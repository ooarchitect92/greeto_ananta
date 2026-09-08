package egress

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

// Scope is resolved by authenticated proxy middleware, not from customer JSON.
type Scope struct{ TenantID, WorkspaceID, EnvironmentID string }

// Attempt is one already-durable F07 delivery attempt. The caller owns retries,
// attempt numbering, signing-key access, durable result storage and cancellation.
// It must not mutate Headers or Body concurrently with Send.
type Attempt struct {
	Scope                      Scope
	EndpointID, AttemptID, URL string
	Headers                    http.Header
	Body                       []byte
}

// Intent is passed to the Action Gateway permit verifier inside the proxy. The
// verifier MUST bind the workload identity (from ctx), scope, endpoint, exact URL,
// delivery/attempt IDs and byte hashes to a live authorized durable attempt/epoch.
// Matching UUIDs or a nil error from an untrusted adapter are not independent proof.
// Check must honor ctx; it checks an existing permit, never allocates a new action.
type Intent struct {
	Scope                                                                      Scope
	EndpointID, AttemptID, DeliveryID, EventID, URL, BodySHA256, HeadersSHA256 string
}
type Authority interface {
	Check(context.Context, Intent) error
}

// Limits is a deployment-approved profile, not tenant-controlled request input.
// No defaults are silently installed. Ports must be explicitly approved; TLS peer
// verification, private-address denial, no redirects and no retry cannot be disabled.
type Limits struct {
	AllowedPorts                                     []uint16
	RequestBytes, ResponseBytes, ResponseHeaderBytes int64
	Timeout                                          time.Duration
	MaxConcurrent, MaxDNSAnswers                     int
}

// Stage is bounded attempt-local telemetry, never a high-cardinality metric label.
// It intentionally omits URL, hostname, body, headers, keys and underlying errors.
type Stage struct {
	Name, Result string
	ElapsedMS    int64
}

// Result describes the HTTPS observation only, not durable ledger or business
// completion. A received 2xx remains accepted even when body collection is bounded
// or fails later. Such errors must not trigger a duplicate send automatically.
type Result struct {
	AttemptID, Outcome, FailureCode string
	StatusCode                      int
	RetryAfter                      string // bounded hint, not an authorization or an automatic schedule
	BodyComplete                    bool
	ResponseBytes                   int64
	Stages                          []Stage
}

// Client is the public-network outbound leg of the approved egress proxy ONLY.
// Runtime deployment must deny direct egress from dispatchers and bind Authority
// to authenticated workload/Action Gateway proof. This package installs no proxy.
// DNS/dial/root injection is private and used only by same-package fixture tests.
type Client struct {
	authority Authority
	limits    Limits
	slots     chan struct{}
	lookup    func(context.Context, string, string) ([]netip.Addr, error)
	dial      func(context.Context, string, string) (net.Conn, error)
	roots     *x509.CertPool
}

// New validates and copies the operator profile without any I/O. It does not grant
// destinations, create records or send probes. Nil/missing authority fails closed.
// params: authority is the trusted permit verifier; limits are bounded host config.
// returns: concurrent-safe client; error codes only. No test adapter fallback.
func New(authority Authority, limits Limits) (*Client, error) {
	if authority == nil || len(limits.AllowedPorts) == 0 || len(limits.AllowedPorts) > 16 ||
		limits.RequestBytes < 1 || limits.RequestBytes > 4<<20 || limits.ResponseBytes < 1 || limits.ResponseBytes > 1<<20 ||
		limits.ResponseHeaderBytes < 256 || limits.ResponseHeaderBytes > 64<<10 || limits.Timeout < 100*time.Millisecond ||
		limits.Timeout > 30*time.Second || limits.MaxConcurrent < 1 || limits.MaxConcurrent > 256 ||
		limits.MaxDNSAnswers < 1 || limits.MaxDNSAnswers > 64 {
		return nil, Fault("EGRESS_CONFIGURATION")
	}
	seen := map[uint16]bool{}
	for _, p := range limits.AllowedPorts {
		if p == 0 || seen[p] {
			return nil, Fault("EGRESS_CONFIGURATION")
		}
		seen[p] = true
	}
	limits.AllowedPorts = append([]uint16(nil), limits.AllowedPorts...)
	dialer := &net.Dialer{}
	return &Client{authority: authority, limits: limits, slots: make(chan struct{}, limits.MaxConcurrent),
		lookup: (&net.Resolver{PreferGo: true, StrictErrors: true}).LookupNetIP, dial: dialer.DialContext}, nil
}

func idOK(id string) bool {
	return uuid.MatchString(id) && id != "00000000-0000-0000-0000-000000000000"
}
func digest(data []byte) string { h := sha256.Sum256(data); return hex.EncodeToString(h[:]) }

// Only the existing five F07 signing headers pass. Host, Cookie, Authorization,
// Connection, Transfer-Encoding and caller-supplied length/compression cannot leak.
func headersFor(input http.Header) (http.Header, error) {
	if len(input) != 5 {
		return nil, Fault("HEADERS_INVALID")
	}
	out := make(http.Header, 5)
	for name, values := range input {
		name = http.CanonicalHeaderKey(name)
		if len(values) != 1 || len(out[name]) != 0 || len(values[0]) > 128 {
			return nil, Fault("HEADERS_INVALID")
		}
		value := values[0]
		ok := false
		switch name {
		case "X-Platform-Event-Id", "X-Platform-Delivery-Id":
			ok = token.MatchString(value)
		case "X-Platform-Key-Id":
			ok = keyToken.MatchString(value)
		case "X-Platform-Timestamp":
			ok = stamp.MatchString(value)
		case "X-Platform-Signature":
			ok = mac.MatchString(value)
		}
		if !ok {
			return nil, Fault("HEADERS_INVALID")
		}
		out[name] = []string{value}
	}
	return out, nil
}

// Send performs AT MOST ONE HTTPS POST after permit checks. It never follows a
// redirect, retries, sleeps, changes a delivery ID or writes a database/Kafka event.
// params: ctx carries verified workload identity and cancellation; attempt is an
// already-signed durable attempt. Signing bytes are copied and sent unchanged.
// returns: header-level endpoint observation + bounded sanitized stage evidence.
// A non-nil error may accompany a real observed 2xx; consult Result.Outcome first.
// Before HTTP could start, faults are blocked. Once HTTP could start and no response
// is observed, faults remain unknown. The caller persists and reconciles the result.
func (c *Client) Send(ctx context.Context, attempt Attempt) (result Result, err error) {
	result = Result{Outcome: "blocked", Stages: []Stage{}}
	if c == nil || ctx == nil {
		result.FailureCode = "EGRESS_CONFIGURATION"
		return result, Fault(result.FailureCode)
	}
	record := func(name, state string, start time.Time) {
		if len(result.Stages) < 16 {
			result.Stages = append(result.Stages, Stage{name, state, time.Since(start).Milliseconds()})
		}
	}
	finish := func(code string) (Result, error) { result.FailureCode = code; return result, Fault(code) }
	if ctx.Err() != nil {
		return finish("CANCELLED")
	}
	select {
	case c.slots <- struct{}{}:
		defer func() { <-c.slots }()
	default:
		return finish("EGRESS_BUSY")
	}
	ctx, cancel := context.WithTimeout(ctx, c.limits.Timeout)
	defer cancel()
	for _, id := range []string{attempt.Scope.TenantID, attempt.Scope.WorkspaceID, attempt.Scope.EnvironmentID, attempt.EndpointID, attempt.AttemptID} {
		if !idOK(id) {
			return finish("SCOPE_INVALID")
		}
	}
	result.AttemptID = attempt.AttemptID
	if int64(len(attempt.Body)) > c.limits.RequestBytes {
		return finish("REQUEST_TOO_LARGE")
	}
	start := time.Now()
	u, host, port, err := Destination(attempt.URL, c.limits.AllowedPorts)
	if err != nil {
		record("destination", "blocked", start)
		return finish(string(err.(Fault)))
	}
	headers, err := headersFor(attempt.Headers)
	if err != nil {
		record("destination", "blocked", start)
		return finish("HEADERS_INVALID")
	}
	body := bytes.Clone(attempt.Body)
	hbytes, _ := json.Marshal(headers) // deterministic sorted string map; values are validated
	intent := Intent{attempt.Scope, attempt.EndpointID, attempt.AttemptID, headers.Get("X-Platform-Delivery-Id"),
		headers.Get("X-Platform-Event-Id"), u.String(), digest(body), digest(hbytes)}
	record("destination", "succeeded", start)
	authorize := func() error {
		start := time.Now()
		if ctx.Err() != nil {
			record("authority", "blocked", start)
			return Fault("CANCELLED")
		}
		if c.authority.Check(ctx, intent) != nil || ctx.Err() != nil {
			record("authority", "blocked", start)
			return Fault("EGRESS_DENIED")
		}
		record("authority", "succeeded", start)
		return nil
	}
	if err = authorize(); err != nil {
		return finish(err.Error())
	}
	// Prepare synchronously under the original bounded context. net/http may detach
	// its dial context from request cancellation; no DNS/TLS goroutine may outlive
	// this call and mutate returned observations. One socket, one DNS answer set.
	start = time.Now()
	answers, e := c.lookup(ctx, "ip", host+".")
	if e != nil || len(answers) == 0 || len(answers) > c.limits.MaxDNSAnswers {
		record("dns", "failed", start)
		return finish("DNS_UNAVAILABLE")
	}
	for _, ip := range answers {
		if !PublicAddress(ip) {
			record("dns", "blocked", start)
			return finish("ADDRESS_BLOCKED")
		}
	}
	record("dns", "succeeded", start)
	if e = authorize(); e != nil {
		return finish(e.Error())
	}
	target := netip.AddrPortFrom(answers[0].Unmap(), port)
	start = time.Now()
	conn, e := c.dial(ctx, "tcp", target.String())
	if e != nil || conn == nil {
		record("connect", "failed", start)
		return finish("CONNECT_FAILED")
	}
	defer conn.Close()
	if conn.RemoteAddr() == nil {
		record("connect", "blocked", start)
		return finish("PEER_MISMATCH")
	}
	actual, e := netip.ParseAddrPort(conn.RemoteAddr().String())
	if e != nil || actual.Addr().Unmap() != target.Addr() || actual.Port() != port {
		record("connect", "blocked", start)
		return finish("PEER_MISMATCH")
	}
	record("connect", "succeeded", start)
	stop := context.AfterFunc(ctx, func() { conn.Close() })
	defer stop()
	tlsConn := tls.Client(conn, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12, RootCAs: c.roots, NextProtos: []string{"http/1.1"}})
	start = time.Now()
	if e = tlsConn.HandshakeContext(ctx); e != nil {
		record("tls", "failed", start)
		return finish("TLS_FAILED")
	}
	record("tls", "succeeded", start)
	if e = authorize(); e != nil {
		return finish(e.Error())
	}
	var handedOff atomic.Bool
	tr := &http.Transport{
		Proxy: nil, DisableKeepAlives: true, DisableCompression: true, ForceAttemptHTTP2: false,
		MaxResponseHeaderBytes: c.limits.ResponseHeaderBytes, ResponseHeaderTimeout: c.limits.Timeout,
		TLSNextProto: map[string]func(string, *tls.Conn) http.RoundTripper{},
		DialTLSContext: func(dialCtx context.Context, network, address string) (net.Conn, error) {
			if ctx.Err() != nil || dialCtx.Err() != nil || network != "tcp" || address != net.JoinHostPort(host, strconv.Itoa(int(port))) || handedOff.Swap(true) {
				return nil, Fault("CONNECTION_NOT_REPLAYABLE")
			}
			return tlsConn, nil
		},
	}
	defer tr.CloseIdleConnections()
	req, e := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), bytes.NewReader(body))
	if e != nil {
		return finish("DESTINATION_INVALID")
	}
	req.Header = headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept-Encoding", "identity")
	req.GetBody = nil // no transparent body replay; no implicit idempotent retry header
	start = time.Now()
	response, e := tr.RoundTrip(req) // RoundTrip never follows Location, including malformed values
	if e != nil {
		if handedOff.Load() {
			result.Outcome = "unknown"
		}
		record("http", result.Outcome, start)
		if ctx.Err() != nil {
			return finish("CANCELLED")
		}
		return finish("HTTP_UNAVAILABLE")
	}
	defer response.Body.Close()
	result.StatusCode = response.StatusCode
	result.Outcome = "not_accepted"
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		result.Outcome = "accepted_by_endpoint"
	}
	record("http", "observed", start)
	result.RetryAfter = retryHint(response.Header.Values("Retry-After"))
	// Identity-only profile prevents decompression bombs instead of trusting declared
	// compression ratios. Never return arbitrary response content to a log or browser.
	start = time.Now()
	enc := response.Header.Values("Content-Encoding")
	if len(enc) > 1 || (len(enc) == 1 && enc[0] != "" && !strings.EqualFold(enc[0], "identity")) {
		record("response", "bounded", start)
		return finish("RESPONSE_ENCODING")
	}
	n, e := io.Copy(io.Discard, io.LimitReader(response.Body, c.limits.ResponseBytes+1))
	result.ResponseBytes = n
	if n > c.limits.ResponseBytes {
		record("response", "bounded", start)
		return finish("RESPONSE_TOO_LARGE")
	}
	if e != nil {
		record("response", "failed", start)
		return finish("RESPONSE_INCOMPLETE")
	}
	result.BodyComplete = true
	record("response", "succeeded", start)
	return result, nil
}

// retryHint exports only a canonical protocol value, never arbitrary endpoint
// text. The scheduler separately enforces the delivery deadline and retry budget.
func retryHint(values []string) string {
	if len(values) != 1 || len(values[0]) > 128 {
		return ""
	}
	raw := strings.TrimSpace(values[0])
	if raw == "" {
		return ""
	}
	digits := true
	for _, r := range raw {
		if r < '0' || r > '9' {
			digits = false
		}
	}
	if digits {
		if len(raw) > 12 {
			return ""
		}
		value, err := strconv.ParseUint(raw, 10, 64)
		if err == nil {
			return strconv.FormatUint(value, 10)
		}
	}
	parsed, err := http.ParseTime(raw)
	if err != nil {
		return ""
	}
	return parsed.UTC().Format(http.TimeFormat)
}

// IsFault supports stable caller error handling without inspecting underlying data.
func IsFault(err error, code string) bool {
	var f Fault
	return errors.As(err, &f) && string(f) == code
}

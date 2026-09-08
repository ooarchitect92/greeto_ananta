package egress

import (
	"bufio"
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/netip"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

type authorityFunc func(context.Context, Intent) error

func (f authorityFunc) Check(ctx context.Context, i Intent) error { return f(ctx, i) }
func limits() Limits                                              { return Limits{[]uint16{443}, 1024, 512, 2048, time.Second, 4, 8} }
func sample() Attempt {
	return Attempt{Scope{"11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "33333333-3333-3333-3333-333333333333"},
		"44444444-4444-4444-4444-444444444444", "55555555-5555-5555-5555-555555555555", "https://hooks.example.com/callback?opaque=value", http.Header{
			"X-Platform-Event-Id": {"event_1"}, "X-Platform-Delivery-Id": {"delivery_1"}, "X-Platform-Timestamp": {"1788800000"},
			"X-Platform-Key-Id": {"key.v1:current"}, "X-Platform-Signature": {"v1=" + strings.Repeat("a", 64)}}, []byte("{\n  \"event_id\": \"event_1\", \"value\": \"é\"\n}")}
}
func client(t *testing.T) *Client {
	t.Helper()
	c, e := New(authorityFunc(func(context.Context, Intent) error { return nil }), limits())
	if e != nil {
		t.Fatal(e)
	}
	return c
}

func TestPublicAddress(t *testing.T) {
	blockedCases := []string{"", "127.0.0.1", "0.1.2.3", "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.2.1",
		"169.254.169.254", "100.64.0.1", "100.127.255.254", "192.0.0.9", "192.0.2.1", "192.31.196.1", "192.52.193.1", "192.88.99.1", "192.175.48.1",
		"198.18.1.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255", "::1", "::", "::ffff:127.0.0.1", "::ffff:10.1.2.3",
		"fe80::1", "fe80::1%eth0", "fc00::1", "fd00:ec2::254", "ff02::1", "64:ff9b::a00:1", "64:ff9b:1::1", "2001::1", "2001:2::1",
		"2001:db8::1", "2002:7f00:1::1", "3fff::1", "2620:4f:8000::1", "5f00::1"}
	for _, s := range blockedCases {
		t.Run("deny_"+s, func(t *testing.T) {
			ip, _ := netip.ParseAddr(s)
			if PublicAddress(ip) {
				t.Fatalf("accepted %s", s)
			}
		})
	}
	for _, s := range []string{"1.1.1.1", "8.8.8.8", "172.15.255.255", "172.32.0.1", "100.128.0.1", "::ffff:8.8.8.8", "2606:4700:4700::1111", "2001:4860:4860::8888"} {
		t.Run("public_"+s, func(t *testing.T) {
			if !PublicAddress(netip.MustParseAddr(s)) {
				t.Fatal(s)
			}
		})
	}
}
func TestDestination(t *testing.T) {
	invalid := []string{"", "http://hooks.example.com/", "https://127.0.0.1", "https://[::1]", "https://user:secret@hooks.example.com",
		"https://hooks.example.com/#secret", "https://hooks.example.com#", "https://hooks.example.com:0443/", "https://hooks.example.com:/",
		"https://hooks.example.com:65536/", "https://hooks.example.com:80/", "https://hooks.example.com:0/", "https://hooks.example.com./",
		"https://x.local/", "https://x.internal/", "https://x.localhost/", "https://localhost/", "https://x.home/", "https://x.arpa/",
		"https://2130706433/", "https://0177.0.0.1/", "https://0x7f000001/", "https://x.123/", "https://ho_oks.example.com/",
		"https://hooks.example.com\\@evil.com/", "https://hooks.example.com/\r\nHost:x", "https://hooks.example.com/a b",
		"https://hóoks.example.com/", "https://%31%32%37.0.0.1/", "https://-x.example.com/", "https://x..example.com/", strings.Repeat("a", 2049)}
	for _, s := range invalid {
		t.Run(s, func(t *testing.T) {
			u, _, _, e := Destination(s, []uint16{443})
			if e == nil || u != nil {
				t.Fatal("not rejected", s)
			}
		})
	}
	t.Run("canonical_binding", func(t *testing.T) {
		u, h, p, e := Destination("https://HOOKS.example.com:443", []uint16{443})
		if e != nil || u.String() != "https://hooks.example.com/" || h != "hooks.example.com" || p != 443 {
			t.Fatal(u, h, p, e)
		}
	})
	t.Run("explicit_port", func(t *testing.T) {
		u, _, p, e := Destination("https://hooks.example.com:8443/a%2fb?q=x%26y", []uint16{8443})
		if e != nil || p != 8443 || u.RawPath != "/a%2fb" || u.RawQuery != "q=x%26y" {
			t.Fatal(u, e)
		}
	})
}
func TestProfiles(t *testing.T) {
	cases := map[string]func(*Limits){"no_ports": func(l *Limits) { l.AllowedPorts = nil }, "duplicate_port": func(l *Limits) { l.AllowedPorts = []uint16{443, 443} }, "zero_port": func(l *Limits) { l.AllowedPorts = []uint16{0} },
		"request": func(l *Limits) { l.RequestBytes = 0 }, "response": func(l *Limits) { l.ResponseBytes = 0 }, "headers": func(l *Limits) { l.ResponseHeaderBytes = 100000 }, "timeout": func(l *Limits) { l.Timeout = 0 }, "too_long": func(l *Limits) { l.Timeout = time.Minute }, "concurrency": func(l *Limits) { l.MaxConcurrent = 0 }, "dns": func(l *Limits) { l.MaxDNSAnswers = 0 }}
	for name, patch := range cases {
		t.Run(name, func(t *testing.T) {
			l := limits()
			patch(&l)
			_, e := New(authorityFunc(func(context.Context, Intent) error { return nil }), l)
			if !IsFault(e, "EGRESS_CONFIGURATION") {
				t.Fatal(e)
			}
		})
	}
	t.Run("nil_authority", func(t *testing.T) {
		if _, e := New(nil, limits()); e == nil {
			t.Fatal("accepted")
		}
	})
	t.Run("profile_copied", func(t *testing.T) {
		l := limits()
		c, e := New(authorityFunc(func(context.Context, Intent) error { return nil }), l)
		l.AllowedPorts[0] = 80
		if e != nil || c.limits.AllowedPorts[0] != 443 {
			t.Fatal("aliased")
		}
	})
}
func TestRequestGuards(t *testing.T) {
	cases := map[string]func(*Attempt){"scope": func(a *Attempt) { a.Scope.TenantID = "bad" }, "nil_uuid": func(a *Attempt) { a.EndpointID = strings.Repeat("0", 8) + "-0000-0000-0000-000000000000" }, "attempt_injection": func(a *Attempt) { a.AttemptID = "unsafe\nsecret" }, "body_limit": func(a *Attempt) { a.Body = make([]byte, 1025) },
		"extra_auth": func(a *Attempt) { a.Headers["Authorization"] = []string{"Bearer private"} }, "missing": func(a *Attempt) { a.Headers.Del("X-Platform-Key-Id") }, "duplicate": func(a *Attempt) { a.Headers.Add("X-Platform-Key-Id", "other") },
		"case_duplicate": func(a *Attempt) {
			delete(a.Headers, "X-Platform-Event-Id")
			a.Headers["x-platform-key-id"] = []string{"other"}
		}, "signature": func(a *Attempt) { a.Headers.Set("X-Platform-Signature", "v1=oops") },
		"header_injection": func(a *Attempt) { a.Headers.Set("X-Platform-Key-Id", "key\r\nHost:evil") }, "delivery_dot": func(a *Attempt) { a.Headers.Set("X-Platform-Delivery-Id", "delivery.1") }}
	for name, patch := range cases {
		t.Run(name, func(t *testing.T) {
			a := sample()
			patch(&a)
			c := client(t)
			c.lookup = func(context.Context, string, string) ([]netip.Addr, error) { t.Fatal("DNS ran"); return nil, nil }
			r, e := c.Send(context.Background(), a)
			if e == nil || r.Outcome != "blocked" {
				t.Fatal(r, e)
			}
			if strings.Contains(r.AttemptID, "\n") {
				t.Fatal("unsafe identifier echoed")
			}
		})
	}
	t.Run("cancelled", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		r, e := client(t).Send(ctx, sample())
		if !IsFault(e, "CANCELLED") || r.Outcome != "blocked" {
			t.Fatal(r, e)
		}
	})
	t.Run("nil_context", func(t *testing.T) {
		_, e := client(t).Send(nil, sample())
		if !IsFault(e, "EGRESS_CONFIGURATION") {
			t.Fatal(e)
		}
	})
	t.Run("nil_client", func(t *testing.T) {
		var c *Client
		_, e := c.Send(context.Background(), sample())
		if !IsFault(e, "EGRESS_CONFIGURATION") {
			t.Fatal(e)
		}
	})
	t.Run("bounded_concurrency", func(t *testing.T) {
		c := client(t)
		for i := 0; i < c.limits.MaxConcurrent; i++ {
			c.slots <- struct{}{}
		}
		_, e := c.Send(context.Background(), sample())
		if !IsFault(e, "EGRESS_BUSY") {
			t.Fatal(e)
		}
	})
}

// The fixture uses real Go TLS and HTTP parsing over in-memory sockets. A PRIVATE
// test dialer maps a vetted public address to net.Pipe; production exposes no dial,
// root or private-IP override. It proves code behavior, not deployed DNS/firewall.
type testAddr string

func (a testAddr) Network() string { return "tcp" }
func (a testAddr) String() string  { return string(a) }

type peerConn struct {
	net.Conn
	peer string
}

func (c peerConn) RemoteAddr() net.Addr { return testAddr(c.peer) }

var certOnce sync.Once
var testCertificate tls.Certificate
var testRoots *x509.CertPool

func certificate(t *testing.T) (tls.Certificate, *x509.CertPool) {
	t.Helper()
	certOnce.Do(func() {
		key, e := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if e != nil {
			panic(e)
		}
		tmpl := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "fixture"}, DNSNames: []string{"hooks.example.com"}, NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour), KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}, IsCA: true, BasicConstraintsValid: true}
		der, e := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
		if e != nil {
			panic(e)
		}
		leaf, e := x509.ParseCertificate(der)
		if e != nil {
			panic(e)
		}
		testCertificate = tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key, Leaf: leaf}
		testRoots = x509.NewCertPool()
		testRoots.AddCert(leaf)
	})
	return testCertificate, testRoots.Clone()
}
func wire(t *testing.T, c *Client, handle func(*http.Request, net.Conn)) (*atomic.Int32, *atomic.Int32) {
	t.Helper()
	cert, roots := certificate(t)
	c.roots = roots
	dns, dials := &atomic.Int32{}, &atomic.Int32{}
	c.lookup = func(ctx context.Context, network, host string) ([]netip.Addr, error) {
		dns.Add(1)
		if network != "ip" || host != "hooks.example.com." {
			return nil, errors.New("unexpected name")
		}
		return []netip.Addr{netip.MustParseAddr("8.8.8.8")}, nil
	}
	var wg sync.WaitGroup
	c.dial = func(ctx context.Context, network, address string) (net.Conn, error) {
		dials.Add(1)
		if address != "8.8.8.8:443" {
			return nil, errors.New("not pinned")
		}
		a, b := net.Pipe()
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer b.Close()
			s := tls.Server(b, &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12})
			if e := s.HandshakeContext(ctx); e != nil {
				return
			}
			req, e := http.ReadRequest(bufio.NewReader(s))
			if e != nil {
				return
			}
			handle(req, s)
		}()
		return peerConn{a, address}, nil
	}
	t.Cleanup(func() {
		done := make(chan struct{})
		go func() { wg.Wait(); close(done) }()
		select {
		case <-done:
		case <-time.After(2 * time.Second):
			t.Error("fixture connection leaked")
		}
	})
	return dns, dials
}
func respond(req *http.Request, conn net.Conn, status int, headers, body string) {
	io.Copy(io.Discard, req.Body)
	fmt.Fprintf(conn, "HTTP/1.1 %d result\r\nContent-Length: %d\r\n%s\r\n%s", status, len(body), headers, body)
}

func TestWireSemantics(t *testing.T) {
	for _, status := range []int{200, 202, 204, 299, 301, 302, 307, 308, 400, 401, 403, 404, 410, 429, 500, 503} {
		t.Run(fmt.Sprintf("status_%d", status), func(t *testing.T) {
			c := client(t)
			dns, dials := wire(t, c, func(r *http.Request, s net.Conn) {
				respond(r, s, status, "Location: http://127.0.0.1/secret\r\nRetry-After: 10\r\n", "")
			})
			r, e := c.Send(context.Background(), sample())
			want := "not_accepted"
			if status < 300 {
				want = "accepted_by_endpoint"
			}
			if e != nil || r.StatusCode != status || r.Outcome != want || !r.BodyComplete || dns.Load() != 1 || dials.Load() != 1 || r.RetryAfter != "10" {
				t.Fatal(r, e, dns.Load(), dials.Load())
			}
		})
	}
	t.Run("exact_signed_bytes_and_bound_intent", func(t *testing.T) {
		a := sample()
		wantBody := bytes.Clone(a.Body)
		wantHeaders := a.Headers.Clone()
		var intents []Intent
		seen := make(chan string, 1)
		c := client(t)
		c.authority = authorityFunc(func(ctx context.Context, i Intent) error {
			intents = append(intents, i)
			a.Body[0] = '!'
			a.Headers.Set("X-Platform-Key-Id", "mutated")
			return nil
		})
		wire(t, c, func(r *http.Request, s net.Conn) {
			body, _ := io.ReadAll(r.Body)
			if !bytes.Equal(body, wantBody) || r.Host != "hooks.example.com" || r.Method != "POST" || r.Header.Get("Accept-Encoding") != "identity" {
				seen <- "request changed"
			} else {
				for k, v := range wantHeaders {
					if r.Header.Get(k) != v[0] {
						seen <- "headers changed"
						return
					}
				}
				seen <- "ok"
			}
			respond(r, s, 202, "", "")
		})
		r, e := c.Send(context.Background(), a)
		if e != nil || r.Outcome != "accepted_by_endpoint" || <-seen != "ok" {
			t.Fatal(r, e)
		}
		if len(intents) != 3 || !reflect.DeepEqual(intents[0], intents[2]) || intents[0].BodySHA256 != digest(wantBody) {
			t.Fatal("binding mismatch", len(intents))
		}
	})
	t.Run("no_environment_proxy", func(t *testing.T) {
		t.Setenv("HTTPS_PROXY", "http://127.0.0.1:1")
		c := client(t)
		_, n := wire(t, c, func(r *http.Request, s net.Conn) { respond(r, s, 200, "", "") })
		r, e := c.Send(context.Background(), sample())
		if e != nil || n.Load() != 1 || r.StatusCode != 200 {
			t.Fatal(r, e)
		}
	})
	t.Run("malformed_redirect_is_not_followed", func(t *testing.T) {
		c := client(t)
		_, n := wire(t, c, func(r *http.Request, s net.Conn) { respond(r, s, 302, "Location: http://%zz\r\n", "") })
		r, e := c.Send(context.Background(), sample())
		if e != nil || n.Load() != 1 || r.StatusCode != 302 {
			t.Fatal(r, e)
		}
	})
	t.Run("connection_lost_is_unknown", func(t *testing.T) {
		c := client(t)
		_, n := wire(t, c, func(r *http.Request, s net.Conn) { io.Copy(io.Discard, r.Body) })
		r, e := c.Send(context.Background(), sample())
		if e == nil || r.Outcome != "unknown" || r.StatusCode != 0 || n.Load() != 1 {
			t.Fatal(r, e)
		}
	})
	t.Run("untrusted_certificate_fails_closed", func(t *testing.T) {
		c := client(t)
		wire(t, c, func(r *http.Request, s net.Conn) { t.Error("HTTP reached untrusted peer") })
		c.roots = x509.NewCertPool()
		r, e := c.Send(context.Background(), sample())
		if !IsFault(e, "TLS_FAILED") || r.Outcome != "blocked" {
			t.Fatal(r, e)
		}
	})
	t.Run("hostname_mismatch", func(t *testing.T) {
		c := client(t)
		wire(t, c, func(r *http.Request, s net.Conn) { t.Error("HTTP reached wrong hostname") })
		c.lookup = func(context.Context, string, string) ([]netip.Addr, error) {
			return []netip.Addr{netip.MustParseAddr("8.8.8.8")}, nil
		}
		a := sample()
		a.URL = "https://wrong.example.com/"
		r, e := c.Send(context.Background(), a)
		if !IsFault(e, "TLS_FAILED") || r.Outcome != "blocked" {
			t.Fatal(r, e)
		}
	})
	for _, tc := range []struct{ name, headers, body, code string }{{"compressed", "Content-Encoding: gzip\r\n", "compressed", "RESPONSE_ENCODING"}, {"multiple_encoding", "Content-Encoding: identity\r\nContent-Encoding: gzip\r\n", "x", "RESPONSE_ENCODING"}, {"oversize", "", strings.Repeat("x", 513), "RESPONSE_TOO_LARGE"}} {
		t.Run(tc.name, func(t *testing.T) {
			c := client(t)
			wire(t, c, func(r *http.Request, s net.Conn) { respond(r, s, 202, tc.headers, tc.body) })
			r, e := c.Send(context.Background(), sample())
			if !IsFault(e, tc.code) || r.Outcome != "accepted_by_endpoint" || r.BodyComplete || r.StatusCode != 202 {
				t.Fatal(r, e)
			}
		})
	}
	t.Run("body_exact_limit", func(t *testing.T) {
		c := client(t)
		wire(t, c, func(r *http.Request, s net.Conn) { respond(r, s, 200, "", strings.Repeat("x", 512)) })
		r, e := c.Send(context.Background(), sample())
		if e != nil || !r.BodyComplete || r.ResponseBytes != 512 {
			t.Fatal(r, e)
		}
	})
	t.Run("truncated_body_retains_ack", func(t *testing.T) {
		c := client(t)
		wire(t, c, func(r *http.Request, s net.Conn) {
			io.Copy(io.Discard, r.Body)
			io.WriteString(s, "HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\nx")
		})
		r, e := c.Send(context.Background(), sample())
		if !IsFault(e, "RESPONSE_INCOMPLETE") || r.Outcome != "accepted_by_endpoint" {
			t.Fatal(r, e)
		}
	})
	t.Run("header_bytes_bounded", func(t *testing.T) {
		c := client(t)
		wire(t, c, func(r *http.Request, s net.Conn) {
			respond(r, s, 200, "X-Padding: "+strings.Repeat("x", 4096)+"\r\n", "")
		})
		r, e := c.Send(context.Background(), sample())
		if e == nil || r.Outcome != "unknown" {
			t.Fatal(r, e)
		}
	})
	t.Run("duplicate_retry_hint_withheld", func(t *testing.T) {
		c := client(t)
		wire(t, c, func(r *http.Request, s net.Conn) { respond(r, s, 429, "Retry-After: 10\r\nRetry-After: 20\r\n", "") })
		r, e := c.Send(context.Background(), sample())
		if e != nil || r.RetryAfter != "" {
			t.Fatal(r, e)
		}
	})
	t.Run("cancellation_closes_response", func(t *testing.T) {
		c := client(t)
		c.limits.Timeout = 100 * time.Millisecond
		wire(t, c, func(r *http.Request, s net.Conn) {
			io.Copy(io.Discard, r.Body)
			io.WriteString(s, "HTTP/1.1 202 Accepted\r\nContent-Length: 999\r\n\r\n")
			io.Copy(io.Discard, s)
		})
		start := time.Now()
		r, e := c.Send(context.Background(), sample())
		if e == nil || time.Since(start) > time.Second || r.Outcome != "accepted_by_endpoint" {
			t.Fatal(r, e)
		}
	})
}
func TestAuthorityDNSAndPeer(t *testing.T) {
	t.Run("denied_before_dns", func(t *testing.T) {
		c := client(t)
		c.authority = authorityFunc(func(context.Context, Intent) error { return errors.New("secret_denial") })
		c.lookup = func(context.Context, string, string) ([]netip.Addr, error) { t.Fatal("DNS ran"); return nil, nil }
		r, e := c.Send(context.Background(), sample())
		if !IsFault(e, "EGRESS_DENIED") || strings.Contains(fmt.Sprint(r, e), "secret_denial") {
			t.Fatal(r, e)
		}
	})
	for _, tc := range []struct {
		name    string
		answers []netip.Addr
	}{{"none", nil}, {"mixed_v4", []netip.Addr{netip.MustParseAddr("8.8.8.8"), netip.MustParseAddr("10.0.0.1")}}, {"mixed_v6", []netip.Addr{netip.MustParseAddr("8.8.8.8"), netip.MustParseAddr("fd00:ec2::254")}}, {"too_many", make([]netip.Addr, 9)}} {
		t.Run(tc.name, func(t *testing.T) {
			c := client(t)
			c.lookup = func(context.Context, string, string) ([]netip.Addr, error) { return tc.answers, nil }
			c.dial = func(context.Context, string, string) (net.Conn, error) { t.Fatal("dial ran"); return nil, nil }
			r, e := c.Send(context.Background(), sample())
			if e == nil || r.Outcome != "blocked" {
				t.Fatal(r, e)
			}
		})
	}
	t.Run("resolver_error_redacted", func(t *testing.T) {
		c := client(t)
		c.lookup = func(context.Context, string, string) ([]netip.Addr, error) {
			return nil, errors.New("sensitive DNS payload")
		}
		r, e := c.Send(context.Background(), sample())
		if !IsFault(e, "DNS_UNAVAILABLE") || strings.Contains(fmt.Sprint(r, e), "sensitive") {
			t.Fatal(r, e)
		}
	})
	t.Run("revoked_after_resolution", func(t *testing.T) {
		c := client(t)
		dns, _ := wire(t, c, func(r *http.Request, s net.Conn) { t.Error("HTTP reached") })
		n := 0
		c.authority = authorityFunc(func(context.Context, Intent) error {
			n++
			if n > 1 {
				return errors.New("revoked")
			}
			return nil
		})
		r, e := c.Send(context.Background(), sample())
		if !IsFault(e, "EGRESS_DENIED") || dns.Load() != 1 || r.Outcome != "blocked" {
			t.Fatal(r, e)
		}
	})
	t.Run("revoked_after_tls", func(t *testing.T) {
		c := client(t)
		wire(t, c, func(r *http.Request, s net.Conn) { t.Error("HTTP reached") })
		n := 0
		c.authority = authorityFunc(func(context.Context, Intent) error {
			n++
			if n == 3 {
				return errors.New("revoked")
			}
			return nil
		})
		r, e := c.Send(context.Background(), sample())
		if !IsFault(e, "EGRESS_DENIED") || r.Outcome != "blocked" {
			t.Fatal(r, e)
		}
	})
	t.Run("peer_mismatch", func(t *testing.T) {
		c := client(t)
		c.lookup = func(context.Context, string, string) ([]netip.Addr, error) {
			return []netip.Addr{netip.MustParseAddr("8.8.8.8")}, nil
		}
		c.dial = func(context.Context, string, string) (net.Conn, error) {
			a, b := net.Pipe()
			b.Close()
			return peerConn{a, "127.0.0.1:443"}, nil
		}
		r, e := c.Send(context.Background(), sample())
		if !IsFault(e, "PEER_MISMATCH") || r.Outcome != "blocked" {
			t.Fatal(r, e)
		}
	})
	t.Run("rebinding_new_attempt_new_resolution", func(t *testing.T) {
		c := client(t)
		_, n := wire(t, c, func(r *http.Request, s net.Conn) { respond(r, s, 200, "", "") })
		r, e := c.Send(context.Background(), sample())
		if e != nil || r.StatusCode != 200 {
			t.Fatal(r, e)
		}
		c.lookup = func(context.Context, string, string) ([]netip.Addr, error) {
			return []netip.Addr{netip.MustParseAddr("169.254.169.254")}, nil
		}
		r, e = c.Send(context.Background(), sample())
		if !IsFault(e, "ADDRESS_BLOCKED") || n.Load() != 1 {
			t.Fatal(r, e)
		}
	})
	t.Run("dial_error_redacted", func(t *testing.T) {
		c := client(t)
		c.lookup = func(context.Context, string, string) ([]netip.Addr, error) {
			return []netip.Addr{netip.MustParseAddr("8.8.8.8")}, nil
		}
		c.dial = func(context.Context, string, string) (net.Conn, error) { return nil, errors.New("secret_socket") }
		r, e := c.Send(context.Background(), sample())
		if !IsFault(e, "CONNECT_FAILED") || strings.Contains(fmt.Sprint(r, e), "secret_socket") {
			t.Fatal(r, e)
		}
	})
	t.Run("telemetry_order_minimized", func(t *testing.T) {
		c := client(t)
		wire(t, c, func(r *http.Request, s net.Conn) { respond(r, s, 200, "Set-Cookie: private\r\n", "sensitive response") })
		r, e := c.Send(context.Background(), sample())
		if e != nil {
			t.Fatal(e)
		}
		var names []string
		for _, s := range r.Stages {
			names = append(names, s.Name)
			if s.ElapsedMS < 0 {
				t.Fatal(s)
			}
		}
		if !reflect.DeepEqual(names, []string{"destination", "authority", "dns", "authority", "connect", "tls", "authority", "http", "response"}) {
			t.Fatal(names)
		}
		for _, secret := range []string{"sensitive", "private", "opaque", "key.v1", "v1="} {
			if strings.Contains(fmt.Sprint(r), secret) {
				t.Fatal("leaked", secret)
			}
		}
	})
}

func FuzzDestination(f *testing.F) {
	for _, s := range []string{"https://hooks.example.com/", "https://127.0.0.1/", "https://[::ffff:127.0.0.1]/", "https://x.internal/"} {
		f.Add(s)
	}
	f.Fuzz(func(t *testing.T, s string) {
		u, h, p, e := Destination(s, []uint16{443})
		if e == nil && (u.Scheme != "https" || u.User != nil || u.Fragment != "" || h == "" || p != 443) {
			t.Fatal("unsafe destination")
		}
	})
}

func TestRetryHints(t *testing.T) {
	cases := []struct {
		name   string
		values []string
		want   string
	}{
		{"missing", nil, ""}, {"duplicate", []string{"10", "20"}, ""},
		{"canonical_delta", []string{"00010"}, "10"}, {"zero", []string{"0"}, "0"},
		{"secret_withheld", []string{"Bearer customer-secret"}, ""},
		{"long_withheld", []string{strings.Repeat("1", 129)}, ""},
		{"negative", []string{"-10"}, ""}, {"injection", []string{"10\r\nX-Token: private"}, ""},
		{"date", []string{"Tue, 08 Sep 2026 05:00:00 GMT"}, "Tue, 08 Sep 2026 05:00:00 GMT"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := retryHint(c.values); got != c.want {
				t.Fatal(got, c.want)
			}
		})
	}
}

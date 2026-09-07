// Package signing implements only the F07 customer-webhook v1 proof contract.
// It does not verify Meta/Telegram callbacks, authorize a tenant, send HTTP,
// claim a replay receipt, or acknowledge durable acceptance. Those owners remain
// separate. Keys must come from the authenticated endpoint/environment context.
package signing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
)

// Stable errors contain no headers, keys or payload fragments. Hosts map proof
// rejection to a neutral response; a configuration error is an operator fault.
var (
	ErrConfig = errors.New("WEBHOOK_SIGNING_CONFIG_INVALID")
	ErrProof  = errors.New("WEBHOOK_PROOF_INVALID")
)

const (
	EventHeader     = "X-Platform-Event-Id"
	DeliveryHeader  = "X-Platform-Delivery-Id"
	TimestampHeader = "X-Platform-Timestamp"
	KeyHeader       = "X-Platform-Key-Id"
	SignatureHeader = "X-Platform-Signature"
	maxUnix         = int64(9999999999)
)

var (
	// A delivery ID cannot contain the '.' framing delimiter. UUIDs and the
	// baseline's opaque example IDs are accepted without numeric coercion.
	identity  = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_:-]{0,127}$`)
	keyID     = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$`)
	timestamp = regexp.MustCompile(`^(0|[1-9][0-9]{0,9})$`)
	signature = regexp.MustCompile(`^v1=[0-9a-f]{64}$`)
)

// Policy is supplied by endpoint configuration, never webhook headers. No
// default replay window is silently chosen. Limits bound CPU/memory only and
// are not evidence that a production endpoint or retention policy is approved.
type Policy struct {
	MaxAgeSeconds        int64
	MaxFutureSkewSeconds int64
	MaxBodyBytes         int
}

// KeyVersion describes a route-owned current or previous key. Time intervals
// are [NotBefore, SignUntil) for attempts and [NotBefore, VerifyUntil) for
// verification. Rotation stops old signing before bounded verification overlap
// ends. Revocation takes precedence over both intervals. Do not log this struct.
// Callers must not mutate Secret concurrently with Sign or Verify.
type KeyVersion struct {
	ID          string
	Secret      []byte
	NotBefore   int64
	SignUntil   int64
	VerifyUntil int64
	Revoked     bool
}

// Proof reports authentication of exact bytes and delivery identity only. The
// unsigned EventHeader is intentionally absent. Consumers must validate an event
// ID in the authenticated body and compare that to the header before using it.
// Retain DeliveryID + BodySHA256 in an endpoint-scoped durable receipt to detect
// same-delivery/different-body conflicts; the timestamp is NOT a deduplication key.
type Proof struct {
	DeliveryID  string `json:"delivery_id"`
	KeyID       string `json:"key_id"`
	AttemptedAt int64  `json:"attempted_at"`
	BodySHA256  string `json:"body_sha256"`
}

func validPolicy(p Policy, now int64) bool {
	return now >= 0 && now <= maxUnix && p.MaxAgeSeconds >= 1 &&
		p.MaxAgeSeconds <= 86400 && p.MaxFutureSkewSeconds >= 0 &&
		p.MaxFutureSkewSeconds <= p.MaxAgeSeconds && p.MaxBodyBytes >= 1 && p.MaxBodyBytes <= 1048576
}

func validKey(k KeyVersion) bool {
	return keyID.MatchString(k.ID) && len(k.Secret) >= 32 && len(k.Secret) <= 4096 &&
		k.NotBefore >= 0 && k.NotBefore < k.SignUntil && k.SignUntil <= k.VerifyUntil && k.VerifyUntil <= maxUnix
}

func mac(body []byte, deliveryID, at string, secret []byte) []byte {
	h := hmac.New(sha256.New, secret)
	_, _ = h.Write([]byte(at + "." + deliveryID + "."))
	_, _ = h.Write(body)
	return h.Sum(nil)
}

// Sign authenticates timestamp + '.' + deliveryID + '.' + exact raw body.
// body: serialized once by the caller; send these SAME bytes, not a JSON rebuild.
// eventID/deliveryID: stable IDs from an authorized durable delivery record, not
// caller-supplied tenant authority. A retry keeps deliveryID but gets a fresh now.
// key/policy/now: route-owned key, explicit limits and trusted Unix-second clock.
// Returns the five F07 headers or a stable error. No I/O, ledger write, logging,
// acknowledgement, key generation or runtime registration occurs here.
func Sign(body []byte, eventID, deliveryID string, key KeyVersion, now int64, policy Policy) (http.Header, error) {
	if !validPolicy(policy, now) || !validKey(key) {
		return nil, ErrConfig
	}
	if len(body) > policy.MaxBodyBytes || !identity.MatchString(eventID) || !identity.MatchString(deliveryID) ||
		key.Revoked || now < key.NotBefore || now >= key.SignUntil {
		return nil, ErrProof
	}
	at := strconv.FormatInt(now, 10)
	headers := make(http.Header, 5)
	headers.Set(EventHeader, eventID)
	headers.Set(DeliveryHeader, deliveryID)
	headers.Set(TimestampHeader, at)
	headers.Set(KeyHeader, key.ID)
	headers.Set(SignatureHeader, "v1="+hex.EncodeToString(mac(body, deliveryID, at, key.Secret)))
	return headers, nil
}

// one rejects duplicates, including differently cased map keys. Calling Header.Get
// alone would hide repeated security headers. HTTP adapters must preserve duplicates.
func one(headers http.Header, name string) (string, bool) {
	value, count := "", 0
	for k, values := range headers {
		if strings.EqualFold(k, name) {
			count += len(values)
			if len(values) > 0 {
				value = values[0]
			}
		}
	}
	return value, count == 1
}

// Verify checks exact proof framing, key validity/rotation/revocation, a bounded
// trusted-clock window and constant-time MAC equality. keys is the endpoint's
// already authorized ring of one or two keys; NEVER resolve a URL/key from headers.
// body/headers are bounded untrusted request bytes; now and policy are host values.
// Returns authenticated delivery metadata, NOT replay protection, a durable ACK,
// a validated event schema, or business completion. All proof failures are neutral.
// The caller must not send 2xx until its separate durable acceptance boundary passes.
func Verify(body []byte, headers http.Header, keys []KeyVersion, now int64, policy Policy) (Proof, error) {
	empty := Proof{}
	if !validPolicy(policy, now) || len(keys) < 1 || len(keys) > 2 {
		return empty, ErrConfig
	}
	for i, k := range keys {
		if !validKey(k) {
			return empty, ErrConfig
		}
		for j := 0; j < i; j++ {
			if k.ID == keys[j].ID || hmac.Equal(k.Secret, keys[j].Secret) {
				return empty, ErrConfig
			}
		}
	}
	if len(body) > policy.MaxBodyBytes || len(headers) > 128 {
		return empty, ErrProof
	}
	event, a := one(headers, EventHeader)
	delivery, b := one(headers, DeliveryHeader)
	at, c := one(headers, TimestampHeader)
	kid, d := one(headers, KeyHeader)
	sig, e := one(headers, SignatureHeader)
	if !a || !b || !c || !d || !e || !identity.MatchString(event) || !identity.MatchString(delivery) ||
		!timestamp.MatchString(at) || !keyID.MatchString(kid) || !signature.MatchString(sig) {
		return empty, ErrProof
	}
	t, err := strconv.ParseInt(at, 10, 64)
	if err != nil || t > maxUnix || (t <= now && now-t > policy.MaxAgeSeconds) ||
		(t > now && t-now > policy.MaxFutureSkewSeconds) {
		return empty, ErrProof
	}
	var selected *KeyVersion
	for i := range keys {
		if keys[i].ID == kid {
			selected = &keys[i]
		}
	}
	if selected == nil || selected.Revoked || t < selected.NotBefore || t >= selected.SignUntil ||
		now < selected.NotBefore || now >= selected.VerifyUntil {
		return empty, ErrProof
	}
	supplied, _ := hex.DecodeString(sig[3:]) // shape already checked; fixed 32-byte input
	if !hmac.Equal(supplied, mac(body, delivery, at, selected.Secret)) {
		return empty, ErrProof
	}
	digest := sha256.Sum256(body)
	return Proof{DeliveryID: delivery, KeyID: kid, AttemptedAt: t, BodySHA256: hex.EncodeToString(digest[:])}, nil
}

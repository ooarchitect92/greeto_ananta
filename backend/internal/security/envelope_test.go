package security

import (
	"bytes"
	"context"
	"crypto/rand"
	"errors"
	"testing"
)

// This fake is confined to _test.go; it is not a deployable key-management service.
type fakeKMS struct {
	key  []byte
	fail bool
}

func (k *fakeKMS) Generate(context.Context, string, Scope) ([]byte, []byte, error) {
	if k.fail {
		return nil, nil, errors.New("kms unavailable")
	}
	k.key = make([]byte, 32)
	_, _ = rand.Read(k.key)
	return append([]byte(nil), k.key...), []byte("test-wrapped-key"), nil
}
func (k *fakeKMS) Unwrap(context.Context, string, []byte, Scope) ([]byte, error) {
	if k.fail {
		return nil, errors.New("kms unavailable")
	}
	return append([]byte(nil), k.key...), nil
}
func fixtureScope() Scope {
	return Scope{TenantID: "tenant-a", WorkspaceID: "workspace-a", EnvironmentID: "sandbox", Purpose: "customer.email"}
}
func TestEnvelopeRoundTrip(t *testing.T) {
	k := &fakeKMS{}
	s := fixtureScope()
	plain := []byte("synthetic-data")
	e, err := Encrypt(context.Background(), k, "kms-ref", s, plain)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := Decrypt(context.Background(), k, s, e)
	if err != nil || !bytes.Equal(decoded, plain) {
		t.Fatal("roundtrip")
	}
	if bytes.Contains(e.Ciphertext, plain) {
		t.Fatal("plaintext stored")
	}
}
func TestEnvelopeBindsAllScopeFields(t *testing.T) {
	for _, field := range []string{"tenant", "workspace", "environment", "purpose", "key"} {
		t.Run(field, func(t *testing.T) {
			k := &fakeKMS{}
			s := fixtureScope()
			e, _ := Encrypt(context.Background(), k, "kms-ref", s, []byte("synthetic"))
			switch field {
			case "tenant":
				s.TenantID = "tenant-b"
			case "workspace":
				s.WorkspaceID = "workspace-b"
			case "environment":
				s.EnvironmentID = "production"
			case "purpose":
				s.Purpose = "other"
			case "key":
				e.KeyRef = "another-key"
			}
			if _, err := Decrypt(context.Background(), k, s, e); err == nil {
				t.Fatal("scope transplant succeeded")
			}
		})
	}
}
func TestEnvelopeTamperAndMalformedInputs(t *testing.T) {
	for _, field := range []string{"ciphertext", "nonce", "version", "algorithm", "size"} {
		t.Run(field, func(t *testing.T) {
			k := &fakeKMS{}
			s := fixtureScope()
			e, _ := Encrypt(context.Background(), k, "kms-ref", s, []byte("synthetic"))
			switch field {
			case "ciphertext":
				e.Ciphertext[0] ^= 1
			case "nonce":
				e.Nonce = nil
			case "version":
				e.Version = 2
			case "algorithm":
				e.Algorithm = "plaintext"
			case "size":
				e.Ciphertext = make([]byte, (1<<20)+17)
			}
			if _, err := Decrypt(context.Background(), k, s, e); err == nil {
				t.Fatal("tamper accepted")
			}
		})
	}
}
func TestEnvelopeKMSOutageAndCancellationFailClosed(t *testing.T) {
	k := &fakeKMS{fail: true}
	if _, err := Encrypt(context.Background(), k, "kms-ref", fixtureScope(), []byte("x")); err == nil {
		t.Fatal("kms outage ignored")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := Encrypt(ctx, &fakeKMS{}, "kms-ref", fixtureScope(), []byte("x")); err == nil {
		t.Fatal("cancellation ignored")
	}
}
func TestEnvelopeUsesFreshNonces(t *testing.T) {
	k := &fakeKMS{}
	e1, _ := Encrypt(context.Background(), k, "kms-ref", fixtureScope(), []byte("x"))
	e2, _ := Encrypt(context.Background(), k, "kms-ref", fixtureScope(), []byte("x"))
	if bytes.Equal(e1.Nonce, e2.Nonce) {
		t.Fatal("nonce reused")
	}
}

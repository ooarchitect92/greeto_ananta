package ingress

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
)

// HMACVerifier verifies the exact raw body using the SHA-256 HMAC wire form.
// The route supplies the expected app secret. Synthetic tests are not a substitute
// for official Meta fixtures, app authorization, key rotation or release approval.
type HMACVerifier struct{ secret []byte }

func NewHMACVerifier(secret []byte) (*HMACVerifier, error) {
	if len(secret) < 16 || len(secret) > 4096 {
		return nil, errors.New("invalid_verifier_key")
	}
	return &HMACVerifier{secret: append([]byte(nil), secret...)}, nil
}
func (v *HMACVerifier) Verify(ctx context.Context, headers http.Header, raw []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	values := headers.Values("X-Hub-Signature-256")
	if len(values) != 1 || len(values[0]) != 71 || values[0][:7] != "sha256=" {
		return errors.New("invalid_signature")
	}
	provided, err := hex.DecodeString(values[0][7:])
	if err != nil {
		return errors.New("invalid_signature")
	}
	mac := hmac.New(sha256.New, v.secret)
	_, _ = mac.Write(raw)
	if !hmac.Equal(provided, mac.Sum(nil)) {
		return errors.New("invalid_signature")
	}
	return nil
}

// SecretTokenVerifier compares fixed-length hashes so malformed token length is
// not a timing oracle. Header values are never logged. Bot/update scope and replay
// deduplication are enforced separately by the Telegram parser/binder/projector.
type SecretTokenVerifier struct{ expected [32]byte }

func NewSecretTokenVerifier(token string) (*SecretTokenVerifier, error) {
	if len(token) < 16 || len(token) > 256 {
		return nil, errors.New("invalid_webhook_secret")
	}
	return &SecretTokenVerifier{expected: sha256.Sum256([]byte(token))}, nil
}
func (v *SecretTokenVerifier) Verify(ctx context.Context, headers http.Header, _ []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	values := headers.Values("X-Telegram-Bot-Api-Secret-Token")
	if len(values) != 1 || len(values[0]) > 256 {
		return errors.New("invalid_signature")
	}
	got := sha256.Sum256([]byte(values[0]))
	if !hmac.Equal(got[:], v.expected[:]) {
		return errors.New("invalid_signature")
	}
	return nil
}

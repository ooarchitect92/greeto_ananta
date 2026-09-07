// Package security contains narrowly scoped primitives, not a security certification.
// Production callers must authorize scope BEFORE decryption and audit key use.
package security

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
)

var scopeID = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,128}$`)

// Scope is authenticated server context. Purpose prevents ciphertext re-use in a
// different field/domain. Do not use free-form customer text as encryption context.
type Scope struct {
	TenantID      string `json:"tenant_id"`
	WorkspaceID   string `json:"workspace_id"`
	EnvironmentID string `json:"environment_id"`
	Purpose       string `json:"purpose"`
}

func (s Scope) bytes() ([]byte, error) {
	for _, id := range []string{s.TenantID, s.WorkspaceID, s.EnvironmentID, s.Purpose} {
		if !scopeID.MatchString(id) {
			return nil, errors.New("invalid_encryption_scope")
		}
	}
	return json.Marshal(s)
}

// KeyProvider is a KMS envelope-encryption port. Generate uses an allowlisted key
// reference and returns a fresh AES-256 DEK plus wrapped DEK. Unwrap must enforce
// key identity, workload IAM and the exact encryption context. No master key is
// stored with the ciphertext. A fake KMS exists only inside unit tests.
type KeyProvider interface {
	Generate(context.Context, string, Scope) ([]byte, []byte, error)
	Unwrap(context.Context, string, []byte, Scope) ([]byte, error)
}

type Envelope struct {
	Version    int    `json:"version"`
	Algorithm  string `json:"algorithm"`
	KeyRef     string `json:"key_ref"`
	WrappedKey []byte `json:"wrapped_key"`
	Nonce      []byte `json:"nonce"`
	Ciphertext []byte `json:"ciphertext"`
}

// wipe is best-effort cleanup of this byte slice, not a guarantee of RAM erasure.
func wipe(b []byte) {
	for i := range b {
		b[i] = 0
	}
}
func aead(key []byte) (cipher.AEAD, error) {
	if len(key) != 32 {
		return nil, errors.New("invalid_data_key")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
func aad(scope Scope, keyRef string) ([]byte, error) {
	if keyRef == "" || len(keyRef) > 2048 {
		return nil, errors.New("invalid_key_reference")
	}
	if _, err := scope.bytes(); err != nil {
		return nil, err
	}
	return json.Marshal(struct {
		Version   int    `json:"version"`
		Algorithm string `json:"algorithm"`
		KeyRef    string `json:"key_ref"`
		Scope     Scope  `json:"scope"`
	}{1, "AES-256-GCM", keyRef, scope})
}

// Encrypt protects a bounded sensitive field with a fresh key and random nonce.
// Key reference and server-authorized tenant/purpose are authenticated as AAD.
func Encrypt(ctx context.Context, kms KeyProvider, keyRef string, scope Scope, plaintext []byte) (Envelope, error) {
	if kms == nil || len(plaintext) > 1<<20 {
		return Envelope{}, errors.New("invalid_encryption_input")
	}
	associated, err := aad(scope, keyRef)
	if err != nil {
		return Envelope{}, err
	}
	if err = ctx.Err(); err != nil {
		return Envelope{}, err
	}
	key, wrapped, err := kms.Generate(ctx, keyRef, scope)
	defer wipe(key)
	if err != nil {
		return Envelope{}, errors.New("data_key_unavailable")
	}
	if len(wrapped) == 0 || len(wrapped) > 8192 {
		return Envelope{}, errors.New("invalid_wrapped_key")
	}
	gcm, err := aead(key)
	if err != nil {
		return Envelope{}, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return Envelope{}, err
	}
	if err = ctx.Err(); err != nil {
		return Envelope{}, err
	}
	return Envelope{Version: 1, Algorithm: "AES-256-GCM", KeyRef: keyRef, WrappedKey: append([]byte(nil), wrapped...), Nonce: nonce, Ciphertext: gcm.Seal(nil, nonce, plaintext, associated)}, nil
}

// Decrypt must be called only after object authorization; never expose it as a
// generic HTTP decrypt endpoint. Authentication failure reveals no plaintext.
func Decrypt(ctx context.Context, kms KeyProvider, scope Scope, e Envelope) ([]byte, error) {
	if kms == nil || e.Version != 1 || e.Algorithm != "AES-256-GCM" || len(e.Nonce) != 12 || len(e.WrappedKey) == 0 || len(e.WrappedKey) > 8192 || len(e.Ciphertext) < 16 || len(e.Ciphertext) > (1<<20)+16 {
		return nil, errors.New("invalid_envelope")
	}
	associated, err := aad(scope, e.KeyRef)
	if err != nil {
		return nil, err
	}
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	key, err := kms.Unwrap(ctx, e.KeyRef, e.WrappedKey, scope)
	defer wipe(key)
	if err != nil {
		return nil, errors.New("decryption_unavailable")
	}
	gcm, err := aead(key)
	if err != nil {
		return nil, err
	}
	if err = ctx.Err(); err != nil {
		return nil, err
	}
	plain, err := gcm.Open(nil, e.Nonce, e.Ciphertext, associated)
	if err != nil {
		return nil, fmt.Errorf("ciphertext_authentication_failed")
	}
	return plain, nil
}

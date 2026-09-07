package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDiagnosticHostNeverClaimsProviderReadiness(t *testing.T) {
	for _, tt := range []struct {
		method, path string
		code         int
	}{{"GET", "/health/live", 200}, {"GET", "/health/ready", 503}, {"POST", "/callbacks/meta/app", 503}} {
		w := httptest.NewRecorder()
		routes().ServeHTTP(w, httptest.NewRequest(tt.method, tt.path, strings.NewReader("{}")))
		if w.Code != tt.code {
			t.Fatalf("%s code=%d", tt.path, w.Code)
		}
	}
}

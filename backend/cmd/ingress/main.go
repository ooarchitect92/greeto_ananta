// ingress starts a loopback-only diagnostic host, NOT a configured provider edge.
// It deliberately returns 503 for provider callbacks until real adapters, TLS/WAF,
// trusted placement, provider fixtures and Kafka quorum evidence are supplied.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/ooarchitect92/greeto_ananta/backend/internal/health"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health/live", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "alive", "scope": "process_only"})
	})
	mux.HandleFunc("GET /health/ready", func(w http.ResponseWriter, r *http.Request) {
		result := health.Evaluate([]string{"provider_verifier", "placement_authority", "kafka_quorum"}, nil, time.Now().UTC())
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(result)
	})
	mux.HandleFunc("POST /callbacks/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Retry-After", "5")
		http.Error(w, "provider_adapters_not_configured", http.StatusServiceUnavailable)
	})
	return mux
}

// main exposes no management credentials, background sender or fake green check.
// Production binding/routing is a reviewed OPS-001/EVT-003 deployment increment.
func main() {
	server := &http.Server{Addr: "127.0.0.1:8090", Handler: routes(), ReadHeaderTimeout: 2 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16 << 10}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	slog.Info("diagnostic_host_started", "address", server.Addr, "provider_ingress", "not_configured")
	select {
	case err := <-done:
		if !errors.Is(err, http.ErrServerClosed) {
			slog.Error("http_server_failed")
			os.Exit(1)
		}
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if server.Shutdown(shutdown) != nil {
			_ = server.Close()
		}
	}
}

// Package observe emits bounded, structured operational telemetry.
// It is NOT the durable command journal or security audit ledger.
package observe

import (
	"encoding/json"
	"errors"
	"io"
	"regexp"
	"sync"
	"sync/atomic"
	"time"
)

var identifier = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,128}$`)

// Stage deliberately has no map[string]any, raw error, headers, URL, token or body.
// Milliseconds measures this stage's elapsed time, not provider delivery latency.
type Stage struct {
	RequestID    string    `json:"request_id"`
	Flow         string    `json:"flow"`
	Name         string    `json:"stage"`
	Outcome      string    `json:"outcome"`
	Reason       string    `json:"reason_code"`
	Sequence     int       `json:"sequence"`
	Milliseconds int64     `json:"duration_ms"`
	At           time.Time `json:"observed_at"`
}

// Sink.Record must be bounded/nonblocking; business acceptance cannot depend on
// a remote logging service. Durable audit uses a separate transactional outbox.
type Sink interface{ Record(Stage) }

// Logger has a bounded queue and explicit loss/error counters for alerting.
// Only trusted enums/opaque IDs pass its allowlist; free-text PII is not a field.
type Logger struct {
	mu       sync.RWMutex
	closed   bool
	queue    chan Stage
	done     chan struct{}
	dropped  atomic.Uint64
	failures atomic.Uint64
}

// New starts one bounded writer. capacity is limited to avoid unbounded memory.
// The writer must have bounded I/O (for example a local collector pipe).
func New(writer io.Writer, capacity int) (*Logger, error) {
	if writer == nil || capacity < 1 || capacity > 65536 {
		return nil, errors.New("invalid_logger_configuration")
	}
	l := &Logger{queue: make(chan Stage, capacity), done: make(chan struct{})}
	go func() {
		defer close(l.done)
		enc := json.NewEncoder(writer)
		for v := range l.queue {
			if enc.Encode(v) != nil {
				l.failures.Add(1)
			}
		}
	}()
	return l, nil
}

// Record rejects malformed fields and drops overflow rather than blocking ingress.
// Alert on Dropped/Failures; do not mistake this telemetry for acceptance evidence.
func (l *Logger) Record(s Stage) {
	if !identifier.MatchString(s.RequestID) || !identifier.MatchString(s.Flow) || !identifier.MatchString(s.Name) || !identifier.MatchString(s.Outcome) || (s.Reason != "" && !identifier.MatchString(s.Reason)) || s.Sequence < 1 || s.Milliseconds < 0 || s.At.IsZero() {
		l.dropped.Add(1)
		return
	}
	l.mu.RLock()
	defer l.mu.RUnlock()
	if l.closed {
		l.dropped.Add(1)
		return
	}
	select {
	case l.queue <- s:
	default:
		l.dropped.Add(1)
	}
}

func (l *Logger) Dropped() uint64  { return l.dropped.Load() }
func (l *Logger) Failures() uint64 { return l.failures.Load() }

// Close stops accepting telemetry and returns a channel closed after the writer
// drains. Callers wait with THEIR shutdown deadline; a blocked writer cannot make
// an application wait forever just because shutdown was requested.
func (l *Logger) Close() <-chan struct{} {
	l.mu.Lock()
	if !l.closed {
		l.closed = true
		close(l.queue)
	}
	l.mu.Unlock()
	return l.done
}

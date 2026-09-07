package observe

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"sync"
	"testing"
	"time"
)

func sample() Stage {
	return Stage{RequestID: "request-1", Flow: "F03", Name: "raw_proof", Outcome: "failed", Reason: "proof_rejected", Sequence: 1, At: time.Now().UTC()}
}
func TestLoggerStructuredAndInjectionRejected(t *testing.T) {
	var b bytes.Buffer
	l, _ := New(&b, 4)
	l.Record(sample())
	bad := sample()
	bad.Reason = "token\nforged_success"
	l.Record(bad)
	<-l.Close()
	if l.Dropped() != 1 {
		t.Fatal("bad fields accepted")
	}
	var entry map[string]any
	if json.Unmarshal(b.Bytes(), &entry) != nil {
		t.Fatal("not structured")
	}
	for _, s := range []string{"token", "forged", "headers", "body", "authorization"} {
		if strings.Contains(b.String(), s) {
			t.Fatalf("unexpected field %s", s)
		}
	}
}
func TestLoggerOverflowIsBounded(t *testing.T) {
	r, w := io.Pipe()
	l, _ := New(w, 1)
	for i := 0; i < 500; i++ {
		l.Record(sample())
	}
	if l.Dropped() == 0 {
		t.Fatal("unbounded queue")
	}
	_ = r.Close()
	_ = w.Close()
	select {
	case <-l.Close():
	case <-time.After(time.Second):
		t.Fatal("did not stop")
	}
}
func TestLoggerConcurrentCloseAndRecord(t *testing.T) {
	l, _ := New(io.Discard, 10)
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				l.Record(sample())
			}
		}()
	}
	l.Close()
	wg.Wait()
	<-l.Close()
}

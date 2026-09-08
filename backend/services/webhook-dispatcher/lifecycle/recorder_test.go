package lifecycle

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

// SYNTHETIC ledger: verifies orchestration only, NOT DynamoDB durability/transactions.
type memoryLedger struct {
	mu                 sync.Mutex
	a                  Attempt
	recorded           *Receipt
	reads, writes      int
	readErr, commitErr error
	lostAck            bool
	corrupt            bool
	foreign            bool
	begun, finish      chan struct{}
}

func (m *memoryLedger) Read(ctx context.Context, k Key) (Snapshot, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.reads++
	s := Snapshot{Attempt: m.a}
	if m.recorded != nil {
		c := *m.recorded
		s.Recorded = &c
	}
	if m.foreign {
		s.Attempt.Key.EnvironmentID = "00000000-0000-0000-0000-000000000099"
	}
	return s, m.readErr
}
func (m *memoryLedger) Commit(ctx context.Context, a Attempt, r Receipt) (Receipt, error) {
	if m.begun != nil {
		close(m.begun)
		<-m.finish
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.commitErr != nil {
		return Receipt{}, m.commitErr
	}
	if m.recorded != nil || a.Version != m.a.Version || a.Key != m.a.Key {
		return Receipt{}, ErrConflict
	}
	m.writes++
	copy := r
	m.recorded = &copy
	if m.lostAck {
		m.lostAck = false
		return Receipt{}, errors.New("private database error")
	}
	if m.corrupt {
		r.Decision.State = Accepted
	}
	return r, nil
}

type authorityFn func(context.Context, Key) error

func (f authorityFn) RequireRecord(c context.Context, k Key) error { return f(c, k) }
func hostContext(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	t.Cleanup(cancel)
	return ctx
}
func setup(t *testing.T) (*Recorder, *memoryLedger) {
	t.Helper()
	m := &memoryLedger{a: attempt()}
	r, e := NewRecorder(m, authorityFn(func(context.Context, Key) error { return nil }), planner(t))
	if e != nil {
		t.Fatal(e)
	}
	return r, m
}
func TestRecordCommitAndReplay(t *testing.T) {
	r, m := setup(t)
	ctx := hostContext(t)
	one, e := r.Record(ctx, key(), observation())
	two, e2 := r.Record(ctx, key(), observation())
	if e != nil || e2 != nil || !sameReceipt(one, two) || m.writes != 1 || one.Version != 12 {
		t.Fatal(one, two, e, e2, m.writes)
	}
}
func TestChangedObservationConflicts(t *testing.T) {
	r, m := setup(t)
	ctx := hostContext(t)
	_, _ = r.Record(ctx, key(), observation())
	o := observation()
	o.StatusCode = 502
	if _, e := r.Record(ctx, key(), o); e != ErrConflict || m.writes != 1 {
		t.Fatal(e, m.writes)
	}
}
func TestLostCommitACKRecoversWithoutAnotherWrite(t *testing.T) {
	r, m := setup(t)
	m.lostAck = true
	ctx := hostContext(t)
	empty, e := r.Record(ctx, key(), observation())
	if e != ErrUnavailable || empty != (Receipt{}) {
		t.Fatal(empty, e)
	}
	got, e := r.Record(ctx, key(), observation())
	if e != nil || got.Decision.State != RetryWait || m.writes != 1 {
		t.Fatal(got, e, m.writes)
	}
}
func TestNoReceiptBeforeCommitACK(t *testing.T) {
	r, m := setup(t)
	m.begun, m.finish = make(chan struct{}), make(chan struct{})
	done := make(chan error, 1)
	ctx := hostContext(t)
	go func() { _, e := r.Record(ctx, key(), observation()); done <- e }()
	<-m.begun
	select {
	case e := <-done:
		t.Fatalf("early receipt: %v", e)
	default:
	}
	close(m.finish)
	if e := <-done; e != nil {
		t.Fatal(e)
	}
}
func TestKnownCommitSurvivesLateCancellation(t *testing.T) {
	r, m := setup(t)
	m.begun, m.finish = make(chan struct{}), make(chan struct{})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	done := make(chan error, 1)
	go func() { _, e := r.Record(ctx, key(), observation()); done <- e }()
	<-m.begun
	cancel()
	close(m.finish)
	if e := <-done; e != nil {
		t.Fatal(e)
	}
}
func TestAuthorizationBeforeRead(t *testing.T) {
	r, m := setup(t)
	r.authority = authorityFn(func(context.Context, Key) error { return errors.New("secret") })
	if _, e := r.Record(hostContext(t), key(), observation()); e != ErrDenied || m.reads != 0 || m.writes != 0 {
		t.Fatal(e)
	}
}
func TestAuthorizationRecheckedForReplay(t *testing.T) {
	r, m := setup(t)
	ctx := hostContext(t)
	_, _ = r.Record(ctx, key(), observation())
	r.authority = authorityFn(func(context.Context, Key) error { return errors.New("revoked") })
	if _, e := r.Record(ctx, key(), observation()); e != ErrDenied || m.reads != 1 {
		t.Fatal(e, m.reads)
	}
}
func TestStorageErrorsAreRedacted(t *testing.T) {
	for _, stage := range []string{"read", "commit"} {
		t.Run(stage, func(t *testing.T) {
			r, m := setup(t)
			e := errors.New("postgres://name:secret@host")
			if stage == "read" {
				m.readErr = e
			} else {
				m.commitErr = e
			}
			if _, e := r.Record(hostContext(t), key(), observation()); e != ErrUnavailable || m.writes != 0 {
				t.Fatal(e)
			}
		})
	}
}
func TestCrossScopeReadWithheld(t *testing.T) {
	r, m := setup(t)
	m.foreign = true
	if _, e := r.Record(hostContext(t), key(), observation()); e != ErrUnavailable || m.writes != 0 {
		t.Fatal(e)
	}
}
func TestMismatchedReceiptWithheld(t *testing.T) {
	r, m := setup(t)
	m.corrupt = true
	if _, e := r.Record(hostContext(t), key(), observation()); e != ErrUnavailable {
		t.Fatal(e)
	}
}
func TestConditionalConflictNotRetriedInternally(t *testing.T) {
	r, m := setup(t)
	m.commitErr = ErrConflict
	if _, e := r.Record(hostContext(t), key(), observation()); e != ErrConflict || m.reads != 1 {
		t.Fatal(e, m.reads)
	}
}
func TestUnboundedContextRejected(t *testing.T) {
	r, m := setup(t)
	if _, e := r.Record(context.Background(), key(), observation()); e != ErrConfiguration || m.reads != 0 {
		t.Fatal(e)
	}
}
func TestExcessiveDeadlineRejected(t *testing.T) {
	r, _ := setup(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	if _, e := r.Record(ctx, key(), observation()); e != ErrConfiguration {
		t.Fatal(e)
	}
}
func TestCancelledBeforeStart(t *testing.T) {
	r, m := setup(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	cancel()
	if _, e := r.Record(ctx, key(), observation()); e != ErrUnavailable || m.reads != 0 {
		t.Fatal(e)
	}
}
func TestInvalidIdentityBeforeRead(t *testing.T) {
	r, m := setup(t)
	k := key()
	k.Epoch = 0
	if _, e := r.Record(hostContext(t), k, observation()); e != ErrInput || m.reads != 0 {
		t.Fatal(e)
	}
}
func TestInvalidObservationNeverWrites(t *testing.T) {
	r, m := setup(t)
	o := observation()
	o.Outcome = "forged"
	if _, e := r.Record(hostContext(t), key(), o); e != ErrInput || m.writes != 0 {
		t.Fatal(e)
	}
}
func TestNilDependencies(t *testing.T) {
	p := planner(t)
	m := &memoryLedger{}
	auth := authorityFn(func(context.Context, Key) error { return nil })
	for _, x := range []struct {
		l Ledger
		a Authority
		p *Planner
	}{{nil, auth, p}, {m, nil, p}, {m, auth, nil}} {
		if _, e := NewRecorder(x.l, x.a, x.p); e != ErrConfiguration {
			t.Fatal(e)
		}
	}
	var r *Recorder
	if _, e := r.Record(context.Background(), key(), observation()); e != ErrConfiguration {
		t.Fatal(e)
	}
}
func TestClockFormattingDoesNotChangeReplayIdentity(t *testing.T) {
	r, m := setup(t)
	ctx := hostContext(t)
	a, e := r.Record(ctx, key(), observation())
	o := observation()
	o.ObservedAt = o.ObservedAt.In(time.FixedZone("offset", 19800))
	b, e2 := r.Record(ctx, key(), o)
	if e != nil || e2 != nil || !sameReceipt(a, b) || m.writes != 1 {
		t.Fatal(e, e2)
	}
}
func TestConcurrentAttemptsDoNotOverwriteReceipt(t *testing.T) {
	r, m := setup(t)
	ctx := hostContext(t)
	var wg sync.WaitGroup
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, e := r.Record(ctx, key(), observation())
			if e != nil && e != ErrConflict {
				t.Error(e)
			}
		}()
	}
	wg.Wait()
	got, e := r.Record(ctx, key(), observation())
	if e != nil || got.Decision.State != RetryWait || m.writes != 1 {
		t.Fatal(got, e, m.writes)
	}
}

func TestZeroValueRecorderRejected(t *testing.T) {
	r := &Recorder{}
	if _, e := r.Record(hostContext(t), key(), observation()); e != ErrConfiguration {
		t.Fatal(e)
	}
}

package ingress

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"github.com/ooarchitect92/greeto_ananta/backend/internal/events"
	"github.com/ooarchitect92/greeto_ananta/backend/internal/observe"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"
)

type fixtures struct {
	fail    string
	calls   []string
	stages  []observe.Stage
	appends int
	cancel  context.CancelFunc
}

func (f *fixtures) ForRoute(context.Context, string) (Verifier, error) {
	f.calls = append(f.calls, "credential")
	if f.fail == "credential" {
		return nil, errors.New("secret")
	}
	return f, nil
}
func (f *fixtures) Verify(context.Context, http.Header, []byte) error {
	f.calls = append(f.calls, "verify")
	if f.fail == "verify" {
		return errors.New("secret-body-must-not-log")
	}
	return nil
}
func (f *fixtures) Parse(context.Context, []byte) ([]Candidate, error) {
	f.calls = append(f.calls, "parse")
	if f.fail == "parse" {
		return nil, errors.New("schema")
	}
	return []Candidate{{AssetID: "asset-a", EventRef: "event-a", Body: []byte("{}")}, {AssetID: "asset-b", EventRef: "event-b", Body: []byte("{}")}}, nil
}
func (f *fixtures) Bind(_ context.Context, _ string, c Candidate) (Slice, error) {
	f.calls = append(f.calls, "bind")
	if f.fail == "bind" {
		return Slice{}, errors.New("no authority")
	}
	return Slice{CellID: "cell-1", PlacementEpoch: 1, AuthorityRef: "signed-placement-1", Record: events.Record{ID: c.EventRef, Topic: "test.cell.provider.received.v1", Key: c.AssetID, Body: c.Body}}, nil
}
func (f *fixtures) Append(_ context.Context, s Slice) (events.Commit, error) {
	f.calls = append(f.calls, "append")
	f.appends++
	if f.fail == "append" || (f.fail == "partial" && f.appends == 2) {
		return events.Commit{}, errors.New("quorum lost")
	}
	if f.cancel != nil {
		f.cancel()
	}
	offset := int64(1)
	if f.fail == "bad_ack" {
		offset = -1
	}
	return events.Commit{RecordID: s.Record.ID, Topic: s.Record.Topic, Partition: 0, Offset: offset}, nil
}
func (f *fixtures) Record(s observe.Stage) { f.stages = append(f.stages, s) }
func setup(f *fixtures) *Handler {
	h, err := New(Options{Route: "app-1", MaxBodyBytes: 1024, MaxSlices: 8, MaxConcurrent: 1, Timeout: time.Second, Proofs: f, Parser: f, Binder: f, Journal: f, Observer: f})
	if err != nil {
		panic(err)
	}
	return h
}
func request() *http.Request {
	r := httptest.NewRequest("POST", "/callbacks/meta/app-1", strings.NewReader(`{"fixture":true}`))
	r.Header.Set("Content-Type", "application/json")
	return r
}
func TestIngressAcknowledgesOnlyAfterAllSlices(t *testing.T) {
	f := &fixtures{}
	h := setup(f)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, request())
	if w.Code != 200 || f.appends != 2 {
		t.Fatalf("code %d appends %d", w.Code, f.appends)
	}
	want := []string{"credential", "verify", "parse", "bind", "bind", "append", "append"}
	if !reflect.DeepEqual(f.calls, want) {
		t.Fatalf("order %v", f.calls)
	}
	last := f.stages[len(f.stages)-1]
	if last.Name != "ack_boundary" || last.Outcome != "response_written" || last.Reason != "durable_acceptance_only" {
		t.Fatal("wrong acknowledgement semantics")
	}
	for i, s := range f.stages {
		if s.Sequence != i+1 {
			t.Fatal("sequence")
		}
	}
}
func TestIngressCrashAndRejectionBoundaries(t *testing.T) {
	for _, tt := range []struct {
		at            string
		code, appends int
	}{{"credential", 503, 0}, {"verify", 401, 0}, {"parse", 422, 0}, {"bind", 503, 0}, {"append", 503, 1}, {"partial", 503, 2}, {"bad_ack", 503, 1}} {
		t.Run(tt.at, func(t *testing.T) {
			f := &fixtures{fail: tt.at}
			w := httptest.NewRecorder()
			setup(f).ServeHTTP(w, request())
			if w.Code != tt.code || f.appends != tt.appends {
				t.Fatalf("code=%d appends=%d", w.Code, f.appends)
			}
			if strings.Contains(w.Body.String(), "secret") {
				t.Fatal("secret exposed")
			}
			for _, s := range f.stages {
				if strings.Contains(s.Reason, "secret") {
					t.Fatal("secret logged")
				}
			}
		})
	}
}
func TestIngressRequestBounds(t *testing.T) {
	for _, tt := range []struct {
		name   string
		change func(*http.Request)
		want   int
	}{{"method", func(r *http.Request) { r.Method = "GET" }, 405}, {"encoding", func(r *http.Request) { r.Header.Set("Content-Encoding", "gzip") }, 415}, {"type", func(r *http.Request) { r.Header.Set("Content-Type", "text/plain") }, 415}} {
		t.Run(tt.name, func(t *testing.T) {
			f := &fixtures{}
			r := request()
			tt.change(r)
			w := httptest.NewRecorder()
			setup(f).ServeHTTP(w, r)
			if w.Code != tt.want || len(f.calls) != 0 {
				t.Fatal("bad request reached pipeline")
			}
		})
	}
	f := &fixtures{}
	r := httptest.NewRequest("POST", "/", strings.NewReader(strings.Repeat("x", 1025)))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	setup(f).ServeHTTP(w, r)
	if w.Code != 413 || len(f.calls) != 0 {
		t.Fatal("oversize reached verifier")
	}
}
func TestIngressCapacityAndCancelledAppend(t *testing.T) {
	f := &fixtures{}
	h := setup(f)
	h.slots <- struct{}{}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, request())
	if w.Code != 503 || f.appends != 0 {
		t.Fatal("capacity ignored")
	}
	<-h.slots
	ctx, cancel := context.WithCancel(context.Background())
	f.cancel = cancel
	w = httptest.NewRecorder()
	h.ServeHTTP(w, request().WithContext(ctx))
	if w.Code != 503 {
		t.Fatal("cancelled request acknowledged")
	}
}
func TestHMACVerifiesExactRawBytes(t *testing.T) {
	secret := []byte("synthetic-app-secret-for-test")
	v, _ := NewHMACVerifier(secret)
	raw := []byte(`{ "entry": [] }`)
	m := hmac.New(sha256.New, secret)
	_, _ = m.Write(raw)
	header := http.Header{"X-Hub-Signature-256": []string{"sha256=" + hex.EncodeToString(m.Sum(nil))}}
	if v.Verify(context.Background(), header, raw) != nil {
		t.Fatal("valid proof rejected")
	}
	if v.Verify(context.Background(), header, []byte(`{"entry":[]}`)) == nil {
		t.Fatal("reserialized bytes accepted")
	}
	header.Add("X-Hub-Signature-256", header.Get("X-Hub-Signature-256"))
	if v.Verify(context.Background(), header, raw) == nil {
		t.Fatal("duplicate signature header accepted")
	}
}
func TestSecretTokenProofFailsClosed(t *testing.T) {
	v, _ := NewSecretTokenVerifier("synthetic-token-for-tests")
	for _, token := range []string{"", "wrong"} {
		if v.Verify(context.Background(), http.Header{"X-Telegram-Bot-Api-Secret-Token": []string{token}}, nil) == nil {
			t.Fatal("bad token accepted")
		}
	}
	if v.Verify(context.Background(), http.Header{"X-Telegram-Bot-Api-Secret-Token": []string{"synthetic-token-for-tests"}}, nil) != nil {
		t.Fatal("valid token rejected")
	}
}

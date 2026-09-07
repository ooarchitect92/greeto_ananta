package events

import (
	"context"
	"errors"
	"testing"
)

type publisher struct {
	calls int
	fail  bool
	bad   bool
}

func (p *publisher) Publish(_ context.Context, r Record) (Commit, error) {
	p.calls++
	if p.fail {
		return Commit{}, errors.New("broker unavailable")
	}
	c := Commit{RecordID: r.ID, Topic: r.Topic, Partition: 0, Offset: 42}
	if p.bad {
		c.Offset = -1
	}
	return c, nil
}

type outbox struct {
	calls int
	fail  bool
}

func (o *outbox) MarkPublished(context.Context, string, Commit) error {
	o.calls++
	if o.fail {
		return errors.New("write failed")
	}
	return nil
}
func TestOutboxOrderingAndCrashWindows(t *testing.T) {
	r := Record{ID: "stable", Topic: "topic", Key: "tenant:recipient", Body: []byte("{}")}
	for _, tt := range []struct {
		name                         string
		brokerFail, badAck, markFail bool
		marks                        int
		wantErr                      bool
	}{{"normal", false, false, false, 1, false}, {"no_quorum", true, false, false, 0, true}, {"invalid_ack", false, true, false, 0, true}, {"crash_after_publish", false, false, true, 1, true}} {
		t.Run(tt.name, func(t *testing.T) {
			p := &publisher{fail: tt.brokerFail, bad: tt.badAck}
			o := &outbox{fail: tt.markFail}
			err := PublishPending(context.Background(), p, o, r)
			if (err != nil) != tt.wantErr || o.calls != tt.marks {
				t.Fatalf("err=%v marks=%d", err, o.calls)
			}
		})
	}
	p := &publisher{}
	o := &outbox{fail: true}
	_ = PublishPending(context.Background(), p, o, r)
	o.fail = false
	if PublishPending(context.Background(), p, o, r) != nil || p.calls != 2 {
		t.Fatal("pending replay failed")
	}
}

type projector struct {
	fail    bool
	effects map[string]bool
}

func (p *projector) ApplyIdempotently(_ context.Context, r Record) error {
	if p.fail {
		return errors.New("db unavailable")
	}
	p.effects[r.ID] = true
	return nil
}

type offsets struct {
	calls int
	fail  bool
}

func (o *offsets) CommitOffset(context.Context, Commit) error {
	o.calls++
	if o.fail {
		return errors.New("offset unavailable")
	}
	return nil
}
func TestConsumerDurableEffectBeforeOffset(t *testing.T) {
	r := Record{ID: "event-1", Topic: "topic"}
	c := Commit{RecordID: r.ID, Topic: r.Topic, Offset: 1}
	p := &projector{fail: true, effects: map[string]bool{}}
	o := &offsets{}
	if Consume(context.Background(), p, o, r, c) == nil || o.calls != 0 {
		t.Fatal("committed before effect")
	}
	p.fail = false
	o.fail = true
	if Consume(context.Background(), p, o, r, c) == nil {
		t.Fatal("lost offset error")
	}
	o.fail = false
	if Consume(context.Background(), p, o, r, c) != nil || len(p.effects) != 1 {
		t.Fatal("duplicate effect")
	}
}
func TestCancelledWorkCannotPublish(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	p := &publisher{}
	if PublishPending(ctx, p, &outbox{}, Record{ID: "x", Topic: "t", Key: "k", Body: []byte("x")}) == nil || p.calls != 0 {
		t.Fatal("cancel ignored")
	}
}
func TestKafkaPolicyRejectsWeakerDurability(t *testing.T) {
	p := KafkaPolicy{ReplicationFactor: 3, MinInSyncReplicas: 2, Acks: "all", Idempotence: true}
	if p.Validate() != nil {
		t.Fatal("baseline rejected")
	}
	for i := 0; i < 7; i++ {
		bad := p
		switch i {
		case 0:
			bad.Acks = "1"
		case 1:
			bad.Idempotence = false
		case 2:
			bad.ReplicationFactor = 1
		case 3:
			bad.MinInSyncReplicas = 1
		case 4:
			bad.UncleanElection = true
		case 5:
			bad.AutoCommit = true
		case 6:
			bad.MinInSyncReplicas = 4
		}
		if bad.Validate() == nil {
			t.Fatalf("weakened config %d allowed", i)
		}
	}
}
func TestAttemptAcknowledgementsNeverInventDelivery(t *testing.T) {
	for _, tt := range []struct {
		e    AttemptEvidence
		want string
	}{{AttemptEvidence{ProviderAccepted: true}, "PROVIDER_ACCEPTED"}, {AttemptEvidence{MayHaveExecuted: true, DocumentedSafeRetry: true}, "UNKNOWN"}, {AttemptEvidence{DefinitiveRejection: true}, "REJECTED"}, {AttemptEvidence{DocumentedSafeRetry: true}, "RETRY_WAIT"}, {AttemptEvidence{}, "UNKNOWN"}, {AttemptEvidence{ProviderAccepted: true, DefinitiveRejection: true}, "UNKNOWN"}} {
		if got := ClassifyAttempt(tt.e); got != tt.want {
			t.Fatalf("%s != %s", got, tt.want)
		}
	}
}

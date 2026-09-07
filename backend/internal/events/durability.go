// Package events defines the durable publication and consumption boundaries.
// These ports need real Kafka and datastore adapters before production use.
package events

import (
	"context"
	"errors"
	"fmt"
)

// KafkaPolicy is verified at adapter startup AND against the broker/topic config.
// Recording these values in JSON alone does not configure or verify a broker.
type KafkaPolicy struct {
	ReplicationFactor int    `json:"replication_factor"`
	MinInSyncReplicas int    `json:"min_in_sync_replicas"`
	Acks              string `json:"acks"`
	Idempotence       bool   `json:"enable_idempotence"`
	UncleanElection   bool   `json:"unclean_leader_election"`
	AutoCommit        bool   `json:"consumer_auto_commit"`
}

// Validate rejects weaker durability than architecture section 8.2.
func (p KafkaPolicy) Validate() error {
	if p.ReplicationFactor < 3 || p.MinInSyncReplicas < 2 || p.MinInSyncReplicas > p.ReplicationFactor || p.Acks != "all" || !p.Idempotence || p.UncleanElection || p.AutoCommit {
		return errors.New("unsafe_kafka_policy")
	}
	return nil
}

// Record carries a stable business/event identity; retries must preserve ID.
// Body is already minimized and authorized. Do not log it or use TraceID for dedup.
type Record struct {
	ID, Topic, Key string
	Body           []byte
}

// Commit is returned only by the trusted broker adapter after configured quorum.
type Commit struct {
	RecordID, Topic string
	Partition       int
	Offset          int64
}

// Publisher must enforce KafkaPolicy, deadlines, TLS and workload authentication.
type Publisher interface {
	Publish(context.Context, Record) (Commit, error)
}

// Outbox owns a durable row/item; MarkPublished is a conditional state change.
// The record remains recoverable until publication is positively acknowledged.
type Outbox interface {
	MarkPublished(context.Context, string, Commit) error
}

// PublishPending implements publish -> broker ACK -> mark, never mark -> publish.
// A crash or mark failure after broker ACK can cause a duplicate transport record.
// The original ID is retained so downstream consumers suppress duplicate effects.
func PublishPending(ctx context.Context, p Publisher, o Outbox, r Record) error {
	if p == nil || o == nil || r.ID == "" || r.Topic == "" || r.Key == "" || len(r.Body) == 0 {
		return errors.New("invalid_publication")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	commit, err := p.Publish(ctx, r)
	if err != nil {
		return fmt.Errorf("publication_unconfirmed: %w", err)
	}
	if commit.RecordID != r.ID || commit.Topic != r.Topic || commit.Partition < 0 || commit.Offset < 0 {
		return errors.New("invalid_broker_acknowledgement")
	}
	if err = ctx.Err(); err != nil {
		return err
	}
	return o.MarkPublished(ctx, r.ID, commit)
}

// Projection must atomically persist the effect and its dedup marker (or use its
// own local outbox). CommitOffset must refer to this exact consumer partition.
type Projection interface {
	ApplyIdempotently(context.Context, Record) error
}
type OffsetStore interface {
	CommitOffset(context.Context, Commit) error
}

// Consume commits an offset only after the consumer's durable effect boundary.
func Consume(ctx context.Context, projection Projection, offsets OffsetStore, r Record, offset Commit) error {
	if projection == nil || offsets == nil || r.ID == "" || offset.RecordID != r.ID || offset.Topic != r.Topic || offset.Partition < 0 || offset.Offset < 0 {
		return errors.New("invalid_consumer_record")
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	if err := projection.ApplyIdempotently(ctx, r); err != nil {
		return err
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	return offsets.CommitOffset(ctx, offset)
}

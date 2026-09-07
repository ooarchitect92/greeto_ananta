-- G0 additive schema DRAFT. Not executed against a live database in this increment.
-- Owner: Platform/Data. Review DAT-001 + PLT-001 before applying with a migration
-- identity. High-volume request/stage payloads belong to Kafka/DynamoDB/S3/OTel,
-- NOT one PostgreSQL row per global message. No production data or keys are seeded.
BEGIN;
CREATE SCHEMA platform;
CREATE SCHEMA delivery;
CREATE SCHEMA security;
CREATE SCHEMA recovery;
REVOKE ALL ON SCHEMA platform, delivery, security, recovery FROM PUBLIC;

-- Every child FK includes the tenant boundary; opaque IDs are issued server-side.
CREATE TABLE platform.tenants (
 tenant_id uuid PRIMARY KEY,
 home_cell varchar(128) NOT NULL,
 placement_epoch bigint NOT NULL CHECK (placement_epoch > 0),
 state text NOT NULL CHECK (state IN ('provisioning','active','suspended','erasing')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform.workspaces (
 tenant_id uuid NOT NULL REFERENCES platform.tenants(tenant_id),
 workspace_id uuid NOT NULL,
 PRIMARY KEY (tenant_id, workspace_id)
);
CREATE TABLE platform.environments (
 tenant_id uuid NOT NULL,
 workspace_id uuid NOT NULL,
 environment_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('production','sandbox','shadow')),
 PRIMARY KEY (tenant_id, workspace_id, environment_id),
 FOREIGN KEY (tenant_id, workspace_id) REFERENCES platform.workspaces
);

-- An immutable baseline reference preserves the uploaded plan; changing status
-- does not rewrite source requirements, dependencies or architecture fingerprints.
CREATE TABLE delivery.baselines (
 tenant_id uuid NOT NULL, workspace_id uuid NOT NULL, environment_id uuid NOT NULL,
 baseline_id uuid NOT NULL,
 source_sha256 char(64) NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
 source_ref text NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 2048),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, workspace_id, environment_id, baseline_id),
 FOREIGN KEY (tenant_id, workspace_id, environment_id) REFERENCES platform.environments
);
CREATE TABLE delivery.work_packages (
 tenant_id uuid NOT NULL, workspace_id uuid NOT NULL, environment_id uuid NOT NULL,
 baseline_id uuid NOT NULL,
 work_package_id varchar(16) NOT NULL CHECK (work_package_id ~ '^[A-Z]{2,4}-[0-9]{3}$'),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 256),
 acceptance text NOT NULL CHECK (length(acceptance) BETWEEN 1 AND 8000),
 gate text NOT NULL CHECK (gate IN ('G0','G1','G2','G3')),
 status text NOT NULL DEFAULT 'Not started' CHECK (status IN ('Not started','In progress','Blocked','Review','Done')),
 version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
 evidence_ref text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, workspace_id, environment_id, baseline_id, work_package_id),
 FOREIGN KEY (tenant_id, workspace_id, environment_id, baseline_id) REFERENCES delivery.baselines,
 CHECK (status <> 'Done' OR length(trim(evidence_ref)) > 0 AND evidence_ref IS NOT NULL)
);
CREATE TABLE delivery.dependencies (
 tenant_id uuid NOT NULL, workspace_id uuid NOT NULL, environment_id uuid NOT NULL,
 baseline_id uuid NOT NULL, work_package_id varchar(16) NOT NULL, predecessor_id varchar(16) NOT NULL,
 PRIMARY KEY (tenant_id, workspace_id, environment_id, baseline_id, work_package_id, predecessor_id),
 FOREIGN KEY (tenant_id, workspace_id, environment_id, baseline_id, work_package_id) REFERENCES delivery.work_packages,
 FOREIGN KEY (tenant_id, workspace_id, environment_id, baseline_id, predecessor_id) REFERENCES delivery.work_packages,
 CHECK (work_package_id <> predecessor_id)
);
-- Dependency cycles require whole-graph contract validation before baseline import.
-- Done requires independently verified acceptance in the service; a URL alone is
-- NOT proof. No general runtime UPDATE grant is supplied by this migration.
CREATE TABLE delivery.status_events (
 tenant_id uuid NOT NULL, workspace_id uuid NOT NULL, environment_id uuid NOT NULL,
 baseline_id uuid NOT NULL, work_package_id varchar(16) NOT NULL,
 event_id uuid NOT NULL, actor_id uuid NOT NULL,
 idempotency_hash char(64) NOT NULL CHECK (idempotency_hash ~ '^[0-9a-f]{64}$'),
 intent_hash char(64) NOT NULL CHECK (intent_hash ~ '^[0-9a-f]{64}$'),
 previous_status text NOT NULL, requested_status text NOT NULL,
 previous_version bigint NOT NULL, resulting_version bigint NOT NULL,
 evidence_ref text, reason_code varchar(128) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, workspace_id, environment_id, event_id),
 UNIQUE (tenant_id, workspace_id, environment_id, idempotency_hash),
 FOREIGN KEY (tenant_id, workspace_id, environment_id, baseline_id, work_package_id) REFERENCES delivery.work_packages,
 CHECK (resulting_version = previous_version + 1)
);

-- Low-volume privileged audit records only. Raw tokens, transcripts, headers,
-- payment data and decryptable keys are forbidden; evidence bodies remain encrypted
-- in a restricted store. The runtime role must have no UPDATE/DELETE/TRUNCATE.
CREATE TABLE security.audit_events (
 tenant_id uuid NOT NULL, workspace_id uuid NOT NULL, environment_id uuid NOT NULL,
 event_id uuid NOT NULL, actor_id uuid NOT NULL,
 action_code varchar(128) NOT NULL, target_ref varchar(256) NOT NULL,
 outcome text NOT NULL CHECK (outcome IN ('allowed','denied','failed','unknown')),
 trace_id char(32) CHECK (trace_id ~ '^[0-9a-f]{32}$'),
 integrity_ref text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, workspace_id, environment_id, event_id),
 FOREIGN KEY (tenant_id, workspace_id, environment_id) REFERENCES platform.environments
);
CREATE TABLE security.incidents (
 tenant_id uuid NOT NULL, workspace_id uuid NOT NULL, environment_id uuid NOT NULL,
 incident_id uuid NOT NULL, rule_id varchar(128) NOT NULL,
 severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
 state text NOT NULL CHECK (state IN ('open','investigating','contained','resolved')),
 evidence_ref text NOT NULL, version bigint NOT NULL DEFAULT 1,
 observed_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (tenant_id, workspace_id, environment_id, incident_id),
 FOREIGN KEY (tenant_id, workspace_id, environment_id) REFERENCES platform.environments
);

-- Standby replication is not a backup. One row records attested recovery evidence
-- for one protected resource; it does not create a backup or promote a replica.
CREATE TABLE recovery.backup_evidence (
 tenant_id uuid NOT NULL, workspace_id uuid NOT NULL, environment_id uuid NOT NULL,
 evidence_id uuid NOT NULL,
 store_kind text NOT NULL CHECK (store_kind IN ('aurora','dynamodb','s3','kafka_archive','temporal','configuration')),
 resource_ref text NOT NULL, recovery_point_ref text NOT NULL,
 observed_at timestamptz NOT NULL, recovery_watermark timestamptz NOT NULL,
 last_restore_test timestamptz, retention_until timestamptz NOT NULL,
 status text NOT NULL CHECK (status IN ('unknown','copying','available','restore_test_passed','failed','expired')),
 key_recovery_evidence_ref text, erasure_replay_evidence_ref text,
 PRIMARY KEY (tenant_id, workspace_id, environment_id, evidence_id),
 FOREIGN KEY (tenant_id, workspace_id, environment_id) REFERENCES platform.environments,
 CHECK (retention_until > recovery_watermark),
 CHECK (status <> 'restore_test_passed' OR (last_restore_test IS NOT NULL AND key_recovery_evidence_ref IS NOT NULL AND erasure_replay_evidence_ref IS NOT NULL))
);
CREATE TABLE recovery.restore_runs (
 tenant_id uuid NOT NULL, workspace_id uuid NOT NULL, environment_id uuid NOT NULL,
 restore_id uuid NOT NULL, approval_ref text NOT NULL,
 state text NOT NULL CHECK (state IN ('requested','fencing','restoring','erasing','replaying','reconciling','verifying','canary','reopened','blocked','failed')),
 evidence_ref text, version bigint NOT NULL DEFAULT 1,
 started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 PRIMARY KEY (tenant_id, workspace_id, environment_id, restore_id),
 FOREIGN KEY (tenant_id, workspace_id, environment_id) REFERENCES platform.environments
);
-- Control-domain mutations append this outbox in THE SAME SQL transaction.
-- CDC and a bounded pending reconciler publish with stable event IDs. Marking
-- published happens only after Kafka quorum ACK; duplicate transport is expected.
CREATE TABLE platform.outbox (
 tenant_id uuid NOT NULL, workspace_id uuid NOT NULL, environment_id uuid NOT NULL,
 event_id uuid NOT NULL, event_type varchar(128) NOT NULL,
 payload_ref text NOT NULL, state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','published')),
 created_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz,
 PRIMARY KEY (tenant_id, workspace_id, environment_id, event_id),
 FOREIGN KEY (tenant_id, workspace_id, environment_id) REFERENCES platform.environments,
 CHECK (state <> 'published' OR published_at IS NOT NULL)
);
CREATE INDEX pending_outbox ON platform.outbox (created_at, event_id) WHERE state='pending';
CREATE INDEX incident_investigation ON security.incidents (tenant_id, workspace_id, environment_id, observed_at DESC);

-- Fail-closed RLS for all scoped tables. Null/unset context never matches a UUID.
-- The deployment must use a non-owner, NOSUPERUSER, NOBYPASSRLS runtime role and
-- SET LOCAL via parameterized set_config(..., true) inside each transaction.
-- RLS is a defence layer; it does not authenticate a caller-supplied tenant ID.
DO $$
DECLARE row record; predicate text;
BEGIN
 FOR row IN SELECT schemaname, tablename FROM pg_tables
 WHERE schemaname IN ('platform','delivery','security','recovery') LOOP
  predicate := 'tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid';
  IF row.tablename <> 'tenants' THEN
   predicate := predicate || ' AND workspace_id = nullif(current_setting(''app.workspace_id'', true), '''')::uuid';
  END IF;
  IF row.tablename NOT IN ('tenants','workspaces') THEN
   predicate := predicate || ' AND environment_id = nullif(current_setting(''app.environment_id'', true), '''')::uuid';
  END IF;
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',row.schemaname,row.tablename);
  EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',row.schemaname,row.tablename);
  EXECUTE format('CREATE POLICY scoped_access ON %I.%I USING (%s) WITH CHECK (%s)',row.schemaname,row.tablename,predicate,predicate);
  EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC',row.schemaname,row.tablename);
 END LOOP;
END $$;
-- Runtime grants, service-owned writes, partitioning, migration compatibility and
-- real cross-tenant SQL tests are explicit remaining DAT-001/PLT-003 gates.
COMMIT;

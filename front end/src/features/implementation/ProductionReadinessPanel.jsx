import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Notice, downloadJson} from '../../shared/ui/PageLayout.jsx';
import delivery from '../../contracts/delivery-status.json';
import {evaluateReadiness, validateRuntimeSnapshot} from './readiness-model.mjs';

const REQUIRED = ['provider_verifier','placement_authority','kafka_quorum'];

/**
 * A single read-only operational/evidence view inside the EXISTING implementation
 * center. Reuses greeto-card, tabs, tables, buttons and Notice; no new design system.
 * @param {object} props Component dependencies, supplied by the authenticated shell.
 * @param {object} props.scope Trusted tenant_id/workspace_id/environment_id context.
 * @param {Function} [props.loadSnapshot] Authorized, bounded API read accepting
 *   {signal}. Not wired by default: there is no deployed operations API yet.
 * @returns {React.ReactElement} Implementation facts and separately labelled health.
 * Side effects: optional authorized read and local JSON export only. Never deploys,
 * changes pipelines, executes shell commands, replays webhooks or promotes a DB.
 */
export default function ProductionReadinessPanel({scope, loadSnapshot} = {}) {
  const [view,setView] = useState('delivery');
  const [snapshot,setSnapshot] = useState(null);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [nowMs,setNowMs] = useState(Date.now());
  const request = useRef(null);
  const generation = useRef(0);
  // Changing scope cancels the old read and clears evidence so it cannot leak into
  // another tenant's panel. An unmounted request never commits its response state.
  const scopeKey = JSON.stringify([scope?.tenant_id,scope?.workspace_id,scope?.environment_id]);
  useEffect(() => { generation.current++; request.current?.abort(); setSnapshot(null); setError(''); setLoading(false);
    return () => { generation.current++;request.current?.abort(); };
  }, [scopeKey]);
  useEffect(() => {if (!snapshot) return;const timer=setInterval(()=>setNowMs(Date.now()),1000);return()=>clearInterval(timer);},[snapshot]);
  const visibleSnapshot = snapshot && JSON.stringify([snapshot.scope.tenant_id,snapshot.scope.workspace_id,snapshot.scope.environment_id]) === scopeKey ? snapshot : null;
  const readiness = useMemo(() => evaluateReadiness(REQUIRED,visibleSnapshot,nowMs), [visibleSnapshot,nowMs]);

  /** A click reads real evidence only through the supplied authorized API adapter. */
  async function refresh() {
    if (!loadSnapshot || !scope || loading) return;
    request.current?.abort();const controller = new AbortController();request.current = controller;
    const current = ++generation.current;setLoading(true);setError('');
    try {
      const response = await loadSnapshot({signal:controller.signal});
      const checked = validateRuntimeSnapshot(response,scope);
      if (generation.current === current && !controller.signal.aborted) setSnapshot(checked);
    } catch (failure) {
      if (generation.current === current && !controller.signal.aborted) {setSnapshot(null);setError('Operational evidence could not be verified. No action was performed.');}
    } finally { if (generation.current === current) setLoading(false); }
  }

  return <section aria-label="Production readiness and delivery evidence">
    <Notice>Repository implementation status is not production health. A passing local test does not activate a channel, provision a backup or enable Secure Boot.</Notice>
    <div className="greeto-stat-grid">
      <div className="greeto-stat"><span>Baseline work packages</span><strong>{delivery.baseline_count}</strong><small>Original IDs and dependencies retained</small></div>
      <div className="greeto-stat"><span>Certified Done</span><strong>{delivery.certified_done}</strong><small>Full acceptance evidence required</small></div>
      <div className="greeto-stat"><span>Production ingress</span><strong>{readiness.ready ? 'Evidence passes' : 'Blocked'}</strong><small>{visibleSnapshot ? 'Observed runtime evidence' : 'No connected runtime evidence'}</small></div>
      <div className="greeto-stat"><span>Repository branch</span><strong>main</strong><small>No automatic deployment</small></div>
    </div>
    <div className="greeto-tabs" aria-label="Readiness sections">{[['delivery','Development status'],['runtime','API / webhook stages'],['recovery','Backups & security'],['contracts','Contracts & parameters']].map(([id,label]) => <button type="button" key={id} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</button>)}</div>
    {view==='delivery' && <div className="greeto-card"><h2>Current increment</h2><p>{delivery.summary}</p><p>Evidence date: {delivery.as_of}. Source and prerequisite status are separate.</p>
      <div className="greeto-table-wrap"><table><thead><tr><th>Work package</th><th>Delivery status</th><th>Source contribution</th><th>Remaining acceptance</th></tr></thead><tbody>{delivery.items.map(item=><tr key={item.id}><td><code>{item.id}</code></td><td><span className="greeto-badge muted">{item.status}</span></td><td>{item.contribution}</td><td>{item.remaining}</td></tr>)}</tbody></table></div>
      <button type="button" className="greeto-button" onClick={()=>downloadJson(delivery,'greeto-delivery-status.json')}>Export development status</button>
    </div>}
    {view==='runtime' && <div className="greeto-card"><h2>Durable acceptance and stage evidence</h2><p>The callback fast path never waits for AI, CRM, workflow execution or search before acknowledging its durable journal.</p>
      <ol>{delivery.ingress_stages.map(stage=><li key={stage.id}><strong>{stage.label}</strong> — {stage.acknowledgement}</li>)}</ol>
      <button type="button" className="greeto-button" onClick={refresh} disabled={!loadSnapshot || !scope || loading}>{loading?'Reading evidence…':'Refresh live evidence'}</button>
      {!loadSnapshot && <Notice>The authorized operations API is not connected. This control cannot manufacture healthy states.</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <div className="greeto-table-wrap"><table><thead><tr><th>Dependency</th><th>Observed state</th><th>Observed at</th><th>Evidence reference</th></tr></thead><tbody>{readiness.checks.map(check=><tr key={check.id}><td><code>{check.id}</code></td><td>{check.state}</td><td>{check.observed_at || 'Not observed'}</td><td>{check.evidence_ref || 'None'}</td></tr>)}</tbody></table></div>
      <Notice>HTTP 200/202, provider acceptance, delivery, reading and verified business outcome remain separate facts. UNKNOWN provider outcomes are reconciled, not blindly resent.</Notice>
    </div>}
    {view==='recovery' && <div className="greeto-card"><h2>Recovery and security gates</h2><div className="greeto-table-wrap"><table><thead><tr><th>Control</th><th>Status</th><th>Required evidence</th></tr></thead><tbody>{delivery.controls.map(control=><tr key={control.id}><td>{control.name}</td><td>{control.state}</td><td>{control.evidence_required}</td></tr>)}</tbody></table></div>
      <Notice>Restore requires authorized fencing, verified backups and keys, erasure reapplication, checkpoint replay, UNKNOWN-action reconciliation, policy checks and a canary. A second writable database is not an automatic recovery mechanism.</Notice>
    </div>}
    {view==='contracts' && <div className="greeto-card"><h2>Developer contracts</h2><p>The repository contains OpenAPI, SQL and DynamoDB access-pattern documents. Proposed APIs are explicitly labelled contract-only; there is no universal decrypt, shell execution or approval-bypass endpoint.</p>
      <dl className="greeto-details"><dt>Swagger / OpenAPI</dt><dd><code>backend/contracts/openapi.json</code></dd><dt>Control schema</dt><dd><code>backend/db/migrations/0001_foundation.sql</code></dd><dt>Operational datastore</dt><dd><code>backend/contracts/dynamodb-tables.json</code></dd><dt>Kafka contract</dt><dd><code>backend/contracts/kafka-policy.json</code></dd><dt>One-command local checks</dt><dd><code>python tools/check_foundation.py</code></dd><dt>Pipeline authority</dt><dd>Owner approval required before any change; main-only source publication does not authorize deployment.</dd></dl>
    </div>}
  </section>;
}

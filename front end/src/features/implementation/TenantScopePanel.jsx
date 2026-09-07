import React, {useEffect, useState} from 'react';
import { Notice } from '../../shared/ui/PageLayout.jsx';
import { tenantScopeView } from './tenant-scope-model.mjs';

/**
 * Tenant-scoped diagnostic section of the existing Implementation Center.
 * @param {object} props Presentation inputs, never authentication credentials.
 * @param {object|null} props.expectedScope Scope selected by the authenticated host.
 * @param {object|null} props.observation Authorized snapshot and freshness metadata.
 * @returns {React.ReactElement} Lifecycle, scope fields and explicit integration gates.
 * Effects: local expiry clock only. No network, storage, provisioning or side effects.
 * Undefined props show the disconnected state; no synthetic tenant is inserted.
 */
export default function TenantScopePanel({expectedScope=null, observation=null}) {
  const [nowMs,setNowMs]=useState(()=>Date.now());
  useEffect(()=>{
    const timer=window.setInterval(()=>setNowMs(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[]);
  const view=tenantScopeView({expectedScope,observation,nowMs});
  return <section className="greeto-card" aria-labelledby="tenant-scope-title">
    <p className="greeto-eyebrow">Platform / PLT-001</p>
    <h2 id="tenant-scope-title">Tenant, workspace and environment isolation</h2>
    <p role="status"><span className="greeto-badge muted">{view.label}</span></p>
    <p>{view.explanation}</p>
    <Notice>Implementation candidate only. This view cannot provision a tenant, authorize a provider action, change ownership, approve a release or certify a backup. The database and authentication adapters remain integration gates.</Notice>
    {view.details.length>0 && <dl className="greeto-details">{view.details.map(([key,value])=><React.Fragment key={key}><dt>{key}</dt><dd><code>{value}</code></dd></React.Fragment>)}</dl>}
    <div className="greeto-table-wrap"><table>
      <caption>Scope contract and actual module ownership</caption>
      <thead><tr><th>Parameter / boundary</th><th>Behavior</th><th>Owning function</th></tr></thead>
      <tbody>
        <tr><td>tenantId / workspaceId / environmentId</td><td>Three explicit UUIDs. Validation never grants authority. Cross-scope results are rejected.</td><td><code>parseTenantScope</code></td></tr>
        <tr><td>Principal and object permission</td><td>Grant verification precedes every database lookup. Caller permission arrays are not trusted.</td><td><code>TenantScopeService.inspect</code></td></tr>
        <tr><td>Transaction scope</td><td>Read-only transaction; parameterized transaction-local context, role/RLS guard, composite-key lookup and commit.</td><td><code>PostgresScopeReader.read</code></td></tr>
        <tr><td>Cell / epoch / environment kind</td><td>Compare trusted routing context to stored ownership. Epochs remain lossless decimal strings.</td><td><code>TenantScopeService.requireStatusWrite</code></td></tr>
        <tr><td>observedAt / expiresAt</td><td>Freshness metadata comes from the future authorized observation adapter. Expired values are never displayed as current.</td><td><code>tenantScopeView</code></td></tr>
      </tbody>
    </table></div>
    <p className="greeto-muted">Backend: <code>backend/services/core/src/platform/</code>. The existing F01 provisioning saga, F03 acknowledgement order, selected database and release gates are unchanged.</p>
  </section>;
}

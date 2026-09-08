import React, {useEffect,useState} from 'react';
import { Notice } from '../../shared/ui/PageLayout.jsx';
import { deliveryLifecycleView, lifecycleParameters } from './delivery-lifecycle-view.mjs';

/**
 * @param {object} props Read-only backend projection inputs; no route or grant changes.
 * @param {object} [props.expectedScope] Server-resolved tenant/workspace/environment.
 * @param {object} [props.observation] One authenticated durable-outcome projection.
 * @returns {React.ReactElement} Existing-design evidence, due time and parameter guide.
 * Side effects: cleaned-up freshness timer only. No replay, network or secret input.
 * Unconnected inputs remain explicit. A due timestamp is not a send acknowledgement.
 */
export default function WebhookDeliveryPanel({expectedScope,observation}={}) {
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const view=deliveryLifecycleView({expectedScope,observation,now});
 return <section className="greeto-card" aria-labelledby="webhook-delivery-title">
  <div className="greeto-card-heading"><div><p className="greeto-eyebrow">F07 / Delivery lifecycle</p><h2 id="webhook-delivery-title">Retry decisions and outcome receipts</h2></div><span className="greeto-badge muted">{view.label}</span></div>
  <Notice>{view.detail}</Notice>
  {view.state==='observed'&&<dl className="greeto-details"><dt>Delivery</dt><dd><code>{view.deliveryId}</code></dd><dt>Attempt</dt><dd><code>{view.attemptId}</code></dd><dt>Observed HTTP status</dt><dd>{view.httpStatus||'No conclusive HTTP response'}</dd><dt>Next attempt</dt><dd>{view.nextAttemptAt?<time dateTime={view.nextAttemptAt}>{view.nextAttemptAt}</time>:'No automatic retry scheduled'}</dd></dl>}
  <div className="greeto-table-wrap"><table><caption>Host-owned lifecycle parameters</caption><thead><tr><th>Parameter</th><th>Type</th><th>Purpose and boundary</th></tr></thead><tbody>{lifecycleParameters.map(([name,type,description])=><tr key={name}><td><code>{name}</code></td><td>{type}</td><td>{description}</td></tr>)}</tbody></table></div>
  <p className="greeto-muted">Source implementation is not a connected ledger, scheduler or production guarantee. Unknown results require reconciliation, even after a deadline.</p>
  <button type="button" className="greeto-button" disabled aria-describedby="webhook-delivery-disabled">Inspect persisted delivery</button>
  <p id="webhook-delivery-disabled" className="greeto-muted">Requires the authenticated delivery API and durable WebhookDelivery adapter. No browser execution is enabled.</p>
 </section>;
}

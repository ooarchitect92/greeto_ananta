import React, {useEffect,useState} from 'react';
import {Notice} from '../../shared/ui/PageLayout.jsx';
import {outboxView} from './outbox-view.mjs';

const steps=[
  ['Committed source','The status change, history and pending outbox row already exist in one SQL transaction.'],
  ['Resolve & authorize','Read the scoped committed history; verify ownership and the current workload grant.'],
  ['Publish same event','The certified transport adapter retains event identity and publishes the minimized fact.'],
  ['Observe transport ACK','Only an exact event/hash acknowledgement may advance to marking. Unknown stays unconfirmed.'],
  ['Commit marker','Reauthorize, re-read/lock the same fact, then commit its published marker.'],
];
const labels={not_connected:'Not connected',unavailable:'Unavailable',stale:'Stale observation',blocked:'Unresolved events',pending:'Unconfirmed outcomes',observed:'Page observed'};
/**
 * @param {object} props Host-supplied authenticated expectedScope and optional observation.
 * @returns {React.ReactElement} The existing-design outbox explanation and page evidence.
 * Parameters: expectedScope (tenant/workspace/environment UUIDs); observation
 * (authorized_adapter, kind=control_status_outbox_page, UTC times, five counters).
 * Side effects: expiry timer only. No API call, retry, replay, publication or approval.
 * Until a real authorized adapter is connected, counters are withheld, not zeroed.
 */
export default function OutboxStatusPanel({expectedScope,observation}={}) {
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  const view=outboxView({expectedScope,observation,now});
  return <section className="greeto-card" aria-labelledby="outbox-status-heading">
    <div className="greeto-card-heading"><div><p className="greeto-eyebrow">Delivery / Durable event relay</p>
      <h2 id="outbox-status-heading">Status outbox & acknowledgements</h2></div>
      <span className="greeto-badge muted" role="status">{labels[view.state]}</span></div>
    <Notice>{view.reason} SQL publication markers, Kafka acceptance, downstream processing and business outcomes are separate facts.</Notice>
    {view.counts&&<div className="greeto-stat-grid">{[
      ['scanned','Scanned in this page'],['published','ACK + marker committed'],['alreadyPublished','Previously marked'],
      ['pending','Unconfirmed'],['blocked','Unresolved']
    ].map(([key,label])=><div className="greeto-stat" key={key}><span>{label}</span><strong>{view.counts[key]}</strong></div>)}</div>}
    {view.observedAt&&<p className="greeto-muted">Observed at <time dateTime={view.observedAt}>{view.observedAt}</time>. This is one bounded scan page, not the total pending backlog.</p>}
    <div className="greeto-table-wrap"><table><caption>Control-data outbox path; the provider webhook F03 path is unchanged.</caption>
      <thead><tr><th scope="col">Stage</th><th scope="col">Evidence boundary</th></tr></thead>
      <tbody>{steps.map(([name,description],i)=><tr key={name}><th scope="row">{i+1}. {name}</th><td>{description}</td></tr>)}</tbody>
    </table></div>
    <p className="greeto-muted">A recovery sweep restarts from the beginning after finishing its bounded pages. An earlier failed or late-committing record must not be skipped permanently. No event is deleted by this relay.</p>
    <button type="button" className="greeto-button" disabled aria-describedby="outbox-action-gate">Run outbox diagnostics</button>
    <p id="outbox-action-gate" className="greeto-muted">Disabled until authenticated diagnostic routing, the real PostgreSQL driver, approved event transport and integration evidence are connected. This page cannot publish, replay or approve code.</p>
  </section>;
}

import React, {useEffect, useState} from 'react';
import {Notice} from '../../shared/ui/PageLayout.jsx';
import {egressView, egressParameters} from './egress-view.mjs';

/**
 * @param {object} props Authenticated host observations, not editable user input.
 * @param {object=} props.expectedScope Server-resolved tenant/workspace/environment.
 * @param {object=} props.observation Minimized, authorized single-attempt result.
 * @returns {React.ReactElement} Existing-design egress boundary and parameter view.
 * Side effects: a cleaned-up display expiry timer only. No DNS, network request,
 * key entry, approval, status mutation, replay or production health certification.
 */
export default function EgressBoundaryPanel({expectedScope, observation} = {}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const view = egressView({expectedScope, observation, now});
  return <section className="greeto-card" aria-labelledby="egress-boundary-title">
    <p className="greeto-eyebrow">F07 / WHK-007 / SEC-009</p>
    <h2 id="egress-boundary-title">Outbound webhook egress</h2>
    <Notice>The proxy-side transport is source code, not a deployed egress proxy. The Action Gateway, durable delivery record, authenticated proxy host and network isolation remain required.</Notice>
    <p role="status"><span className="greeto-badge muted">{view.state.replaceAll('_', ' ')}</span> {view.reason}</p>
    {view.details && <dl className="greeto-details">
      <dt>Single attempt</dt><dd>{view.details.outcome.replaceAll('_', ' ')}</dd>
      <dt>Observed HTTP response</dt><dd>{view.details.statusCode || 'Not observed'}</dd>
      <dt>Response collection</dt><dd>{view.details.bodyComplete ? 'Bounded read completed' : 'Incomplete or withheld'} · {view.details.responseBytes} bytes</dd>
      <dt>Diagnostic code</dt><dd><code>{view.details.failureCode || 'None'}</code></dd>
    </dl>}
    <h3>Proxy-side controls</h3>
    <p>Current permit → HTTPS destination → every resolved IPv4/IPv6 address → pinned TCP peer → verified TLS hostname → current permit → one POST → bounded response observation. Redirects and automatic retries are disabled.</p>
    <Notice>A 2xx remains endpoint acceptance even if later response-body collection fails. It is not business completion. Private enterprise destinations require the separately approved connector, not a public-network exception.</Notice>
    <div className="greeto-table-wrap"><table><thead><tr><th>Parameter</th><th>Type / bounds</th><th>Ownership and purpose</th></tr></thead><tbody>
      {egressParameters.map(([name, type, description]) => <tr key={name}><td><code>{name}</code></td><td>{type}</td><td>{description}</td></tr>)}
    </tbody></table></div>
    <button className="greeto-button" type="button" disabled aria-describedby="egress-check-disabled">Run approved endpoint check</button>
    <p id="egress-check-disabled" className="greeto-muted">Disabled until the authenticated diagnostic host, Action Gateway permit and durable attempt ledger are connected. This page cannot submit URLs, send webhooks or enable private-network access.</p>
  </section>;
}

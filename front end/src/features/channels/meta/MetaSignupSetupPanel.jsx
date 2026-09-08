import React, { useEffect, useState } from 'react';
import { Notice } from '../../../shared/ui/PageLayout.jsx';
import { inspectSignupSetup, META_CONNECTION_STEPS } from './signup-setup-model.mjs';

/**
 * F02 preparation within the existing Channel Center; not a second provider app.
 * @param {object} props
 * @param {object|null} props.setup Optional public prepared DTO from an authenticated
 *   host. The current studio supplies none: a form draft cannot impersonate the host.
 * @param {object|null} props.expectedScope Exact server-owned ID tuple (not UI labels).
 * @returns {React.ReactElement} Stepwise review and fixed disabled launch control.
 * No keys, arbitrary JSON editor, session storage, SDK or provider request is used.
 * The bounded local freshness tick cannot establish server authority or readiness.
 */
export default function MetaSignupSetupPanel({setup = null, expectedScope = null}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!setup) return undefined;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [setup]);
  const view = inspectSignupSetup(setup, expectedScope, nowMs);
  return <section className="greeto-card" aria-labelledby="meta-setup-title">
    <div className="greeto-card-heading">
      <h2 id="meta-setup-title">Meta onboarding — configuration preparation</h2>
      <span className="greeto-badge">{view.state === 'prepared' ? 'Prepared, not connected' : 'Setup required'}</span>
    </div>
    <Notice kind={view.state === 'prepared' ? 'info' : 'warning'}>{view.message}</Notice>
    <p className="greeto-muted">This first implementation prepares the reviewed Meta login payload. Configuration preparation is not a completed F02 step. The original connection sequence below remains mandatory.</p>
    {view.parameters.length > 0 && <div className="greeto-table-wrap"><table>
      <caption>Public parameters from the scoped configuration profile</caption>
      <thead><tr><th>Parameter</th><th>Observed value</th></tr></thead>
      <tbody>{view.parameters.map(p => <tr key={p.name}><td><code>{p.name}</code></td><td>{p.value}</td></tr>)}</tbody>
    </table></div>}
    {view.payload && <details><summary>Review the prepared login options</summary><pre className="greeto-code">{view.payload}</pre></details>}
    <details><summary>Parameter ownership and next implementation steps</summary>
      <p>App ID, Graph API version, configuration ID, Embedded Signup version and permitted features must come from one reviewed server profile. No production version or feature is selected automatically.</p>
      <ol className="greeto-step-list">{META_CONNECTION_STEPS.map(step => <li key={step.key}>
        <strong>{step.label}</strong><p className="greeto-muted">{step.detail} Status: not observed by this panel.</p>
      </li>)}</ol>
    </details>
    <div className="greeto-form-actions"><button type="button" className="greeto-button" disabled aria-describedby="meta-launch-boundary">Launch Embedded Signup</button></div>
    <p id="meta-launch-boundary" className="greeto-field-hint">Requires the authenticated server connection attempt, qualified Meta SDK configuration, callback correlation and original prerequisites. This increment never launches the provider, exchanges a code or grants account access.</p>
  </section>;
}

import React, { useEffect, useState } from 'react';
import { inspectSignupCallbackBridge } from './signup-callback-view.mjs';
import { inspectSignupAttempt } from './signup-attempt-model.mjs';
import { Notice } from '../../../shared/ui/PageLayout.jsx';
import { inspectSignupSetup, META_CONNECTION_STEPS } from './signup-setup-model.mjs';

/**
 * F02 preparation within the existing Channel Center; not a second provider app.
 * @param {object} props
 * @param {object|null} props.setup Optional public prepared DTO from an authenticated
 *   host. The current studio supplies none: a form draft cannot impersonate the host.
 * @param {object|null} props.expectedScope Exact server-owned ID tuple (not UI labels).
 * @param {object|null} props.attempt Minimized durable attempt observation; no code or secret.
 * @param {object|null} props.callbackObservation Local, minimized bridge report; NOT provider readiness.
 * @returns {React.ReactElement} Stepwise review and fixed disabled launch control.
 * No keys, arbitrary JSON editor, session storage, SDK or provider request is used.
 * The bounded local freshness tick cannot establish server authority or readiness.
 */
export default function MetaSignupSetupPanel({setup = null, expectedScope = null, attempt = null, callbackObservation = null}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!setup && !attempt && !callbackObservation) return undefined;
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [setup, attempt, callbackObservation]);
  const view = inspectSignupSetup(setup, expectedScope, nowMs);
  const attemptView = inspectSignupAttempt(attempt, expectedScope, nowMs);
  const callbackView = inspectSignupCallbackBridge(callbackObservation, expectedScope, nowMs);
  return <section className="greeto-card" aria-labelledby="meta-setup-title">
    <div className="greeto-card-heading">
      <h2 id="meta-setup-title">Meta onboarding — configuration preparation</h2>
      <span className="greeto-badge">{view.state === 'prepared' ? 'Prepared, not connected' : 'Setup required'}</span>
    </div>
    <Notice kind={view.state === 'prepared' ? 'info' : 'warning'}>{view.message}</Notice>
    <p className="greeto-muted">Configuration preparation and server-attempt tracking are separate steps. Configuration preparation is not a completed F02 step. The original connection sequence below remains mandatory.</p>
    {view.parameters.length > 0 && <div className="greeto-table-wrap"><table>
      <caption>Public parameters from the scoped configuration profile</caption>
      <thead><tr><th>Parameter</th><th>Observed value</th></tr></thead>
      <tbody>{view.parameters.map(p => <tr key={p.name}><td><code>{p.name}</code></td><td>{p.value}</td></tr>)}</tbody>
    </table></div>}
    {view.payload && <details><summary>Review the prepared login options</summary><pre className="greeto-code">{view.payload}</pre></details>}
    <div aria-labelledby="meta-attempt-heading">
      <h3 id="meta-attempt-heading">Step 2 — connection attempt and callback correlation</h3>
      <Notice kind="info">{attemptView.message}</Notice>
      {attemptView.progress && <dl className="greeto-details">
        <dt>Attempt</dt><dd><code>{attemptView.progress.attemptId}</code></dd>
        <dt>Committed revision</dt><dd>{attemptView.progress.version}</dd>
        <dt>Code custody</dt><dd>{attemptView.progress.codeReceived ? 'Acknowledged' : 'Not recorded'}</dd>
        <dt>Session claims</dt><dd>{attemptView.progress.sessionReceived ? 'Recorded; grants unverified' : 'Not recorded'}</dd>
        <dt>Token exchange</dt><dd>Not requested</dd>
      </dl>}
    </div>
    <div aria-labelledby="meta-callback-heading">
      <h3 id="meta-callback-heading">Step 3 — attempt-local SDK callback bridge</h3>
      <Notice kind="info">{callbackView.message}</Notice>
      <p className="greeto-muted">Exact origin and owned window checks precede parsing. Browser observations do not establish server authorization or channel readiness. The live bridge is not attached by this preview.</p>
      {callbackView.details && <dl className="greeto-details">
        <dt>Code host receipt</dt><dd>{callbackView.details.codeAcknowledged ? 'Observed by browser' : 'Not observed'}</dd>
        <dt>Session host receipt</dt><dd>{callbackView.details.sessionAcknowledged ? 'Observed by browser' : 'Not observed'}</dd>
        <dt>Last adapter stage / result</dt><dd>{callbackView.details.stage} / {callbackView.details.result}</dd>
        <dt>Stage elapsed</dt><dd>{callbackView.details.elapsedMs} ms</dd>
        <dt>Server request reference</dt><dd>{callbackView.details.requestId || 'Not observed'}</dd>
      </dl>}
    </div>
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

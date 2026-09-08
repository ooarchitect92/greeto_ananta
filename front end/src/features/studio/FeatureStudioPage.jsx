import React, { useEffect, useRef, useState } from 'react';
import { features, getFeature } from '../../app/navigation/registry.js';
import schemas from '../../contracts/features.json';
import workPackages from '../../contracts/work-packages.json';
import { defaultValues, validateFeature, buildHandoff } from '../../shared/forms/validation.js';
import { loadDraft, saveDraft, clearDraft, draftKey } from '../../shared/state/drafts.js';
import { PageLayout, Notice, StatePage, downloadJson } from '../../shared/ui/PageLayout.jsx';
import ParameterInput from './ParameterInput.jsx';
import MetaSignupSetupPanel from '../channels/meta/MetaSignupSetupPanel.jsx';
export default function FeatureStudioPage({featureId,scope,onNavigate,preview=false}) {
  const feature=schemas.find(f=>f.id===featureId);
  const [tab,setTab]=useState('configure'); const [values,setValues]=useState(()=>feature?defaultValues(feature):{});
  const [errors,setErrors]=useState({}); const [notice,setNotice]=useState(''); const [dirty,setDirty]=useState(false);
  const [valid,setValid]=useState(false); const errorRef=useRef(null);
  const scopeKey=JSON.stringify(scope); let completeScope=true; try{draftKey(scope,featureId);}catch{completeScope=false;}
  useEffect(()=>{
    if (!feature) return;
    setValues(defaultValues(feature));setDirty(false);setValid(false);setErrors({});setNotice('');
    if (!completeScope) return;
    try {const saved=loadDraft(window.sessionStorage,scope,feature);if(saved){setValues({...defaultValues(feature),...saved.values});setNotice('Restored a session draft. It has not been applied to a server.');}}
    catch(error){setNotice(error.message);}
  },[featureId,scopeKey]);
  useEffect(()=>{
    if (!dirty) return;
    const unload=e=>{e.preventDefault();e.returnValue='';};
    const navigate=e=>{if(!window.confirm('This page has unsaved draft changes. Leave without saving?'))e.preventDefault();};
    window.addEventListener('beforeunload',unload);window.addEventListener('greeto:before-navigate',navigate);
    return()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('greeto:before-navigate',navigate);};
  },[dirty]);
  if(!feature)return <StatePage title="Feature not found">Choose a registered feature from navigation.</StatePage>;
  const linked=workPackages.filter(task=>feature.workPackageIds.includes(task.id));
  const update=(name,value)=>{setValues(v=>({...v,[name]:value}));setDirty(true);setValid(false);setErrors(v=>({...v,[name]:undefined}));setNotice('');};
  const check=()=>{const result=validateFeature(feature,values);setErrors(result.errors);setValid(result.valid);if(!result.valid){setNotice('Resolve the highlighted parameter errors.');setTimeout(()=>errorRef.current?.focus(),0);}else setNotice('Browser validation passed. Server authorization, capability checks and execution have not run.');return result;};
  const persist=()=>{try{saveDraft(window.sessionStorage,scope,feature,values);setDirty(false);setNotice('Draft saved in this tab’s session storage only. No server write occurred.');}catch(error){setNotice(error.message);}};
  const exportDraft=()=>{if(!check().valid)return;try{downloadJson(buildHandoff(feature,values),`greeto-${feature.id}-draft.json`);setNotice('Exported a draft for implementation. This is not a publish request or proof of authorization.');}catch(error){setNotice(error.message);}};
  const reset=()=>{if(!window.confirm('Reset this feature’s draft and discard its unsaved changes?'))return;try{if(completeScope)clearDraft(window.sessionStorage,scope,feature.id);setValues(defaultValues(feature));setErrors({});setDirty(false);setValid(false);setNotice('Draft reset to documented defaults.');}catch(error){setNotice(error.message);}};
  return <PageLayout eyebrow={`${feature.group.replaceAll('-',' ')} / Configuration studio`} title={feature.label} description={feature.description}
    actions={<><span className="greeto-badge">Frontend only</span><span className={`greeto-badge ${dirty?'warning':''}`}>{dirty?'Unsaved draft':'Draft'}</span></>}>
    <Notice>Configure and review this feature here. Live execution is unavailable in this increment. {preview?'You are using an isolated, synthetic frontend preview.':'Existing connected screens remain separate and retain their existing integrations.'} Do not enter passwords, access tokens, customer records, or payment details.</Notice>
    <div className="greeto-scope-strip"><span><strong>Tenant</strong>{scope?.tenantId||'Not provided'}</span><span><strong>Workspace</strong>{scope?.workspaceId||'Not provided'}</span><span><strong>Environment</strong>{scope?.environment||'Not provided'}</span><span><strong>Schema</strong>1.0 · Browser validation</span></div>
    {!completeScope&&<Notice kind="warning">Session draft storage is disabled until the existing session provides a complete tenant, workspace, environment and user scope. No scope is invented. Parameters may still be reviewed and exported without authorization claims.</Notice>}
    <div className="greeto-tabs" aria-label="Feature sections">{[['configure','Configure'],['parameters',`Parameters (${feature.fields.length})`],['implementation','Implementation']].map(([id,label])=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {featureId==='channel-center'&&tab==='configure'&&<MetaSignupSetupPanel/>}
    {notice&&<div className="greeto-feedback" role="status">{notice}</div>}
    {tab==='configure'&&<div className="greeto-studio-grid"><div className="greeto-card"><div className="greeto-card-heading"><h2>Configuration parameters</h2><span className="greeto-muted">Required fields are marked *</span></div>
      {Object.values(errors).some(Boolean)&&<div className="greeto-notice error" ref={errorRef} tabIndex={-1} role="alert"><strong>Check your parameters</strong><ul>{Object.entries(errors).filter(([,message])=>message).map(([key,message])=><li key={key}>{key}: {message}</li>)}</ul></div>}
      <form noValidate onSubmit={e=>{e.preventDefault();check();}}><div className="greeto-form-grid">{feature.fields.map(field=><ParameterInput key={field.name} field={field} value={values[field.name]} onChange={value=>update(field.name,value)} error={errors[field.name]}/>)}</div>
      {!feature.fields.length&&<p className="greeto-muted">No separate configuration is required for this page.</p>}
      <div className="greeto-form-actions"><button type="submit" className="greeto-button primary">Validate parameters</button><button type="button" className="greeto-button" disabled={!completeScope} onClick={persist}>Save session draft</button><button type="button" className="greeto-button" onClick={exportDraft}>Export draft JSON</button><button type="button" className="greeto-button quiet" onClick={reset}>Reset draft</button></div></form>
      {valid&&<p className="greeto-valid">Parameter shape valid · Server verification pending</p>}
    </div><aside className="greeto-card greeto-studio-aside"><h2>Implementation boundary</h2><dl className="greeto-details"><dt>Frontend</dt><dd>Configuration and validation</dd><dt>Backend</dt><dd>Not connected by this increment</dd><dt>Source</dt><dd>{feature.sourceSection}</dd><dt>Owning component</dt><dd><code>{feature.component}</code></dd></dl>
      <button className="greeto-button" type="button" disabled aria-describedby="execution-limit">Apply to server</button><p id="execution-limit" className="greeto-field-hint">Requires a verified endpoint, server-derived scope, authorization, version checks, evidence and end-to-end tests.</p>
      <h3>Prerequisite features</h3>{feature.dependencies.length?feature.dependencies.map(id=><button className="greeto-text-link" type="button" key={id} onClick={()=>onNavigate(id)}>{features.find(f=>f.id===id)?.label||id} →</button>):<p className="greeto-muted">Foundation contracts; see the work packages.</p>}
      <h3>Outcome vocabulary</h3><p className="greeto-muted">Queued, provider accepted, delivered, read and business success are separate facts. Unknown remains unknown until evidence resolves it.</p>
    </aside></div>}
    {tab==='parameters'&&<div className="greeto-card"><h2>Parameter contract</h2><p className="greeto-muted">Names are stable handoff keys. Defaults do not imply provider support or production readiness.</p><div className="greeto-table-wrap"><table><thead><tr><th>Parameter</th><th>Type / required</th><th>Default</th><th>Rules and meaning</th></tr></thead><tbody>{feature.fields.map(field=><tr key={field.name}><td><code>{field.name}</code><br/>{field.label}</td><td>{field.type}<br/>{field.required?'Required':'Optional'}</td><td><code>{JSON.stringify(field.default)}</code></td><td>{field.description}<br/>{field.options&&`Options: ${field.options.join(', ')}`}{field.min!==undefined&&` Range ${field.min}–${field.max}.`}{field.pattern&&<code>{field.pattern}</code>}</td></tr>)}</tbody></table></div>
      <h3>Proposed integration</h3>{feature.contract?<pre className="greeto-code">{JSON.stringify(feature.contract,null,2)}</pre>:<Notice>No endpoint is asserted for this configuration. Confirm the authoritative backend contract before integration.</Notice>}
    </div>}
    {tab==='implementation'&&<div className="greeto-card"><h2>Implement one step at a time</h2><ol className="greeto-step-list">{feature.implementationSteps.map(step=><li key={step}>{step}</li>)}</ol><h3>Source work packages ({linked.length})</h3><p className="greeto-muted">These are domain-level associations, not claims that every package is implemented by this screen.</p><div className="greeto-task-links">{linked.map(task=><button type="button" key={task.id} onClick={()=>onNavigate(`implementation?task=${task.id}`)}><strong>{task.id}</strong> {task.name}<span>{task.gate} · {task.priority}</span></button>)}</div></div>}
  </PageLayout>;
}

import React, {useEffect,useState,useRef,Suspense,lazy} from 'react';
import WorkspaceSidebar from './layouts/WorkspaceSidebar.jsx';
import { getFeature } from './navigation/registry.js';
import { PageLayout, Notice } from '../shared/ui/PageLayout.jsx';
const FeatureStudioPage=lazy(()=>import('../features/studio/FeatureStudioPage.jsx'));
const ImplementationCenter=lazy(()=>import('../features/implementation/ImplementationCenter.jsx'));
const scope={tenantId:'preview-tenant',workspaceId:'preview-workspace',environment:'simulation',userId:'preview-reviewer'};
const readFeature=()=>new URLSearchParams(window.location.search).get('feature')||'implementation';
/** Development-only component. Never mounts legacy API clients or authentication flows. */
export default function FrontendPreview(){
  const approvedUrlRef=useRef(window.location.pathname+window.location.search);
  const [active,setActive]=useState(readFeature);const feature=getFeature(active);
  const navigate=target=>{
    const event=new Event('greeto:before-navigate',{cancelable:true});if(!window.dispatchEvent(event))return;
    const [id,query='']=target.split('?'); const params=new URLSearchParams(query);params.set('feature',id);
    window.history.pushState(null,'',`/frontend-preview?${params}`);setActive(id);window.dispatchEvent(new PopStateEvent('popstate'));
  };
  useEffect(()=>{const update=event=>{if(event.isTrusted&&!window.dispatchEvent(new Event('greeto:before-navigate',{cancelable:true}))){window.history.pushState(null,'',approvedUrlRef.current);return;}approvedUrlRef.current=window.location.pathname+window.location.search;setActive(readFeature());};window.addEventListener('popstate',update);return()=>window.removeEventListener('popstate',update);},[]);
  useEffect(()=>{document.title=`${feature?.label||'Not found'} | Greeto frontend preview`;},[active]);
  return <div className="greeto-workspace-shell"><WorkspaceSidebar activePage={active} onNavigate={navigate} role="admin" userName="Frontend reviewer" preview/>
    <main id="workspace-main" className="greeto-workspace-main greeto-preview-main" tabIndex={-1}><div className="greeto-preview-banner">DEVELOPMENT PREVIEW · Synthetic scope · No API execution</div><Suspense fallback={<div className="greeto-page" role="status">Loading frontend module…</div>}>
      {active==='implementation'?<ImplementationCenter onNavigate={navigate}/>:feature?.uiStatus==='frontend_configuration'?<FeatureStudioPage key={active} featureId={active} scope={scope} onNavigate={navigate} preview/>:<PageLayout eyebrow="Existing application" title={feature?.label||'Feature not found'} description={feature?.description||'The requested route is not registered.'}><Notice>{feature?'This is an existing live-integrated screen. It is not mounted in the isolated preview, to avoid issuing authentication or backend requests. Open it through a configured, authenticated workspace.':'Choose a feature from the navigation.'}</Notice>{feature&&<div className="greeto-card"><code>{feature.component}</code><p>Route: {feature.route}</p><p>Backend state: existing integration, not verified in this frontend increment.</p></div>}<button type="button" className="greeto-button" onClick={()=>navigate('implementation')}>Return to implementation center</button></PageLayout>}
    </Suspense></main>
  </div>;
}

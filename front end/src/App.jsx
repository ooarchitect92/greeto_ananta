import React, {lazy,Suspense} from 'react';
const GreetoWorkspace=lazy(()=>import('./app/GreetoWorkspace.jsx'));
// Production builds do not expose a synthetic user as a way around authentication.
const FrontendPreview=import.meta.env.DEV?lazy(()=>import('./app/FrontendPreview.jsx')):null;
export default function App(){
  const preview=Boolean(FrontendPreview)&&window.location.pathname==='/frontend-preview';
  return <Suspense fallback={<div className="greeto-page" role="status">Loading Greeto…</div>}>{preview?<FrontendPreview/>:<GreetoWorkspace/>}</Suspense>;
}

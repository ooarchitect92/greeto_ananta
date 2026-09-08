import React, { useEffect, useRef, useState } from 'react';
import { groups, getFeature } from '../navigation/registry.js';
import { filterNavigation } from '../navigation/policy.js';
import { features } from '../navigation/registry.js';
export default function WorkspaceSidebar({activePage, onNavigate, role, userName, onLogout, preview=false}) {
  const [query,setQuery] = useState(''); const [mobileOpen,setMobileOpen] = useState(false);
  const [collapsed,setCollapsed] = useState(() => Object.fromEntries(groups.map(g => [g.id, g.id !== getFeature(activePage)?.group]))); const navRef = useRef(null); const trigger = useRef(null);
  const matches = filterNavigation(features, role, query);
  const activeGroup = getFeature(activePage)?.group;
  useEffect(() => {setMobileOpen(false);setCollapsed(v=>({...v,[getFeature(activePage)?.group]:false}));}, [activePage]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement; navRef.current?.querySelector('button')?.focus();
    const handle = e => {
      if (e.key === 'Escape') {setMobileOpen(false);trigger.current?.focus();}
      if (e.key === 'Tab') {
        const els = [...(navRef.current?.querySelectorAll('button:not([disabled]),input,a[href]') || [])].filter(el => el.getClientRects().length);
        const first=els[0],last=els.at(-1);
        if (e.shiftKey && document.activeElement === first) {e.preventDefault();last?.focus();}
        else if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',handle);
    return () => {document.removeEventListener('keydown',handle); if (previous?.isConnected) previous.focus();};
  },[mobileOpen]);
  return <>
    <a className="greeto-skip" href="#workspace-main">Skip to workspace</a>
    <div className="greeto-mobile-bar"><button ref={trigger} type="button" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="greeto-navigation" onClick={()=>setMobileOpen(true)}>☰</button><span>{getFeature(activePage)?.label || 'Greeto'}</span></div>
    {mobileOpen && <button className="greeto-nav-backdrop" aria-label="Close navigation" onClick={()=>setMobileOpen(false)} />}
    <aside id="greeto-navigation" ref={navRef} className={`greeto-sidebar ${mobileOpen?'is-open':''}`} aria-label="Workspace navigation">
      <div className="greeto-brand"><img src="/logo.svg" alt="Greeto"/><button className="greeto-mobile-close" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}>×</button></div>
      <p className="greeto-nav-caption">{preview?'Frontend review • No live actions':'Customer Action OS'}</p>
      <label className="greeto-nav-search"><span className="greeto-sr-only">Find a feature</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a feature…"/></label>
      <nav className="greeto-nav-scroll" aria-label="Features">
        {groups.map(group => {
          const entries=matches.filter(f=>f.group===group.id); if (!entries.length) return null;
          const expanded=Boolean(query)||!collapsed[group.id];
          return <div className="greeto-nav-group" key={group.id}>
            <button className="greeto-group-toggle" type="button" aria-expanded={expanded} aria-controls={`nav-${group.id}`} onClick={()=>setCollapsed(s=>({...s,[group.id]:!s[group.id]}))}><span>{group.label}</span><span aria-hidden="true">{expanded?'−':'+'}</span></button>
            {expanded && <div id={`nav-${group.id}`}>{entries.map(feature=><button key={feature.id} id={['inbox','campaigns','settings'].includes(feature.id)?`tour-nav-${feature.id}`:`nav-${feature.id}`} type="button" className="greeto-nav-item" aria-current={activePage===feature.id?'page':undefined} onClick={()=>onNavigate(feature.id)} title={feature.description}><span>{feature.label}</span>{feature.uiStatus!=='existing_screen'&&<span className="greeto-nav-dot" aria-label="Frontend configuration"/>}</button>)}</div>}
          </div>;
        })}
        {!matches.length && <p className="greeto-nav-caption" role="status">No matching features for this role.</p>}
      </nav>
      <footer className="greeto-nav-footer"><strong>{userName || 'Workspace user'}</strong><span>{role || 'No role'}{preview?' · isolated preview':''}</span>{onLogout&&<button type="button" onClick={onLogout}>Log out</button>}</footer>
    </aside>
  </>;
}

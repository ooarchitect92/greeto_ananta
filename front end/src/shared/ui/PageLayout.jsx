import React from 'react';
export function PageLayout({eyebrow, title, description, actions, children}) {
  return <section className="greeto-page" aria-label={title}>
    <header className="greeto-page-header"><div><p className="greeto-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="greeto-description">{description}</p></div>{actions && <div className="greeto-actions">{actions}</div>}</header>
    {children}
  </section>;
}
export function Notice({children, kind='info'}) {return <div className={`greeto-notice ${kind}`} role={kind === 'error' ? 'alert' : 'note'}>{children}</div>;}
export function StatePage({title,children}) {return <PageLayout eyebrow="Workspace" title={title} description="No action was performed."><Notice>{children}</Notice></PageLayout>;}
export function downloadJson(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import React, { useState } from 'react';
import FlowsList from './FlowsList.jsx';
import FlowsCreate from './FlowsCreate.jsx';

export default function FlowsPage() {
  const [view, setView] = useState(() => localStorage.getItem('whatsapp_flows_view') || 'list'); // 'list' | 'create'

  React.useEffect(() => {
    localStorage.setItem('whatsapp_flows_view', view);
  }, [view]);

  return (
    <div className="w-full h-full bg-[#f3f1f8]">
      {view === 'list' ? (
        <FlowsList onCreate={() => setView('create')} />
      ) : (
        <FlowsCreate 
          onCancel={() => setView('list')} 
          onSave={() => setView('list')}
        />
      )}
    </div>
  );
}

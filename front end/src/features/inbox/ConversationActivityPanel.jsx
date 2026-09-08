'use strict';
import React, { useEffect, useState } from 'react';
import { getConversationActivity } from './api.js';
import { Activity, UserPlus, UserMinus, Repeat, Loader2 } from 'lucide-react';

const ACTION_META = {
  'conversation.claim': { label: 'Claimed conversation', Icon: UserPlus, color: 'text-emerald-600 bg-emerald-50' },
  'conversation.release': { label: 'Released conversation', Icon: UserMinus, color: 'text-slate-500 bg-slate-100' },
  'conversation.reassign': { label: 'Reassigned conversation', Icon: Repeat, color: 'text-purple-600 bg-purple-50' },
};

export default function ConversationActivityPanel({ conversationId }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    getConversationActivity(conversationId)
      .then((res) => setActivity(Array.isArray(res?.activity) ? res.activity : []))
      .catch(() => setActivity([]))
      .finally(() => setLoading(false));
  }, [conversationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 text-slate-400">
        <Activity size={28} className="mb-2 opacity-60" />
        <p className="text-sm font-bold text-slate-500">No activity yet</p>
        <p className="text-xs mt-1">Assignment changes for this conversation will show up here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {activity.map((item) => {
        const meta = ACTION_META[item.action] || { label: item.action, Icon: Activity, color: 'text-slate-500 bg-slate-100' };
        const Icon = meta.Icon;
        return (
          <div key={item.id} className="flex items-start gap-3 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
              <Icon size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">{meta.label}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {item.actor_name || 'Someone'} · {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

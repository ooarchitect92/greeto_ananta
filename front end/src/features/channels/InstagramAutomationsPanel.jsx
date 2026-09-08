'use strict';
import React, { useEffect, useState } from 'react';
import { getInstagramAutomations, createInstagramAutomation, deleteInstagramAutomation, toggleInstagramAutomation } from './api.js';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Trash2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const DEFAULT_AUTOMATION = { type: 'auto_reply', name: '', keyword: '', message: '', delay_seconds: 2 };

export default function InstagramAutomationsPanel({ channelId, embedded = false }) {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newAutomation, setNewAutomation] = useState(DEFAULT_AUTOMATION);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await getInstagramAutomations();
      if (res?.automations) setAutomations(res.automations);
    } catch (err) {
      console.error('Error loading IG automations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    if (!newAutomation.name || !newAutomation.message) return alert('Name and message are required');
    if (!channelId) return alert('No Instagram channel connected');
    try {
      await createInstagramAutomation({
        channel_id: channelId,
        type: newAutomation.type,
        name: newAutomation.name,
        trigger: { keyword: newAutomation.keyword, comment_keyword: newAutomation.keyword },
        action: { message: newAutomation.message, delay_seconds: parseInt(newAutomation.delay_seconds) || 2 },
        is_active: true,
      });
      setShowAdd(false);
      setNewAutomation(DEFAULT_AUTOMATION);
      await refresh();
    } catch (err) {
      console.error('Create automation error:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmAction({
      title: 'Delete automation?',
      message: 'Delete this automation?',
      confirmLabel: 'Delete automation',
      tone: 'danger',
    }))) return;
    try {
      await deleteInstagramAutomation(id);
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error('Delete automation error:', err);
    }
  };

  const handleToggle = async (id) => {
    const current = automations.find((a) => a.id === id);
    const next = !current?.is_active;
    if (!(await confirmAction({
      title: next ? 'Enable automation?' : 'Disable automation?',
      message: next ? 'This automation will start running.' : 'This automation will pause.',
      confirmLabel: next ? 'Enable' : 'Disable',
      tone: 'toggle',
    }))) return;
    try {
      await toggleInstagramAutomation(id);
      setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: !a.is_active } : a)));
    } catch (err) {
      console.error('Toggle automation error:', err);
    }
  };

  return (
    <div className={cn("bg-white", embedded && "h-full flex flex-col")}>
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-900">Automation Rules</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Auto-reply, comment-to-DM, and auto-DM rules</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="h-9 px-4 rounded-full bg-slate-900 text-white font-bold text-xs">
          + Add Rule
        </Button>
      </div>

      <div className={cn("p-5 space-y-3", embedded && "flex-1 overflow-y-auto")}>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : automations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">No automation rules yet.</p>
            <p className="text-xs text-slate-300 mt-1">Create auto-reply, comment-to-DM, or auto-DM rules.</p>
          </div>
        ) : (
          automations.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-xl">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center text-white text-[10px] font-black",
                  rule.type === 'auto_reply' ? "bg-blue-500" : rule.type === 'comment_dm' ? "bg-purple-500" : "bg-green-500"
                )}>
                  {rule.type === 'auto_reply' ? '↩️' : rule.type === 'comment_dm' ? '💬' : '📩'}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{rule.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase",
                      rule.type === 'auto_reply' ? "bg-blue-50 text-blue-600" : rule.type === 'comment_dm' ? "bg-purple-50 text-purple-600" : "bg-green-50 text-green-600"
                    )}>
                      {rule.type.replace('_', ' ')}
                    </span>
                    {rule.trigger_config?.keyword && (
                      <span className="text-[10px] text-slate-400">Keywords: {rule.trigger_config.keyword}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(rule.id)}
                  className={cn(
                    "relative w-10 h-5 rounded-full transition-colors",
                    rule.is_active ? "bg-green-500" : "bg-slate-300"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    rule.is_active ? "translate-x-5" : "translate-x-0.5"
                  )} />
                </button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}
                  className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Create Automation Rule">
        <div className="space-y-4 p-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600">Rule Type</label>
            <select value={newAutomation.type}
              onChange={(e) => setNewAutomation((p) => ({ ...p, type: e.target.value }))}
              className="w-full h-11 rounded-xl bg-white border border-slate-200 px-4 text-sm">
              <option value="auto_reply">Auto Reply — Automatically reply to incoming DMs</option>
              <option value="comment_dm">Comment to DM — Send DM when someone comments</option>
              <option value="auto_dm">Auto DM — Send DM on follow / interaction</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600">Rule Name</label>
            <Input value={newAutomation.name}
              onChange={(e) => setNewAutomation((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Welcome Message" className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600">Trigger Keywords (optional, comma-separated)</label>
            <Input value={newAutomation.keyword}
              onChange={(e) => setNewAutomation((p) => ({ ...p, keyword: e.target.value }))}
              placeholder="e.g. price, info, hello (leave empty to match all)"
              className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm" />
            <p className="text-[10px] text-slate-400">Leave empty to trigger on every incoming message or comment</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600">Auto-Reply Message</label>
            <textarea value={newAutomation.message}
              onChange={(e) => setNewAutomation((p) => ({ ...p, message: e.target.value }))}
              placeholder="Hi! 👋 Thanks for reaching out. We'll get back to you shortly."
              rows={3}
              className="w-full rounded-xl bg-white border border-slate-200 px-4 py-3 text-sm resize-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600">Delay (seconds)</label>
            <Input type="number" value={newAutomation.delay_seconds}
              onChange={(e) => setNewAutomation((p) => ({ ...p, delay_seconds: e.target.value }))}
              placeholder="2" min="0" max="60"
              className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm w-32" />
            <p className="text-[10px] text-slate-400">Delay before sending (for a more natural feel)</p>
          </div>
          <Button onClick={handleCreate}
            className="w-full bg-slate-900 hover:bg-black h-11 rounded-xl text-white font-bold text-sm shadow-lg">
            Create Automation
          </Button>
        </div>
      </Modal>
    </div>
  );
}

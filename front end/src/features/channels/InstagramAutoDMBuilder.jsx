'use strict';
import React, { useState } from 'react';
import { createInstagramAutomation } from './api.js';
import { cn } from '../../lib/utils.js';
import {
  X, Zap, Clock, Play, MessageSquare, Camera, Key, Tag, Bell, Database,
  GitFork, CheckCircle2, Lock, ChevronRight,
} from 'lucide-react';

const NODE_META = {
  trigger: { label: 'Trigger', color: 'text-purple-600', iconBg: 'bg-purple-100', icon: <Zap size={18} className="text-purple-600" /> },
  delay: { label: 'Delay', color: 'text-green-600', iconBg: 'bg-green-100', icon: <Clock size={18} className="text-green-600" /> },
  action: { label: 'Action', color: 'text-purple-600', iconBg: 'bg-purple-600', icon: <Play size={15} fill="white" className="text-white ml-0.5" /> },
};

// Real, wired-up steps only. Everything else is shown for visual parity but
// disabled — oooo's backend only stores one trigger + one delay + one action
// per automation (no branching/CRM/notify integrations yet).
const LIBRARY_SECTIONS = [
  {
    label: 'Triggers', color: 'text-purple-600',
    items: [
      { key: 'keyword-dm', title: 'Keyword in DM', icon: <Key size={14} className="text-purple-600" />, iconBg: 'bg-purple-100', enabled: true },
      { key: 'comment-post', title: 'Comment on post', icon: <MessageSquare size={14} className="text-purple-600" />, iconBg: 'bg-purple-100', enabled: true },
      { key: 'story-mention', title: 'Story Mention', icon: <Camera size={14} className="text-pink-500" />, iconBg: 'bg-pink-100', enabled: false },
    ],
  },
  {
    label: 'Actions', color: 'text-green-600',
    items: [
      { key: 'send-message', title: 'Send Message', icon: <MessageSquare size={14} className="text-green-600" />, iconBg: 'bg-green-100', enabled: true },
      { key: 'tag-user', title: 'Tag User', icon: <Tag size={14} className="text-green-600" />, iconBg: 'bg-green-100', enabled: false },
      { key: 'notify-team', title: 'Notify Team', icon: <Bell size={14} className="text-green-600" />, iconBg: 'bg-green-100', enabled: false },
      { key: 'add-crm', title: 'Add to CRM', icon: <Database size={14} className="text-green-600" />, iconBg: 'bg-green-100', enabled: false },
    ],
  },
  {
    label: 'Logic', color: 'text-orange-500',
    items: [
      { key: 'wait', title: 'Wait', icon: <Clock size={14} className="text-orange-500" />, iconBg: 'bg-orange-100', enabled: true },
      { key: 'condition-split', title: 'Condition Split', icon: <GitFork size={14} className="text-orange-500" />, iconBg: 'bg-orange-100', enabled: false },
    ],
  },
];

function EditableNode({ kind, title, value, onChange, placeholder, extra }) {
  const [editing, setEditing] = useState(false);
  const meta = NODE_META[kind];
  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-200">
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <span className={cn('text-[10px] font-bold tracking-widest uppercase', meta.color)}>{meta.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', meta.iconBg)}>{meta.icon}</div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
        </div>
      </div>
      <div className="px-5 pb-4">
        {editing ? (
          <textarea
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => setEditing(false)}
            rows={2}
            placeholder={placeholder}
            className="w-full border border-purple-300 bg-purple-50/30 rounded-xl px-4 py-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 placeholder:text-gray-300 transition"
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 leading-relaxed cursor-text hover:bg-purple-50 hover:ring-2 hover:ring-purple-200 transition-all min-h-10"
          >
            {value || <span className="text-gray-300 italic">{placeholder}</span>}
          </div>
        )}
        {extra}
      </div>
    </div>
  );
}

function LibItem({ item }) {
  return (
    <div
      onClick={() => { if (!item.enabled) alert(`"${item.title}" is coming soon.`); }}
      className={cn(
        'flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2.5 select-none transition-all',
        item.enabled ? 'hover:border-purple-300 hover:shadow-sm cursor-default' : 'opacity-60 cursor-not-allowed'
      )}
    >
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', item.iconBg)}>{item.icon}</div>
      <span className="text-sm font-semibold text-gray-700 flex-1">{item.title}</span>
      {!item.enabled && (
        <span className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-wide">
          <Lock size={10} /> Soon
        </span>
      )}
    </div>
  );
}

export default function InstagramAutoDMBuilder({ isOpen, onClose, post, channelId, onSaved }) {
  const [name, setName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [delaySeconds, setDelaySeconds] = useState('2');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const isCommentTrigger = Boolean(post);

  const reset = () => {
    setName('');
    setKeyword('');
    setDelaySeconds('2');
    setMessage('');
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleActivate = async () => {
    if (!message.trim()) return alert('The DM message is required.');
    if (!channelId) return alert('No Instagram channel connected.');
    setSaving(true);
    try {
      await createInstagramAutomation({
        channel_id: channelId,
        type: isCommentTrigger ? 'comment_dm' : 'auto_reply',
        name: name.trim() || (isCommentTrigger ? `Comment-to-DM: ${String(post?.id || '').slice(-6)}` : 'Keyword Auto-DM'),
        trigger: {
          keyword: keyword.trim(),
          comment_keyword: keyword.trim(),
          post_id: post?.id,
        },
        action: {
          message: message.trim(),
          delay_seconds: parseInt(delaySeconds, 10) || 0,
        },
        is_active: true,
      });
      setSuccess(true);
      if (onSaved) onSaved();
      setTimeout(handleClose, 1500);
    } catch (err) {
      console.error('[InstagramAutoDMBuilder] Save failed:', err);
      alert('Failed to activate automation. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#f4f5fb] flex flex-col animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-1.5 text-sm mb-1 text-gray-400">
            <span>Instagram</span>
            <ChevronRight size={14} />
            <span className="text-purple-600 font-semibold">Instagram Flow</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Setup Auto DM</h1>
        </div>
        <button onClick={handleClose} className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <X size={20} />
        </button>
      </div>

      {success ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">Automation Activated!</h3>
          <p className="text-gray-500">Greeto will now watch for this trigger and send the DM automatically.</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 overflow-y-auto px-8 py-8 flex flex-col items-center">
            <div className="w-full max-w-lg flex flex-col gap-2">
              {post && (
                <div className="flex gap-3 p-3 bg-white rounded-2xl border border-gray-200 mb-2">
                  <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-black">
                    <img
                      src={post.media_type === 'VIDEO' ? (post.thumbnail_url || post.media_url) : post.media_url}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Target Post</p>
                    <p className="text-xs text-gray-600 line-clamp-2 italic leading-snug">"{post.caption || 'No caption'}"</p>
                  </div>
                </div>
              )}

              <RuleNameInput value={name} onChange={setName} />

              <EditableNode
                kind="trigger"
                title={isCommentTrigger ? 'Comment on this post' : 'Keyword in DM'}
                value={keyword}
                onChange={setKeyword}
                placeholder={isCommentTrigger ? "Optional: only trigger for comments containing this word..." : 'e.g. "Price" or "How much" — leave empty to match everything'}
              />

              <div className="w-px h-8 bg-purple-300 self-center" />

              <EditableNode
                kind="delay"
                title="Smart Wait"
                value={delaySeconds}
                onChange={setDelaySeconds}
                placeholder="Seconds to wait before sending (e.g. 2)"
              />

              <div className="w-px h-8 bg-purple-300 self-center" />

              <EditableNode
                kind="action"
                title="Send Auto-Reply DM"
                value={message}
                onChange={setMessage}
                placeholder='Hey! Thanks for reaching out. Here are the details you asked for...'
              />

              <button
                onClick={handleActivate}
                disabled={saving || !message.trim()}
                className="mt-6 w-full h-12 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-sm shadow-lg disabled:opacity-40 transition-colors"
              >
                {saving ? 'Activating...' : 'Activate Automation'}
              </button>
            </div>
          </div>

          {/* Step Library */}
          <div className="w-65 shrink-0 bg-white border-l border-gray-200 overflow-y-auto flex flex-col p-5 gap-5">
            <div>
              <h3 className="text-base font-bold text-gray-900">Step Library</h3>
              <p className="text-xs text-gray-400 mt-0.5">Only enabled steps are live right now</p>
            </div>
            {LIBRARY_SECTIONS.map((section) => (
              <div key={section.label} className="flex flex-col gap-2">
                <p className={cn('text-[10px] font-bold tracking-widest uppercase', section.color)}>{section.label}</p>
                {section.items.map((item) => (
                  <LibItem key={item.key} item={item} />
                ))}
              </div>
            ))}
            <div className="bg-purple-50 rounded-2xl p-4">
              <p className="text-sm font-bold text-gray-900 mb-1.5">Pro Tip</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Leave the trigger keyword empty to fire the DM for every comment or message.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RuleNameInput({ value, onChange }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Rule name (e.g. Pricing Auto-DM)"
      className="w-full h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-purple-200 mb-2"
    />
  );
}

'use strict';
import React, { useCallback } from 'react';
import { cn } from '../../lib/utils.js';
import { getInitials, getAvatarColor, getSlaState } from '../../lib/sla.js';
import { Badge } from '../../components/ui/Badge.jsx';
import { Pin, MessageCircle, Instagram, Send, Check, Trash2, RefreshCcw, Loader2, PlugZap } from 'lucide-react';

// TEMPORARY: only WhatsApp is a live channel right now, so the "All /
// WhatsApp / Instagram / Telegram" chip row is hidden below rather than
// showing three permanently-empty tabs next to a duplicate "All". Restore
// the full list here once other channels are re-enabled.
const CHANNEL_CHIPS = [
  { key: 'all', label: 'All', Icon: null },
  { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { key: 'instagram', label: 'Instagram', Icon: Instagram },
  { key: 'telegram', label: 'Telegram', Icon: Send },
];
const SHOW_CHANNEL_CHIPS = false;

// Returns null if the string is blank or looks like a raw phone number
function resolveContactName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // If 7+ consecutive digits (with optional leading + or spaces), it's a phone number not a name
  if (/^[\+\s]*\d[\d\s\-]{6,}$/.test(trimmed)) return null;
  return trimmed;
}

export default function Inbox({ conversations, hasMore, isLoadingMore, onLoadMore, selectedId, onSelect, onPin, onResolve, onDelete, currentUser, filter, setFilter, counts, channelFilter, setChannelFilter, hasConnectedChannel = true, onConnectChannel }) {
  const safeCounts = counts || { all: 0, open: 0, unassigned: 0, assigned_to_me: 0, pinned: 0, resolved: 0, whatsapp: 0, telegram: 0, instagram: 0 };

  const handleListScroll = useCallback((e) => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;
    const el = e.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) onLoadMore();
  }, [onLoadMore, hasMore, isLoadingMore]);

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Channel Chips */}
      {SHOW_CHANNEL_CHIPS && setChannelFilter && (
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-white px-4 py-3 no-scrollbar">
          {CHANNEL_CHIPS.map(({ key, label, Icon }) => {
            const isActive = (channelFilter || 'all') === key;
            const count = key === 'all' ? safeCounts.all : (safeCounts[key] || 0);
            return (
              <button
                key={key}
                onClick={() => setChannelFilter(key)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
                  isActive
                    ? "border-violet-200 bg-violet-50 text-violet-800"
                    : "border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                )}
              >
                {Icon && <Icon size={12} />}
                <span>{label}</span>
                <span className={cn("text-[10px] px-1.5 rounded-full", isActive ? "bg-white/60 text-purple-800" : "bg-slate-100 text-slate-500")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 no-scrollbar">
        <button
          id="tour-inbox-filter-all"
          onClick={() => setFilter('all')}
          className={cn(
            "flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors",
            filter === 'all'
              ? "border-slate-900 bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
          )}
        >
          <span>All</span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full",
            filter === 'all' ? "bg-white/20 text-white" : "bg-purple-50 text-purple-700"
          )}>
            {safeCounts.all}
          </span>
        </button>
        <button
          id="tour-inbox-filter-open"
          onClick={() => setFilter('open')}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap border flex items-center gap-1.5",
            filter === 'open'
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
          )}
        >
          <span>Open</span>
          <span className={cn(
             "text-[10px] px-1.5 py-0.5 rounded-full",
             filter === 'open' ? "bg-white/20 text-white" : "bg-green-50 text-green-600"
          )}>
            {safeCounts.open}
          </span>
        </button>
        <button
          id="tour-inbox-filter-unassigned"
          onClick={() => setFilter('unassigned')}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap border flex items-center gap-1.5",
            filter === 'unassigned'
              ? "bg-orange-500 text-white border-orange-500"
              : "bg-white text-slate-600 border-slate-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"
          )}
        >
          <span>Unassigned</span>
          <span className={cn(
             "text-[10px] px-1.5 py-0.5 rounded-full",
             filter === 'unassigned' ? "bg-white/20 text-white" : "bg-orange-50 text-orange-600"
          )}>
            {safeCounts.unassigned}
          </span>
        </button>
        <button
          onClick={() => setFilter('pinned')}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap border flex items-center gap-1.5",
            filter === 'pinned'
              ? "bg-violet-700 text-white border-violet-700"
              : "bg-white text-slate-600 border-slate-200 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200"
          )}
        >
          <span>Pinned</span>
          <span className={cn(
             "text-[10px] px-1.5 py-0.5 rounded-full",
             filter === 'pinned' ? "bg-white/20 text-white" : "bg-purple-50 text-purple-700"
          )}>
            {safeCounts.pinned}
          </span>
        </button>
        <button
          onClick={() => setFilter('closed')}
          className={cn(
            "px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap border flex items-center gap-1.5",
            filter === 'closed'
              ? "bg-slate-700 text-white border-slate-700"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800"
          )}
        >
          <span>Closed</span>
          <span className={cn(
             "text-[10px] px-1.5 py-0.5 rounded-full",
             filter === 'closed' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
          )}>
            {safeCounts.resolved}
          </span>
        </button>

      </div>

      {/* List */}
      <div id="tour-inbox-list" className="flex-1 overflow-y-auto bg-white px-2 py-2" onScroll={handleListScroll}>
        <ul className="space-y-0.5">
          {conversations.map((c) => {
             const isSelected = selectedId === c.id;
             const isInsta = c.channelType === 'instagram';
             const name = resolveContactName(c.displayName) || resolveContactName(c.contactName) || 'No Name';
             const avatarColor = getAvatarColor(c.id || name);
             const sla = getSlaState(c.lastMessageAt);
             return (
              <li
                key={c.id}
                className={cn(
                  "group relative cursor-pointer rounded-lg border border-transparent px-3 py-3 transition-colors",
                  isSelected ? "border-violet-100 bg-violet-50/70" : "hover:bg-slate-50"
                )}
                onClick={() => onSelect(c.id)}
              >
                {isSelected && <div className="absolute bottom-3 left-0 top-3 w-0.5 rounded-r-full bg-violet-600" />}
                <div className="flex gap-3">
                  <div className="relative shrink-0">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-medium"
                      style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                    >
                      {getInitials(name)}
                    </div>
                    <div
                      className={cn(
                        "absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white",
                        isInsta ? "bg-pink-500 text-white" : "bg-emerald-500 text-white"
                      )}
                      title={isInsta ? 'Instagram' : (c.channelDisplayName || 'WhatsApp')}
                    >
                      {isInsta ? <Instagram size={9} /> : <MessageCircle size={9} />}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className={cn("flex items-center gap-1 truncate text-sm font-medium", isSelected ? "text-slate-950" : "text-slate-800")}>
                        {c.isPinned && <Pin size={12} className="text-slate-500 rotate-45 shrink-0" fill="currentColor" />}
                        <span className="truncate">{name}</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400">
                          {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onPin(c.id);
                          }}
                          className={cn(
                            "p-1.5 rounded-full hover:bg-purple-100 transition-colors",
                            c.isPinned ? "text-purple-700 bg-purple-50" : "text-slate-400 hover:text-purple-700"
                          )}
                          title={c.isPinned ? "Unpin" : "Pin"}
                        >
                          <Pin size={14} fill={c.isPinned ? "currentColor" : "none"} />
                        </button>
                        {c.status !== 'closed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onResolve(c.id);
                            }}
                            className="p-1.5 rounded-full hover:bg-emerald-50 transition-colors text-slate-400 hover:text-emerald-600"
                            title="Resolve"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(c.id);
                            }}
                            className="p-1.5 rounded-full hover:bg-red-50 transition-colors text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100"
                            title="Delete conversation"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                       <p className="text-xs text-slate-500 line-clamp-1 max-w-[70%]">
                         {c.lastMessage || "No messages yet"}
                       </p>
                       {c.unreadCount > 0 && (
                          <div className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-medium text-white">
                            {c.unreadCount}
                          </div>
                       )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                       <Badge variant={c.assigneeId ? "secondary" : "outline"} className={cn("h-5 rounded-full px-2 text-[10px] font-medium", c.assigneeId ? "border-violet-100 bg-violet-50 text-violet-700" : "border-orange-100 bg-orange-50 text-orange-700")}>
                         {c.assigneeId ? 'Assigned' : 'Unassigned'}
                       </Badge>
                       {c.leadStage && c.leadStage.name && (
                         <span
                           className="inline-flex items-center gap-1.5 h-5 px-1.5 rounded border text-[10px] font-medium"
                           style={{
                             borderColor: (c.leadStage.color || '#0f172a') + '33',
                             backgroundColor: (c.leadStage.color || '#0f172a') + '14',
                             color: c.leadStage.color || '#0f172a',
                           }}
                           title={c.leadStage.isClosed ? 'Closed stage' : 'Open stage'}
                         >
                           <span
                             className="h-2 w-2 rounded-full"
                             style={{ backgroundColor: c.leadStage.color || '#0f172a' }}
                           />
                           {c.leadStage.name}
                         </span>
                       )}
                       <span className={cn("inline-flex h-5 items-center rounded-full px-1.5 text-[10px] font-medium", sla.tone)} title="Time since last message">
                         {sla.label}
                       </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 h-5 flex items-center gap-1 font-medium shadow-sm transition-all duration-300",
                            isInsta
                              ? "text-pink-600 border-pink-200 bg-pink-50/50"
                              : c.channelExternalId === '921055841100882'
                              ? "text-emerald-600 border-emerald-200 bg-emerald-50/50"
                              : c.channelExternalId === '146239241916262'
                              ? "text-indigo-600 border-indigo-200 bg-indigo-50/50"
                              : c.channelExternalId === '297769093430352'
                              ? "text-purple-600 border-purple-200 bg-purple-50/50"
                              : c.channelExternalId === '5277768612254386'
                              ? "text-amber-600 border-amber-200 bg-amber-50/50"
                              : "text-green-600 border-green-200 bg-green-50/50"
                          )}
                        >
                          {isInsta ? <Instagram size={10} /> : <MessageCircle size={10} />}
                          {isInsta ? 'Instagram' : (c.channelDisplayName || 'WhatsApp')}
                        </Badge>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          {conversations.length === 0 && (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                {hasConnectedChannel ? <MessageCircle size={21} /> : <PlugZap size={21} />}
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-800">
                {hasConnectedChannel ? 'No conversations yet' : 'Connect WhatsApp to start your inbox'}
              </p>
              <p className="mx-auto mt-1 max-w-[270px] text-xs leading-5 text-slate-500">
                {hasConnectedChannel
                  ? 'New customer messages will appear here as soon as they arrive.'
                  : 'Connect your WhatsApp Business number before receiving messages.'}
              </p>
              {!hasConnectedChannel && onConnectChannel && (
                <button
                  type="button"
                  onClick={onConnectChannel}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-700 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-purple-800"
                >
                  <PlugZap size={14} />
                  Connect WhatsApp
                </button>
              )}
            </div>
          )}
        </ul>
        {isLoadingMore && (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-xs">
            <Loader2 size={14} className="animate-spin" />
            Loading more…
          </div>
        )}
      </div>
    </div>
  );
}

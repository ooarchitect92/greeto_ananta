'use strict';

// Client-computed "freshness" indicator for a conversation, based on how long
// it's been since the last message. No backend SLA/due-date tracking exists
// (or is planned) — this mirrors it well enough for an at-a-glance chip.
export function getSlaState(lastMessageAt) {
  if (!lastMessageAt) {
    return { label: 'No activity', tone: 'text-slate-500 bg-slate-100' };
  }
  const ageMinutes = Math.max(0, Math.floor((Date.now() - new Date(lastMessageAt).getTime()) / 60000));
  if (ageMinutes <= 15) {
    return { label: 'On track', tone: 'text-emerald-700 bg-emerald-50' };
  }
  if (ageMinutes <= 60) {
    return { label: 'Due soon', tone: 'text-amber-700 bg-amber-50' };
  }
  return { label: 'Breached', tone: 'text-red-700 bg-red-50' };
}

export function getInitials(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

const AVATAR_PALETTE = [
  { bg: '#ede9fe', text: '#6d28d9' },
  { bg: '#fce7f3', text: '#be185d' },
  { bg: '#dbeafe', text: '#1d4ed8' },
  { bg: '#dcfce7', text: '#15803d' },
  { bg: '#fef3c7', text: '#b45309' },
  { bg: '#fee2e2', text: '#b91c1c' },
  { bg: '#e0f2fe', text: '#0369a1' },
];

export function getAvatarColor(seed) {
  const str = String(seed || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

import React from 'react';
import { MessageSquare, Instagram, Globe, Phone } from 'lucide-react';

export const LEAD_STAGES = [
    'new',
    'attempted_to_contact',
    'contacted',
    'qualified',
    'proposal_sent',
    'negotiation',
    'won',
    'lost'
];

export const LEAD_STATUSES = [
    'new',
    'hot',
    'warm',
    'cold',
    'follow_up',
    'not_interested'
];

export function ChannelIcon({ type, name, size = 14 }) {
    if (name === 'Instagram' || type === 'instagram') return <Instagram size={size} className="text-pink-500" />;
    if (name === 'XOLOX' || name === 'WhatsApp') return <MessageSquare size={size} className="text-green-500" />;
    if (type === 'raw') return <Globe size={size} className="text-slate-400" />;
    if (type === 'call') return <Phone size={size} className="text-orange-500" />;
    return <MessageSquare size={size} className="text-slate-400" />;
}

export function getChannelLabel(channel) {
    if (!channel) return 'Unknown';
    if (channel.name === 'XOLOX') return 'XOLOX (WhatsApp)';
    return `${channel.name} (${channel.type})`;
}

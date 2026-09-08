'use strict';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { User, TrendingUp, Plus, X } from 'lucide-react';
import { useToast } from '../../components/ui/use-toast.jsx';
import { getLeadStages, updateConversationLeadStage, getScheduledTasks } from './api.js';
import TagSelector from './TagSelector.jsx';
import { Clock, Loader2 } from 'lucide-react';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';

const OPPORTUNITY_TYPES = ['CPA', 'CMA US', 'CFA', 'ACCA', 'EA'];

const TYPE_COLORS = {
  'CPA':    { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  'CMA US': { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe', dot: '#8b5cf6' },
  'CFA':    { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#22c55e' },
  'ACCA':   { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', dot: '#f97316' },
  'EA':     { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dot: '#ef4444' },
};

const STATUS_DOT = { open: '#3b82f6', won: '#22c55e', lost: '#ef4444' };

function getAuthHeaders() {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: token ? `Bearer ${token}` : undefined };
}

// Returns null when the value is blank or looks like a raw phone number (e.g. "919699862919").
// Prevents the phone number from being shown as the contact's display name.
function resolveContactName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // 7+ consecutive digits (with optional leading + or spaces) → it's a phone, not a name
  if (/^[\+\s]*\d[\d\s\-]{6,}$/.test(trimmed)) return null;
  return trimmed;
}

export default function CustomerCard({ conversationId, onLeadStageUpdated, onContactUpdated }) {
  const { toast } = useToast();
  const LANGUAGE_LABELS = {
    en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu',
    ml: 'Malayalam', kn: 'Kannada', mr: 'Marathi', gu: 'Gujarati'
  };

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [leadStages, setLeadStages] = useState([]);
  const [leadStatuses, setLeadStatuses] = useState([]);
  const [loadingStages, setLoadingStages] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [opportunities, setOpportunities] = useState([]);
  const [loadingOpps, setLoadingOpps] = useState(false);
  const [addingOpp, setAddingOpp] = useState(false);
  const [newOppType, setNewOppType] = useState('');
  const [savingOpp, setSavingOpp] = useState(false);
  const [dupWarning, setDupWarning] = useState(null);
  const [formData, setFormData] = useState({
    contactId: '', name: '', number: '', course: '',
    preferredLanguage: '', blocked: false, leadStageId: '', leadStatus: '', tags: []
  });
  const [scheduledTasks, setScheduledTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    if (!conversationId) return;
    setFetching(true);
    setScheduledTasks([]);
    const token = localStorage.getItem('accessToken');
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`/api/conversations/${conversationId}/contact`, { headers })
      .then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); })
      .then(data => {
        setFormData({
          contactId: data.contactId || '',
          name: data.name || '',
          number: data.number || '',
          course: data.course || '',
          preferredLanguage: data.preferredLanguage || '',
          blocked: !!data.blocked,
          leadStageId: data.leadStage?.id || '',
          leadStatus: data.leadStatus || '',
          tags: data.tags || []
        });
        if (data.number) loadScheduledTasks(conversationId, data.number);
      })
      .catch(err => console.error(err))
      .finally(() => setFetching(false));
  }, [conversationId]);

  const loadScheduledTasks = async (activeConversationId, phone) => {
    if (!phone) return;
    setLoadingTasks(true);
    try {
      const res = await getScheduledTasks(activeConversationId, phone);
      if (res?.success) setScheduledTasks(res.tasks || []);
    } catch (e) { console.error('Failed to load tasks', e); }
    finally { setLoadingTasks(false); }
  };

  useEffect(() => {
    if (!conversationId) return;
    setLoadingStages(true);
    getLeadStages()
      .then(res => setLeadStages(Array.isArray(res?.stages) ? res.stages : []))
      .catch(() => setLeadStages([]))
      .finally(() => setLoadingStages(false));
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    fetch('/api/lead-statuses', { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => setLeadStatuses(d.statuses || []))
      .catch(() => {});
  }, [conversationId]);

  const loadOpportunities = useCallback(async (contactId) => {
    if (!contactId) return;
    setLoadingOpps(true);
    try {
      const res = await fetch(`/api/opportunities?contact_id=${contactId}&limit=20`, { headers: getAuthHeaders() });
      const data = await res.json();
      setOpportunities(data.opportunities || []);
    } catch {}
    finally { setLoadingOpps(false); }
  }, []);

  useEffect(() => {
    if (formData.contactId) loadOpportunities(formData.contactId);
  }, [formData.contactId, loadOpportunities]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/conversations/${conversationId}/contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: formData.name, course: formData.course, tags: formData.tags, leadStatus: formData.leadStatus })
      });
      if (!res.ok) throw new Error('Failed');
      toast({ description: "Contact details updated", duration: 1200 });
      // Notify parent so the header + conversation list update immediately
      if (onContactUpdated && formData.name && resolveContactName(formData.name)) {
        onContactUpdated(resolveContactName(formData.name));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleLeadStageChange = async (value) => {
    const nextId = value || '';
    setFormData(prev => ({ ...prev, leadStageId: nextId }));
    if (!conversationId) return;
    setSavingStage(true);
    try {
      const res = await updateConversationLeadStage(conversationId, nextId || null);
      if (res && Object.prototype.hasOwnProperty.call(res, 'leadStage') && onLeadStageUpdated) {
        onLeadStageUpdated(res.leadStage || null);
      }
    } catch (err) { console.error(err); }
    finally { setSavingStage(false); }
  };

  const handleAddOpp = async (force = false) => {
    if (!newOppType || !formData.contactId) return;
    setSavingOpp(true);
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ opportunity_type: newOppType, contact_id: formData.contactId, force }),
      });
      const data = await res.json();
      if (res.status === 409 && data.error === 'duplicate') {
        setDupWarning({ existing: data.existing, pendingType: newOppType });
        return;
      }
      if (data.success) {
        setAddingOpp(false);
        setNewOppType('');
        setDupWarning(null);
        loadOpportunities(formData.contactId);
        toast({ description: `${newOppType} opportunity created`, duration: 1200 });
      }
    } catch {}
    finally { setSavingOpp(false); }
  };

  if (!conversationId) return null;

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-500" />
          <CardTitle className="text-sm font-semibold text-slate-900">Customer Information</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {fetching ? (
          <GreetoLoader label="Loading customer..." sublabel="Fetching profile context" />
        ) : (
          <>
            <div>
              <label className="text-xs font-medium text-slate-500">Full Name</label>
              <Input
                value={resolveContactName(formData.name) || ''}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="h-8 mt-1"
                placeholder="No Name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Preferred Language</label>
              <Input value={LANGUAGE_LABELS[formData.preferredLanguage] || formData.preferredLanguage || ''} disabled className="h-8 bg-slate-50 mt-1 text-slate-500" placeholder="Auto-detected from chat" />
            </div>

            {/* Lead Status — dynamic from API */}
            <div>
              <label className="text-xs font-medium text-slate-500">Lead Status</label>
              <select
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 mt-1"
                value={formData.leadStatus}
                onChange={e => setFormData({...formData, leadStatus: e.target.value})}
              >
                <option value="">Select status</option>
                {leadStatuses.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500">System Visibility</label>
              <Input value={formData.blocked ? 'Blocked' : 'Active'} disabled className="h-8 bg-slate-50 mt-1 text-slate-500" />
            </div>

            {/* Lead Stage */}
            <div>
              <label className="text-xs font-medium text-slate-500">Lead Stage</label>
              <div className="mt-1 flex items-center gap-2">
                <select
                  className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                  value={formData.leadStageId || ''}
                  onChange={e => handleLeadStageChange(e.target.value)}
                  disabled={loadingStages}
                >
                  <option value="">No stage</option>
                  {leadStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {savingStage && <span className="text-[10px] text-slate-400 whitespace-nowrap">Saving...</span>}
              </div>
            </div>

            {/* Course */}
            <div>
              <label className="text-xs font-medium text-slate-500">Course</label>
              <select
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 mt-1"
                value={formData.course}
                onChange={e => setFormData({...formData, course: e.target.value})}
              >
                <option value="">Select Course</option>
                {OPPORTUNITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <TagSelector
              selectedLabels={formData.tags}
              onChange={newTags => setFormData(prev => ({ ...prev, tags: newTags }))}
            />

            {/* Opportunities Section */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <TrendingUp className="w-3 h-3" />
                  Opportunities
                  {loadingOpps && <Loader2 className="w-3 h-3 animate-spin ml-1" />}
                </div>
                {!addingOpp && (
                  <button
                    onClick={() => { setAddingOpp(true); setNewOppType(''); setDupWarning(null); }}
                    className="text-[10px] text-blue-600 hover:text-blue-700 flex items-center gap-0.5 font-medium"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>

              {/* Existing opportunities */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {opportunities.length === 0 && !addingOpp && (
                  <div className="text-[10px] text-slate-400 italic w-full text-center py-1.5 bg-slate-50/50 rounded border border-dashed border-slate-200">
                    No opportunities yet
                  </div>
                )}
                {opportunities.map(opp => {
                  const c = TYPE_COLORS[opp.opportunity_type] || TYPE_COLORS['CPA'];
                  return (
                    <div key={opp.id} style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT[opp.status] || '#64748b', flexShrink: 0 }} />
                      {opp.opportunity_type}
                      <span style={{ fontWeight: 400, fontSize: 9, textTransform: 'uppercase', opacity: 0.75 }}>{opp.status}</span>
                    </div>
                  );
                })}
              </div>

              {/* Add opportunity inline form */}
              {addingOpp && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {OPPORTUNITY_TYPES.map(t => {
                      const c = TYPE_COLORS[t];
                      const selected = newOppType === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => { setNewOppType(t); setDupWarning(null); }}
                          style={{
                            background: selected ? c.bg : '#fff',
                            color: selected ? c.text : '#64748b',
                            border: `1.5px solid ${selected ? c.border : '#e2e8f0'}`,
                            borderRadius: 6,
                            padding: '3px 10px',
                            fontSize: 11,
                            fontWeight: selected ? 700 : 500,
                            cursor: 'pointer',
                          }}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>

                  {/* Duplicate warning */}
                  {dupWarning && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-800">
                      <p className="font-semibold mb-1">Duplicate detected</p>
                      <p>This lead already has an open <strong>{dupWarning.pendingType}</strong> opportunity
                        {dupWarning.existing?.lead_stage_name && ` · ${dupWarning.existing.lead_stage_name}`}
                        {dupWarning.existing?.assigned_user_name && ` · ${dupWarning.existing.assigned_user_name}`}.
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => { setDupWarning(null); }} className="text-slate-500 hover:text-slate-700 font-medium">Cancel</button>
                        <button onClick={() => handleAddOpp(true)} className="text-amber-700 hover:text-amber-900 font-semibold">Create Anyway</button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleAddOpp(false)} disabled={!newOppType || savingOpp}>
                      {savingOpp ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAddingOpp(false); setDupWarning(null); }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Pending Automations */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <Clock className="w-3 h-3" />
                  Pending Automations
                </div>
                {loadingTasks && <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />}
              </div>
              <div className="space-y-2">
                {scheduledTasks.length > 0 ? scheduledTasks.map(task => {
                  const remainMs = new Date(task.scheduled_time) - new Date();
                  const remainMins = Math.max(0, Math.round(remainMs / 60000));
                  let timeStr = remainMins > 1440 ? `${Math.floor(remainMins/1440)}d ${Math.floor((remainMins%1440)/60)}h` : remainMins > 60 ? `${Math.floor(remainMins/60)}h ${remainMins%60}m` : `${remainMins}m`;
                  return (
                    <div key={task.id} className="bg-slate-50 rounded-md p-2 border border-slate-100 flex justify-between items-center">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-medium text-slate-700 truncate">{task.workflow_name}</span>
                        <span className="text-[9px] text-slate-400">Scheduled for {new Date(task.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">in {timeStr}</div>
                    </div>
                  );
                }) : (
                  <div className="text-[10px] text-slate-400 italic text-center py-2 bg-slate-50/50 rounded-md border border-dashed border-slate-200">No automations scheduled</div>
                )}
              </div>
            </div>

            <Button size="sm" className="w-full mt-2" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : 'Submit'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

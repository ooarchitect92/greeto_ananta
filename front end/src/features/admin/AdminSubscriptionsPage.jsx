import React, { useEffect, useMemo, useState } from 'react';
import { Archive, CalendarClock, CheckCircle2, CreditCard, Edit3, Loader2, Plus, RefreshCw, ShieldCheck, Users, X } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { deactivateAdminSubscriptionPlan, getAdminSubscriptionPlans } from './api.js';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';

function formatMoney(value, currency = 'INR') {
  if (value == null) return 'Custom';
  return `${currency} ${Number(value || 0).toLocaleString('en-IN')}`;
}

function Metric({ label, value, icon: Icon, tone = 'purple' }) {
  const tones = {
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    blue: 'bg-blue-50 text-blue-600',
  };
  return (
    <Card className="p-4">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon size={18} />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
    </Card>
  );
}

export default function AdminSubscriptionsPage({ onCreate, onEdit }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [discontinuePlan, setDiscontinuePlan] = useState(null);
  const [reason, setReason] = useState('');

  const stats = useMemo(() => {
    const active = plans.filter((plan) => plan.isActive).length;
    const custom = plans.filter((plan) => plan.price?.monthly == null).length;
    return { total: plans.length, active, inactive: plans.length - active, custom };
  }, [plans]);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await getAdminSubscriptionPlans();
      setPlans(result.plans || []);
    } catch (error) {
      setMessage(error.message || 'Failed to load subscription plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDeactivate = async () => {
    const plan = discontinuePlan;
    if (!plan) return;
    setSaving(true);
    try {
      const result = await deactivateAdminSubscriptionPlan(plan.id, { reason });
      if (!result.success) throw new Error(result.message || 'Unable to deactivate plan.');
      setDiscontinuePlan(null);
      setReason('');
      await load();
      const affected = Number(result.impact?.affectedSubscribers || 0);
      const failures = Number(result.impact?.gatewayFailures?.length || 0);
      setMessage(`${plan.name} discontinued. ${affected} existing subscription${affected === 1 ? '' : 's'} will retain access until the paid period ends.${failures ? ` ${failures} gateway cancellation${failures === 1 ? '' : 's'} need manual review.` : ''}`);
    } catch (error) {
      setMessage(error.message || 'Unable to deactivate plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-[#f4f1fb] p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-500">Admin Billing</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Subscription Catalog</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
              Create customer-facing plans, limits, channels and feature access from the admin control room.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={load}><RefreshCw size={16} /> Refresh</Button>
            <Button onClick={onCreate}><Plus size={16} /> New Plan</Button>
          </div>
        </div>

        {message && (
          <div className="rounded-[24px] border border-purple-100 bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Total Plans" value={stats.total} icon={CreditCard} />
          <Metric label="Active Plans" value={stats.active} icon={CheckCircle2} tone="emerald" />
          <Metric label="Discontinued" value={stats.inactive} icon={Archive} tone="rose" />
          <Metric label="Custom Pricing" value={stats.custom} icon={ShieldCheck} tone="blue" />
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-purple-100 p-5">
            <h2 className="text-base font-black text-slate-950">Plans</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">Active plans appear in customer checkout. Discontinued plans remain available to existing subscribers until their paid period ends.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-purple-50/70 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="px-5 py-4">Plan</th>
                  <th className="px-5 py-4">Monthly</th>
                  <th className="px-5 py-4">Limits</th>
                  <th className="px-5 py-4">Channels</th>
                  <th className="px-5 py-4">Subscribers</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-5 py-8">
                      <GreetoLoader label="Loading subscription plans..." sublabel="Preparing plans and active subscriptions" />
                    </td>
                  </tr>
                ) : plans.length ? plans.map((plan) => (
                  <tr key={plan.id} className="border-t border-purple-50 align-top">
                    <td className="px-5 py-4">
                      <p className="text-sm font-black text-slate-950">{plan.name}</p>
                      <p className="mt-1 max-w-sm text-xs font-medium leading-5 text-slate-500">{plan.description}</p>
                      <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-purple-500">{plan.slug}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-black text-slate-800">{formatMoney(plan.price?.monthly, plan.currency)}</td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-500">
                      Contacts {plan.limits?.contacts ?? 'Unlimited'}<br />
                      Workflows {plan.limits?.workflows ?? 'Unlimited'}<br />
                      Campaigns {plan.limits?.campaigns ?? 'Unlimited'}<br />
                      Agents {plan.limits?.teamMembers ?? 'Unlimited'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-xs flex-wrap gap-1.5">
                        {(plan.channels || []).map((channel) => <Badge key={channel} variant="outline">{channel}</Badge>)}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 text-sm font-black text-slate-800"><Users size={14} className="text-purple-500" />{plan.subscriberSummary?.active || 0}</div>
                      <p className="mt-1 text-[11px] font-semibold text-slate-400">{plan.subscriberSummary?.ending || 0} ending</p>
                    </td>
                    <td className="px-5 py-4">
                      <Badge className={plan.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}>
                        {plan.isActive ? 'Active' : 'Discontinued'}
                      </Badge>
                      {!plan.isActive && plan.discontinuedAt && <p className="mt-2 text-[11px] font-semibold text-slate-400">{new Date(plan.discontinuedAt).toLocaleDateString('en-IN')}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => onEdit(plan)}><Edit3 size={14} /> Edit</Button>
                        {plan.isActive && (
                          <Button variant="destructive" size="sm" onClick={() => setDiscontinuePlan(plan)} disabled={saving}>
                            <Archive size={14} /> Discontinue
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="7" className="px-5 py-12 text-center text-sm font-bold text-slate-400">No plans found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {discontinuePlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-purple-100 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 p-5">
              <div className="flex gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><Archive size={18} /></span><div><h2 className="text-base font-black text-slate-950">Discontinue {discontinuePlan.name}?</h2><p className="mt-1 text-xs font-medium text-slate-500">This preserves customer access and billing history.</p></div></div>
              <button type="button" onClick={() => setDiscontinuePlan(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50" aria-label="Close"><X size={17} /></button>
            </div>
            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-purple-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-purple-500">Affected subscribers</p><p className="mt-1 text-xl font-black text-slate-950">{discontinuePlan.subscriberSummary?.active || 0}</p></div><div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Access</p><p className="mt-1 flex items-center gap-1.5 text-xs font-black text-slate-800"><CalendarClock size={14} /> Until paid end date</p></div></div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-900">New purchases and renewals will stop. Existing customers keep the plan until their individual current period ends, then the subscription becomes canceled.</div>
              <label className="block"><span className="text-xs font-black text-slate-700">Internal reason <span className="font-medium text-slate-400">(optional)</span></span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows="3" placeholder="Why is this plan being discontinued?" className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 p-5"><Button variant="outline" onClick={() => setDiscontinuePlan(null)} disabled={saving}>Keep plan</Button><Button variant="destructive" onClick={handleDeactivate} disabled={saving}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />} Discontinue plan</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}

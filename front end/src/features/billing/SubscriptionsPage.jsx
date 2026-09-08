import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Crown,
  FileText,
  Gauge,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import {
  cancelCustomerSubscription,
  cancelScheduledUpgrade,
  checkoutSubscription,
  createSubscriptionOrder,
  getBillingPortalUrl,
  getCustomerSubscription,
  getPaymentMethods,
  reactivateCustomerSubscription,
  verifySubscriptionPayment,
} from './api.js';

const GATEWAY_LABELS = {
  razorpay: { name: 'Razorpay', hint: 'Cards, UPI, Netbanking, Wallets' },
  stripe: { name: 'Stripe', hint: 'International cards' },
  cashfree: { name: 'Cashfree', hint: 'Cards, UPI, Netbanking' },
};

function loadExternalScript(src, globalCheck) {
  if (globalCheck()) return Promise.resolve(true);
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
    });
  }
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const loadRazorpayScript = () => loadExternalScript('https://checkout.razorpay.com/v1/checkout.js', () => Boolean(window.Razorpay));
const loadCashfreeScript = () => loadExternalScript('https://sdk.cashfree.com/js/v3/cashfree.js', () => Boolean(window.Cashfree));

const cycles = [
  { id: 'monthly', label: 'Monthly', hint: 'Flexible billing' },
  { id: 'quarterly', label: 'Quarterly', hint: '3 month plan' },
  { id: 'yearly', label: 'Yearly', hint: 'Best value' },
];

const statusStyles = {
  active: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  trialing: 'border-blue-100 bg-blue-50 text-blue-700',
  canceling: 'border-amber-100 bg-amber-50 text-amber-700',
  canceled: 'border-slate-100 bg-slate-100 text-slate-600',
  past_due: 'border-red-100 bg-red-50 text-red-700',
};

function money(value, currency = 'INR') {
  if (value == null) return 'Custom';
  const safeCurrency = /^[A-Za-z]{3}$/.test(currency || '') ? currency : 'INR';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: safeCurrency,
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `${safeCurrency} ${Number(value || 0).toLocaleString('en-IN')}`;
  }
}

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function priceFor(plan, cycle) {
  if (!plan) return 0;
  if (cycle === 'quarterly') return plan.price?.quarterly ?? (plan.price?.monthly || 0) * 3;
  if (cycle === 'yearly') return plan.price?.yearly ?? (plan.price?.monthly || 0) * 12;
  return plan.price?.monthly ?? 0;
}

function monthlyEquivalent(plan, cycle) {
  const price = priceFor(plan, cycle);
  if (price == null) return null;
  if (cycle === 'quarterly') return Math.round(Number(price) / 3);
  if (cycle === 'yearly') return Math.round(Number(price) / 12);
  return Number(price);
}

function limitText(value) {
  if (value == null || value === 0) return 'Unlimited';
  return Number(value).toLocaleString('en-IN');
}

function usagePercent(meter) {
  const used = Number(meter.used ?? meter.quantity ?? 0);
  const limit = Number(meter.limit ?? 0);
  if (!limit) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function initials(name = '') {
  return String(name || 'G')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'G';
}

function ConfirmModal({ title, message, confirmLabel, tone = 'danger', busy, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-purple-100 bg-white p-6 shadow-2xl shadow-purple-950/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone === 'danger' ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
              {tone === 'danger' ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-slate-950">{title}</h3>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{message}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Keep plan
          </Button>
          <Button type="button" variant={tone === 'danger' ? 'destructive' : 'default'} onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : null}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, tone = 'purple' }) {
  const tones = {
    purple: 'bg-purple-50 text-purple-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-950">{value}</h2>
          {hint && <p className="mt-1 text-xs font-semibold text-slate-400">{hint}</p>}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone] || tones.purple}`}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}

function UsageMeter({ meter }) {
  const pct = usagePercent(meter);
  const used = meter.used ?? meter.quantity ?? 0;
  const label = meter.label || meter.dimension || meter.key || 'Usage';
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-400' : 'bg-purple-600';

  return (
    <div className="rounded-2xl border border-purple-100 bg-white/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-700">{label}</p>
        <span className="text-xs font-semibold text-slate-400">{limitText(used)} / {limitText(meter.limit)}</span>
      </div>
      {meter.limit ? (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-400">{pct}% used</p>
        </>
      ) : (
        <p className="mt-3 text-xs font-bold text-emerald-600">Unlimited usage</p>
      )}
    </div>
  );
}

function PlanCard({ plan, billingCycle, isCurrent, busy, onChoose, onTrial }) {
  const price = priceFor(plan, billingCycle);
  const monthly = monthlyEquivalent(plan, billingCycle);
  const featureList = (plan.features || []).slice(0, 7);
  const isPopular = /growth|pro|scale/i.test(plan.name || '');

  return (
    <Card className={`relative flex h-full flex-col overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-100/70 ${isCurrent ? 'ring-2 ring-purple-500' : ''}`}>
      {isPopular && !isCurrent && (
        <div className="absolute right-5 top-5 rounded-full bg-purple-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-purple-700">
          Popular
        </div>
      )}
      {isCurrent && (
        <div className="absolute right-5 top-5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
          Current
        </div>
      )}

      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-100 to-fuchsia-50 text-purple-700">
        <Crown size={22} />
      </div>

      <div className="mt-5">
        <h3 className="text-xl font-bold tracking-tight text-slate-950">{plan.name}</h3>
        <p className="mt-2 min-h-[52px] text-sm font-medium leading-6 text-slate-500">{plan.description || 'A workspace plan for your team operations.'}</p>
      </div>

      <div className="mt-5 rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold tracking-tight text-slate-950">{money(price, plan.currency)}</span>
          <span className="pb-1 text-sm font-bold text-slate-400">/ {billingCycle}</span>
        </div>
        {monthly !== null && billingCycle !== 'monthly' && (
          <p className="mt-1 text-xs font-bold text-emerald-600">Approx {money(monthly, plan.currency)} / month</p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Contacts</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{limitText(plan.limits?.contacts)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Agents</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{limitText(plan.limits?.teamMembers)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Workflows</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{limitText(plan.limits?.workflows)}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Templates</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{limitText(plan.limits?.templates)}</p>
        </div>
      </div>

      <div className="mt-5 flex-1 space-y-2">
        {featureList.length ? featureList.map((feature) => (
          <div key={feature} className="flex items-start gap-2 text-sm font-medium leading-6 text-slate-600">
            <CheckCircle2 className="mt-1 shrink-0 text-emerald-500" size={16} />
            <span>{feature}</span>
          </div>
        )) : (
          <div className="flex items-start gap-2 text-sm font-medium leading-6 text-slate-500">
            <CheckCircle2 className="mt-1 shrink-0 text-emerald-500" size={16} />
            <span>Core inbox, workflow, and template access</span>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-2">
        <Button disabled={isCurrent || !!busy} onClick={() => onChoose(plan)} className="w-full">
          {busy === `checkout:${plan.id}` ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
          {isCurrent ? 'Current plan' : 'Activate plan'}
        </Button>
        {plan.trialDays > 0 && !isCurrent && (
          <Button variant="outline" disabled={!!busy} onClick={() => onTrial(plan)}>
            Start {plan.trialDays}-day trial
          </Button>
        )}
      </div>
    </Card>
  );
}

function FeatureComparison({ plans }) {
  if (!plans.length) return null;
  const featureNames = Array.from(new Set(plans.flatMap((plan) => plan.features || []))).slice(0, 12);
  if (!featureNames.length) return null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-purple-100 p-5">
        <h2 className="text-lg font-bold tracking-tight text-slate-950">Compare plan features</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">Quick view of what each plan unlocks for your workspace.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-purple-50/60 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            <tr>
              <th className="px-5 py-4">Feature</th>
              {plans.map((plan) => <th key={plan.id} className="px-5 py-4 text-center">{plan.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {featureNames.map((feature) => (
              <tr key={feature} className="border-t border-purple-50">
                <td className="px-5 py-4 text-sm font-bold text-slate-700">{feature}</td>
                {plans.map((plan) => (
                  <td key={`${plan.id}-${feature}`} className="px-5 py-4 text-center">
                    {plan.features?.includes(feature) ? (
                      <CheckCircle2 className="mx-auto text-emerald-500" size={18} />
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function GatewayPickerModal({ gateways, plan, onChoose, onCancel, busy }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[28px] border border-purple-100 bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-950">Choose payment method</h3>
        <p className="mt-1 text-sm font-medium text-slate-500">Pay for the {plan?.name} plan using:</p>
        <div className="mt-4 space-y-2">
          {gateways.map((id) => {
            const info = GATEWAY_LABELS[id] || { name: id, hint: '' };
            return (
              <button
                key={id}
                type="button"
                disabled={!!busy}
                onClick={() => onChoose(id)}
                className="flex w-full items-center justify-between rounded-2xl border border-purple-100 bg-white px-4 py-3 text-left transition hover:border-purple-300 hover:bg-purple-50/50 disabled:opacity-50"
              >
                <span>
                  <span className="block text-sm font-bold text-slate-800">{info.name}</span>
                  <span className="block text-xs font-medium text-slate-400">{info.hint}</span>
                </span>
                {busy === id ? <Loader2 className="animate-spin text-purple-600" size={16} /> : <CreditCard className="text-purple-400" size={16} />}
              </button>
            );
          })}
        </div>
        <Button type="button" variant="outline" className="mt-4 w-full" onClick={onCancel} disabled={!!busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function TransitionModal({ currentPlanName, currentPeriodEnd, newPlan, onChoose, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-purple-100 bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-950">Switch to {newPlan?.name}?</h3>
        <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
          Your <strong>{currentPlanName}</strong> plan is still active until <strong>{formatDate(currentPeriodEnd)}</strong>. How would you like to switch?
        </p>
        <div className="mt-5 space-y-2.5">
          <button
            type="button"
            onClick={() => onChoose(false)}
            className="w-full rounded-2xl border border-purple-200 bg-purple-50/60 p-4 text-left transition hover:border-purple-300 hover:bg-purple-50"
          >
            <p className="text-sm font-bold text-slate-900">Switch now</p>
            <p className="mt-1 text-xs font-medium text-slate-500">Cancel {currentPlanName} immediately and activate {newPlan?.name} today.</p>
          </button>
          <button
            type="button"
            onClick={() => onChoose(true)}
            className="w-full rounded-2xl border border-purple-100 bg-white p-4 text-left transition hover:border-purple-300 hover:bg-purple-50/50"
          >
            <p className="text-sm font-bold text-slate-900">Keep {currentPlanName} until it ends</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              Pay for {newPlan?.name} now — it activates automatically on {formatDate(currentPeriodEnd)}, right when your current plan ends.
            </p>
          </button>
        </div>
        <Button type="button" variant="outline" className="mt-4 w-full" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const [data, setData] = useState(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Never advertise a gateway before the authenticated backend confirms it is configured.
  const [gateways, setGateways] = useState(null);
  const [gatewayPickerPlan, setGatewayPickerPlan] = useState(null);
  const [transitionPlan, setTransitionPlan] = useState(null);

  useEffect(() => {
    getPaymentMethods().then(setGateways).catch(() => setGateways({}));
  }, []);

  // Bounce back from a Stripe or Cashfree hosted checkout redirect and verify the payment.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stripeSessionId = params.get('stripe_session_id');
    const cashfreeOrderId = params.get('cashfree_order_id');
    if (!stripeSessionId && !cashfreeOrderId) return;
    window.history.replaceState(null, '', window.location.pathname);
    (async () => {
      setBusy('checkout:redirect-return');
      try {
        const verified = await verifySubscriptionPayment(
          stripeSessionId ? { stripe_session_id: stripeSessionId } : { cashfree_order_id: cashfreeOrderId }
        );
        if (!verified.success) throw new Error(verified.message || 'Payment verification failed.');
        await load();
        setMessage(verified.scheduled ? 'Payment confirmed — this plan will take over automatically when your current plan ends.' : 'Plan activated.');
      } catch (error) {
        setMessage(error.message || 'Payment verification failed.');
      } finally {
        setBusy('');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await getCustomerSubscription();
      if (result?.error) throw new Error(result.message || result.error);
      setData(result);
      const cycle = result?.subscription?.billingCycle;
      if (cycle && ['monthly', 'quarterly', 'yearly'].includes(cycle)) setBillingCycle(cycle);
    } catch (error) {
      setMessage(error.message || 'Failed to load subscription data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const subscription = data?.subscription || null;
  const plans = useMemo(() => data?.plans || [], [data]);
  const invoices = data?.invoices || [];
  const usageMeters = data?.usageMeters || [];
  const currentPlanId = subscription?.plan?.id || null;
  const statusClass = statusStyles[subscription?.status] || 'border-slate-100 bg-slate-100 text-slate-600';

  const handleStartTrial = async (plan) => {
    setBusy(`trial:${plan.id}`);
    setMessage('');
    try {
      const result = await checkoutSubscription({ planId: plan.id, billingCycle, startTrial: true });
      if (!result.success) throw new Error(result.message || 'Unable to start trial.');
      await load();
      setMessage(`${plan.trialDays || 0}-day trial started.`);
    } catch (error) {
      setMessage(error.message || 'Unable to start trial.');
    } finally {
      setBusy('');
    }
  };

  const availableGateways = Object.keys(gateways || {}).filter((id) => gateways[id]);

  // Plans requiring payment, while another paid plan is still active with time left, get a
  // "switch now vs keep current plan until it ends" choice instead of an immediate switch.
  const handleChoosePlan = (plan) => {
    const priceNow = priceFor(plan, billingCycle);
    const hasActivePlanWithTimeLeft = subscription
      && subscription.status === 'active'
      && plan.id !== currentPlanId
      && new Date(subscription.currentPeriodEnd) > new Date();
    if (hasActivePlanWithTimeLeft && priceNow > 0) {
      setTransitionPlan(plan);
      return;
    }
    proceedToGateway(plan, false);
  };

  const handleTransitionChoice = (scheduleAtPeriodEnd) => {
    const plan = transitionPlan;
    setTransitionPlan(null);
    proceedToGateway(plan, scheduleAtPeriodEnd);
  };

  const proceedToGateway = (plan, scheduleAtPeriodEnd) => {
    if (gateways === null) {
      setMessage('Loading secure payment options. Please try again in a moment.');
      return;
    }
    if (availableGateways.length === 0) {
      setMessage('Payments are not configured yet. Contact support to activate this plan.');
      return;
    }
    if (availableGateways.length > 1) {
      setGatewayPickerPlan({ plan, scheduleAtPeriodEnd });
      return;
    }
    runCheckout(plan, availableGateways[0], scheduleAtPeriodEnd);
  };

  const handleGatewayChoice = (gateway) => {
    const { plan, scheduleAtPeriodEnd } = gatewayPickerPlan;
    setGatewayPickerPlan(null);
    runCheckout(plan, gateway, scheduleAtPeriodEnd);
  };

  const runCheckout = async (plan, gateway, scheduleAtPeriodEnd = false) => {
    setBusy(`checkout:${plan.id}`);
    setMessage('');
    try {
      const order = await createSubscriptionOrder({ planId: plan.id, billingCycle, gateway, scheduleAtPeriodEnd });
      const scheduledMsg = `Payment confirmed — ${plan.name} will take over automatically on ${formatDate(subscription?.currentPeriodEnd)}, when your current plan ends.`;

      // Free plan — nothing to charge, activate straight away.
      if (order.provider === 'internal') {
        const verified = await verifySubscriptionPayment({ planId: plan.id, billingCycle });
        if (!verified.success) throw new Error(verified.message || 'Unable to activate plan.');
        await load();
        setMessage(`${plan.name} plan activated.`);
        return;
      }

      if (order.provider === 'stripe') {
        if (!order.redirectUrl) throw new Error('Unable to start Stripe checkout.');
        window.location.href = order.redirectUrl;
        return;
      }

      if (order.provider === 'cashfree') {
        const scriptLoaded = await loadCashfreeScript();
        if (!scriptLoaded || !window.Cashfree) throw new Error('Unable to load payment gateway. Check your connection and try again.');
        const cashfree = window.Cashfree({ mode: order.environment || 'production' });
        await cashfree.checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: '_self' });
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded || !window.Razorpay) {
        throw new Error('Unable to load payment gateway. Check your connection and try again.');
      }

      let storedUser = {};
      try { storedUser = JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch { /* ignore */ }

      // Recurring: subscription_id drives the widget instead of order_id/amount — Razorpay
      // derives the charge from the plan itself and auto-bills every cycle going forward.
      await new Promise((resolve) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          subscription_id: order.subscriptionId,
          name: 'Greeto',
          description: `${plan.name} plan — ${billingCycle}${scheduleAtPeriodEnd ? ' (starts when your current plan ends)' : ' (auto-renews)'}`,
          prefill: { name: storedUser.name || '', email: storedUser.email || '' },
          theme: { color: '#8B2CF5' },
          handler: async (response) => {
            try {
              const verified = await verifySubscriptionPayment({
                planId: plan.id,
                billingCycle,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });
              if (!verified.success) throw new Error(verified.message || 'Payment verification failed.');
              await load();
              setMessage(verified.scheduled ? scheduledMsg : `${plan.name} plan activated — it will auto-renew each ${billingCycle === 'yearly' ? 'year' : billingCycle === 'quarterly' ? 'quarter' : 'month'}.`);
            } catch (error) {
              setMessage(error.message || 'Payment verification failed.');
            } finally {
              resolve();
            }
          },
          modal: {
            ondismiss: () => {
              setMessage('Payment cancelled.');
              resolve();
            },
          },
        });
        rzp.on('payment.failed', (response) => {
          setMessage(response?.error?.description || 'Payment failed. Please try again.');
          resolve();
        });
        rzp.open();
      });
    } catch (error) {
      setMessage(error.message || 'Unable to start checkout.');
    } finally {
      setBusy('');
    }
  };

  const handleCancelScheduled = async () => {
    setBusy('cancel-scheduled');
    try {
      const result = await cancelScheduledUpgrade();
      if (!result.success) throw new Error(result.message || 'Unable to cancel the scheduled plan change.');
      await load();
      setMessage('Scheduled plan change cancelled — your current plan continues as-is.');
    } catch (error) {
      setMessage(error.message || 'Unable to cancel the scheduled plan change.');
    } finally {
      setBusy('');
    }
  };

  const handleCancel = async () => {
    setBusy('cancel');
    try {
      const result = await cancelCustomerSubscription();
      if (!result.success) throw new Error(result.message || 'Unable to cancel subscription.');
      setConfirmCancel(false);
      await load();
      setMessage('Subscription will cancel at the end of the billing period.');
    } catch (error) {
      setMessage(error.message || 'Unable to cancel subscription.');
    } finally {
      setBusy('');
    }
  };

  const handleReactivate = async () => {
    setBusy('reactivate');
    try {
      const result = await reactivateCustomerSubscription();
      if (!result.success) throw new Error(result.message || 'Unable to reactivate subscription.');
      await load();
      setMessage('Cancellation undone — your subscription will continue to renew.');
    } catch (error) {
      setMessage(error.message || 'Unable to reactivate subscription.');
    } finally {
      setBusy('');
    }
  };

  const handleManageBilling = async () => {
    setBusy('portal');
    try {
      const result = await getBillingPortalUrl(window.location.href);
      if (!result.success) throw new Error(result.message || 'Unable to open billing portal.');
      if (result.url) {
        window.location.href = result.url;
      } else {
        setMessage('Card and invoice management for this plan is handled right here on this page.');
      }
    } catch (error) {
      setMessage(error.message || 'Unable to open billing portal.');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-[#f4f1fb]">
        <div className="flex items-center gap-4 rounded-[24px] border border-purple-100 bg-white px-6 py-4 text-sm font-semibold text-purple-700 shadow-xl shadow-purple-100/60">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#a100ff] to-[#5b0b84] text-white">
            <Loader2 className="animate-spin" size={20} />
          </div>
          Loading subscriptions
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex-1 overflow-y-auto bg-[#f4f1fb] p-5 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-500">Customer Billing</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-950">Subscriptions</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
              Manage your workspace plan, billing cycle, usage limits, and invoices.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => document.getElementById('billing-history')?.scrollIntoView({ behavior: 'smooth' })}>
              <FileText size={16} /> Billing History
            </Button>
            <Button variant="outline" onClick={load}>
              <RefreshCw size={16} /> Refresh
            </Button>
            <Button onClick={() => document.getElementById('available-plans')?.scrollIntoView({ behavior: 'smooth' })}>
              Upgrade Plan <ArrowRight size={16} />
            </Button>
          </div>
        </div>

        {message && (
          <div className="rounded-[24px] border border-purple-100 bg-white px-5 py-4 text-sm font-bold text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-4">
          <StatCard icon={Crown} label="Current Plan" value={subscription?.plan?.name || 'No plan'} hint={subscription ? 'Workspace access' : 'Choose a plan'} />
          <StatCard icon={ShieldCheck} label="Status" value={subscription?.status || 'Not active'} hint={subscription?.billingCycle || 'No billing cycle'} tone="emerald" />
          <StatCard icon={CalendarClock} label="Next Billing" value={formatDate(subscription?.currentPeriodEnd)} hint={subscription?.cancelAtPeriodEnd ? 'Cancel scheduled' : 'Renewal date'} tone="blue" />
          <StatCard icon={FileText} label="Invoices" value={invoices.length || 0} hint="Recent billing events" tone="amber" />
        </div>

        {subscription ? (
          <>
            {subscription.cancelAtPeriodEnd && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={18} />
                  <span className="font-bold">Your plan remains active until {formatDate(subscription.currentPeriodEnd)}.</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleReactivate} disabled={busy === 'reactivate'}>
                    {busy === 'reactivate' ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                    Undo cancellation
                  </Button>
                  <Button variant="outline" onClick={() => document.getElementById('available-plans')?.scrollIntoView({ behavior: 'smooth' })}>
                    Pick another plan
                  </Button>
                </div>
              </div>
            )}

            {subscription.scheduledPlan && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
                <div className="flex items-center gap-3">
                  <CalendarClock size={18} />
                  <span className="font-bold">
                    {subscription.scheduledPlan.name} is paid for and will activate automatically on {formatDate(subscription.currentPeriodEnd)}.
                  </span>
                </div>
                <Button variant="outline" disabled={busy === 'cancel-scheduled'} onClick={handleCancelScheduled}>
                  {busy === 'cancel-scheduled' ? <Loader2 className="animate-spin" size={16} /> : <XCircle size={16} />}
                  Cancel scheduled change
                </Button>
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-br from-[#8c00d4] via-[#6d05a8] to-[#280044] p-6 text-white">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${statusClass}`}>
                          {subscription.status}
                        </span>
                        <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-white">
                          {subscription.billingCycle}
                        </span>
                      </div>
                      <h2 className="mt-5 text-2xl font-bold tracking-tight">{subscription.plan.name} Workspace Plan</h2>
                      <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-purple-100">
                        {(subscription.plan.features || []).slice(0, 3).join(' - ') || subscription.plan.description || 'Active workspace subscription'}
                      </p>
                    </div>
                    <div className="rounded-[24px] bg-white/12 p-5 text-right shadow-inner shadow-white/10">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-purple-100">Plan price</p>
                      <p className="mt-2 text-2xl font-bold">{money(monthlyEquivalent(subscription.plan, subscription.billingCycle), subscription.currency)}</p>
                      <p className="text-sm font-semibold text-purple-100">per month equivalent</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 p-5 lg:grid-cols-[1fr_240px]">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(usageMeters.length ? usageMeters : [
                      { key: 'contacts', label: 'Contacts', used: 0, limit: subscription.plan.limits?.contacts },
                      { key: 'workflows', label: 'Workflows', used: 0, limit: subscription.plan.limits?.workflows },
                      { key: 'templates', label: 'Templates', used: 0, limit: subscription.plan.limits?.templates },
                    ]).slice(0, 6).map((meter) => (
                      <UsageMeter key={meter.key || meter.dimension} meter={meter} />
                    ))}
                  </div>
                  <div className="rounded-[24px] border border-purple-100 bg-purple-50/60 p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-purple-500">Access until</p>
                    <p className="mt-2 text-base font-bold text-slate-950">{formatDate(subscription.currentPeriodEnd)}</p>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                      {subscription.cancelAtPeriodEnd
                        ? 'Your access will stop after this date.'
                        : subscription.recurring
                          ? `Auto-renews every ${subscription.billingCycle === 'yearly' ? 'year' : subscription.billingCycle === 'quarterly' ? 'quarter' : 'month'}.`
                          : 'Renewal can be managed from this screen.'}
                    </p>
                    <div className="mt-5 grid gap-2">
                      {subscription.provider === 'stripe' && (
                        <Button variant="outline" disabled={busy === 'portal'} onClick={handleManageBilling}>
                          {busy === 'portal' ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                          Manage card & invoices
                        </Button>
                      )}
                      {!subscription.cancelAtPeriodEnd && (
                        <Button variant="destructive" disabled={busy === 'cancel'} onClick={() => setConfirmCancel(true)}>
                          <XCircle size={16} /> Cancel Subscription
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                    <Gauge size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-slate-950">Workspace limits</h2>
                    <p className="text-sm font-medium text-slate-500">Live entitlement snapshot</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    ['Contacts', subscription.plan.limits?.contacts, Users],
                    ['Conversations', subscription.plan.limits?.conversations, Layers3],
                    ['Workflows', subscription.plan.limits?.workflows, Zap],
                    ['Templates', subscription.plan.limits?.templates, FileText],
                    ['Team Members', subscription.plan.limits?.teamMembers, Users],
                  ].map(([label, value, Icon]) => (
                    <div key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-purple-100 bg-white px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Icon className="text-purple-500" size={17} />
                        <span className="text-sm font-bold text-slate-700">{label}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-950">{limitText(value)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        ) : (
          <Card className="overflow-hidden p-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div>
                <Badge className="mb-4">No active plan</Badge>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950">Choose a plan to unlock your workspace.</h2>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-500">
                  Select a plan below to activate inbox, templates, workflows, team members, and channel automation.
                </p>
              </div>
              <div className="rounded-[24px] bg-gradient-to-br from-purple-600 to-[#3b0758] p-5 text-white">
                <Sparkles size={22} />
                <p className="mt-4 text-base font-bold">Built for internal operations</p>
                <p className="mt-2 text-sm font-medium leading-6 text-purple-100">Plans are managed by your admin catalog.</p>
              </div>
            </div>
          </Card>
        )}

        <section id="available-plans" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-purple-500">Available Plans</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Upgrade or change plan</h2>
            </div>
            <div className="grid rounded-[22px] border border-purple-100 bg-white p-1 shadow-sm sm:grid-cols-3">
              {cycles.map((cycle) => (
                <button
                  key={cycle.id}
                  type="button"
                  onClick={() => setBillingCycle(cycle.id)}
                  className={`rounded-2xl px-4 py-2.5 text-left transition ${billingCycle === cycle.id ? 'bg-gradient-to-r from-[#9200cc] to-[#34075a] text-white shadow-lg shadow-purple-200' : 'text-slate-500 hover:bg-purple-50'}`}
                >
                  <span className="block text-sm font-semibold">{cycle.label}</span>
                  <span className={`block text-[11px] font-bold ${billingCycle === cycle.id ? 'text-purple-100' : 'text-slate-400'}`}>{cycle.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {plans.length ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  billingCycle={billingCycle}
                  isCurrent={plan.id === currentPlanId}
                  busy={busy}
                  onChoose={handleChoosePlan}
                  onTrial={handleStartTrial}
                />
              ))}
            </div>
          ) : (
            <Card className="p-10 text-center">
              <p className="text-sm font-bold text-slate-500">No active subscription plans found.</p>
            </Card>
          )}
        </section>

        <FeatureComparison plans={plans} />

        <Card id="billing-history" className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-100 p-5">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-slate-950">Billing History</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Recent subscription invoices and billing events.</p>
            </div>
            <Badge variant="outline">{invoices.length} records</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead className="bg-purple-50/60 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="px-5 py-4">Invoice</th>
                  <th className="px-5 py-4">Plan</th>
                  <th className="px-5 py-4">Amount</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Provider</th>
                  <th className="px-5 py-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length ? invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-purple-50">
                    <td className="px-5 py-4 text-sm font-semibold text-slate-800">{invoice.id}</td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-600">{invoice.planName || '-'}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-800">{money(invoice.amount, invoice.currency)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase ${statusStyles[invoice.status] || 'border-slate-100 bg-slate-100 text-slate-600'}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold capitalize text-slate-500">{invoice.provider || 'internal'}</td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-500">{formatDate(invoice.createdAt)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="px-5 py-12 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50 text-purple-500">
                        <FileText size={22} />
                      </div>
                      <p className="mt-3 text-sm font-bold text-slate-500">No invoices yet.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {confirmCancel && (
        <ConfirmModal
          title="Cancel subscription?"
          message={`Your ${subscription?.plan?.name || 'current'} plan will remain active until ${formatDate(subscription?.currentPeriodEnd)}.`}
          confirmLabel="Yes, cancel"
          busy={busy === 'cancel'}
          onClose={() => setConfirmCancel(false)}
          onConfirm={handleCancel}
        />
      )}

      {gatewayPickerPlan && (
        <GatewayPickerModal
          gateways={availableGateways}
          plan={gatewayPickerPlan.plan}
          busy={null}
          onChoose={handleGatewayChoice}
          onCancel={() => setGatewayPickerPlan(null)}
        />
      )}

      {transitionPlan && (
        <TransitionModal
          currentPlanName={subscription?.plan?.name}
          currentPeriodEnd={subscription?.currentPeriodEnd}
          newPlan={transitionPlan}
          onChoose={handleTransitionChoice}
          onCancel={() => setTransitionPlan(null)}
        />
      )}
    </div>
  );
}

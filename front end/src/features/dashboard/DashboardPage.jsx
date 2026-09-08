import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  CreditCard,
  FileText,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  LogOut,
  Workflow,
  Zap,
} from 'lucide-react';
import { getDashboardData } from './api.js';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';

const CHANNEL_COLORS = {
  whatsapp: '#10b981',
  instagram: '#ec4899',
  telegram: '#0ea5e9',
};

function formatMoney(amount, currency = 'INR') {
  const n = Number(amount || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

function compactNumber(value) {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
  return new Intl.NumberFormat('en-IN', { notation: safeValue >= 1000 ? 'compact' : 'standard' }).format(safeValue);
}

function ShellCard({ children, className = '' }) {
  return (
    <div className={`rounded-[22px] border border-purple-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-100/50 ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, helper, tone = 'purple' }) {
  const tones = {
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-indigo-100 text-indigo-700',
    pink: 'bg-pink-100 text-pink-700',
    amber: 'bg-amber-100 text-amber-700',
  };

  return (
    <ShellCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone] || tones.purple}`}>
          <Icon size={20} />
        </div>
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          Live
        </span>
      </div>
      <p className="mt-4 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-2 text-xs text-slate-400">{helper}</p>
    </ShellCard>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-purple-100 bg-white px-4 py-3 text-xs shadow-lg">
      <p className="mb-2 font-semibold text-slate-800">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="font-semibold" style={{ color: item.color }}>
          {item.name}: <span className="text-slate-900">{item.value}</span>
        </p>
      ))}
    </div>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {subtitle ? <p className="text-xs font-medium text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage({ teamId, onNavigate, currentUser, onLogout, hasWhatsApp, onConnectWhatsApp }) {
  const cacheKey = `dashboard_cache_${teamId}`;

  const [loading, setLoading] = useState(() => {
    // Show loader only if no cached data exists
    try { return !localStorage.getItem(cacheKey); } catch { return true; }
  });
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(() => {
    // Instantly hydrate from localStorage cache on mount
    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [profileOpen, setProfileOpen] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    // If we already have cached data, don't show full-screen loader
    else if (!data) setLoading(true);
    try {
      const res = await getDashboardData(teamId);
      setData(res);
      // Cache the result for instant load next time
      try { localStorage.setItem(cacheKey, JSON.stringify(res)); } catch {}
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      if (!data) setData(null); // Only clear if no cached data to fall back on
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(false);
  }, [teamId]);

  const channelPie = useMemo(() => {
    const rows = data?.messages?.channels || [];
    return rows.map((row) => ({
      name: row.channel_type,
      value: row.count,
      color: CHANNEL_COLORS[row.channel_type] || '#7c3aed',
    }));
  }, [data]);

  if (loading) {
    return (
      <GreetoLoader fullScreen label="Loading dashboard..." sublabel="Fetching live metrics and workspace health" />
    );
  }

  if (!data) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-[#f7f3fb]">
        <div className="rounded-3xl border border-amber-100 bg-white px-8 py-7 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <p className="font-bold text-slate-900">Dashboard data unavailable</p>
          <button
            onClick={() => fetchData(true)}
            className="mt-4 rounded-2xl bg-purple-700 px-4 py-2 text-sm font-bold text-white hover:bg-purple-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const c = data.conversations || {};
  const contacts = data.contacts || {};
  const msgTotals = data.messages?.totals || {};
  const volume = data.messages?.volume || [];
  const csat = data.csat || {};
  const payments = data.payments?.summary || {};
  const campaigns = data.campaigns?.summary || {};
  const automations = data.automations || {};
  const recentConversations = data.recentConversations || [];
  const agents = data.agents || [];
  const totalMessages = Number(msgTotals.inbound || 0) + Number(msgTotals.outbound || 0);
  const isNewWorkspace = Number(c.total || c.all || 0) === 0
    && Number(contacts.total || 0) === 0
    && totalMessages === 0
    && Number(automations.workflows_total || 0) === 0
    && Number(campaigns.total || 0) === 0;

  const healthItems = [
    {
      label: 'Open conversations',
      value: c.open || 0,
      helper: `${c.closed || 0} closed, ${c.snoozed || 0} snoozed`,
      icon: MessageSquare,
      tone: 'blue',
    },
    {
      label: 'Messages in 14 days',
      value: totalMessages,
      helper: `${msgTotals.inbound || 0} inbound, ${msgTotals.outbound || 0} outbound`,
      icon: Activity,
      tone: 'purple',
    },
    {
      label: 'Total contacts',
      value: contacts.total || 0,
      helper: `+${contacts.new_7d || 0} added this week`,
      icon: Users,
      tone: 'green',
    },
    {
      label: 'CSAT score',
      value: csat.average || '-',
      helper: `${csat.total || 0} responses, ${csat.positiveRate || 0}% positive`,
      icon: Star,
      tone: 'pink',
    },
  ];

  const focusItems = [
    {
      label: 'Campaigns running',
      value: campaigns.running || 0,
      icon: Megaphone,
      tone: 'bg-purple-50 text-purple-700',
    },
    {
      label: 'Active workflows',
      value: automations.workflows_active || 0,
      icon: Workflow,
      tone: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: 'Payment pending',
      value: payments.pending || 0,
      icon: CreditCard,
      tone: 'bg-amber-50 text-amber-700',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#f7f3fb]">
      <div className="border-b border-purple-100 bg-white/95 px-8 py-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            {/* <p className="text-xs font-bold uppercase tracking-[0.24em] text-purple-500">Greeto Command Center</p> */}
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Dashboard</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">
              One place for conversations, campaigns, workflows, payments and team activity.
            </p>
          </div>
          <div className="relative flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.16)]" />
              Live workspace
            </div>
            <button
              onClick={() => fetchData(true)}
              className="flex items-center gap-2 rounded-2xl border border-purple-100 bg-white px-4 py-2 text-sm font-semibold text-purple-700 shadow-sm transition hover:bg-purple-50"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
            <div className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#8b00d4] to-[#33005a] px-3 shadow-xl shadow-purple-500/20">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 hover:text-white"
                title="Notifications"
              >
                <Bell size={16} />
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('settings')}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 hover:text-white"
                title="Settings"
              >
                <Settings size={16} />
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('profile')}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/60 bg-gradient-to-br from-fuchsia-400 to-purple-600 text-xs font-bold text-white shadow-inner"
                title="Profile"
              >
                {(currentUser?.name || currentUser?.email || 'D').substring(0, 1).toUpperCase()}
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition hover:bg-white/12 hover:text-white"
                title="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>

            {profileOpen && (
              <div className="absolute right-0 top-14 z-40 w-80 rounded-[28px] border border-purple-100 bg-white p-4 text-slate-900 shadow-2xl">
                <div className="flex items-center gap-3 border-b border-purple-50 pb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-500 text-lg font-bold text-white">
                    {(currentUser?.name || 'D').substring(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{currentUser?.name || 'Greeto User'}</p>
                    <p className="truncate text-xs text-slate-500">{currentUser?.email || 'No email available'}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-xs">
                  <div className="flex items-center justify-between rounded-2xl bg-purple-50 px-3 py-2">
                    <span className="font-semibold text-slate-500">Role</span>
                    <span className="font-semibold text-purple-700">{currentUser?.role || 'agent'}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                    <span className="font-semibold text-slate-500">Team</span>
                    <span className="max-w-[160px] truncate font-semibold text-slate-800">{currentUser?.teamId || 'Default'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-900"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] space-y-6 p-8">
        {!hasWhatsApp && (
          <ShellCard className="overflow-hidden border-emerald-200 bg-gradient-to-br from-white via-emerald-50/60 to-white p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white shadow-sm">
                  <MessageSquare size={22} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-950">Connect WhatsApp to start receiving messages</h2>
                  <p className="mt-0.5 text-sm text-slate-600">Link your WhatsApp Business number to bring customer conversations straight into Greeto.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => (onConnectWhatsApp ? onConnectWhatsApp() : onNavigate?.('integrations'))}
                className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1ebe5b]"
              >
                <MessageSquare size={16} /> Connect WhatsApp
              </button>
            </div>
          </ShellCard>
        )}
        {isNewWorkspace && (
          <ShellCard className="overflow-hidden border-purple-200 bg-gradient-to-br from-white via-purple-50/70 to-fuchsia-50/50 p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-sm font-semibold text-purple-700">
                  <Sparkles size={17} /> Workspace setup
                </div>
                <h2 className="mt-2 text-xl font-bold text-slate-950">Your workspace is ready. Choose how you want to begin.</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Connect a channel for live conversations, or create contacts, templates and workflows directly inside Greeto.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:w-[430px]">
                {[
                  { label: 'Connect a channel', page: 'integrations', icon: Zap },
                  { label: 'Add contacts', page: 'contacts', icon: Users },
                  { label: 'Create template', page: 'templates', icon: FileText },
                  { label: 'Create workflow', page: 'workflows', icon: Workflow },
                ].map(({ label, page, icon: Icon }) => (
                  <button key={page} type="button" onClick={() => onNavigate?.(page)} className="flex items-center gap-2 rounded-xl border border-purple-100 bg-white px-3.5 py-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-800">
                    <Icon size={16} className="text-purple-700" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </ShellCard>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {healthItems.map((item) => (
            <StatCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={compactNumber(item.value)}
              helper={item.helper}
              tone={item.tone}
            />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <ShellCard className="overflow-hidden">
            <div className="border-b border-purple-50 p-5">
              <SectionHeading icon={MessageSquare} title="Recent Conversations" subtitle="Latest active customer threads" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-purple-50/50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Contact</th>
                    <th className="px-5 py-3 font-semibold">Channel</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Assignee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentConversations.map((row) => (
                    <tr key={row.id} className="hover:bg-purple-50/50">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{row.display_name || row.external_id}</p>
                        <p className="text-xs text-slate-400">{row.external_id}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-700">
                          {row.channel_type || 'channel'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold capitalize text-purple-700">
                          {row.status || 'conversation'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-600">{row.assignee_name || '-'}</td>
                    </tr>
                  ))}
                  {!recentConversations.length && (
                    <tr>
                      <td colSpan="4" className="px-5 py-12 text-center text-sm text-slate-400">No recent conversations yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </ShellCard>

          <ShellCard className="p-5">
            <SectionHeading icon={Users} title="Agent Workload" subtitle="Open assigned conversations and outbound sends" />
            <div className="mt-5 space-y-3">
              {agents.map((agent, index) => (
                <div key={agent.id || index} className="flex items-center justify-between rounded-2xl border border-purple-100 bg-purple-50/50 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-700 to-fuchsia-500 text-sm font-bold text-white">
                      {agent.initials || 'AG'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{agent.name}</p>
                      <p className="text-xs capitalize text-slate-400">{agent.role || 'agent'}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-purple-700">{agent.openAssigned || 0} open</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{agent.outboundSent || 0} sent</span>
                  </div>
                </div>
              ))}
              {!agents.length && (
                <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">No agent workload data yet</div>
              )}
            </div>
          </ShellCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <ShellCard className="p-5">
            <SectionHeading icon={Workflow} title="Automation Health" subtitle="Workflow and asset readiness" />
            <div className="mt-5 space-y-3">
              {[
                ['Workflows', `${automations.workflows_active || 0} / ${automations.workflows_total || 0} active`],
                ['Rules', `${automations.rules_active || 0} / ${automations.rules_total || 0} active`],
                ['WhatsApp Flows', automations.whatsapp_flows_total || 0],
                ['Email Templates', automations.email_templates_total || 0],
                ['Media Assets', automations.media_assets_total || 0],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </ShellCard>

          <ShellCard className="p-5">
            <SectionHeading icon={Megaphone} title="Campaign Pulse" subtitle="Current campaign status" />
            <div className="mt-5 space-y-3">
              {[
                ['Total', campaigns.total || 0],
                ['Scheduled', campaigns.scheduled || 0],
                ['Running', campaigns.running || 0],
                ['Completed', campaigns.completed || 0],
                ['Stopped', campaigns.stopped || 0],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </ShellCard>

          <ShellCard className="p-5">
            <SectionHeading icon={CreditCard} title="Payment Snapshot" subtitle="Razorpay workflow outcomes" />
            <div className="mt-5 space-y-3">
              {[
                ['Pending', payments.pending || 0],
                ['Paid', payments.paid || 0],
                ['Expired', payments.expired || 0],
                ['Pending Amount', formatMoney(payments.pending_amount)],
                ['Paid Amount', formatMoney(payments.paid_amount)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                  <span className="font-semibold text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </ShellCard>
        </div>

        <ShellCard className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
                <Zap size={22} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-950">Quick Operations</h2>
                <p className="text-sm text-slate-500">Jump into the most common Greeto workflows.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Open Inbox', icon: MessageSquare, page: 'inbox' },
                { label: 'Launch Campaign', icon: Send, page: 'campaigns' },
                { label: 'Create Workflow', icon: Workflow, page: 'workflows' },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => onNavigate?.(action.page)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700 transition hover:bg-purple-100"
                >
                  <action.icon size={16} />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </ShellCard>
      </div>
    </div>
  );
}

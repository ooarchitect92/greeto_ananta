import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileCheck2,
  GitBranch,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { getAdminOperationsDashboard, getAdminSystemHealth, getAdminWorkspaces } from './api.js';
import TemplatesPage from '../content/TemplatesPage.jsx';
import TeamMembersPage from '../workforce/TeamMembersPage.jsx';
import ReportsPage from '../reports/ReportsPage.jsx';
import AdminSubscriptionsPage from './AdminSubscriptionsPage.jsx';
import AdminSubscriptionPlanFormPage from './AdminSubscriptionPlanFormPage.jsx';
import AdminAuditLogsPage from './AdminAuditLogsPage.jsx';
import AccessControlPage from './AccessControlPage.jsx';
import AdminSettingsPage from './AdminSettingsPage.jsx';
import AdminWorkflowMonitorPage from './AdminWorkflowMonitorPage.jsx';
import AdminIntegrationsPage from './AdminIntegrationsPage.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import GettingStartedPage from '../onboarding/GettingStartedPage.jsx';

const adminMenu = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
  { id: 'guide', label: 'Getting Started', icon: BookOpen, path: '/admin/getting-started' },
  { id: 'workspaces', label: 'Workspaces', icon: Building2, path: '/admin/workspaces' },
  { id: 'conversations', label: 'Inbox Monitor', icon: MessageSquare, path: '/admin/inbox-monitor' },
  { id: 'workflows', label: 'Workflow Monitor', icon: GitBranch, path: '/admin/workflows' },
  { id: 'integrations', label: 'Integrations', icon: Plug, path: '/admin/integrations' },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard, path: '/admin/subscriptions' },
  { id: 'team', label: 'Team Management', icon: UserCog, path: '/admin/team-management' },
  { id: 'access', label: 'Access Control', icon: ShieldCheck, path: '/admin/access-control' },
  { id: 'audit', label: 'Audit Logs', icon: History, path: '/admin/audit-logs' },
  { id: 'reports', label: 'Reports', icon: BarChart3, path: '/admin/reports' },
];

function normalizeAdminPath(pathname) {
  if (pathname === '/admin/settings') return 'settings';
  const match = adminMenu.find((item) => item.path === pathname);
  if (match) return match.id;
  if (pathname === '/admin' || pathname === '/admin/') return 'dashboard';
  return 'dashboard';
}

function AdminPlaceholder({ title, description, icon: Icon, cards = [] }) {
  return (
    <div className="min-h-full bg-[#f4f1fb] p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-purple-500">Admin Control Room</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">{description}</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white text-purple-600 shadow-sm ring-1 ring-purple-100">
            <Icon size={24} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map((card) => {
            const CardIcon = card.icon || Activity;
            return (
              <div key={card.title} className="rounded-[28px] border border-purple-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                  <CardIcon size={19} />
                </div>
                <h3 className="text-base font-black text-slate-950">{card.title}</h3>
                <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{card.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ onNavigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      setDashboard(await getAdminOperationsDashboard());
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load operations dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const summary = dashboard?.summary || {};
  const metrics = [
    { label: 'Total workspaces', value: summary.workspaces || 0, note: `${summary.connectedChannels || 0} connected channels`, icon: Building2, target: 'workspaces', tone: 'purple' },
    { label: 'Open conversations', value: summary.openConversations || 0, note: `${summary.unassignedConversations || 0} need assignment`, icon: MessageSquare, target: 'conversations', tone: 'blue' },
    { label: 'Active workflows', value: summary.activeWorkflows || 0, note: `${summary.failedRuns24h || 0} failures in 24h`, icon: GitBranch, target: 'workflows', tone: 'emerald' },
    { label: 'Messages today', value: summary.messagesToday || 0, note: `${summary.conversations || 0} conversations total`, icon: TrendingUp, target: 'reports', tone: 'amber' },
  ];
  const tones = {
    purple: 'bg-purple-50 text-purple-700', blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-700',
  };
  const pieColors = ['#7c3aed', '#2563eb', '#10b981', '#f59e0b', '#ec4899'];
  const workflowRuns = (dashboard?.workflowHealth || []).reduce((total, item) => total + Number(item.value || 0), 0);
  const successfulRuns = (dashboard?.workflowHealth || []).find((item) => ['completed', 'success', 'successful'].includes(String(item.name).toLowerCase()))?.value || 0;
  const successRate = workflowRuns ? Math.round((Number(successfulRuns) / workflowRuns) * 100) : null;

  if (loading && !dashboard) {
    return <GreetoLoader fullScreen label="Loading admin dashboard..." sublabel="Preparing workspace operations" />;
  }
  return (
    <div className="min-h-full bg-[#f4f1fb] p-5 lg:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-purple-600">Admin control room</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">Business performance</h1>
            <p className="mt-1 text-sm text-slate-500">Live workspace, inbox, automation and channel health in one place.</p>
          </div>
          <button type="button" onClick={loadDashboard} disabled={loading} className="flex h-10 items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh data
          </button>
        </div>
        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <div><p className="text-xs font-semibold text-emerald-700">Automation success</p><p className="text-lg font-bold text-emerald-950">{successRate === null ? 'No runs' : `${successRate}%`}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <Activity size={18} className="text-blue-600" />
            <div><p className="text-xs font-semibold text-blue-700">Connected channels</p><p className="text-lg font-bold text-blue-950">{Number(summary.connectedChannels || 0).toLocaleString()} live</p></div>
          </div>
          <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${summary.failedRuns24h ? 'border-rose-100 bg-rose-50' : 'border-slate-200 bg-white'}`}>
            <TriangleAlert size={18} className={summary.failedRuns24h ? 'text-rose-600' : 'text-slate-400'} />
            <div><p className={`text-xs font-semibold ${summary.failedRuns24h ? 'text-rose-700' : 'text-slate-500'}`}>Needs attention</p><p className="text-lg font-bold text-slate-950">{Number(summary.failedRuns24h || 0).toLocaleString()} failed runs</p></div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          {metrics.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => onNavigate(item.target)}
                className="rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md"
              >
                <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-lg ${tones[item.tone]}`}>
                  <Icon size={20} />
                </div>
                <p className="text-sm font-medium text-slate-500">{item.label}</p>
                <p className="mt-1 text-3xl font-bold text-slate-950">{Number(item.value).toLocaleString()}</p>
                <p className="mt-2 text-xs font-medium text-slate-400">{item.note}</p>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-base font-bold text-slate-900">Seven-day activity</h2><p className="text-xs text-slate-500">Messages, new conversations and workflow executions</p></div><Activity size={18} className="text-purple-600" /></div>
            <div className="h-[310px]">
              <ResponsiveContainer width="100%" height="100%"><AreaChart data={dashboard?.activity || []} margin={{ left: -20, right: 8 }}><defs><linearGradient id="adminActivity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.28}/><stop offset="95%" stopColor="#7c3aed" stopOpacity={0.02}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }}/><YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }}/><Tooltip contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0' }}/><Area type="monotone" dataKey="messages" name="Messages" stroke="#7c3aed" strokeWidth={2.5} fill="url(#adminActivity)"/><Area type="monotone" dataKey="workflowRuns" name="Workflow runs" stroke="#10b981" strokeWidth={2} fillOpacity={0}/><Area type="monotone" dataKey="conversations" name="New conversations" stroke="#2563eb" strokeWidth={2} fillOpacity={0}/></AreaChart></ResponsiveContainer>
            </div>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div><h2 className="text-base font-bold text-slate-900">Channel mix</h2><p className="text-xs text-slate-500">Conversation distribution by channel</p></div>
            <div className="h-[230px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dashboard?.channelMix || []} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>{(dashboard?.channelMix || []).map((entry, index) => <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
            <div className="grid grid-cols-2 gap-2">{(dashboard?.channelMix || []).slice(0, 6).map((item, index) => <div key={item.name} className="flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-slate-500"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} />{item.name}</span><strong className="text-slate-800">{Number(item.value).toLocaleString()}</strong></div>)}</div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-base font-bold text-slate-900">Workflow health</h2><p className="text-xs text-slate-500">Execution outcomes over the last 30 days</p></div><button onClick={() => onNavigate('workflows')} className="text-xs font-bold text-purple-600">View monitor</button></div>
            <div className="h-[245px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashboard?.workflowHealth || []}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/><XAxis dataKey="name" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip cursor={{ fill: '#f8fafc' }}/><Bar dataKey="value" name="Runs" fill="#7c3aed" radius={[5, 5, 0, 0]} maxBarSize={58}/></BarChart></ResponsiveContainer></div>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-5"><h2 className="text-base font-bold text-slate-900">Recent operations</h2><p className="text-xs text-slate-500">Latest automation executions</p></div>
            <div className="divide-y divide-slate-100">{(dashboard?.recentActivity || []).slice(0, 6).map((item) => { const failed = ['FAILED', 'ERROR'].includes(item.status); return <div key={item.id} className="flex items-start gap-3 px-5 py-3"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${failed ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{failed ? <TriangleAlert size={15}/> : <CheckCircle2 size={15}/>}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-0.5 text-xs text-slate-400">{item.kind} · {new Date(item.occurred_at).toLocaleString()}</p></div><span className={`text-[10px] font-bold ${failed ? 'text-rose-600' : 'text-slate-400'}`}>{item.status}</span></div>; })}{!(dashboard?.recentActivity || []).length && <p className="p-8 text-center text-sm text-slate-400">No recent activity</p>}</div>
          </section>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-base font-bold text-slate-900">Workspace readiness</h2><p className="text-xs text-slate-500">Latest workspaces and their operational setup</p></div><button onClick={() => onNavigate('workspaces')} className="text-xs font-bold text-purple-600">All workspaces</button></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Workspace</th><th className="px-5 py-3">Members</th><th className="px-5 py-3">Workflows</th><th className="px-5 py-3">WhatsApp</th><th className="px-5 py-3">Readiness</th></tr></thead><tbody className="divide-y divide-slate-100">{(dashboard?.workspaces || []).map((workspace) => { const ready = Number(workspace.whatsapp_channels) > 0; return <tr key={workspace.id} className="hover:bg-slate-50"><td className="px-5 py-4 text-sm font-semibold text-slate-900">{workspace.name}</td><td className="px-5 py-4 text-sm text-slate-600">{workspace.members}</td><td className="px-5 py-4 text-sm text-slate-600">{workspace.workflows}</td><td className="px-5 py-4 text-sm text-slate-600">{workspace.whatsapp_channels}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{ready ? 'Operational' : 'Setup needed'}</span></td></tr>; })}</tbody></table></div>
        </section>
        </div>
    </div>
  );
}

function AdminWorkspacesPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0, hasNextPage: false, hasPrevPage: false });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      getAdminWorkspaces({ page, limit: 20, search, status })
        .then((body) => {
          if (cancelled) return;
          setItems(Array.isArray(body?.items) ? body.items : []);
          setMeta(body?.meta || { page: 1, totalPages: 1, total: 0, hasNextPage: false, hasPrevPage: false });
        })
        .catch((requestError) => {
          if (cancelled) return;
          setItems([]);
          setError(requestError?.message || 'Unable to load workspaces');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, search ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, search, status]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Workspace Management</h1>
        <p className="mt-1 text-sm text-gray-500">Internal view of customer workspaces, WhatsApp readiness, team size, and inbox volume.</p>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search workspace, owner, domain..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-purple-200"
            />
          </div>
          <select
            value={status}
            onChange={(event) => { setStatus(event.target.value); setPage(1); }}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="onboarding">Onboarding</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-[900px] w-full divide-y divide-gray-100">
          <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-5 py-3">Workspace</th>
              <th className="px-5 py-3">Owner</th>
              <th className="px-5 py-3">WhatsApp</th>
              <th className="px-5 py-3">Team</th>
              <th className="px-5 py-3">Conversations</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item.id} className="transition-colors hover:bg-gray-50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700"><Building2 size={18} /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">{item.name}</p>
                      <p className="truncate text-xs text-gray-400">{item.domain}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">{item.ownerEmail}</td>
                <td className="px-5 py-4">
                  <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', item.whatsappConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                    <CheckCircle2 size={13} /> {item.whatsappConnected ? `Connected (${item.whatsappChannelCount || 1})` : 'Needs setup'}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm font-semibold text-gray-700"><Users size={14} className="mr-1 inline" />{item.teamMembers}</td>
                <td className="px-5 py-4">
                  <p className="text-sm font-semibold text-gray-700"><MessageSquare size={14} className="mr-1 inline" />{item.conversationCount}</p>
                  <p className="mt-1 text-xs font-medium text-gray-400">{item.openConversationCount || 0} open</p>
                </td>
                <td className="px-5 py-4"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold capitalize text-gray-700">{item.status}</span></td>
              </tr>
            ))}
            {!loading && items.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">No workspaces found.</td></tr>}
            {loading && <tr><td colSpan={6} className="px-5 py-8"><GreetoLoader label="Loading workspaces..." sublabel="Checking customer workspaces and channel readiness" /></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs text-gray-500">{meta.total} total workspaces &middot; Page {meta.page} of {meta.totalPages}</p>
        <div className="flex gap-2">
          <button type="button" disabled={!meta.hasPrevPage} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={15} /></button>
          <button type="button" disabled={!meta.hasNextPage} onClick={() => setPage((value) => value + 1)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold disabled:opacity-40" aria-label="Next page"><ChevronRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPortal({ currentUser, onLogout }) {
  const [systemHealth, setSystemHealth] = useState(null);
  const [activePage, setActivePage] = useState(() => normalizeAdminPath(window.location.pathname));
  const [editingPlan, setEditingPlan] = useState(null); // null = list, 'new' = create, {..plan} = edit
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeItem = useMemo(() => adminMenu.find((item) => item.id === activePage) || adminMenu[0], [activePage]);

  const navigateAdmin = (pageId) => {
    const item = adminMenu.find((entry) => entry.id === pageId) || adminMenu[0];
    setEditingPlan(null);
    setActivePage(item.id);
    window.history.pushState(null, '', item.path);
  };

  useEffect(() => {
    const onPop = () => {
      setEditingPlan(null);
      setActivePage(normalizeAdminPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const handleLogout = () => {
    onLogout('admin');
  };

  useEffect(() => {
    let active = true;

    const loadSystemHealth = async () => {
      try {
        const health = await getAdminSystemHealth();
        if (active) setSystemHealth(health);
      } catch {
        if (active) setSystemHealth({ status: 'unhealthy', score: 0 });
      }
    };

    loadSystemHealth();
    const timer = window.setInterval(loadSystemHealth, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const renderPage = () => {
    if (activePage === 'dashboard') return <AdminDashboard onNavigate={navigateAdmin} />;
    if (activePage === 'guide') return <GettingStartedPage variant="admin" onNavigate={navigateAdmin} />;
    if (activePage === 'templates') return <TemplatesPage />;
    if (activePage === 'workflows') {
      return <AdminWorkflowMonitorPage />;
    }
    if (activePage === 'team') return <TeamMembersPage adminMode onNavigate={navigateAdmin} />;
    if (activePage === 'subscriptions') {
      if (editingPlan) {
        return (
          <AdminSubscriptionPlanFormPage
            plan={editingPlan === 'new' ? null : editingPlan}
            onBack={() => {
              setEditingPlan(null);
              window.history.pushState(null, '', '/admin/subscriptions');
            }}
            onSaved={() => {
              setEditingPlan(null);
              window.history.pushState(null, '', '/admin/subscriptions');
            }}
          />
        );
      }
      return (
        <AdminSubscriptionsPage
          onCreate={() => {
            setEditingPlan('new');
            window.history.pushState(null, '', '/admin/subscriptions/new');
          }}
          onEdit={(plan) => {
            setEditingPlan(plan);
            window.history.pushState(null, '', `/admin/subscriptions/${plan.id}`);
          }}
        />
      );
    }
    if (activePage === 'integrations') return <AdminIntegrationsPage />;
    if (activePage === 'access') return <AccessControlPage />;
    if (activePage === 'reports') return <ReportsPage onNavigate={navigateAdmin} variant="admin" />;
    if (activePage === 'workspaces') {
      return <AdminWorkspacesPage />;
    }
    if (activePage === 'conversations') {
      return (
        <AdminPlaceholder
          title="Inbox Monitor"
          description="Manager control room for unassigned chats, SLA risk, blocked conversations and assignment health."
          icon={MessageSquare}
          cards={[
            { title: 'Unassigned queue', text: 'Use customer conversations for live assignment actions.' },
            { title: 'SLA risk', text: 'Review late or breached chats before they become customer issues.' },
            { title: 'Agent ownership', text: 'Monitor assigned versus unassigned flow across teams.' },
          ]}
        />
      );
    }
    if (activePage === 'audit') return <AdminAuditLogsPage searchQuery={searchQuery} />;
    if (activePage === 'settings') return <AdminSettingsPage currentUser={currentUser} />;
    return <AdminDashboard onNavigate={navigateAdmin} />;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f1fb] text-slate-950">
      <aside className={cn(
        'group relative z-30 flex h-screen w-16 shrink-0 flex-col overflow-hidden bg-gradient-to-b from-[#9200cc] to-[#34075a] text-white shadow-xl transition-[width] duration-300 hover:w-60'
      )}>
        <div className="flex h-[76px] shrink-0 items-center border-b border-white/10 px-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-xl font-black shadow-lg">G</div>
            <div className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:w-auto group-hover:opacity-100">
              <div className="text-2xl font-black tracking-tight">Greeto</div>
              <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/65">Admin Panel</div>
            </div>
          </div>
        </div>
        <nav className="no-scrollbar flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
          {adminMenu.filter((item) => {
            // Access Control and Audit Logs manage/expose RBAC + security-sensitive activity —
            // restrict to admin/super_admin to match the backend's requireRole gate on these routes.
            if (item.id === 'access' || item.id === 'audit') {
              return ['admin', 'super_admin'].includes(String(currentUser?.role || '').toLowerCase());
            }
            return true;
          }).map((item) => {
            const Icon = item.icon;
            const active = item.id === activePage;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateAdmin(item.id)}
                className={cn(
                  'flex h-12 w-full items-center rounded-xl text-sm font-semibold transition-all',
                  'gap-0 px-0 group-hover:gap-2 group-hover:px-0',
                  active ? 'bg-white text-purple-700 shadow-lg shadow-purple-950/20' : 'text-white/80 hover:bg-white/10 hover:text-white'
                )}
                title={item.label}
              >
                <span className="flex h-8 w-10 shrink-0 items-center justify-center"><Icon size={19} /></span>
                <span className="w-0 overflow-hidden whitespace-nowrap tracking-wide opacity-0 transition-all duration-300 group-hover:w-auto group-hover:opacity-100">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="flex h-10 w-full items-center gap-0 rounded-xl px-0 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 hover:text-white group-hover:gap-2"
            title="Logout"
          >
            <span className="flex h-8 w-10 shrink-0 items-center justify-center"><LogOut size={19} /></span>
            <span className="w-0 overflow-hidden whitespace-nowrap tracking-wide opacity-0 transition-all duration-300 group-hover:w-auto group-hover:opacity-100">Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="mx-6 mt-6 flex h-[92px] shrink-0 items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white px-10 shadow-sm">
          <div className="relative hidden w-[560px] max-w-[42vw] md:block">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search transactions, tenants, logs or templates..."
                className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-11 pr-4 text-sm font-medium outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
              />
          </div>
          <div className="flex min-w-0 items-center gap-4">
            <div
              className={cn(
                'hidden items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold xl:flex',
                !systemHealth && 'border-slate-200 bg-slate-50 text-slate-500',
                systemHealth?.status === 'healthy' && 'border-emerald-100 bg-emerald-50 text-emerald-600',
                systemHealth?.status === 'degraded' && 'border-amber-100 bg-amber-50 text-amber-700',
                systemHealth?.status === 'unhealthy' && 'border-rose-100 bg-rose-50 text-rose-600'
              )}
              title={systemHealth?.checkedAt ? `Last checked ${new Date(systemHealth.checkedAt).toLocaleTimeString()}` : 'Checking live API and database readiness'}
            >
              <Activity size={15} /> SYS HEALTH: {systemHealth ? `${systemHealth.score}%` : 'CHECKING'}
            </div>
            <button type="button" className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-gray-50" aria-label="Notifications">
              <Bell size={20} />
              <span className="absolute right-1 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">6</span>
            </button>
            <button type="button" onClick={() => { setActivePage('settings'); window.history.pushState(null, '', '/admin/settings'); }} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 hover:bg-gray-50" aria-label="Admin settings"><Settings size={20} /></button>
            <div className="h-12 w-px bg-gray-100" />
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-purple-600 text-sm font-black text-white">
                {(currentUser?.name || currentUser?.email || 'A').charAt(0).toUpperCase()}
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-400" />
              </div>
              <div className="hidden xl:block">
                <p className="max-w-40 truncate text-sm font-bold text-slate-800">{currentUser?.name || 'Admin User'}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{currentUser?.role || 'Super Admin'}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{renderPage()}</main>
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[32px] border border-purple-100 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Confirm logout</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Leave admin panel?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Your admin session will be closed on this browser.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl bg-gradient-to-b from-rose-500 to-rose-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-rose-800"
              >
                Yes, log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

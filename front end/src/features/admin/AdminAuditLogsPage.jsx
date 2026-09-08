import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  History,
  MoreHorizontal,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { getAdminAuditLogs } from './api.js';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';

const CATEGORY_STYLE = {
  SECURITY: 'bg-teal-100 text-teal-700',
  BILLING: 'bg-orange-100 text-orange-600',
  SYSTEM: 'bg-red-100 text-red-600',
  TENANT: 'bg-purple-100 text-purple-700',
};

const PAGE_SIZE = 5;

function getInitials(name, email) {
  const source = name || email || 'System';
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SA';
}

function categoryFromAction(event) {
  const text = `${event.action} ${event.targetEntity || ''} ${event.targetName || ''} ${JSON.stringify(event.metadata || {})}`.toLowerCase();
  if (text.includes('billing') || text.includes('subscription') || text.includes('invoice') || text.includes('payment') || text.includes('razorpay')) return 'BILLING';
  if (text.includes('tenant') || text.includes('workspace') || text.includes('kyb') || text.includes('kyc') || text.includes('business')) return 'TENANT';
  if (text.includes('role') || text.includes('permission') || text.includes('admin') || text.includes('mfa') || text.includes('security') || text.includes('login')) return 'SECURITY';
  return 'SYSTEM';
}

function formatAuditDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { line1: 'Not available', line2: '' };
  return {
    line1: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    line2: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };
}

function describeAuditEvent(event) {
  const target = [event.targetEntity, event.targetName].filter(Boolean).join(': ');
  const reason = event.reason ? ` Reason: ${event.reason}` : '';
  return `${event.action}${target ? ` on ${target}` : ''}.${reason}`;
}

function mapAuditEvent(event, index) {
  const adminName = event.admin?.name
    || [event.admin?.firstName, event.admin?.lastName].filter(Boolean).join(' ')
    || event.admin?.email
    || 'System';
  const date = formatAuditDate(event.createdAt);
  const colors = ['bg-sky-500', 'bg-orange-400', 'bg-teal-500', 'bg-purple-500', 'bg-emerald-500'];
  const ipAddress = event.ipAddress || event.metadata?.ipAddress || event.metadata?.ip || 'Internal';

  return {
    id: event.id,
    timestampLine1: date.line1,
    timestampLine2: date.line2,
    adminName,
    adminId: event.adminId || event.admin?.id || 'system',
    initials: getInitials(adminName, event.admin?.email),
    initialsColor: colors[index % colors.length],
    category: categoryFromAction(event),
    description: describeAuditEvent(event),
    ipAddress,
    ipVariant: ipAddress === 'Internal' ? 'internal' : 'external',
  };
}

function csvEscape(value) {
  const normalized = String(value ?? '');
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function exportLogsCsv(logs) {
  const rows = [
    ['Timestamp', 'Admin', 'Admin ID', 'Category', 'Description', 'IP Address'],
    ...logs.map((log) => [
      `${log.timestampLine2} ${log.timestampLine1}`,
      log.adminName,
      log.adminId,
      log.category,
      log.description,
      log.ipAddress,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function MetricCard({ label, value, icon, iconBg, valueColor = 'text-slate-950' }) {
  return (
    <div className="flex items-center gap-4 rounded-[24px] border border-purple-100 bg-white p-4 shadow-sm">
      <div className={`${iconBg} flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
        <p className={`mt-0.5 text-2xl font-bold ${valueColor}`}>{value}</p>
      </div>
    </div>
  );
}

export default function AdminAuditLogsPage({ searchQuery = '' }) {
  const [logs, setLogs] = useState([]);
  const [liveFeed, setLiveFeed] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All Action Categories');
  const [userFilter, setUserFilter] = useState('All Admin Users');
  const [page, setPage] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loadedFromApi, setLoadedFromApi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [range, setRange] = useState('24h');
  const [summary, setSummary] = useState({ security: 0, tenant: 0, billing: 0, failed: 0 });
  const [adminOptions, setAdminOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      if (!cancelled) {
        setLoading(true);
        setLoadError('');
      }

      const rangeHours = range === '7d' ? 7 * 24 : range === '30d' ? 30 * 24 : 24;
      const data = await getAdminAuditLogs({
        page,
        limit: PAGE_SIZE,
        search: searchQuery,
        category: categoryFilter !== 'All Action Categories' ? categoryFilter : '',
        adminName: userFilter !== 'All Admin Users' ? userFilter : '',
        from: new Date(Date.now() - rangeHours * 60 * 60 * 1000).toISOString(),
      });
      if (data?.error || data?.success === false) throw new Error(data.message || data.error || 'Unable to load audit logs');
      const events = Array.isArray(data?.events) ? data.events : [];
      if (!cancelled) {
        setLogs(events.map(mapAuditEvent));
        setTotalLogs(Number(data.total ?? events.length));
        setSummary(data.summary || { security: 0, tenant: 0, billing: 0, failed: 0 });
        setAdminOptions(Array.isArray(data.admins) ? data.admins : []);
        setLoadedFromApi(true);
        setLoading(false);
      }
    }

    loadLogs().catch((err) => {
      if (!cancelled) {
        setLogs([]);
        setTotalLogs(0);
        setLoadedFromApi(false);
        setLoadError(err instanceof Error ? err.message : 'Unable to load audit logs');
        setLoading(false);
      }
    });

    if (!liveFeed) {
      return () => {
        cancelled = true;
      };
    }

    const interval = window.setInterval(() => {
      loadLogs().catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load audit logs');
          setLoading(false);
        }
      });
    }, 4500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [liveFeed, page, searchQuery, categoryFilter, userFilter, range]);

  const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE));
  const securityCount = summary.security;
  const tenantCount = summary.tenant;
  const billingCount = summary.billing;
  const failedCount = summary.failed;
  const startRow = totalLogs === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, totalLogs);
  const endRow = Math.min(page * PAGE_SIZE, totalLogs);

  return (
    <div className="min-h-full bg-[#f4f1fb] p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-500">Admin Control Room</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Audit Logs</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Complete transparency of administrative operations</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-purple-100 bg-white px-3.5 py-2 shadow-sm">
              <span className="select-none text-[11px] font-bold tracking-wider text-slate-500">LIVE FEED</span>
              <button
                type="button"
                onClick={() => setLiveFeed((value) => !value)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${liveFeed ? 'bg-[#8B2CF5]' : 'bg-slate-300'}`}
                aria-label="Toggle live feed"
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${liveFeed ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
              {liveFeed && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className={`relative inline-flex h-2 w-2 rounded-full ${loadedFromApi ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                </span>
              )}
            </div>

            <label className="flex items-center gap-2 rounded-2xl border border-purple-100 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition focus-within:ring-4 focus-within:ring-purple-100">
              <Calendar size={14} />
              <select
                value={range}
                onChange={(event) => { setRange(event.target.value); setPage(1); }}
                className="bg-transparent outline-none"
                aria-label="Audit log time range"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => exportLogsCsv(logs)}
              disabled={logs.length === 0}
              className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#b532f5] to-[#4a0872] px-4 py-2 text-xs font-bold text-white shadow-lg shadow-purple-200 transition hover:shadow-purple-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={14} />
              Export Logs
            </button>
          </div>
        </div>

        {loadError && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {loadError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Security Events" value={securityCount} icon={<Shield size={20} className="text-purple-500" />} iconBg="bg-purple-50" />
          <MetricCard label="Tenant Mods" value={tenantCount} icon={<Users size={20} className="text-teal-500" />} iconBg="bg-teal-50" />
          <MetricCard label="Billing Actions" value={billingCount} icon={<CreditCard size={20} className="text-orange-400" />} iconBg="bg-orange-50" />
          <MetricCard label="Failed Attempts" value={failedCount} icon={<AlertTriangle size={20} className="text-red-500" />} iconBg="bg-red-50" valueColor="text-red-600" />
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-[24px] border border-purple-100 bg-white px-5 py-3.5 shadow-sm">
          <SlidersHorizontal size={14} className="shrink-0 text-slate-400" />
          <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Filters:</span>

          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}
              className="cursor-pointer appearance-none rounded-2xl border border-purple-100 bg-white py-2 pl-3 pr-9 text-xs font-semibold text-slate-700 outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
            >
              <option>All Action Categories</option>
              <option value="SECURITY">Security</option>
              <option value="BILLING">Billing</option>
              <option value="SYSTEM">System</option>
              <option value="TENANT">Tenant</option>
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="relative">
            <select
              value={userFilter}
              onChange={(event) => { setUserFilter(event.target.value); setPage(1); }}
              className="cursor-pointer appearance-none rounded-2xl border border-purple-100 bg-white py-2 pl-3 pr-9 text-xs font-semibold text-slate-700 outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
            >
              <option>All Admin Users</option>
              {adminOptions.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          <button
            type="button"
            onClick={() => {
              setCategoryFilter('All Action Categories');
              setUserFilter('All Admin Users');
              setPage(1);
            }}
            className="ml-auto text-xs font-bold text-[#8B2CF5] hover:underline"
          >
            Clear all filters
          </button>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-purple-100 bg-white shadow-sm">
          <div className="border-b border-purple-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                <History size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-950">Administrative event trail</h2>
                <p className="text-xs font-medium text-slate-500">Template, workflow, integration, assignment and access activity.</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-purple-50">
                  {['TIMESTAMP', 'ADMIN USER', 'CATEGORY', 'DESCRIPTION', 'IP ADDRESS', ''].map((heading) => (
                    <th key={heading} className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-400">
                      {loading ? <GreetoLoader label="Loading audit records..." sublabel="Reviewing workspace activity" /> : 'No audit records match the selected filters.'}
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="transition hover:bg-purple-50/35">
                      <td className="px-6 py-5">
                        <p className="font-bold leading-none text-slate-800">{log.timestampLine1}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{log.timestampLine2}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${log.initialsColor}`}>
                            {log.initials}
                          </div>
                          <div>
                            <p className="font-bold leading-none text-slate-900">{log.adminName}</p>
                            <p className="mt-1 max-w-[180px] truncate font-mono text-[9px] text-slate-400">ID: {log.adminId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${CATEGORY_STYLE[log.category]}`}>
                          {log.category}
                        </span>
                      </td>
                      <td className="max-w-xs px-6 py-5">
                        <p className={`truncate leading-relaxed ${log.category === 'SYSTEM' && log.description.toLowerCase().includes('fail') ? 'font-semibold text-red-600' : 'text-slate-700'}`}>
                          {log.description}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`rounded-xl px-2.5 py-1 font-mono text-[11px] font-semibold ${log.ipVariant === 'internal' ? 'bg-slate-100 text-slate-500' : 'bg-indigo-50 text-indigo-700'}`}>
                          {log.ipAddress}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <button type="button" className="text-slate-400 transition hover:text-slate-700">
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-purple-50 px-6 py-4">
            <span className="text-xs text-slate-400">
              Showing {startRow}-{endRow} of {totalLogs.toLocaleString()} entries
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={page === 1}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-purple-100 text-slate-500 transition hover:border-[#8B2CF5] hover:text-[#8B2CF5] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-bold transition ${page === pageNumber ? 'border-[#8B2CF5] bg-[#8B2CF5] text-white' : 'border-purple-100 text-slate-600 hover:border-[#8B2CF5] hover:text-[#8B2CF5]'}`}
                  >
                    {pageNumber}
                  </button>
                );
              })}

              {totalPages > 5 && (
                <>
                  <span className="px-1 text-xs text-slate-400">...</span>
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border text-xs font-bold transition ${page === totalPages ? 'border-[#8B2CF5] bg-[#8B2CF5] text-white' : 'border-purple-100 text-slate-600 hover:border-[#8B2CF5] hover:text-[#8B2CF5]'}`}
                  >
                    {totalPages}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={page === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-purple-100 text-slate-500 transition hover:border-[#8B2CF5] hover:text-[#8B2CF5] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

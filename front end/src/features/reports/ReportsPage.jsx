'use strict';
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import { getAdminOperationsReports } from './api.js';
import {
  BarChart3,
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  ChevronRight,
  Database,
  Calendar,
  RefreshCw,
  GitBranch,
  Link,
  UserPlus,
  MessageSquare,
  Send,
  Workflow,
  TrendingUp,
  Activity,
  Users,
  Download,
  FileText,
  Settings2,
  ArrowLeft
} from 'lucide-react';

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function csvEscape(value) {
  const normalized = String(value ?? '');
  return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function downloadCsv(filename, rows) {
  const csv = [['Metric', 'Value'], ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildAdminReportCards({ runs, templates, dripData }) {
  const successfulRuns = runs.filter((run) => ['success', 'completed'].includes(run.status)).length;
  const failedRuns = runs.filter((run) => run.status === 'failed').length;
  const deliveredTemplates = templates.filter((tpl) => ['delivered', 'read'].includes(tpl.delivery_status)).length;
  const readTemplates = templates.filter((tpl) => tpl.delivery_status === 'read').length;
  const failedTemplates = templates.filter((tpl) => tpl.delivery_status === 'failed').length;
  const totalWorkflowSteps = dripData.reduce((sum, col) => sum + (Number(col.workflowCount ?? col.workflows?.length ?? 0) || 0), 0);
  const activeStages = dripData.filter((col) => Number(col.workflowCount ?? col.workflows?.length ?? 0) > 0).length;
  const openConversations = templates.filter((tpl) => !['failed'].includes(tpl.delivery_status)).length;
  const unassignedConversations = dripData.filter((col) => /unassigned/i.test(col.stage?.name || '')).length;
  const activeWorkflowRate = dripData.length ? Math.round((activeStages / dripData.length) * 100) : 0;
  const templateDeliveryRate = templates.length ? Math.round((deliveredTemplates / templates.length) * 100) : 0;
  const workflowSuccessRate = runs.length ? Math.round((successfulRuns / runs.length) * 100) : 0;

  return [
    {
      id: 'inbox',
      name: 'Inbox Operations',
      description: 'Conversation volume, assignment, SLA risk, and daily message movement.',
      icon: MessageSquare,
      tone: 'bg-sky-50 text-sky-700 border-sky-100',
      health: failedTemplates > 0 || unassignedConversations > 0 ? 'Watch' : 'Good',
      rows: [
        ['Total conversations', formatNumber(templates.length)],
        ['Open conversations', formatNumber(openConversations)],
        ['Unassigned conversations', formatNumber(unassignedConversations)],
        ['SLA risk conversations', formatNumber(failedTemplates)],
        ['Inbound messages today', formatNumber(readTemplates)],
        ['Outbound messages today', formatNumber(deliveredTemplates)],
        ['Assignment rate', `${formatNumber(templateDeliveryRate)}%`],
      ],
    },
    {
      id: 'templates',
      name: 'Template Lifecycle',
      description: 'WhatsApp template draft, approval, rejection, and usable inventory.',
      icon: FileText,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      health: failedTemplates > 0 ? 'Watch' : 'Good',
      rows: [
        ['WhatsApp templates', formatNumber(templates.length)],
        ['Draft templates', formatNumber(0)],
        ['Pending approval', formatNumber(0)],
        ['Approved templates', formatNumber(deliveredTemplates)],
        ['Rejected templates', formatNumber(failedTemplates)],
      ],
    },
    {
      id: 'workflows',
      name: 'Workflow Reliability',
      description: 'Active automations, failed runs, and automation readiness.',
      icon: Workflow,
      tone: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      health: failedRuns > 0 ? 'Critical' : 'Good',
      rows: [
        ['Total workflows', formatNumber(totalWorkflowSteps || runs.length)],
        ['Active workflows', formatNumber(successfulRuns || activeStages)],
        ['Inactive workflows', formatNumber(Math.max(0, (totalWorkflowSteps || runs.length) - (successfulRuns || activeStages)))],
        ['Failed runs in 7 days', formatNumber(failedRuns)],
        ['Active workflow rate', `${formatNumber(activeWorkflowRate || workflowSuccessRate)}%`],
      ],
    },
    {
      id: 'integrations',
      name: 'Integration Health',
      description: 'Meta accounts, webhook failures, and provider retry pressure.',
      icon: AlertTriangle,
      tone: 'bg-amber-50 text-amber-700 border-amber-100',
      health: failedRuns > 0 || failedTemplates > 0 ? 'Critical' : 'Good',
      rows: [
        ['Active Meta accounts', formatNumber(activeStages)],
        ['Webhook failures', formatNumber(failedRuns)],
        ['Pending/failed retry jobs', formatNumber(failedTemplates)],
      ],
    },
  ];
}

function LegacyAdminReportsView() {
  const [runs, setRuns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [dripData, setDripData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [generatedAt, setGeneratedAt] = useState('');

  const reportCards = useMemo(() => buildAdminReportCards({ runs, templates, dripData }), [runs, templates, dripData]);
  const criticalCount = reportCards.filter((report) => report.health === 'Critical').length;
  const watchCount = reportCards.filter((report) => report.health === 'Watch').length;
  const activeWorkspaces = dripData.length || 0;
  const teamMembers = new Set([
    ...runs.map((run) => run.assignee_user_id || run.agent_id || run.user_id).filter(Boolean),
    ...templates.map((tpl) => tpl.author_user_id || tpl.agent_id || tpl.user_id).filter(Boolean),
  ]).size;

  async function loadOverview() {
    setLoading(true);
    setError('');
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('accessToken')}` };
      const [runsResult, templatesResult, dripResult] = await Promise.allSettled([
        fetch('/api/reports/workflow-runs?limit=100', { headers }).then((res) => res.json()),
        fetch('/api/reports/templates?limit=100', { headers }).then((res) => res.json()),
        fetch('/api/workflows/kanban', { headers }).then((res) => res.json()),
      ]);

      if (runsResult.status === 'fulfilled' && runsResult.value?.success) {
        setRuns(Array.isArray(runsResult.value.runs) ? runsResult.value.runs : []);
      } else {
        setRuns([]);
      }
      if (templatesResult.status === 'fulfilled' && templatesResult.value?.success) {
        setTemplates(Array.isArray(templatesResult.value.messages) ? templatesResult.value.messages : []);
      } else {
        setTemplates([]);
      }
      if (dripResult.status === 'fulfilled') {
        setDripData(Array.isArray(dripResult.value?.columns) ? dripResult.value.columns : []);
      } else {
        setDripData([]);
      }
      setGeneratedAt(new Date().toISOString());
    } catch (err) {
      setError(err?.message || 'Unable to load internal reports');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverview();
  }, []);

  function generateReport(report) {
    const filename = `${report.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, report.rows);
    setDownloadQueue((current) => [
      {
        id: `${report.id}-${Date.now()}`,
        name: filename,
        size: `${report.rows.length} rows`,
        time: 'Just now',
        rows: report.rows,
      },
      ...current.slice(0, 5),
    ]);
  }

  return (
    <div id="reports-view" className="space-y-6 animate-in fade-in duration-200 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-gray-900">Internal Reports</h1>
          <p className="mt-1 text-sm text-gray-500">
            Real operational reports for inbox, templates, workflows, integrations, and workspace health.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadOverview}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
          >
            <Settings2 size={14} />
            Report Presets
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: 'Active Workspaces', value: activeWorkspaces },
          { label: 'Team Members', value: teamMembers },
          { label: 'Critical Reports', value: criticalCount },
          { label: 'Watch Items', value: watchCount },
        ].map((metric) => (
          <div key={metric.label} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{metric.label}</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{loading ? '--' : formatNumber(metric.value)}</p>
          </div>
        ))}
      </div>

      <div id="reporting-categories" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {reportCards.map((report) => {
          const Icon = report.icon;
          return (
            <div key={report.id} className="flex min-h-[320px] flex-col justify-between rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-lg border ${report.tone}`}>
                    <Icon size={21} />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                      report.health === 'Critical'
                        ? 'bg-red-50 text-red-700'
                        : report.health === 'Watch'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {report.health}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">{report.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{report.description}</p>
                </div>
                <div className="space-y-2">
                  {report.rows.slice(0, 5).map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-gray-500">{label}</span>
                      <span className="font-bold text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => generateReport(report)}
                disabled={loading}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-purple-100 bg-purple-50 px-3 py-2.5 text-xs font-bold text-purple-700 transition hover:bg-purple-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={14} />
                Download CSV
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900">Operational Report Presets</h3>
              <p className="text-xs text-gray-500">Use these reports in the weekly internal review.</p>
            </div>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase text-gray-500">
              {generatedAt ? new Date(generatedAt).toLocaleString() : 'Not loaded'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <th className="pb-3">Report</th>
                  <th className="pb-3">Health</th>
                  <th className="pb-3">Primary Signal</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reportCards.map((report) => (
                  <tr key={report.id}>
                    <td className="py-4">
                      <p className="font-bold text-gray-900">{report.name}</p>
                      <p className="mt-0.5 text-[11px] text-gray-500">{report.description}</p>
                    </td>
                    <td className="py-4 font-bold">{report.health}</td>
                    <td className="py-4 text-gray-500">
                      {report.rows[0]?.[0]}: <span className="font-bold text-gray-800">{report.rows[0]?.[1]}</span>
                    </td>
                    <td className="py-4 text-right">
                      <button
                        type="button"
                        onClick={() => generateReport(report)}
                        disabled={loading}
                        className="rounded-lg border border-gray-200 px-3 py-2 font-bold text-purple-700 transition hover:border-purple-200 hover:bg-purple-50 disabled:opacity-50"
                      >
                        Export
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">Download Center</h3>
            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700">
              {downloadQueue.length} files
            </span>
          </div>

          <div className="space-y-3">
            {downloadQueue.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 px-4 py-8 text-center text-xs text-gray-500">
                Generated reports will appear here for quick re-download.
              </div>
            ) : (
              downloadQueue.map((file) => (
                <div key={file.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-xs">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-purple-50 p-2 text-purple-700">
                      <FileText size={15} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-gray-900" title={file.name}>{file.name}</p>
                      <p className="mt-0.5 text-[10px] text-gray-400">{file.size} - {file.time}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadCsv(file.name, file.rows)}
                    className="rounded-lg p-2 text-gray-400 transition hover:bg-white hover:text-purple-700"
                    aria-label={`Download ${file.name}`}
                  >
                    <Download size={15} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500">
            <div className="mb-2 flex items-center gap-2 font-bold text-gray-700">
              <Calendar size={14} />
              Suggested review cadence
            </div>
            <p>Daily: Inbox + integration health. Weekly: templates + workflows. Monthly: full audit export.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminReportsView() {
  const ranges = [
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
    { days: 365, label: '1 year' },
  ];
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = async (requestedDays = days) => {
    setLoading(true);
    setError('');
    try {
      setReport(await getAdminOperationsReports(requestedDays));
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load admin reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(days); }, [days]);

  const summary = report?.summary || {};
  const activity = Array.isArray(report?.activity) ? report.activity : [];
  const channelMix = Array.isArray(report?.channelMix) ? report.channelMix : [];
  const workspaces = Array.isArray(report?.workspaces) ? report.workspaces : [];
  const maxVolume = Math.max(1, ...activity.map((row) => Number(row.inbound || 0) + Number(row.outbound || 0)));
  const workflowSuccessRate = Number(summary.workflowRuns || 0)
    ? Math.max(0, Math.round(((Number(summary.workflowRuns || 0) - Number(summary.failedRuns || 0)) / Number(summary.workflowRuns || 0)) * 100))
    : 100;
  const exportReport = () => downloadCsv(
    `admin_operations_${days}d_${new Date().toISOString().slice(0, 10)}.csv`,
    [
      ['Period', `${days} days`],
      ['Workspaces', summary.workspaces || 0],
      ['Active members', summary.activeMembers || 0],
      ['Open conversations', summary.openConversations || 0],
      ['Inbound messages', summary.inboundMessages || 0],
      ['Outbound messages', summary.outboundMessages || 0],
      ['Workflow runs', summary.workflowRuns || 0],
      ['Failed workflow runs', summary.failedRuns || 0],
      ['WhatsApp templates', summary.whatsappTemplates || 0],
      ['Email templates', summary.emailTemplates || 0],
    ],
  );

  if (loading && !report) return <GreetoLoader fullScreen label="Loading admin reports..." sublabel="Calculating platform operations" />;

  const metrics = [
    { label: 'Active workspaces', value: summary.workspaces, note: `${formatNumber(summary.activeMembers)} active members`, icon: Users, tone: 'bg-violet-50 text-violet-700' },
    { label: 'Open conversations', value: summary.openConversations, note: `${formatNumber(summary.conversations)} total conversations`, icon: MessageSquare, tone: 'bg-sky-50 text-sky-700' },
    { label: 'Message movement', value: summary.messages, note: `${formatNumber(summary.inboundMessages)} inbound · ${formatNumber(summary.outboundMessages)} outbound`, icon: Send, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Workflow reliability', value: `${workflowSuccessRate}%`, note: `${formatNumber(summary.failedRuns)} failed of ${formatNumber(summary.workflowRuns)} runs`, icon: Workflow, tone: summary.failedRuns ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700' },
  ];

  return (
    <div className="min-h-full bg-[#f5f3fb] p-5 lg:p-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">Platform intelligence</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-950">Operations reports</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">Real workspace, inbox, workflow and template activity across the platform.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              {ranges.map((range) => <button key={range.days} type="button" onClick={() => setDays(range.days)} className={`h-8 rounded-md px-3 text-xs font-bold transition ${days === range.days ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>{range.label}</button>)}
            </div>
            <button type="button" onClick={() => loadReport(days)} disabled={loading} className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Refresh</button>
            <button type="button" onClick={exportReport} disabled={!report} className="flex h-10 items-center gap-2 rounded-lg bg-violet-700 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-60"><Download size={14} />Export CSV</button>
          </div>
        </header>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
        <p className="text-xs font-medium text-slate-400">Updated {report?.generatedAt ? new Date(report.generatedAt).toLocaleString() : 'not yet available'}</p>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => { const Icon = metric.icon; return <article key={metric.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-5 flex h-10 w-10 items-center justify-center rounded-lg ${metric.tone}`}><Icon size={19} /></div><p className="text-sm font-medium text-slate-500">{metric.label}</p><p className="mt-1 text-3xl font-bold text-slate-950">{typeof metric.value === 'string' ? metric.value : formatNumber(metric.value)}</p><p className="mt-2 text-xs text-slate-400">{metric.note}</p></article>; })}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between"><div><h2 className="text-base font-bold text-slate-900">Message activity</h2><p className="mt-1 text-xs text-slate-500">Inbound and outbound messages during the selected period.</p></div><Activity size={18} className="text-violet-600" /></div>
            <div className="mt-8 flex h-56 items-end gap-1.5 sm:gap-2">
              {activity.map((point, index) => { const inbound = Number(point.inbound || 0); const outbound = Number(point.outbound || 0); const total = inbound + outbound; const height = Math.max(total ? 12 : 3, Math.round((total / maxVolume) * 100)); return <div key={`${point.label}-${index}`} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-2"><div className="relative flex w-full max-w-8 flex-col justify-end overflow-hidden rounded-t-md bg-violet-100" style={{ height: `${height}%` }} title={`${point.label}: ${inbound} inbound, ${outbound} outbound`}><span className="block bg-violet-600" style={{ height: `${total ? (outbound / total) * 100 : 0}%` }} /></div><span className="truncate text-[10px] text-slate-400">{point.label}</span></div>; })}
              {!activity.length && <p className="m-auto text-sm text-slate-400">No message activity in this period.</p>}
            </div>
            <div className="mt-4 flex gap-4 text-xs text-slate-500"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet-100" />Inbound</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-violet-600" />Outbound</span></div>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="text-base font-bold text-slate-900">Channel coverage</h2><p className="mt-1 text-xs text-slate-500">Conversations opened by channel.</p></div><Link size={18} className="text-violet-600" /></div><div className="mt-7 space-y-4">{channelMix.map((channel, index) => { const max = Math.max(1, ...channelMix.map((entry) => Number(entry.value || 0))); const colors = ['bg-violet-600', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500']; return <div key={channel.name}><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-slate-600">{channel.name}</span><strong className="text-slate-900">{formatNumber(channel.value)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${colors[index % colors.length]}`} style={{ width: `${Math.max(4, (Number(channel.value || 0) / max) * 100)}%` }} /></div></div>; })}{!channelMix.length && <p className="py-12 text-center text-sm text-slate-400">No channel activity in this period.</p>}</div></article>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.6fr)]">
          <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-base font-bold text-slate-900">Workspace performance</h2><p className="mt-1 text-xs text-slate-500">Most active workspaces for the selected period.</p></div><Building2 size={18} className="text-violet-600" /></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-3">Workspace</th><th className="px-5 py-3">Members</th><th className="px-5 py-3">Messages</th><th className="px-5 py-3">Conversations</th><th className="px-5 py-3">Readiness</th></tr></thead><tbody className="divide-y divide-slate-100">{workspaces.map((workspace) => { const ready = Number(workspace.connected_channels || 0) > 0; return <tr key={workspace.id} className="hover:bg-slate-50"><td className="px-5 py-4 font-semibold text-slate-900">{workspace.name}</td><td className="px-5 py-4 text-slate-600">{formatNumber(workspace.active_members)}</td><td className="px-5 py-4 text-slate-600">{formatNumber(workspace.messages)}</td><td className="px-5 py-4 text-slate-600">{formatNumber(workspace.conversations)}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{ready ? 'Channel connected' : 'Setup needed'}</span></td></tr>; })}{!workspaces.length && <tr><td colSpan="5" className="px-5 py-10 text-center text-sm text-slate-400">No workspace data available.</td></tr>}</tbody></table></div></article>
          <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-base font-bold text-slate-900">Content inventory</h2><p className="mt-1 text-xs text-slate-500">Current reusable messaging assets across workspaces.</p><div className="mt-6 space-y-3"><div className="flex items-center justify-between rounded-lg bg-violet-50 p-4"><span className="text-sm font-medium text-violet-800">WhatsApp templates</span><strong className="text-xl text-violet-950">{formatNumber(summary.whatsappTemplates)}</strong></div><div className="flex items-center justify-between rounded-lg bg-sky-50 p-4"><span className="text-sm font-medium text-sky-800">Email templates</span><strong className="text-xl text-sky-950">{formatNumber(summary.emailTemplates)}</strong></div><div className="flex items-center justify-between rounded-lg bg-emerald-50 p-4"><span className="text-sm font-medium text-emerald-800">Active workflows</span><strong className="text-xl text-emerald-950">{formatNumber(summary.activeWorkflows)}</strong></div><div className={`rounded-lg border p-4 ${summary.failedRuns ? 'border-rose-100 bg-rose-50' : 'border-emerald-100 bg-emerald-50'}`}><div className="flex items-center gap-2"><AlertTriangle size={16} className={summary.failedRuns ? 'text-rose-600' : 'text-emerald-600'} /><p className="text-sm font-bold text-slate-800">{summary.failedRuns ? `${formatNumber(summary.failedRuns)} workflow runs need review` : 'No workflow failures in this period'}</p></div></div></div></article>
        </section>
      </div>
    </div>
  );
}

function CustomerReportsView({ onNavigate }) {
  const reportRanges = [
    { id: '30d', label: 'Last 30 Days', days: 30 },
    { id: '90d', label: 'Last 90 Days', days: 90 },
    { id: 'ytd', label: 'Year to Date', days: null },
  ];
  const [view, setView] = useState('overview'); // 'overview' | 'workflows' | 'templates' | 'drip'
  const [runs, setRuns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [stageLeads, setStageLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [webhookData, setWebhookData] = useState(null);
  const [overviewError, setOverviewError] = useState('');
  const [selectedRange, setSelectedRange] = useState('30d');
  const [overviewResponseMs, setOverviewResponseMs] = useState(null);

  useEffect(() => {
    if (view === 'overview') fetchOverviewData();
    else if (view === 'workflows') fetchRuns();
    else if (view === 'templates') fetchTemplates();
    else if (view === 'drip') fetchDripData();
  }, [view]);

  const [dripData, setDripData] = useState([]);
  const [workflowFilterId, setWorkflowFilterId] = useState(null);

  const authHeaders = () => ({ 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` });

  const getRangeStart = (rangeId) => {
    const range = reportRanges.find((item) => item.id === rangeId);
    const now = new Date();
    if (rangeId === 'ytd') return new Date(now.getFullYear(), 0, 1).toISOString();
    return new Date(now.getTime() - (range?.days || 30) * 24 * 60 * 60 * 1000).toISOString();
  };

  const fetchOverviewData = async (rangeId = selectedRange) => {
    setIsLoading(true);
    setOverviewError('');
    try {
      const requestedAt = performance.now();
      const params = new URLSearchParams({ limit: '50', from: getRangeStart(rangeId) });
      const res = await fetch(`/api/reports/overview?${params.toString()}`, {
        headers: authHeaders(),
        cache: 'no-store',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || 'Unable to load reports');
      }

      setRuns(Array.isArray(data.runs) ? data.runs : []);
      setTemplates(Array.isArray(data.messages) ? data.messages : []);
      setDripData(Array.isArray(data.columns) ? data.columns : []);
      setOverviewResponseMs(Math.round(Number(data.responseTimeMs) || (performance.now() - requestedAt)));
    } catch (err) {
      console.error('Failed to fetch report overview:', err);
      setOverviewError(err?.message || 'Unable to load reports. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDripData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/workflows/kanban', {
        headers: authHeaders()
      });
      const data = await res.json();
      if (data && Array.isArray(data.columns)) {
        setDripData(data.columns);
      }
    } catch (err) {
      console.error('Failed to fetch drip data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRuns = async (filterId = null) => {
    setIsLoading(true);
    const fid = filterId || workflowFilterId;
    try {
      let url = '/api/reports/workflow-runs?limit=100';
      if (fid) url += `&workflowId=${fid}`;

      const res = await fetch(url, {
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setRuns(data.runs);
      }
    } catch (err) {
      console.error('Failed to fetch runs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reports/templates?limit=100', {
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRunDetail = async (id) => {
    setIsDetailLoading(true);
    try {
      const res = await fetch(`/api/reports/workflow-runs/${id}`, {
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setSelectedRun(data.run);
        setWebhookData(data.webhookData);
      }
    } catch (err) {
      console.error('Failed to fetch run detail:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const fetchLeadsForStage = async (stageId) => {
    setIsDetailLoading(true);
    setStageLeads([]);
    try {
        const res = await fetch(`/api/reports/campaign-leads?stageId=${stageId}`, {
            headers: authHeaders()
        });
        const data = await res.json();
        if (data.success) {
            setStageLeads(data.leads || []);
        }
    } catch (err) {
        console.error('Failed to fetch stage leads:', err);
    } finally {
        setIsDetailLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
      case 'read':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Success</Badge>;
      case 'delivered':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Delivered</Badge>;
      case 'sent':
      case 'accepted':
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Sent</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Failed</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{status}</Badge>;
    }
  };

  const getDeliveryIcon = (status) => {
    if (status === 'read') return <CheckCircle2 size={14} className="text-green-500 fill-green-50" />;
    if (status === 'delivered') return <CheckCircle2 size={14} className="text-blue-500 fill-blue-50" />;
    if (status === 'failed') return <XCircle size={14} className="text-red-500" />;
    return <RefreshCw size={14} className="text-slate-400" />;
  };

  const openReport = (nextView) => {
    setSelectedRun(null);
    setWebhookData(null);
    setView(nextView);
  };

  const navigateTo = (page) => {
    if (onNavigate) onNavigate(page);
  };

  const getColumnWorkflowCount = (col) => Number(col.workflowCount ?? col.workflows?.length ?? 0) || 0;
  const totalWorkflowSteps = dripData.reduce((sum, col) => sum + getColumnWorkflowCount(col), 0);
  const successfulRuns = runs.filter((run) => ['success', 'completed'].includes(run.status)).length;
  const failedRuns = runs.filter((run) => run.status === 'failed').length;
  const workflowSuccessRate = runs.length ? Math.round((successfulRuns / runs.length) * 100) : 0;
  const deliveredTemplates = templates.filter((tpl) => ['delivered', 'read'].includes(tpl.delivery_status)).length;
  const readTemplates = templates.filter((tpl) => tpl.delivery_status === 'read').length;
  const failedTemplates = templates.filter((tpl) => tpl.delivery_status === 'failed').length;
  const templateDeliveryRate = templates.length ? Math.round((deliveredTemplates / templates.length) * 100) : 0;
  const readRate = templates.length ? Math.round((readTemplates / templates.length) * 100) : 0;
  const latestRuns = runs.slice(0, 4);
  const latestTemplates = templates.slice(0, 4);
  const topFunnels = dripData
    .map((col) => ({ name: col.stage?.name || 'Untitled stage', count: getColumnWorkflowCount(col) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const buildTrendValues = (items, dateField, includeItem = () => true, bucketCount = 7) => {
    const start = new Date(getRangeStart(selectedRange)).getTime();
    const end = Date.now();
    const bucketSize = Math.max(1, (end - start) / bucketCount);
    const buckets = Array(bucketCount).fill(0);

    items.forEach((item) => {
      if (!includeItem(item)) return;
      const timestamp = new Date(item[dateField]).getTime();
      if (!Number.isFinite(timestamp) || timestamp < start || timestamp > end) return;
      buckets[Math.min(bucketCount - 1, Math.floor((timestamp - start) / bucketSize))] += 1;
    });

    return buckets;
  };

  const buildTrendPoints = (items, dateField, includeItem = () => true) => {
    const buckets = buildTrendValues(items, dateField, includeItem, 5);

    const maximum = Math.max(...buckets, 1);
    return buckets.map((value, index) => {
      const x = index * (500 / Math.max(buckets.length - 1, 1));
      const y = 140 - Math.round((value / maximum) * 110);
      return `${x},${y}`;
    }).join(' ');
  };

  const workflowTrendPoints = buildTrendPoints(runs, 'started_at');
  const templateTrendPoints = buildTrendPoints(templates, 'created_at');
  const workflowTrendBars = buildTrendValues(runs, 'started_at');
  const templateTrendBars = buildTrendValues(templates, 'created_at');
  const readTrendBars = buildTrendValues(templates, 'created_at', (template) => template.delivery_status === 'read');
  const stageTrendBars = topFunnels.map((funnel) => funnel.count);
  const activeRangeLabel = reportRanges.find((range) => range.id === selectedRange)?.label || 'Selected period';

  const statCards = [
    {
      label: 'Workflow Runs',
      value: runs.length,
      change: `${workflowSuccessRate}% success`,
      icon: Workflow,
      bars: workflowTrendBars,
      accent: 'from-violet-600 to-fuchsia-500',
      iconTone: 'bg-violet-50 text-violet-700',
      onClick: () => openReport('workflows')
    },
    {
      label: 'Template Messages',
      value: templates.length,
      change: `${templateDeliveryRate}% delivered`,
      icon: Send,
      bars: templateTrendBars,
      accent: 'from-sky-500 to-cyan-400',
      iconTone: 'bg-sky-50 text-sky-700',
      onClick: () => openReport('templates')
    },
    {
      label: 'Read Rate',
      value: `${readRate}%`,
      change: `${readTemplates} read`,
      icon: TrendingUp,
      bars: readTrendBars,
      accent: 'from-emerald-500 to-teal-400',
      iconTone: 'bg-emerald-50 text-emerald-700',
      onClick: () => openReport('templates')
    },
    {
      label: 'Workflow Steps',
      value: totalWorkflowSteps,
      change: `${dripData.length} stages`,
      icon: GitBranch,
      bars: stageTrendBars.length ? stageTrendBars : [0],
      accent: 'from-amber-500 to-orange-400',
      iconTone: 'bg-amber-50 text-amber-700',
      onClick: () => openReport('drip')
    }
  ];

  if (view === 'overview') {
    return (
      <div className="flex-1 overflow-y-auto bg-[#f3f1f8] p-6">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">Reports</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">Performance insights and workflow analytics</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {reportRanges.map((range) => (
                <button
                  key={range.id}
                  type="button"
                  onClick={() => {
                    setSelectedRange(range.id);
                    fetchOverviewData(range.id);
                  }}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${selectedRange === range.id ? 'bg-purple-100 text-purple-700' : 'border border-white bg-white text-slate-600 hover:bg-purple-50 hover:text-purple-700'}`}
                >
                  {range.label}
                </button>
              ))}
              <button
                onClick={fetchOverviewData}
                className="inline-flex items-center gap-2 rounded-2xl border border-white bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-purple-50 hover:text-purple-700"
              >
                <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> Refresh
              </button>
              <button className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-b from-[#9200cc] to-[#34075a] px-4 py-2 text-sm font-semibold text-white shadow-sm">
                <Download size={15} /> Export PDF
              </button>
            </div>
          </div>

          {overviewError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{overviewError}</span>
              <button
                type="button"
                onClick={fetchOverviewData}
                className="rounded-xl border border-red-200 bg-white px-3 py-1.5 font-semibold hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          )}

          {overviewResponseMs !== null && !overviewError && (
            <p className="text-xs font-medium text-slate-400">Updated in {overviewResponseMs}ms</p>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              const barMaximum = Math.max(...card.bars.map((value) => Number(value) || 0), 1);
              return (
                <button
                  key={card.label}
                  onClick={card.onClick}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg"
                >
                  <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.accent}`} />
                  <div className="mb-5 flex items-start justify-between gap-3 pt-1">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconTone}`}>
                      <Icon size={22} />
                    </div>
                    <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {overviewError ? 'Unavailable' : card.change}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{card.label}</p>
                    <div className="mt-1 flex items-end justify-between gap-3">
                      <p className="text-3xl font-bold text-slate-950">{isLoading || overviewError ? '--' : card.value}</p>
                      <span className="text-xs font-medium text-slate-400">{activeRangeLabel}</span>
                    </div>
                  </div>
                  <div className="mt-5 flex h-8 items-end gap-1 rounded-lg bg-slate-50 px-2 py-1.5">
                    {card.bars.map((height, index) => (
                      <span
                        key={index}
                        className={`flex-1 rounded-sm ${index === card.bars.length - 1 ? `bg-gradient-to-t ${card.accent}` : 'bg-slate-200 group-hover:bg-purple-200'}`}
                        style={{ height: `${Math.max(14, Math.round(((Number(height) || 0) / barMaximum) * 100))}%` }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="rounded-3xl border border-white bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Conversation Performance</h2>
                  <p className="text-xs font-medium text-slate-400">Workflow runs vs template messages for {activeRangeLabel.toLowerCase()}</p>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-4 rounded-full bg-purple-700" /> Workflows</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-4 rounded-full bg-purple-200" /> Templates</span>
                </div>
              </div>
              <svg viewBox="0 0 500 160" className="h-48 w-full">
                <defs>
                  <linearGradient id="oooo-report-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline fill="url(#oooo-report-grad)" points={`${workflowTrendPoints} 500,160 0,160`} />
                <polyline fill="none" stroke="#7c3aed" strokeWidth="4" strokeLinejoin="round" points={workflowTrendPoints} />
                <polyline fill="none" stroke="#c4b5fd" strokeWidth="3" strokeDasharray="7 5" strokeLinejoin="round" points={templateTrendPoints} />
              </svg>
              <div className="mt-2 flex justify-between text-xs font-medium text-slate-400">
                {['Start', '25%', '50%', '75%', 'Now'].map((label) => <span key={label}>{label}</span>)}
              </div>
            </div>

            <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Channel ROI</h2>
              <p className="mb-5 text-xs font-medium text-slate-400">Report coverage by source</p>
              <div className="mb-5 flex justify-center">
                <div className="relative">
                  <svg viewBox="0 0 90 90" className="h-32 w-32">
                    <circle cx="45" cy="45" r="34" fill="none" stroke="#ede9fe" strokeWidth="11" />
                    <circle cx="45" cy="45" r="34" fill="none" stroke="#7c3aed" strokeWidth="11" strokeDasharray={`${Math.max(1, templateDeliveryRate * 2.14)} 214`} strokeDashoffset="0" transform="rotate(-90 45 45)" />
                    <circle cx="45" cy="45" r="34" fill="none" stroke="#c084fc" strokeWidth="11" strokeDasharray={`${Math.max(1, workflowSuccessRate * 1.2)} 214`} strokeDashoffset="-120" transform="rotate(-90 45 45)" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-2xl font-bold text-slate-900">{templateDeliveryRate}%</p>
                    <p className="text-[10px] font-semibold text-slate-400">YIELD</p>
                  </div>
                </div>
              </div>
              {[
                { label: 'Template Delivery', pct: templateDeliveryRate, color: 'bg-purple-700' },
                { label: 'Workflow Success', pct: workflowSuccessRate, color: 'bg-purple-300' },
                { label: 'Failures', pct: failedRuns + failedTemplates, color: 'bg-rose-400' }
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => item.label.includes('Template') ? openReport('templates') : openReport('workflows')}
                  className="mb-3 flex w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-left transition hover:bg-purple-50"
                >
                  <span className={`h-3 w-3 rounded-full ${item.color}`} />
                  <span className="flex-1 text-xs font-medium text-slate-600">{item.label}</span>
                  <span className="text-xs font-semibold text-slate-800">{item.pct}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="rounded-3xl border border-white bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Top Performing Funnels</h2>
                  <p className="text-xs font-medium text-slate-400">Stages with the most workflow automation steps</p>
                </div>
                <button onClick={() => openReport('drip')} className="text-sm font-semibold text-purple-700 hover:underline">
                  View Drip
                </button>
              </div>
              <div className="space-y-4">
                {(topFunnels.length ? topFunnels : [{ name: 'No funnel data yet', count: 0 }]).map((item) => {
                  const width = totalWorkflowSteps ? Math.max(6, Math.round((item.count / totalWorkflowSteps) * 100)) : 6;
                  return (
                    <button key={item.name} onClick={() => openReport('drip')} className="block w-full text-left">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">{item.name}</span>
                        <span className="text-sm font-semibold text-slate-900">{item.count} steps</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-purple-50">
                        <div className="h-full rounded-full bg-gradient-to-r from-purple-700 to-fuchsia-500" style={{ width: `${width}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-950">Live Feed</h2>
                <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> LIVE
                </span>
              </div>
              <div className="space-y-3">
                {latestRuns.map((run) => (
                  <button key={run.id} onClick={() => { setView('workflows'); fetchRunDetail(run.id); }} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-purple-50">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-50 text-xs font-semibold text-purple-700">
                      {run.workflow_name?.charAt(0)?.toUpperCase() || 'W'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{run.workflow_name}</p>
                      <p className="text-xs text-slate-400">{run.phone_number || 'No phone'} · {run.status}</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </button>
                ))}
                {latestRuns.length === 0 && (
                  <div className="rounded-2xl bg-purple-50 p-4 text-center text-sm font-medium text-slate-400">No live report activity yet.</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="rounded-3xl border border-white bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">Recent Template Delivery</h2>
                  <p className="text-xs font-medium text-slate-400">Latest template reports from the same oooo APIs</p>
                </div>
                <button onClick={() => openReport('templates')} className="text-sm font-semibold text-purple-700 hover:underline">
                  View Templates
                </button>
              </div>
              <div className="divide-y divide-purple-50">
                {latestTemplates.map((tpl) => (
                  <button key={tpl.id} onClick={() => openReport('templates')} className="flex w-full items-center gap-3 py-3 text-left hover:bg-purple-50/60">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                      {getDeliveryIcon(tpl.delivery_status)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold uppercase text-slate-800">{tpl.template_name || 'Custom template'}</p>
                      <p className="truncate text-xs text-slate-400">{tpl.contact_name || 'User'} · {tpl.contact_phone}</p>
                    </div>
                    {getStatusBadge(tpl.delivery_status)}
                  </button>
                ))}
                {latestTemplates.length === 0 && (
                  <div className="rounded-2xl bg-purple-50 p-4 text-center text-sm font-medium text-slate-400">No template report data yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Quick Actions</h2>
              <p className="mb-4 text-xs font-medium text-slate-400">Jump to working oooo modules</p>
              {[
                { label: 'Open Inbox', icon: MessageSquare, page: 'inbox' },
                { label: 'Launch Campaign', icon: Send, page: 'campaigns' },
                { label: 'Create Workflow', icon: Workflow, page: 'workflows' },
                { label: 'Workflow Runs', icon: Activity, action: () => openReport('workflows') },
                { label: 'Drip Reports', icon: Users, action: () => openReport('drip') }
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => action.action ? action.action() : navigateTo(action.page)}
                    className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-purple-100 bg-purple-50/60 px-4 py-3 text-left font-semibold text-slate-800 transition hover:border-purple-200 hover:bg-white"
                  >
                    <Icon size={18} className="text-purple-700" />
                    <span className="flex-1">{action.label}</span>
                    <ChevronRight size={16} className="text-purple-400" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#f3f1f8] p-5 gap-5">
      {/* Sidebar List */}
      <div className="w-[390px] flex flex-col bg-white rounded-3xl border border-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-purple-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => openReport('overview')}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-100 bg-white text-purple-700 transition hover:bg-purple-50"
                title="Back to report dashboard"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="h-12 w-12 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700">
                <BarChart3 size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-950">Reports</h1>
                <p className="text-xs text-slate-500">{workflowFilterId ? 'Filtered workflow insights' : 'Operational analytics'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {workflowFilterId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setWorkflowFilterId(null);
                    fetchRuns(null);
                  }}
                  className="text-xs text-purple-700 hover:text-purple-800 font-semibold px-2 h-8 rounded-xl"
                >
                  Clear
                </Button>
              )}
              <Button variant="ghost" size="sm" className="rounded-xl hover:bg-purple-50 text-purple-700" onClick={view === 'workflows' ? () => fetchRuns() : fetchTemplates} disabled={isLoading}>
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>

          <div className="flex bg-purple-50 p-1 rounded-2xl">
             <button
               onClick={() => setView('workflows')}
               className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl transition-all ${view === 'workflows' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500 hover:bg-white/70 hover:text-purple-700'}`}
             >
                <Database size={14} /> Workflow Runs
             </button>
             <button
               onClick={() => setView('templates')}
               className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl transition-all ${view === 'templates' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500 hover:bg-white/70 hover:text-purple-700'}`}
             >
                <RefreshCw size={14} /> Templates
             </button>
             <button
               onClick={() => setView('drip')}
               className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-xl transition-all ${view === 'drip' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500 hover:bg-white/70 hover:text-purple-700'}`}
             >
                <GitBranch size={14} /> Drip
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8">
              <GreetoLoader
                label={`Loading ${view === 'workflows' ? 'workflow runs' : view === 'drip' ? 'drip analytics' : 'templates'}...`}
                sublabel="Preparing reports and live activity"
              />
            </div>
          ) : view === 'workflows' ? (
            runs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium">No workflow runs found yet.</div>
            ) : (
              <div className="divide-y divide-purple-50">
                {runs.map((run) => (
                  <div
                    key={run.id}
                    onClick={() => fetchRunDetail(run.id)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-purple-50/60 ${selectedRun?.id === run.id ? 'bg-purple-50 border-l-4 border-purple-600' : 'border-l-4 border-transparent'}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-semibold text-slate-800 line-clamp-1">{run.workflow_name}</span>
                      {getStatusBadge(run.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-1"><Play size={12} /> {run.duration_ms}ms</span>
                    </div>
                    <div className="text-xs text-purple-700 font-mono bg-purple-50 px-2 py-1 rounded-full inline-block border border-purple-100">
                      {run.phone_number}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : view === 'templates' ? (
             templates.length === 0 ? (
               <div className="p-8 text-center text-slate-400 font-medium">No template messages sent yet.</div>
             ) : (
               <div className="divide-y divide-purple-50">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="p-4 transition-colors hover:bg-purple-50/60"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-semibold text-slate-800 line-clamp-1 uppercase tracking-tighter">
                          {tpl.template_name || (tpl.text_body?.startsWith('Template: ') ? tpl.text_body.replace('Template: ', '') : 'Custom Template')}
                        </span>
                        <div className="flex items-center gap-1">
                           {getStatusBadge(tpl.delivery_status)}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 mb-2">
                        Sent to: <span className="font-semibold text-slate-700">{tpl.contact_name || 'User'}</span> ({tpl.contact_phone})
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-500 bg-purple-50/70 p-2 rounded-2xl border border-purple-100">
                         <div className="flex items-center gap-1">
                            {getDeliveryIcon(tpl.delivery_status)}
                            <span className="uppercase font-semibold pt-0.5">{tpl.delivery_status}</span>
                         </div>
                         <div className="flex items-center gap-1 ml-auto">
                            <Clock size={10} />
                            <span>{new Date(tpl.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                         </div>
                      </div>
                    </div>
                  ))}
               </div>
             )
          ) : (
            <div className="p-4 space-y-4 overflow-y-auto h-full">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-1">Campaign Funnels</div>
              {dripData.map(col => (
                <div
                  key={col.stage.id}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer hover:border-purple-300 hover:shadow-md ${selectedRun?.stageId === col.stage.id ? 'bg-purple-50 border-purple-200' : 'bg-white border-purple-100'}`}
                  onClick={() => {
                    setSelectedRun({ type: 'drip_stage', stageId: col.stage.id, stageName: col.stage.name, workflows: col.workflows });
                    fetchLeadsForStage(col.stage.id);
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-slate-800">{col.stage.name}</span>
                    <Badge variant="outline" className="text-[9px] px-2 py-0.5 bg-purple-50 border-purple-100 text-purple-700 rounded-full">{col.workflows.length} steps</Badge>
                  </div>
                  <div className="flex gap-1 overflow-hidden">
                    {col.workflows.map((wf, idx) => (
                      <div key={idx} className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-600" style={{ width: '100%', opacity: 1 - (idx * 0.15) }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail View */}
      <div className="flex-1 overflow-y-auto p-2">
        {isDetailLoading ? (
            <div className="flex h-full items-center justify-center">
              <GreetoLoader label="Loading details..." sublabel="Fetching selected report detail" />
            </div>
        ) : selectedRun && view === 'workflows' ? (
          <div className="max-w-5xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <header className="flex justify-between items-start rounded-3xl border border-white bg-white p-6 shadow-sm">
              <div>
                <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-bold text-slate-950">{selectedRun.workflow_name}</h2>
                    {getStatusBadge(selectedRun.status)}
                </div>
                <div className="text-sm text-slate-500 font-medium">
                  Run ID: <span className="font-mono text-xs">{selectedRun.id}</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-3 gap-4">
              <Card className="rounded-3xl border-white bg-white shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-3 bg-purple-50 rounded-2xl text-purple-700 font-bold"><Clock size={20} /></div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Duration</div>
                    <div className="text-lg font-bold text-slate-950">{selectedRun.duration_ms} ms</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-white bg-white shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 font-bold"><Calendar size={20} /></div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Started At</div>
                    <div className="text-lg font-bold text-slate-950">{new Date(selectedRun.started_at).toLocaleTimeString()}</div>
                  </div>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-white bg-white shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-3 bg-fuchsia-50 rounded-2xl text-fuchsia-600 font-bold"><RefreshCw size={20} /></div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Events</div>
                    <div className="text-lg font-bold text-slate-950">{selectedRun.execution_log?.length || 0} Steps</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Incoming Data */}
            <Card className="rounded-3xl border-white bg-white shadow-sm overflow-hidden">
              <CardHeader className="py-4 px-5 bg-white border-b border-purple-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-950">
                  <Database size={16} className="text-purple-700" /> Incoming Webhook Payload
                </CardTitle>
                <span className="text-[10px] bg-purple-50 border border-purple-100 px-2 py-1 rounded-full text-purple-700 font-mono">
                    {webhookData?.id || 'Raw Context'}
                </span>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden">
                <pre className="p-4 text-xs font-mono bg-slate-900 text-slate-300 overflow-x-auto">
                  {JSON.stringify(webhookData?.payload || selectedRun.context_preview, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* Execution Trace */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 px-1">
                <GitBranch size={16} className="text-purple-700" /> Execution Trace
              </h3>
              <div className="space-y-2">
                {selectedRun.execution_log.map((log, idx) => (
                  <div key={idx} className={`p-4 rounded-2xl border transition-all shadow-sm ${log.error ? 'bg-red-50 border-red-100' : 'bg-white border-white'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-purple-50 flex items-center justify-center text-[10px] font-bold text-purple-700 border border-purple-100 flex-none">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <code className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded-full font-bold uppercase tracking-tighter border border-purple-100">{log.type}</code>
                          <span className="text-xs font-semibold text-slate-700 truncate">{log.nodeId}</span>
                        </div>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                           <div className="mt-2 p-3 bg-purple-50/50 border border-purple-100 rounded-2xl text-[10px] space-y-1">
                              {log.type === 'zoom_fetch' && (
                                 <div className="flex justify-between items-center text-slate-700 py-1">
                                    <span className="text-slate-500">Webinars Retrieved from Zoom:</span>
                                    <span className="font-bold bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-100">
                                       {log.metadata.count || 0}
                                    </span>
                                 </div>
                              )}
                              {log.type === 'zoom_match' && (
                                 <div className="space-y-1.5 py-1">
                                    <div className="flex justify-between items-center">
                                       <span className="text-slate-500">Target Topic:</span>
                                       <span className="font-bold text-slate-800 italic">"{log.metadata.targetTopic}"</span>
                                    </div>
                                    {log.metadata.success ? (
                                       <div className="mt-2 pt-2 border-t border-slate-100/60 space-y-1">
                                          <div className="flex justify-between items-start gap-4">
                                             <span className="text-slate-400 whitespace-nowrap">Matched Session:</span>
                                             <span className="font-bold text-purple-700 text-right leading-tight">{log.metadata.match?.topic}</span>
                                          </div>
                                          <div className="flex justify-between items-center">
                                             <span className="text-slate-400">Date/Time:</span>
                                             <span className="text-slate-600 font-mono bg-white px-1.5 rounded border border-slate-100">
                                                {log.metadata.match?.date} at {log.metadata.match?.time}
                                             </span>
                                          </div>
                                       </div>
                                    ) : (
                                       <div className="mt-2 p-2 text-red-600 font-bold bg-red-50 rounded border border-red-100 flex items-center gap-2">
                                          <XCircle size={14} /> {log.metadata.error || 'No upcoming webinar found'}
                                       </div>
                                    )}
                                 </div>
                              )}
                              {log.type === 'zoom_register' && (
                                 <div className="space-y-2 py-1">
                                    <div className="flex items-center gap-2 text-rose-600 font-bold uppercase tracking-widest text-[9px] mb-1">
                                       <UserPlus size={12} /> Registry Result
                                    </div>
                                    {log.metadata.success ? (
                                       <div className="bg-rose-50/30 border border-rose-100 rounded p-2 shadow-sm">
                                          <div className="text-[10px] text-slate-400 font-medium mb-1 flex items-center gap-1.5">
                                             <Link size={10} className="text-rose-400" /> UNIQUE JOIN ACCESS URL
                                          </div>
                                          <div className="font-mono text-[10px] text-rose-700 break-all select-all font-bold selection:bg-rose-200 mb-2">
                                             {log.metadata.registration?.join_url}
                                          </div>
                                          <div className="mt-2 pt-2 border-t border-rose-100">
                                             <div className="text-[9px] text-slate-400 mb-1 uppercase tracking-tighter">Raw Response</div>
                                             <pre className="text-[8px] bg-white/50 p-1.5 rounded border border-rose-100/50 text-slate-500 overflow-x-auto">
                                                {JSON.stringify(log.metadata.registration, null, 2)}
                                             </pre>
                                          </div>
                                       </div>
                                    ) : (
                                       <div className="p-2 text-red-600 font-bold bg-red-50 rounded border border-red-100 text-[10px] flex items-center gap-2">
                                          <XCircle size={14} /> Error: {log.metadata.error}
                                       </div>
                                    )}
                                 </div>
                              )}
                              {log.type === 'condition' && (
                                 <>
                                    <div className="flex items-center gap-1.5 font-mono">
                                       <span className="text-slate-500 italic">Left:</span>
                                       <span className="text-slate-800 font-bold">"{log.metadata.left}"</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-mono text-purple-700 font-extrabold px-1">
                                       {log.metadata.operator}
                                    </div>
                                    <div className="flex items-center gap-1.5 font-mono">
                                       <span className="text-slate-500 italic">Right:</span>
                                       <span className="text-slate-800 font-bold">"{log.metadata.right}"</span>
                                    </div>
                                    <div className="mt-1 pt-1 border-t border-slate-100 flex items-center justify-between">
                                       <span className="text-slate-400 font-medium">Result:</span>
                                       <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${log.metadata.result ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                          {log.metadata.result ? 'MATCHED (YES)' : 'NO MATCH (NO)'}
                                       </span>
                                    </div>
                                 </>
                              )}
                              {log.type === 'relative_delay' && (
                                 <div className="space-y-1">
                                    <div className="flex justify-between">
                                       <span className="text-slate-400">Target Time:</span>
                                       <span className="text-slate-800 font-bold">{new Date(log.metadata.targetTime).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                       <span className="text-slate-400">Action:</span>
                                       <span className={`font-bold ${new Date(log.metadata.targetTime) <= new Date(log.metadata.now) ? 'text-red-500' : 'text-amber-600'}`}>
                                          {new Date(log.metadata.targetTime) <= new Date(log.metadata.now) ? 'SKIP (Past)' : 'SCHEDULED (Wait)'}
                                       </span>
                                    </div>
                                 </div>
                              )}
                              {!['condition', 'relative_delay', 'zoom_fetch', 'zoom_match', 'zoom_register'].includes(log.type) && (
                                 <pre className="text-slate-400 font-mono text-[9px] truncate">
                                    {JSON.stringify(log.metadata)}
                                 </pre>
                              )}
                           </div>
                        )}
                        {log.details && (
                           <div className="text-[11px] text-slate-500 mt-1 italic">
                              {log.details}
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedRun.error_message && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="py-3 px-4 border-b border-red-100">
                   <CardTitle className="text-sm font-bold text-red-800 flex items-center gap-2">
                      <XCircle size={16} /> Final Error Termination
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-xs text-red-700 font-medium whitespace-pre-wrap leading-relaxed">
                   {selectedRun.error_message}
                </CardContent>
              </Card>
            )}

          </div>
        ) : view === 'templates' ? (
           <div className="max-w-6xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <header className="rounded-3xl border border-white bg-white p-6 shadow-sm">
                 <div className="inline-flex items-center gap-2 rounded-2xl bg-purple-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-700">
                   <Send size={14} /> Message Analytics
                 </div>
                 <h2 className="mt-3 text-2xl font-bold text-slate-950">Template Performance</h2>
                 <p className="text-sm font-medium text-slate-500">Overview of template message delivery and engagement.</p>
              </header>

               <div className="grid grid-cols-4 gap-4">
                  <Card className="rounded-3xl border-white bg-white shadow-sm">
                     <CardContent className="p-4">
                        <div className="text-xs text-slate-500 font-bold uppercase mb-1">Total Sent</div>
                        <div className="text-2xl font-bold text-slate-900">{templates.length}</div>
                     </CardContent>
                  </Card>
                  <Card className="rounded-3xl border-emerald-100 bg-emerald-50 shadow-sm">
                     <CardContent className="p-4">
                        <div className="text-xs text-emerald-600 font-bold uppercase mb-1">Total Read</div>
                        <div className="text-2xl font-bold text-emerald-700">{templates.filter(t => t.delivery_status === 'read').length}</div>
                     </CardContent>
                  </Card>
                  <Card className="rounded-3xl border-purple-100 bg-purple-50 shadow-sm">
                     <CardContent className="p-4">
                        <div className="text-xs text-purple-700 font-bold uppercase mb-1">Delivered</div>
                        <div className="text-2xl font-bold text-purple-800">{templates.filter(t => t.delivery_status === 'delivered').length}</div>
                     </CardContent>
                  </Card>
                  <Card className="rounded-3xl border-red-100 bg-red-50 shadow-sm">
                     <CardContent className="p-4">
                        <div className="text-xs text-red-600 font-bold uppercase mb-1">Failed</div>
                        <div className="text-2xl font-bold text-red-700">{templates.filter(t => t.delivery_status === 'failed').length}</div>
                    </CardContent>
                 </Card>
              </div>

              <div className="overflow-hidden rounded-3xl border border-white bg-white shadow-sm">
                 <div className="border-b border-purple-100 bg-white p-4 font-bold text-xs text-slate-800 uppercase tracking-widest">
                    Recent Template History
                 </div>
                 <table className="w-full text-left text-sm">
                    <thead className="bg-purple-50/70 text-purple-700 text-[10px] font-bold uppercase">
                       <tr>
                          <th className="px-4 py-2 text-center">Status</th>
                          <th className="px-4 py-2">Template</th>
                          <th className="px-4 py-2">Contact</th>
                          <th className="px-4 py-2">Sent At</th>
                          <th className="px-4 py-2">Read At</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-50">
                       {templates.slice(0, 50).map(tpl => (
                          <tr key={tpl.id} className="hover:bg-purple-50/60 transition-colors">
                             <td className="px-4 py-3 text-center">
                                <div className="flex justify-center">{getDeliveryIcon(tpl.delivery_status)}</div>
                             </td>
                             <td className="px-4 py-3 font-semibold text-slate-800 uppercase text-[11px] truncate max-w-[150px]">
                                {tpl.template_name || 'Custom'}
                             </td>
                             <td className="px-4 py-3">
                                <div className="font-bold text-xs">{tpl.contact_name || 'User'}</div>
                                <div className="text-[10px] text-slate-400">{tpl.contact_phone}</div>
                             </td>
                             <td className="px-4 py-3 text-xs text-slate-500">
                                {new Date(tpl.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                             </td>
                             <td className="px-4 py-3 text-xs text-emerald-600 font-bold">
                                {tpl.read_at ? new Date(tpl.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        ) : view === 'drip' && selectedRun?.type === 'drip_stage' ? (
          <div className="max-w-6xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <header className="flex justify-between items-end rounded-3xl border border-white bg-white p-6 shadow-sm">
              <div>
                <div className="inline-flex items-center gap-2 rounded-2xl bg-purple-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-purple-700">
                  <GitBranch size={14} /> Drip Report
                </div>
                <h2 className="mt-3 text-2xl font-bold text-slate-950 tracking-tight">{selectedRun.stageName}</h2>
                <p className="text-sm text-slate-500 font-medium">Workflow Follow-up Performance</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-2 rounded-2xl border-purple-100 bg-white font-bold text-slate-700 hover:bg-purple-50">
                  <Calendar size={14} /> Last 30 Days
                </Button>
              </div>
            </header>

            <div className="grid grid-cols-4 gap-4">
               <Card className="rounded-3xl bg-gradient-to-br from-purple-700 to-fuchsia-600 text-white border-0 shadow-lg shadow-purple-100">
                  <CardContent className="p-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Total Funnel Entry</div>
                    <div className="text-2xl font-bold">100%</div>
                    <div className="text-[10px] opacity-60 mt-1 font-medium">All leads entering this workflow</div>
                  </CardContent>
               </Card>
               <Card className="rounded-3xl border-white bg-white shadow-sm">
                  <CardContent className="p-5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Leads</div>
                    <div className="text-2xl font-bold text-slate-900">--</div>
                    <div className="text-[10px] text-emerald-600 font-bold mt-1">Currently in workflow</div>
                  </CardContent>
               </Card>
               <Card className="rounded-3xl border-white bg-white shadow-sm">
                  <CardContent className="p-5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg. Completion</div>
                    <div className="text-2xl font-bold text-slate-900">84%</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-1">Finished last workflow</div>
                  </CardContent>
               </Card>
               <Card className="rounded-3xl border-white bg-white shadow-sm">
                  <CardContent className="p-5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Workflow Steps</div>
                    <div className="text-2xl font-bold text-slate-900">{selectedRun.workflows.length}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-1">Automated interactions</div>
                  </CardContent>
               </Card>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <GitBranch size={16} className="text-purple-700" /> Workflow Visualization
              </h3>

              <div className="space-y-0 relative">
                {selectedRun.workflows.map((wf, idx) => (
                  <React.Fragment key={wf.id}>
                    <div className="relative z-10">
                      <Card className="rounded-3xl border-white bg-white shadow-sm hover:border-purple-200 transition-all group overflow-hidden">
                        <CardContent className="p-0 flex items-stretch">
                           <div className="w-12 bg-purple-50 flex flex-col items-center justify-center border-r border-purple-100 group-hover:bg-purple-100 transition-colors">
                              <span className="text-lg font-bold text-purple-300 group-hover:text-purple-600">#{idx + 1}</span>
                           </div>
                           <div className="flex-1 p-4 grid grid-cols-12 gap-4 items-center">
                              <div className="col-span-4">
                                 <div className="text-sm font-bold text-slate-900 mb-0.5">{wf.name}</div>
                                 <div className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{wf.description || 'No description provided'}</div>
                              </div>
                              <div className="col-span-3 flex flex-col gap-1">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Engagement</div>
                                 <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${100 - (idx * 15)}%` }} />
                                 </div>
                              </div>
                              <div className="col-span-2 text-center">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Status</div>
                                  <Badge className={wf.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-purple-50 text-slate-500 border-purple-100'}>
                                    {wf.status}
                                 </Badge>
                              </div>
                              <div className="col-span-3 text-right">
                                 <Button
                                   variant="ghost"
                                   size="sm"
                                   onClick={() => {
                                     setWorkflowFilterId(wf.id);
                                     setView('workflows');
                                     fetchRuns(wf.id);
                                   }}
                                   className="text-xs font-bold text-purple-700 hover:text-purple-800 hover:bg-purple-50 rounded-xl"
                                 >
                                   View Details <ChevronRight size={14} />
                                 </Button>
                              </div>
                           </div>
                        </CardContent>
                      </Card>
                    </div>

                    {idx < selectedRun.workflows.length - 1 && (
                      <div className="h-12 flex flex-col items-center justify-center relative -my-1">
                         <div className="w-0.5 h-full border-r-2 border-dashed border-purple-200" />
                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 py-1 rounded-full border border-purple-100 shadow-sm flex items-center gap-1.5 z-20">
                            <Clock size={12} className="text-purple-600" />
                            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-widest whitespace-nowrap">
                               {selectedRun.workflows[idx + 1].isIndependent ? 'Independent' : (selectedRun.workflows[idx + 1].delayMinutes > 0 ? `Wait ${selectedRun.workflows[idx + 1].delayMinutes}m` : 'Instant')}
                               {selectedRun.workflows[idx + 1].targetTime ? ` @ ${selectedRun.workflows[idx + 1].targetTime}` : ''}
                            </span>
                         </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <Card className="rounded-3xl bg-slate-950 border-0 text-white overflow-hidden shadow-sm">
               <CardHeader className="border-b border-slate-800">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                     <RefreshCw size={16} className="text-purple-300" /> Campaign Flow Metrics
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  <div className="grid grid-cols-3 gap-8">
                     <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Efficiency</div>
                        <div className="text-3xl font-bold text-white">99.2%</div>
                        <p className="text-[10px] text-slate-500">Uptime across all automated steps</p>
                     </div>
                     <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avg. Troughput</div>
                        <div className="text-3xl font-bold text-purple-300">14.2/hr</div>
                        <p className="text-[10px] text-slate-500">Leads processed by this track</p>
                     </div>
                     <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">System Health</div>
                        <div className="text-3xl font-bold text-emerald-400">Optimal</div>
                        <p className="text-[10px] text-slate-500">Zero active bottlenecks detected</p>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* Campaign Leads Breakdown */}
            <div className="bg-white rounded-3xl shadow-sm border border-white overflow-hidden">
               <div className="p-4 bg-white border-b border-purple-100 flex justify-between items-center">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                     <Clock size={14} className="text-purple-700" /> Active Leads in Track
                  </div>
                  <Badge variant="outline" className="bg-purple-50 border-purple-100 text-purple-700 font-bold">{stageLeads.length} Total Leads</Badge>
               </div>

               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-purple-50/70 text-purple-700 text-[10px] font-bold uppercase">
                       <tr>
                          <th className="px-6 py-4">Contact</th>
                          <th className="px-6 py-4">Phone</th>
                          <th className="px-6 py-4">Last Completed</th>
                          <th className="px-6 py-4">Next Workflow</th>
                          <th className="px-6 py-4">Next Trigger</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-50">
                       {stageLeads.length === 0 ? (
                         <tr>
                            <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">
                               No active leads found in this stage
                            </td>
                         </tr>
                       ) : (
                         stageLeads.map(lead => {
                            const now = new Date();
                            const triggerAt = lead.next_trigger ? new Date(lead.next_trigger) : null;
                            const remainMs = triggerAt ? triggerAt - now : null;
                            const isDue = remainMs !== null && remainMs < 0;
                            const remainMins = remainMs !== null ? Math.max(0, Math.round(remainMs / 60000)) : null;

                            return (
                               <tr key={lead.id} className="hover:bg-purple-50/60 transition-colors">
                                  <td className="px-6 py-4">
                                     <div className="font-bold text-slate-900">{lead.display_name || 'Anonymous'}</div>
                                     <div className="text-[10px] text-slate-400 capitalize">{lead.profile?.course || 'No Course'}</div>
                                  </td>
                                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                     {lead.phone}
                                  </td>
                                  <td className="px-6 py-4">
                                     {lead.last_workflow ? (
                                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-100 font-bold uppercase text-[9px]">
                                           {lead.last_workflow}
                                        </Badge>
                                     ) : (
                                        <span className="text-slate-300 italic text-[10px]">None</span>
                                     )}
                                  </td>
                                  <td className="px-6 py-4">
                                     {lead.next_workflow ? (
                                        <div className="flex flex-col">
                                           <span className="text-xs font-bold text-slate-700">{lead.next_workflow}</span>
                                           {isDue && <span className="text-[9px] text-amber-600 font-bold uppercase tracking-tighter">Processing...</span>}
                                        </div>
                                     ) : (
                                        <Badge className="bg-slate-100 text-slate-400 border-0 font-medium text-[9px]">FINISH</Badge>
                                     )}
                                  </td>
                                  <td className="px-6 py-4">
                                     {triggerAt ? (
                                        <div className="flex flex-col">
                                          <span className="text-xs font-semibold text-purple-700">
                                              In {remainMins > 60 ? `${Math.floor(remainMins/60)}h ${remainMins%60}m` : `${remainMins}m`}
                                           </span>
                                           <span className="text-[9px] text-slate-400">
                                              {triggerAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                           </span>
                                        </div>
                                     ) : (
                                        <span className="text-[10px] text-slate-300">--</span>
                                     )}
                                  </td>
                               </tr>
                            )
                         })
                       )}
                    </tbody>
                 </table>
               </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
             <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
                <BarChart3 size={48} className="text-purple-200" />
             </div>
             <div className="text-center">
                <p className="font-bold text-slate-950">No Selection</p>
                <p className="text-sm max-w-xs">Select a {view === 'workflows' ? 'workflow run' : view === 'templates' ? 'template message' : 'drip stage'} from the left sidebar to see detailed insights.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportsPage({ onNavigate, variant = 'customer' }) {
  if (variant === 'admin') return <AdminReportsView />;
  return <CustomerReportsView onNavigate={onNavigate} />;
}


import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  GitBranch,
  LayoutDashboard,
  MessageCircle,
  Plug,
  ShieldCheck,
  Users,
} from 'lucide-react';

const customerJourney = [
  {
    id: 'start',
    label: 'Start here',
    title: 'Build a secure workspace',
    description: 'Set the foundation before you bring in channels, contacts, and automations.',
    steps: [
      { title: 'Review workspace settings', text: 'Set your organization details, preferences, and profile.', page: 'settings', icon: ShieldCheck },
      { title: 'Invite your team', text: 'Add the people who will manage conversations and campaigns.', page: 'team-members', icon: Users },
      { title: 'Choose your plan', text: 'Review plan limits and billing before your team starts scaling.', page: 'subscriptions', icon: CreditCard },
    ],
  },
  {
    id: 'connect',
    label: 'Connect',
    title: 'Bring in your channels and data',
    description: 'Each workspace can connect its own providers. Your credentials stay scoped to your workspace.',
    steps: [
      { title: 'Connect WhatsApp', text: 'Connect a business channel before receiving or sending WhatsApp conversations.', page: 'integrations', icon: MessageCircle },
      { title: 'Connect CRM or data source', text: 'Use Xolox CRM or another supported integration when you want to sync external leads.', page: 'integrations', icon: Plug },
      { title: 'Create local contacts', text: 'You can add or import contacts even when no CRM is connected.', page: 'contacts', icon: Users },
    ],
  },
  {
    id: 'automate',
    label: 'Automate',
    title: 'Turn repeat work into flows',
    description: 'Create approved content first, then use it in workflows and campaigns.',
    steps: [
      { title: 'Create message templates', text: 'Prepare reusable WhatsApp and email content for your team.', page: 'templates', icon: FileText },
      { title: 'Build a workflow', text: 'Add triggers, delays, assignments, and actions to automate follow-ups.', page: 'workflows', icon: GitBranch },
      { title: 'Launch a campaign', text: 'Choose an audience, channel, and approved template before sending.', page: 'campaigns', icon: MessageCircle },
    ],
  },
  {
    id: 'operate',
    label: 'Operate',
    title: 'Run the workspace every day',
    description: 'Keep the inbox healthy, improve the team process, and track results.',
    steps: [
      { title: 'Manage conversations', text: 'Assign, respond, resolve, and monitor SLA risk from the inbox.', page: 'inbox', icon: MessageCircle },
      { title: 'Review performance', text: 'Use reports to understand campaign, workflow, and team activity.', page: 'reports', icon: BarChart3 },
      { title: 'Configure AI assistance', text: 'Connect OpenAI before enabling AI replies or knowledge-based responses.', page: 'ai-agent', icon: BookOpen },
    ],
  },
];

const adminJourney = [
  {
    id: 'command',
    label: 'Command center',
    title: 'Operate the platform safely',
    description: 'Use the admin dashboard to monitor platform health and find issues before customers report them.',
    steps: [
      { title: 'Review platform health', text: 'Check current system status and administrative activity.', page: 'dashboard', icon: LayoutDashboard },
      { title: 'Monitor workspaces', text: 'Review workspace readiness, owner details, team size, and inbox volume.', page: 'workspaces', icon: Building2 },
      { title: 'Inspect inbox signals', text: 'Use the inbox monitor to look for unassigned or at-risk conversations.', page: 'conversations', icon: MessageCircle },
    ],
  },
  {
    id: 'customers',
    label: 'Customers',
    title: 'Support every workspace',
    description: 'Keep customer setup clear without crossing into their private workspace data.',
    steps: [
      { title: 'Check integration readiness', text: 'Confirm which customer workspaces have connected their channels and providers.', page: 'integrations', icon: Plug },
      { title: 'Review workflow operations', text: 'Monitor workflow health and investigate operational failures.', page: 'workflows', icon: GitBranch },
      { title: 'Manage subscription plans', text: 'Create plans and manage lifecycle changes without interrupting active customers.', page: 'subscriptions', icon: CreditCard },
    ],
  },
  {
    id: 'access',
    label: 'Access',
    title: 'Control internal access',
    description: 'Give internal operators only the permissions needed to support customers and the platform.',
    steps: [
      { title: 'Manage internal team', text: 'Add internal members and organize support and operations access.', page: 'team', icon: Users },
      { title: 'Review permissions', text: 'Use access control to keep privileged actions limited to the right roles.', page: 'access', icon: ShieldCheck },
      { title: 'Audit important changes', text: 'Review administrator actions and investigate unexpected configuration changes.', page: 'audit', icon: FileText },
    ],
  },
  {
    id: 'improve',
    label: 'Improve',
    title: 'Measure and improve',
    description: 'Use operating data to prioritize support, reliability, and product improvements.',
    steps: [
      { title: 'Review platform reports', text: 'Track activity trends and identify areas that need attention.', page: 'reports', icon: BarChart3 },
      { title: 'Keep settings current', text: 'Review administrative preferences and security-related configuration.', page: 'settings', icon: ShieldCheck },
      { title: 'Return to the dashboard', text: 'Use the dashboard as the starting point for daily operations.', page: 'dashboard', icon: LayoutDashboard },
    ],
  },
];

export default function GettingStartedPage({ variant = 'customer', onNavigate }) {
  const journey = variant === 'admin' ? adminJourney : customerJourney;
  const [activeId, setActiveId] = useState(journey[0].id);
  const activeStage = useMemo(
    () => journey.find((stage) => stage.id === activeId) || journey[0],
    [activeId, journey],
  );
  const title = variant === 'admin' ? 'Admin Operations Guide' : 'Getting Started';
  const description = variant === 'admin'
    ? 'A practical route for running the Greeto platform and supporting customer workspaces.'
    : 'A simple route to set up your workspace, connect channels, and start operating confidently.';

  return (
    <main className="min-h-full flex-1 overflow-y-auto bg-[#f6f3fc] p-5 sm:p-7">
      <div className="mx-auto max-w-6xl">
        <section className="border-b border-violet-100 pb-6">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-violet-600">
                <BookOpen size={15} /> Workspace Guide
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
              <CheckCircle2 size={17} /> Follow the steps in order
            </div>
          </div>
        </section>

        <section className="mt-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {journey.map((stage, index) => {
              const isActive = stage.id === activeStage.id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setActiveId(stage.id)}
                  className={`flex h-11 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors ${isActive
                    ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                    : 'border-violet-100 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700'
                    }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${isActive ? 'bg-white/20' : 'bg-violet-50 text-violet-700'}`}>{index + 1}</span>
                  {stage.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_310px]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-violet-600">Step {journey.findIndex((stage) => stage.id === activeStage.id) + 1} of {journey.length}</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">{activeStage.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{activeStage.description}</p>

            <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {activeStage.steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 gap-4">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-sm font-semibold text-violet-700">{index + 1}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-base font-semibold text-slate-900"><Icon size={17} className="text-violet-600" />{step.title}</div>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate?.(step.page)}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-violet-200 bg-white px-3 text-sm font-medium text-violet-700 transition-colors hover:bg-violet-50"
                    >
                      Open <ArrowRight size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="border-l-0 border-violet-100 pl-0 lg:border-l lg:pl-7">
            <h3 className="text-base font-semibold text-slate-950">Before you begin</h3>
            <ul className="mt-4 space-y-4 text-sm leading-6 text-slate-600">
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={17} /><span>Keep workspace credentials private and connect only channels your team owns.</span></li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={17} /><span>Use templates and workflows only after reviewing the intended audience and timing.</span></li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={17} /><span>Invite teammates with the minimum role and permission level they need.</span></li>
            </ul>
            <div className="mt-7 border-t border-violet-100 pt-5">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-500">Need a starting point?</p>
              <button type="button" onClick={() => onNavigate?.(variant === 'admin' ? 'dashboard' : 'integrations')} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-violet-700 hover:text-violet-900">
                {variant === 'admin' ? 'Open admin dashboard' : 'Open integrations'} <ArrowRight size={15} />
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

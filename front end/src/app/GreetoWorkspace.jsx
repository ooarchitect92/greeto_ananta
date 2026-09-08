'use strict';
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import WorkspaceSidebar from './layouts/WorkspaceSidebar.jsx';
import { features, studioPageIds, getFeature, canAccessPage, scopeFromUser } from './navigation/registry.js';
import { canonicalPage } from './navigation/policy.js';
import { StatePage } from '../shared/ui/PageLayout.jsx';
import { clearScopedDrafts } from '../shared/state/drafts.js';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
const FeatureStudioPage = lazy(() => import('../features/studio/FeatureStudioPage.jsx'));
const ImplementationCenter = lazy(() => import('../features/implementation/ImplementationCenter.jsx'));
import { cn } from '../lib/utils.js';
import { getSlaState } from '../lib/sla.js';

/* ─── Splash / Preloader ────────────────────────────────────────────── */
function Preloader({ onDone }) {
  // phase: 'enter' → 'shake' → 'logo' → 'out'
  const [phase, setPhase] = useState('enter');
  const doneRef = useRef(false);

  useEffect(() => {
    // favicon enters (0–600ms), then shakes (600–1700ms)
    const t1 = setTimeout(() => setPhase('shake'), 600);
    // logo fades in at 1700ms
    const t2 = setTimeout(() => setPhase('logo'),  1700);
    // overlay fades out at 2700ms, done at 3100ms
    const t3 = setTimeout(() => setPhase('out'),   2700);
    const t4 = setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; onDone(); }
    }, 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onDone]);

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 99999,
    background: '#080810',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.45s ease',
    opacity: phase === 'out' ? 0 : 1,
    pointerEvents: phase === 'out' ? 'none' : 'all',
  };

  return (
    <div style={overlayStyle}>
      {/* Subtle glow behind icon */}
      <div style={{
        position: 'absolute', width: 260, height: 260, borderRadius: '50%',
        background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,230,118,0.14) 0%, transparent 100%)',
        filter: 'blur(30px)',
        transition: 'opacity 0.5s',
        opacity: phase === 'logo' ? 0.6 : 0.4,
      }} />

      {/* Favicon — shows during enter + shake phases */}
      {phase !== 'logo' && (
        <img
          src="/favicon.png"
          alt="Greeto"
          style={{
            width: 80, height: 80,
            objectFit: 'contain',
            position: 'absolute',
            animation: phase === 'enter'
              ? 'favicon-enter 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards'
              : 'handshake 1.1s ease-in-out forwards',
          }}
        />
      )}

      {/* Logo — fades in replacing favicon */}
      {phase === 'logo' && (
        <img
          src="/logo.svg"
          alt="Greeto"
          style={{
            height: 44,
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)',
            opacity: 0.92,
            position: 'absolute',
            animation: 'logo-enter 0.65s cubic-bezier(0.34,1.2,0.64,1) forwards',
          }}
        />
      )}
    </div>
  );
}
import Inbox from '../features/inbox/Inbox.jsx';
import Chat from '../features/inbox/Chat.jsx';
import NotesPanel from '../features/inbox/NotesPanel.jsx';
import CustomerCard from '../features/inbox/CustomerCard.jsx';
import GreetoLoader from '../components/ui/GreetoLoader.jsx';
import { connectSocket } from '../services/realtime/socket.js';
import { getInbox, getInboxCounts, getMessages, claimConversation, reassignConversation, forceReassignConversation, releaseConversation, markAsRead, resolveConversation, deleteConversation, blockConversation, unblockConversation, pinConversation, updateWorkflow, getTeamUser, getTeamUsers, getLocalTeamUsers, getWorkspaceLoginPolicy, reassignExternalLead, getInstagramStatus, getTelegramSettings, getExotelSettings, getTwilioSettings, getEmailSettings, logout as logoutApi } from '../services/api/legacy.js';
import { LayoutDashboard, MessageSquare, MessageCircle, Users, UserPlus, Megaphone, Settings, LogOut, Search, Bell, BellOff, FileText, Folder, Workflow, Shield, ShieldCheck, ChevronsUpDown, Check, Zap, GitBranch, Instagram, ChevronDown, ChevronRight, Mail, Bot, Puzzle, Phone, BarChart3, TrendingUp, Layers, Tag, X, List, Image as ImageIcon, CreditCard, Activity, BookOpen, Copy } from 'lucide-react';
import { Button } from '../components/ui/Button.jsx';
import { ConfirmActionHost, confirmAction } from '../components/ui/confirmAction.jsx';
import { subscribeUserToPush, unsubscribeUserFromPush, checkPushSubscription } from '../services/notifications.js';
import { Badge } from '../components/ui/Badge.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Toaster } from '../components/ui/Toaster.jsx';
import QuickWorkflowBuilder from '../features/automation/QuickWorkflowBuilder.jsx';

const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage.jsx'));
const TeamPage = lazy(() => import('../features/workforce/TeamPage.jsx'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage.jsx'));
const TemplatesPage = lazy(() => import('../features/content/TemplatesPage.jsx'));
const FlowsPage = lazy(() => import('../features/whatsapp-flows/FlowsPage.jsx'));
const WorkflowsKanban = lazy(() => import('../features/automation/WorkflowsKanban.jsx'));
const WorkflowBuilder = lazy(() => import('../features/automation/WorkflowBuilder.jsx'));
const SequencesPage = lazy(() => import('../features/automation/SequencesPage.jsx'));
const RulesPage = lazy(() => import('../features/automation/RulesPage.jsx'));
const TeamMembersPage = lazy(() => import('../features/workforce/TeamMembersPage.jsx'));
const ContactsPage = lazy(() => import('../features/contacts/ContactsEntry.jsx'));
const LabelsPage = lazy(() => import('../features/crm/LabelsPage.jsx'));
const CampaignsPage = lazy(() => import('../features/campaigns/CampaignsPage.jsx'));
const EmailTemplatesPage = lazy(() => import('../features/content/EmailTemplatesPage.jsx'));
const LoginPage = lazy(() => import('../features/auth/LoginPage.jsx'));
const ResetPasswordPage = lazy(() => import('../features/auth/ResetPasswordPage.jsx'));
const SignupPage = lazy(() => import('../features/auth/SignupPage.jsx'));
const VerifyEmailPage = lazy(() => import('../features/auth/VerifyEmailPage.jsx'));
const InviteAcceptancePage = lazy(() => import('../features/auth/InviteAcceptancePage.jsx'));
const PrivacyPolicyPage = lazy(() => import('../features/marketing/PrivacyPolicyPage.jsx'));
const TermsPage = lazy(() => import('../features/marketing/TermsPage.jsx'));
const AdminPortal = lazy(() => import('../features/admin/AdminPortal.jsx'));
const InstagramPage = lazy(() => import('../features/channels/InstagramPage.jsx'));
const TelegramPage = lazy(() => import('../features/channels/TelegramPage.jsx'));
const GalleryPage = lazy(() => import('../features/media/GalleryPage.jsx'));
const LandingPage = lazy(() => import('../features/marketing/LandingPage.jsx'));
const AiAgentPage = lazy(() => import('../features/ai-agent/AiAgentPage.jsx'));
const CallsPage = lazy(() => import('../features/voice/CallsPage.jsx'));
const SmsPage = lazy(() => import('../features/channels/SmsPage.jsx'));
const EmailPage = lazy(() => import('../features/channels/EmailPage.jsx'));
const ReportsPage = lazy(() => import('../features/reports/ReportsPage.jsx'));
const LeadStagesPage = lazy(() => import('../features/crm/LeadStagesPage.jsx'));
const LeadStatusPage = lazy(() => import('../features/crm/LeadStatusPage.jsx'));
const OpportunitiesPage = lazy(() => import('../features/crm/OpportunitiesPage.jsx'));
const InternalChat = lazy(() => import('../features/inbox/InternalChat.jsx'));
const ProfilePage = lazy(() => import('../features/settings/ProfilePage.jsx'));
const SubscriptionsPage = lazy(() => import('../features/billing/SubscriptionsPage.jsx'));
const GettingStartedPage = lazy(() => import('../features/onboarding/GettingStartedPage.jsx'));

function PageBoundary({ children, label = 'Loading workspace' }) {
  return (
    <Suspense fallback={<GreetoLoader fullScreen label={label} sublabel="Loading only what you need..." />}>
      {children}
    </Suspense>
  );
}

function readStoredSession() {
  try {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const user = savedUser ? JSON.parse(savedUser) : null;

    if (!token || !user) {
      if (savedUser && !token) localStorage.removeItem('user');
      return { token: null, user: null };
    }

    return { token, user };
  } catch {
    localStorage.removeItem('user');
    return { token: null, user: null };
  }
}

// The full list of valid pages in the app
const validPages = [...features.map(feature => feature.id), 'create-template', 'payments'];


function AppContent() {
  // Only show preloader on public landing/login — skip if user is already logged in
  const [initialSession] = useState(readStoredSession);
  const [showPreloader, setShowPreloader] = useState(() => !initialSession.user);
  const [storedUser, setStoredUser] = useState(() => initialSession.user);
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(initialSession.user && initialSession.token));

  const currentUser = useMemo(() => {
    if (storedUser) {
      const rawTeamIds = storedUser.teamId
        ? [storedUser.teamId]
        : Array.isArray(storedUser.teamIds) && storedUser.teamIds.length > 0
          ? storedUser.teamIds
          : [];
          
      const activeTeamId = localStorage.getItem('activeTeamId');
      const resolvedTeamId = activeTeamId && rawTeamIds.includes(activeTeamId) ? activeTeamId : rawTeamIds[0];

      return {
        id: storedUser._id || storedUser.id,
        role: storedUser.role || 'agent',
        tenantId: storedUser.tenantId || storedUser.tenant_id || '',
        workspaceId: storedUser.workspaceId || storedUser.workspace_id || '',
        environment: storedUser.environment || '',
        teamIds: rawTeamIds,
        teamId: resolvedTeamId,
        name: `${storedUser.firstname || ''} ${storedUser.lastname || ''}`.trim() || storedUser.name || 'User'
      };
    }
    return null;
  }, [storedUser]);
  const approvedUrlRef = useRef(window.location.pathname + window.location.search);
  const [socket, setSocket] = useState(null);

  const [activePage, setActivePage] = useState(() => {
    const fullPath = window.location.pathname.substring(1);
    const path = fullPath.split('/')[0];

    // If we're not logged in and at root, we don't have an active app page yet
    if (!storedUser && !path) {
      return 'landing';
    }

    if (path && validPages.includes(path)) {
      return path === 'payments' ? 'subscriptions' : path;
    }
    if (path) return 'not-found';
    const saved = localStorage.getItem('activePage');
    return saved && validPages.includes(saved) ? (saved === 'payments' ? 'subscriptions' : saved) : 'inbox';
  });

  const [isLoginView, setIsLoginView] = useState(() => {
    return window.location.pathname === '/login' || window.location.pathname === '/customer/login';
  });
  const [isAdminLoginView, setIsAdminLoginView] = useState(() => {
    return window.location.pathname === '/admin/login';
  });
  const [isAdminMode, setIsAdminMode] = useState(() => {
    return window.location.pathname.startsWith('/admin') || storedUser?.accountType === 'admin';
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setStoredUser(null);
      setIsLoggedIn(false);
      setIsAdminMode(false);
      setIsLoginView(true);
      setIsAdminLoginView(false);
    };
    window.addEventListener('greeto:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('greeto:unauthorized', handleUnauthorized);
  }, []);

  const [isContactsMenuOpen, setIsContactsMenuOpen] = useState(() => {
    const fullPath = window.location.pathname.substring(1);
    const path = fullPath.split('/')[0];
    return path === 'contacts' || path === 'labels';
  });

  const [editingWorkflow, setEditingWorkflow] = useState(() => {
    try {
      const fullPath = window.location.pathname.substring(1);
      const pathParts = fullPath.split('/');
      const saved = localStorage.getItem('editingWorkflow');
      const parsedSaved = saved ? JSON.parse(saved) : null;

      if (pathParts[0] === 'workflows' && pathParts[1]) {
        if (parsedSaved && String(parsedSaved.id) === pathParts[1]) {
          return parsedSaved;
        }
        return { id: pathParts[1], name: pathParts[1], steps: { nodes: [], edges: [] } };
      }
      return parsedSaved;
    } catch (e) {
      return null;
    }
  });
  const [quickWorkflowStage, setQuickWorkflowStage] = useState(null);

  useEffect(() => {
    if (['/reset-password', '/signup', '/verify-email', '/accept-invite', '/privacy', '/terms'].includes(window.location.pathname)) return;
    if (!isLoggedIn) {
      if (isAdminLoginView) {
        if (window.location.pathname !== '/admin/login') window.history.pushState(null, '', '/admin/login');
        document.title = 'Greeto Admin Login';
      } else if (isLoginView) {
        const loginPath = window.location.pathname === '/customer/login' ? '/customer/login' : '/login';
        if (window.location.pathname !== loginPath) window.history.pushState(null, '', loginPath);
        document.title = 'greeto2.0';
      } else {
        if (window.location.pathname !== '/') window.history.pushState(null, '', '/');
        document.title = 'greeto2.0';
      }
      return;
    }

    if (isAdminMode) {
      if (!window.location.pathname.startsWith('/admin')) {
        window.history.pushState(null, '', '/admin/dashboard');
      }
      document.title = 'Admin Panel | greeto2.0';
      return;
    }

    localStorage.setItem('activePage', activePage);
    let path = `/${activePage === 'inbox' ? '' : activePage}`;
    if (activePage === 'workflows' && editingWorkflow) {
      // Always use the real UUID so initialWorkflow.id is always the DB id
      const identifier = editingWorkflow.id || 'new';
      path = `/workflows/${encodeURIComponent(identifier)}`;
    }
    if (activePage !== 'not-found' && window.location.pathname !== path && !(activePage === 'inbox' && window.location.pathname === '/inbox')) window.history.pushState(null, '', path);

    // Update browser tab title with SEO-friendly names
    const pageTitles = {
      inbox:           'Conversation — Manage Customer Conversations',
      dashboard:       'Dashboard — Analytics & Live Metrics',
      contacts:        'Contacts — Customer Directory',
      labels:          'Labels — Organize Conversations',
      campaigns:       'Campaigns — Broadcast & Marketing',
      templates:       'Message Templates — WhatsApp Templates',
      'email-templates':'Email Templates — Greeto',
      flows:           'Flows — WhatsApp Interactive Flows',
      workflows:       'Workflows — No-Code Automation Builder',
      sequences:       'Sequences — Drip Automation',
      rules:           'Automation Rules — Smart Triggers',
      'ai-agent':      'AI Agent — Intelligent Auto-Replies',
      'team-members':  'Team Members — Manage Your Team',
      settings:        'Settings — Workspace Configuration',
      integrations:    'Integrations — Connect Your Tools',
      instagram:       'Instagram — Social Inbox',
      telegram:        'Telegram — Bot Inbox',
      calls:           'Calls — Exotel VoIP',
      sms:             'SMS — Twilio Messaging',
      email:           'Email — IMAP/SMTP Inbox',
      gallery:         'File Manager — Media Assets',
      reports:         'Reports — Workflow Performance & Traces',
      subscriptions:   'Subscriptions — Plan & Billing',
      opportunities:   'Opportunities — Sales Pipeline',
      'lead-stages':   'Lead Stages — Pipeline Configuration',
      'lead-status':   'Lead Status — Status Management',
    };
    document.title = `${getFeature(activePage)?.label || pageTitles[activePage] || 'Page not found'} | Greeto`;
    approvedUrlRef.current = window.location.pathname + window.location.search;
  }, [activePage, editingWorkflow, isLoggedIn, isLoginView, isAdminLoginView, isAdminMode]);

  useEffect(() => {
    const handlePopState = (event) => {
      if (event.isTrusted && !window.dispatchEvent(new Event('greeto:before-navigate', {cancelable:true}))) {
        window.history.pushState(null, '', approvedUrlRef.current); return;
      }
      approvedUrlRef.current = window.location.pathname + window.location.search;
      const fullPath = window.location.pathname.substring(1);
      const pathParts = fullPath.split('/');
      const path = pathParts[0];

      if (!isLoggedIn) {
        setIsLoginView(window.location.pathname === '/login' || window.location.pathname === '/customer/login');
        setIsAdminLoginView(window.location.pathname === '/admin/login');
        return;
      }

      if (path === 'admin') {
        setIsAdminMode(true);
        return;
      }

      if (path && validPages.includes(path)) {
        setIsAdminMode(false);
        setActivePage(path === 'payments' ? 'subscriptions' : path);
      } else if (!path) {
        setIsAdminMode(false);
        setActivePage('inbox');
      } else {
        setIsAdminMode(false);
        setActivePage('not-found');
      }
      if (path === 'workflows') {
        if (pathParts[1]) {
          setEditingWorkflow((prev) => {
            // Very simple check just to avoid unnecessary re-renders
            if (prev) return prev;
            return { id: pathParts[1], name: pathParts[1], steps: { nodes: [], edges: [] } };
          });
        } else {
          setEditingWorkflow(null);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLoggedIn]);

  useEffect(() => {
    if (editingWorkflow) {
      localStorage.setItem('editingWorkflow', JSON.stringify(editingWorkflow));
    } else {
      localStorage.removeItem('editingWorkflow');
    }
  }, [editingWorkflow]);
  const [conversations, setConversations] = useState([]);
  const [hasMoreConversations, setHasMoreConversations] = useState(true);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [isInboxSearchOpen, setIsInboxSearchOpen] = useState(false);
  const [inboxSearchInput, setInboxSearchInput] = useState('');
  const [inboxSearch, setInboxSearch] = useState('');
  const CONVERSATIONS_PAGE_SIZE = 20;
  const [selectedId, setSelectedId] = useState(() => {
    try {
      return localStorage.getItem('selectedConversationId') || null;
    } catch (e) {
      return null;
    }
  });
  const selectedIdRef = React.useRef(selectedId);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [messagesLoadError, setMessagesLoadError] = useState('');
  const [leadDebugData, setLeadDebugData] = useState(null);
  const [assigneeName, setAssigneeName] = useState(null);
  const [showInternalChat, setShowInternalChat] = useState(false);
  const [internalChatUnread, setInternalChatUnread] = useState(0);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [targetAssigneeId, setTargetAssigneeId] = useState(null);
  const [inboxFilter, setInboxFilter] = useState('open');
  const [phoneNumberId, setPhoneNumberId] = useState(null);
  const [inboxDateFrom, setInboxDateFrom] = useState('');
  const [inboxDateTo, setInboxDateTo] = useState('');
  const [inboxAssigneeId, setInboxAssigneeId] = useState('');
  const [linkedPhones, setLinkedPhones] = useState([]);
  const [autoOpenWhatsAppConnect, setAutoOpenWhatsAppConnect] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const inboxQueryFilters = {
    dateFrom: inboxDateFrom || undefined,
    dateTo: inboxDateTo || undefined,
    assigneeId: inboxAssigneeId || undefined,
  };
  const selectedConversation = conversations.find((c) => c.id === selectedId);

  // Returns null when the value is blank or is just a raw phone number (e.g. "919699862919").
  // Used so we never display a phone number in place of a contact's name anywhere in the UI.
  const resolveContactName = (raw) => {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^[\+\s]*\d[\d\s\-]{6,}$/.test(trimmed)) return null;
    return trimmed;
  };

  const displayContactName = resolveContactName(selectedConversation?.contactName) || 'No Name';

  // Splits a raw WhatsApp wa_id (e.g. "919876543210", no "+") into a best-guess
  // country code and local number for display. Falls back to the full digits
  // as the "number" part when we can't confidently detect the country code.
  const COUNTRY_CODE_LENGTHS = [
    { code: '91', length: 10 },   // India
    { code: '1', length: 10 },    // US/Canada
    { code: '44', length: 10 },   // UK
    { code: '971', length: 9 },   // UAE
    { code: '65', length: 8 },    // Singapore
    { code: '61', length: 9 },    // Australia
    { code: '92', length: 10 },   // Pakistan
    { code: '880', length: 10 },  // Bangladesh
    { code: '94', length: 9 },    // Sri Lanka
  ];
  const formatPhoneParts = (raw) => {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return null;
    const match = COUNTRY_CODE_LENGTHS.find(
      ({ code, length }) => digits.startsWith(code) && digits.length === code.length + length
    );
    if (match) {
      return { countryCode: `+${match.code}`, number: digits.slice(match.code.length), full: `+${digits}` };
    }
    return { countryCode: '', number: digits, full: `+${digits}` };
  };
  const [copiedPhone, setCopiedPhone] = useState(false);
  const handleCopyPhone = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 1500);
    } catch (e) { /* clipboard unavailable */ }
  };

  // Called by CustomerCard after a successful name save — patches the in-memory
  // conversation list so the header and sidebar update immediately without a
  // full inbox reload.
  const handleContactNameUpdated = (conversationId, newName) => {
    if (!newName || !conversationId) return;
    setConversations(prev =>
      prev.map(c =>
        c.id === conversationId ? { ...c, contactName: newName, displayName: newName } : c
      )
    );
  };
  const isAssignedToMe = Boolean(selectedConversation?.assigneeId && selectedConversation.assigneeId === currentUser?.id);
  const isAssigned = Boolean(selectedConversation?.assigneeId);

  const [inboxCounts, setInboxCounts] = useState({ all: 0, unassigned: 0, assigned_to_me: 0, pinned: 0, resolved: 0, whatsapp: 0, telegram: 0, instagram: 0 });
  const [channelTypeFilter, setChannelTypeFilter] = useState('all');
  const [integrationStatus, setIntegrationStatus] = useState({ instagram: false, telegram: false, calls: false, sms: false, email: false });
  const [isSubscribedToPush, setIsSubscribedToPush] = useState(false);

  // Resizable Inbox list/profile panes + collapsible profile column.
  const [listPaneWidth, setListPaneWidth] = useState(320);
  const [profilePaneWidth, setProfilePaneWidth] = useState(320);
  const [draggingPane, setDraggingPane] = useState(null); // 'list' | 'profile' | null
  // Details stay out of the way until an agent explicitly opens them.
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [isHeaderProfileMenuOpen, setIsHeaderProfileMenuOpen] = useState(false);
  const conversationLayoutRef = React.useRef(null);

  const clampWidth = (value, min, max) => Math.min(max, Math.max(min, value));

  const startPaneDrag = (pane) => (e) => {
    e.preventDefault();
    setDraggingPane(pane);
  };

  useEffect(() => {
    if (!draggingPane) return;
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e) => {
      const bounds = conversationLayoutRef.current?.getBoundingClientRect();
      if (!bounds) return;
      if (draggingPane === 'list') {
        setListPaneWidth(clampWidth(e.clientX - bounds.left, 280, 480));
      } else {
        setProfilePaneWidth(clampWidth(bounds.right - e.clientX, 280, 440));
      }
    };
    const handleMouseUp = () => setDraggingPane(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingPane]);

  useEffect(() => {
    if (isLoggedIn) {
      checkPushSubscription().then(setIsSubscribedToPush);
    }
  }, [isLoggedIn]);

  const togglePushNotifications = async () => {
    const ok = await confirmAction({
      title: isSubscribedToPush ? 'Disable notifications?' : 'Enable notifications?',
      message: isSubscribedToPush
        ? 'You will stop receiving browser push notifications.'
        : 'You will receive browser push notifications for important updates.',
      confirmLabel: isSubscribedToPush ? 'Disable' : 'Enable',
      tone: 'toggle',
    });
    if (!ok) return;
    if (isSubscribedToPush) {
      const success = await unsubscribeUserFromPush();
      if (success) setIsSubscribedToPush(false);
    } else {
      const success = await subscribeUserToPush();
      if (success) setIsSubscribedToPush(true);
    }
  };

  useEffect(() => {
    if (!storedUser) return;
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        const res = await fetch('/api/settings/whatsapp', {
          headers: {
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });
        if (res.ok) {
          const data = await res.json();
          // Keep the UI's connected-channel state aligned with the backend:
          // disabled/disconnected WhatsApp settings do not make the inbox live.
          setLinkedPhones((data.allSettings || []).filter((setting) => setting.is_active !== false));
        }
      } catch (e) {
        console.error("Failed to fetch linked phones", e);
      }
    };
    fetchSettings();
  }, [storedUser]);

  useEffect(() => {
    const integrationStatusRoles = ['admin', 'super_admin', 'quality_manager', 'agent', 'supervisor', 'lead_manager', 'sales_manager', 'staff'];
    const teamId = currentUser?.teamId;
    if (!storedUser || !teamId || !integrationStatusRoles.includes((storedUser.role || '').toLowerCase())) return;
    (async () => {
      try {
        const [ig, tg, ext, twl, eml] = await Promise.all([
          getInstagramStatus().catch(() => null),
          getTelegramSettings(teamId).catch(() => null),
          getExotelSettings(teamId).catch(() => null),
          getTwilioSettings(teamId).catch(() => null),
          getEmailSettings(teamId).catch(() => null),
        ]);
        setIntegrationStatus({
          instagram: ig?.connected === true,
          telegram: Array.isArray(tg?.settings) ? tg.settings.length > 0 : Boolean(tg?.settings),
          calls: !!ext?.settings,
          sms: !!twl?.settings,
          email: !!eml?.settings?.email_address,
        });
      } catch (e) {
        console.error('Failed to fetch integration statuses', e);
      }
    })();
  }, [storedUser, currentUser?.teamId]);

  useEffect(() => {
    if (selectedId) {
      const conv = conversations.find(c => c.id === selectedId);
      setTargetAssigneeId(conv?.assigneeId || null);
    }
  }, [selectedId, conversations]);

  useEffect(() => {
    if (!storedUser) return;
    
    async function loadTeamMembers() {
      try {
        let data = [];
        let useXolox = false;

        try {
          const policy = await getWorkspaceLoginPolicy();
          useXolox = (policy?.data?.loginSource === 'xolox') || (policy?.loginSource === 'xolox');
        } catch {
          useXolox = false;
        }

        if (useXolox) {
          try {
            const res = await getTeamUsers();
            if (res && res.data && Array.isArray(res.data.data)) {
              data = res.data.data;
            } else if (res && Array.isArray(res.data)) {
              data = res.data;
            } else if (Array.isArray(res)) {
              data = res;
            } else {
              data = [];
            }
          } catch {
            const res = await getLocalTeamUsers();
            data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          }
        } else {
          const res = await getLocalTeamUsers();
          data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        }

        setTeamMembers(data);

        if (!useXolox) {
          const me = data.find(m => String(m.id) === String(storedUser.id) || String(m._id) === String(storedUser.id));
          if (me && me.role) {
            const roleMap = {
              'super_admin': 'super_admin',
              'admin': 'admin',
              'team_lead': 'supervisor',
              'agent': 'agent',
              'quality_manager': 'quality_manager'
            };
            const mappedRole = roleMap[me.role] || me.role || 'agent';
            if (mappedRole !== storedUser.role) {
              const updated = { ...storedUser, role: mappedRole };
              localStorage.setItem('user', JSON.stringify(updated));
              setStoredUser(updated);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch team members', err);
      }
    }

    loadTeamMembers();
  }, [storedUser, currentUser?.teamId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const setSelectedConversation = (id) => {
    setSelectedId(id);
    try {
      if (id) {
        localStorage.setItem('selectedConversationId', id);
      } else {
        localStorage.removeItem('selectedConversationId');
      }
    } catch (e) { }
  };



  const handleLogin = (user) => {
    setShowPreloader(false); // always kill preloader before entering app
    const nextUser = { ...user, accountType: 'customer' };
    localStorage.setItem('user', JSON.stringify(nextUser));
    setStoredUser(nextUser);
    setIsLoggedIn(true);
    setIsLoginView(false);
    setIsAdminLoginView(false);
    setIsAdminMode(false);
    setActivePage('dashboard');
    try {
      localStorage.setItem('activePage', 'dashboard');
    } catch (e) { }
  };

  const handleAdminLogin = (user) => {
    setShowPreloader(false);
    const nextUser = { ...user, accountType: 'admin' };
    localStorage.setItem('user', JSON.stringify(nextUser));
    setStoredUser(nextUser);
    setIsLoggedIn(true);
    setIsLoginView(false);
    setIsAdminLoginView(false);
    setIsAdminMode(true);
    window.history.pushState(null, '', '/admin/dashboard');
  };

  const handleLogout = async (target = isAdminMode ? 'admin' : 'customer') => {
    try { clearScopedDrafts(window.sessionStorage, scopeFromUser(currentUser)); } catch { /* No scoped drafts when session scope is incomplete. */ }
    // Logout must always work locally. The server endpoint is only a
    // best-effort acknowledgement and may be unavailable during an outage.
    logoutApi(target).catch((err) => {
      console.error('Logout API failed:', err);
    });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setStoredUser(null);
    setIsLoggedIn(false);
    setIsAdminMode(false);
    if (target === 'admin') {
      setIsAdminLoginView(true);
      setIsLoginView(false);
      window.location.href = '/admin/login';
    } else {
      setIsAdminLoginView(false);
      setIsLoginView(true);
      window.location.href = '/login';
    }
  };
  const getUserName = (user) => {
    if (!user) return 'Unknown Agent';
    if (user.firstname || user.lastname) {
      return `${user.firstname || ''} ${user.lastname || ''}`.trim();
    }
    return user.name || user.username || 'Unknown Agent';
  };

  const agents = useMemo(
    () => {
      if (!currentUser) return [];
      // Combine currentUser with any teamMembers not already in the list
      const list = [{ id: currentUser.id, name: currentUser.name, role: currentUser.role, initials: currentUser.name?.substring(0, 2).toUpperCase() || 'US' }];
      
      if (Array.isArray(teamMembers)) {
        teamMembers.forEach(m => {
          const mid = m.id || m._id;
          if (mid !== currentUser.id && !list.some(a => a.id === mid)) {
            list.push({ 
              id: mid, 
              name: getUserName(m), 
              role: m.role || 'agent', 
              initials: (getUserName(m) || 'A').substring(0, 2).toUpperCase() 
            });
          }
        });
      }
      return list;
    },
    [currentUser, teamMembers]
  );

  useEffect(() => {
    if (!currentUser?.id || !currentUser?.teamId) {
      setSocket(null);
      return;
    }
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    const s = connectSocket({ userId: currentUser.id, teamIds: currentUser.teamIds, activeTeamId: currentUser.teamId, token });
    // Real-time delivery previously failed completely silently on a bad
    // token or a blocked connection — no console output, no UI signal, just
    // "live updates don't work, refresh to see anything." These make that
    // diagnosable without needing to reproduce it against a live backend.
    s.on('connect', () => console.log('[socket] connected:', s.id));
    s.on('disconnect', (reason) => console.warn('[socket] disconnected:', reason));
    s.on('connect_error', (err) => console.error('[socket] connect_error:', err.message));
    setSocket(s);
    return () => {
      if (s) s.disconnect();
    };
  }, [currentUser]);

  const loadInboxCounts = async () => {
    if (!currentUser?.teamId) return;
    try {
      const res = await getInboxCounts(currentUser.teamId, phoneNumberId, inboxQueryFilters);
      setInboxCounts(res);
      if (res && typeof res.unread === 'number') {
        setTotalUnread(res.unread);
      }
    } catch (err) {
      console.error('Failed to load inbox counts:', err);
    }
  };

  const loadInbox = async () => {
    if (!currentUser?.teamId) return;
    try {
      const effectiveFilter = inboxSearch ? 'all' : inboxFilter;
      const res = await getInbox(currentUser.teamId, effectiveFilter, phoneNumberId, CONVERSATIONS_PAGE_SIZE, 0, inboxSearch, inboxQueryFilters);
      const currentId = selectedIdRef.current;
      const nextConversations = (res.conversations || []).map(c => {
        const base = c.id === currentId ? { ...c, unreadCount: 0 } : c;
        return base;
      });
      setConversations(nextConversations);
      setHasMoreConversations(!!res.hasMore);

      if (!currentId && nextConversations.length > 0) {
        setSelectedConversation(nextConversations[0].id);
      }
      // Also reload counts when inbox loads
      loadInboxCounts();
    } catch (err) {
      console.error('Failed to load inbox:', err);
    }
  };

  const loadMoreConversations = async () => {
    if (!currentUser || !hasMoreConversations || isLoadingMoreConversations) return;
    setIsLoadingMoreConversations(true);
    try {
      const effectiveFilter = inboxSearch ? 'all' : inboxFilter;
      const res = await getInbox(currentUser.teamId, effectiveFilter, phoneNumberId, CONVERSATIONS_PAGE_SIZE, conversations.length, inboxSearch, inboxQueryFilters);
      const existingIds = new Set(conversations.map(c => c.id));
      const newOnes = (res.conversations || []).filter(c => !existingIds.has(c.id));
      setConversations(prev => [...prev, ...newOnes]);
      setHasMoreConversations(!!res.hasMore);
    } catch (err) {
      console.error('Failed to load more conversations:', err);
    } finally {
      setIsLoadingMoreConversations(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      setInboxSearch(inboxSearchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [inboxSearchInput]);

  useEffect(() => {
    loadInbox();
  }, [currentUser, inboxFilter, phoneNumberId, inboxSearch, inboxDateFrom, inboxDateTo, inboxAssigneeId]);

  useEffect(() => {
    loadInboxCounts();
    const interval = setInterval(loadInboxCounts, 30000);
    return () => clearInterval(interval);
  }, [currentUser, phoneNumberId, inboxDateFrom, inboxDateTo, inboxAssigneeId]);

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    const byChannel = channelTypeFilter === 'all'
      ? conversations
      : conversations.filter(c => c.channelType === channelTypeFilter);
    // While actively searching, the backend already matched across all statuses
    // (filter='all'), so don't re-apply the tab's status filter on top of it.
    if (inboxSearch) return byChannel;
    return byChannel.filter(c => {
      // open: status open AND (has assignee OR unassigned)
      if (inboxFilter === 'open') {
        return c.status === 'open' || c.status === 'unassigned';
      }
      // pinned: isPinned true
      if (inboxFilter === 'pinned') {
        return c.isPinned;
      }
      // closed: status closed
      if (inboxFilter === 'closed') {
        return c.status === 'closed';
      }
      // unassigned: no assignee
      if (inboxFilter === 'unassigned') {
        return !c.assigneeId;
      }
      // all
      return true;
    });
  }, [conversations, inboxFilter, inboxSearch, channelTypeFilter]);
  
  const instagramUnread = useMemo(() => {
    if (!conversations) return 0;
    return conversations
      .filter(c => c.channelType === 'instagram')
      .reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0);
  }, [conversations]);

  const slaRiskCount = useMemo(() => {
    if (!conversations) return 0;
    return conversations.filter((c) => c.status !== 'closed' && getSlaState(c.lastMessageAt).label !== 'On track').length;
  }, [conversations]);

  const loadMessages = async (silent = false) => {
    if (!selectedId) return;
    if (!silent) setIsLoadingMessages(true);
    try {
      const res = await getMessages(selectedId);
      if (res.success === false) {
        throw new Error(res.message || 'Failed to load messages');
      }
      setMessages(res.messages || []);
      setMessagesLoadError('');

      // Mark as read and update local state
      await markAsRead(selectedId);
      loadInboxCounts();
      setConversations(prev => prev.map(c =>
        c.id === selectedId ? { ...c, unreadCount: 0 } : c
      ));
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessagesLoadError(err?.message || 'Failed to load messages');
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    setMessagesLoadError('');
    loadMessages();
  }, [selectedId]);

  useEffect(() => {
    if (!socket) return;
    const onNewMessage = (payload) => {
      // Play notification sound for inbound messages
      if (payload && payload.direction === 'inbound') {
        try {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(e => console.error('Error playing notification sound:', e));
        } catch (err) {
          console.error('Failed to initialize audio:', err);
        }
      }

      let conversationMissing = false;
      setConversations((prev) => {
        const idx = prev.findIndex(c => c.id === payload.conversationId);
        if (idx === -1) {
          // A brand-new conversation (first message from a contact) isn't in
          // the currently loaded list yet, and this socket payload doesn't
          // carry enough contact/channel metadata to construct a correct row
          // client-side — refresh from the server instead of silently
          // dropping the update (see loadInbox() call below).
          conversationMissing = true;
          return prev;
        }

        const updated = [...prev];
        const conv = { ...updated[idx] };
        
        // Update conversation preview data
        conv.lastMessage = payload.contentType === 'text' ? payload.textBody : `[${payload.contentType}]`;
        conv.lastMessageAt = payload.createdAt || new Date().toISOString();
        if (payload.direction === 'inbound' && selectedIdRef.current !== payload.conversationId) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }
        
        // Remove from old position and prepend to the top (respecting pinned grouping if possible)
        // For simplicity and immediate feedback, we'll just move it to the relative top
        updated.splice(idx, 1);
        
        // Find insert position: after pinned conversations if not pinned, or at the very top if pinned
        let insertAt = 0;
        if (!conv.isPinned) {
          // Find the first non-pinned conversation
          const firstNonPinned = updated.findIndex(c => !c.isPinned);
          if (firstNonPinned !== -1) insertAt = firstNonPinned;
          else insertAt = updated.length;
        }
        
        updated.splice(insertAt, 0, conv);
        return updated;
      });

      if (conversationMissing) {
        loadInbox();
        loadInboxCounts();
      }

      const currentId = selectedIdRef.current;
      if (currentId && payload && payload.conversationId === currentId) {
        // Mark as read immediately since we are viewing it
        markAsRead(currentId).then(() => loadInboxCounts()).catch(console.error);

        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.messageId)) return prev;
          return [
            ...prev,
            {
              id: payload.messageId,
              conversationId: payload.conversationId,
              direction: payload.direction,
              textBody: payload.textBody,
              contentType: payload.contentType || 'text',
              createdAt: payload.createdAt || new Date().toISOString(),
              rawPayload: payload.rawPayload || {},
              attachments: payload.attachments || [],
              translation: payload.translation || null,
            },
          ];
        });
      }
    };
    const onClaimed = () => loadInbox();
    const onReassigned = () => loadInbox();
    const onReleased = () => loadInbox();
    socket.on('message:new', onNewMessage);
    socket.on('assignment:claimed', onClaimed);
    socket.on('assignment:reassigned', onReassigned);
    socket.on('assignment:released', onReleased);

    // Listen for debug events from backend
    const onDebugLead = (data) => {
      console.log('Lead API Response:', data);
      setLeadDebugData(data);
      // Auto-hide after 10 seconds
      setTimeout(() => setLeadDebugData(null), 10000);
    };
    socket.on('debug:lead_api_response', onDebugLead);

    const onInternalChat = () => {
      if (!showInternalChat) setInternalChatUnread(n => n + 1);
    };
    socket.on('internal_chat:message', onInternalChat);
    socket.on('internal_chat:invited', onInternalChat);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('assignment:claimed', onClaimed);
      socket.off('assignment:reassigned', onReassigned);
      socket.off('assignment:released', onReleased);
      socket.off('debug:lead_api_response', onDebugLead);
      socket.off('internal_chat:message', onInternalChat);
      socket.off('internal_chat:invited', onInternalChat);
    };
  }, [socket, selectedId]);

  const handleClaim = async () => {
    if (!selectedId) return;
    await claimConversation(selectedId, currentUser.teamId, currentUser.id);
    loadInbox();
  };

  const handleAssign = async (conversationId, assigneeUserId) => {
    if (!conversationId || !assigneeUserId) return;

    try {
      // Optimistic update
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, assigneeId: assigneeUserId } : c
        )
      );

      // Ensure we have a valid teamId
      const teamId = currentUser?.teamId;
      if (!teamId) throw new Error('No team context is available. Select an authorized workspace first.');

      if (assigneeUserId === currentUser.id) {
        await claimConversation(conversationId, teamId, currentUser.id);
      } else {
        const conversation = conversations.find(c => c.id === conversationId);
        const isReassignment = conversation && conversation.assigneeId;

        if (isReassignment) {
          // Use specific reassign endpoint to force admin role
          await forceReassignConversation(conversationId, teamId, assigneeUserId);
        } else {
          await reassignConversation(conversationId, teamId, assigneeUserId);
        }
      }
      loadInbox();
    } catch (err) {
      console.error('Failed to assign conversation:', err);
      loadInbox();
    }
  };

  const handleExternalReassign = async () => {
    if (!selectedId) return;

    // Unassign case
    if (!targetAssigneeId) {
      await handleUnassign(selectedId);
      return;
    }

    const conversation = conversations.find(c => c.id === selectedId);
    if (!conversation) return;

    if (conversation.leadId) {
      try {
        const res = await reassignExternalLead(conversation.leadId, targetAssigneeId);
        console.log('External reassign response:', res);

        // Check for success - assuming standard API response structure or just successful execution
        if (res && res.success) {
          await handleAssign(selectedId, targetAssigneeId);
        }
      } catch (err) {
        console.error('Failed to reassign external lead:', err);
        alert('Failed to reassign external lead');
      }
    } else {
      // Fallback for conversations without leadId
      await handleAssign(selectedId, targetAssigneeId);
    }
  };

  const handleUnassign = async (conversationId) => {
    if (!conversationId) return;
    const ok = await confirmAction({
      title: 'Unassign conversation?',
      message: 'This conversation will move back to unassigned.',
      confirmLabel: 'Unassign',
      tone: 'toggle',
    });
    if (!ok) return;
    await releaseConversation(conversationId);
    loadInbox();
  };

  const handleResolve = async (id) => {
    const targetId = typeof id === 'string' ? id : selectedId;
    if (!targetId) return;
    const ok = await confirmAction({
      title: 'Resolve conversation?',
      message: 'Mark this conversation as resolved?',
      confirmLabel: 'Resolve',
      tone: 'toggle',
    });
    if (!ok) return;
    try {
      await resolveConversation(targetId);
      loadInbox();
    } catch (err) {
      console.error('Failed to resolve conversation:', err);
    }
  };

  const handleLeadStageUpdated = (conversationId, leadStage) => {
    if (!conversationId) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, leadStage: leadStage || null } : c))
    );
  };

  const handleToggleBlock = async () => {
    if (!selectedConversation) return;
    const conversationId = selectedConversation.id;
    const isBlocked = selectedConversation.blocked === true;
    const ok = await confirmAction({
      title: isBlocked ? 'Unblock conversation?' : 'Block conversation?',
      message: isBlocked
        ? 'This customer will be able to message again.'
        : 'This customer conversation will be blocked.',
      confirmLabel: isBlocked ? 'Unblock' : 'Block',
      tone: isBlocked ? 'toggle' : 'danger',
    });
    if (!ok) return;
    try {
      if (isBlocked) {
        await unblockConversation(conversationId);
        setConversations(prev =>
          prev.map(c => (c.id === conversationId ? { ...c, blocked: false } : c))
        );
      } else {
        await blockConversation(conversationId);
        setConversations(prev =>
          prev.map(c => (c.id === conversationId ? { ...c, blocked: true } : c))
        );
      }
    } catch (err) {
      console.error('Failed to toggle block:', err);
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (!conversationId) return;
    const confirmed = await confirmAction({
      title: 'Delete conversation?',
      message: 'Delete this conversation and all its messages? This cannot be undone.',
      confirmLabel: 'Delete conversation',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      loadInboxCounts();
      if (selectedId === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };


  const handlePin = async (conversationId) => {
    try {
      await pinConversation(conversationId);
      loadInbox();
    } catch (err) {
      console.error('Failed to pin conversation:', err);
    }
  };
  
  const handleWorkflowSave = async (workflowJson) => {
    try {
      if (editingWorkflow && editingWorkflow.id) {
        const updatedWorkflow = {
          ...editingWorkflow,
          trigger: workflowJson.trigger,
          nodes: workflowJson.nodes,
          edges: workflowJson.edges,
          steps: {
            nodes: workflowJson.nodes,
            edges: workflowJson.edges,
            trigger: workflowJson.trigger,
          },
        };
        await updateWorkflow(editingWorkflow.id, updatedWorkflow);
        // CRITICAL: update local state so that refreshing the page restores all nodes
        setEditingWorkflow(updatedWorkflow);
      }
    } catch (err) {
      console.error('Failed to save workflow:', err);
    }
  };





  useEffect(() => {
    if (!isAssigned || !selectedConversation?.assigneeId) {
      setAssigneeName(null);
      return;
    }

    const userId = selectedConversation.assigneeId;

    // 1. Prefer backend provided name if it's there
    if (selectedConversation.assigneeName) {
      setAssigneeName(selectedConversation.assigneeName);
      // We don't return here so we can still allow the local resolution to override 
      // if targetAssigneeId matched (indicating a very recent local manual change)
    }

    // 2. Check if local agent (instant feedback for currentUser)
    const localAgent = agents.find(a => a.id === userId);
    if (localAgent) {
      setAssigneeName(localAgent.name);
      return;
    }

    // 3. Check if in teamMembers list already
    const member = teamMembers.find(m => m.id === userId || m._id === userId);
    if (member) {
      setAssigneeName(getUserName(member));
      return;
    }

    // 4. Fallback from targetAssigneeId if available (for instant feedback during assignment)
    if (targetAssigneeId === userId) {
      const targetMember = teamMembers.find(m => m.id === targetAssigneeId || m._id === targetAssigneeId);
      if (targetMember) {
        setAssigneeName(getUserName(targetMember));
        return;
      }
    }

    // 5. Fetch external details if still unknown
    if (!selectedConversation.assigneeName) {
      let isMounted = true;
      getTeamUser(userId)
        .then(res => {
          if (!isMounted) return;
          const user = res.data || res;
          const name = getUserName(user);
          setAssigneeName(name);
        })
        .catch(err => {
          if (!isMounted) return;
          console.error('Failed to fetch assignee:', err);
          setAssigneeName('Unknown Agent');
        });
      return () => { isMounted = false; };
    }
  }, [selectedConversation?.assigneeId, selectedConversation?.assigneeName, isAssigned, agents, teamMembers]);

  if (window.location.pathname === '/reset-password') {
    return <ResetPasswordPage />;
  }

  if (window.location.pathname === '/signup') {
    return <SignupPage />;
  }

  if (window.location.pathname === '/verify-email') {
    return <VerifyEmailPage />;
  }

  if (window.location.pathname === '/accept-invite') {
    return <InviteAcceptancePage />;
  }

  if (window.location.pathname === '/privacy') {
    return <PrivacyPolicyPage />;
  }

  if (window.location.pathname === '/terms') {
    return <TermsPage />;
  }

  if (window.location.pathname === '/login' || window.location.pathname === '/customer/login') {
    return <LoginPage mode="customer" onLogin={handleLogin} />;
  }

  if (window.location.pathname === '/admin/login') {
    return <LoginPage mode="admin" onLogin={handleAdminLogin} />;
  }

  if (!isLoggedIn) {
    if (isAdminLoginView) {
      return <LoginPage mode="admin" onLogin={handleAdminLogin} />;
    }
    if (isLoginView) {
      return <LoginPage mode="customer" onLogin={handleLogin} />;
    }
    return <LandingPage onLoginClick={() => setIsLoginView(true)} />;
  }

  if (isAdminMode) {
    return (
      <>
        <AdminPortal currentUser={{ ...currentUser, email: storedUser?.email || currentUser?.email }} onLogout={handleLogout} />
        <Toaster />
        <ConfirmActionHost />
      </>
    );
  }


  const handleProfileUpdated = (user) => setStoredUser(user);
  const navigateWorkspace = target => {
    if (typeof target !== 'string') return;
    const event = new Event('greeto:before-navigate', {cancelable:true});
    if (!window.dispatchEvent(event)) return;
    const [raw, query = ''] = target.replace(/^\//, '').split('?');
    const page = raw === 'create-template' ? raw : canonicalPage(raw);
    if (!validPages.includes(page)) { setActivePage('not-found'); return; }
    const url = `/${page}${query ? `?${query}` : ''}`;
    if (window.location.pathname + window.location.search !== url) window.history.pushState(null, '', url);
    setEditingWorkflow(null);
    setActivePage(page);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  const scope = scopeFromUser(currentUser);
  const pagePermitted = canAccessPage(activePage, currentUser?.role);
  return (
    <div className="greeto-workspace-shell">
      <WorkspaceSidebar activePage={activePage} onNavigate={navigateWorkspace} role={currentUser?.role}
        userName={currentUser?.name} onLogout={() => setShowLogoutConfirm(true)} />
      {/* Existing and new feature routes share a responsive, role-aware shell. */}
      <main id="workspace-main" className="greeto-workspace-main" tabIndex={-1}>
        <ErrorBoundary key={`${activePage}:${JSON.stringify(scope)}`}>
        {activePage === 'not-found' ? <StatePage title="Page not found">This route is not registered. Choose a feature from the navigation.</StatePage>
        : !pagePermitted ? <StatePage title="Access restricted">This feature is not available to your current role. The server must independently authorize all requests.</StatePage> : <>
        {activePage === 'implementation' && <ImplementationCenter onNavigate={navigateWorkspace} />}
        {studioPageIds.includes(activePage) && <FeatureStudioPage key={`${activePage}:${JSON.stringify(scope)}`} featureId={activePage} scope={scope} onNavigate={navigateWorkspace} />}
        {activePage === 'dashboard' && (
          <DashboardPage
            teamId={currentUser.teamId}
            role={currentUser.role}
            currentUser={{ ...currentUser, email: storedUser?.email || currentUser?.email }}
            onNavigate={navigateWorkspace}
            onLogout={() => setShowLogoutConfirm(true)}
            hasWhatsApp={linkedPhones.length > 0}
            onConnectWhatsApp={() => { setAutoOpenWhatsAppConnect(true); setActivePage('integrations'); }}
          />
        )}

        {activePage === 'getting-started' && (
          <PageBoundary label="Loading workspace guide">
            <GettingStartedPage onNavigate={navigateWorkspace} />
          </PageBoundary>
        )}

        {activePage === 'profile' && (
          <ProfilePage
            currentUser={{ ...currentUser, email: storedUser?.email || currentUser?.email }}
            onProfileUpdated={handleProfileUpdated}
          />
        )}

        {activePage === 'team' && (
          <TeamPage
            conversations={conversations}
            agents={agents}
            currentUser={currentUser}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
          />
        )}

        {activePage === 'settings' && <SettingsPage currentUser={currentUser} onNavigate={navigateWorkspace} />}
        {activePage === 'integrations' && (
          <SettingsPage
            currentUser={currentUser}
            onNavigate={navigateWorkspace}
            initialMode="integrations"
            autoOpenWhatsApp={autoOpenWhatsAppConnect}
            onAutoOpenWhatsAppHandled={() => setAutoOpenWhatsAppConnect(false)}
          />
        )}

        {activePage === 'templates' && <TemplatesPage onNavigate={navigateWorkspace} />}
        {activePage === 'email-templates' && <EmailTemplatesPage />}
        {activePage === 'create-template' && <EmailTemplatesPage startCreate={true} />}
        {activePage === 'flows' && <FlowsPage />}

        {activePage === 'workflows' && (
          quickWorkflowStage ? (
            <QuickWorkflowBuilder
              stage={quickWorkflowStage}
              onBack={() => setQuickWorkflowStage(null)}
              onOpenVisualBuilder={(workflow) => {
                setQuickWorkflowStage(null);
                setEditingWorkflow(workflow);
              }}
            />
          ) : editingWorkflow ? (
            <WorkflowBuilder
              initialWorkflow={editingWorkflow}
              linkedPhones={linkedPhones}
              onBack={() => setEditingWorkflow(null)}
              onSave={handleWorkflowSave}
            />
          ) : (
            <WorkflowsKanban
              currentUser={currentUser}
              onOpenBuilder={(wf) => setEditingWorkflow(wf)}
              onOpenQuickBuilder={(stage) => {
                setEditingWorkflow(null);
                setQuickWorkflowStage(stage);
              }}
              onNavigate={navigateWorkspace}
              onLogout={() => setShowLogoutConfirm(true)}
            />
          )
        )}

        {activePage === 'sequences' && (
          <SequencesPage
            onOpenWorkflow={(workflow) => {
              setEditingWorkflow(workflow);
              setActivePage('workflows');
            }}
          />
        )}

        {activePage === 'rules' && <RulesPage />}

        {activePage === 'instagram' && <InstagramPage currentUser={currentUser} socket={socket} />}
        {activePage === 'telegram' && <TelegramPage currentUser={currentUser} socket={socket} />}
        {activePage === 'calls' && <CallsPage currentUser={currentUser} />}
        {activePage === 'sms' && <SmsPage currentUser={currentUser} />}
        {activePage === 'email' && <EmailPage currentUser={currentUser} />}
        {activePage === 'gallery' && <GalleryPage onNavigate={navigateWorkspace} />}
        {activePage === 'ai-agent' && <AiAgentPage onNavigate={navigateWorkspace} />}

        {activePage === 'team-members' && <TeamMembersPage onNavigate={navigateWorkspace} />}
        {activePage === 'contacts' && <ContactsPage onNavigate={navigateWorkspace} />}
        {activePage === 'reports' && <ReportsPage onNavigate={navigateWorkspace} />}
        {activePage === 'subscriptions' && <SubscriptionsPage />}
        {activePage === 'opportunities' && <OpportunitiesPage />}
        {activePage === 'lead-stages' && <LeadStagesPage />}
        {activePage === 'lead-status' && <LeadStatusPage />}
        {activePage === 'labels' && <LabelsPage onNavigate={navigateWorkspace} />}
        {activePage === 'campaigns' && <CampaignsPage onNavigate={navigateWorkspace} />}

        {activePage === 'inbox' && (
          <div ref={conversationLayoutRef} className="flex flex-1 min-w-0 overflow-hidden">
            <div style={{ width: listPaneWidth }} className="flex-none border-r border-slate-200 bg-white flex flex-col shadow-[6px_0_20px_rgba(15,23,42,0.03)]">
              <div className="border-b border-slate-200 px-4 py-4 bg-white">
                {isInboxSearchOpen ? (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-purple-400" />
                      <input
                        autoFocus
                        type="text"
                        value={inboxSearchInput}
                        onChange={(e) => setInboxSearchInput(e.target.value)}
                        placeholder="Search by name or phone number..."
                        className="w-full text-sm border border-slate-200 rounded-2xl pl-9 pr-3 py-2.5 bg-white text-slate-800 shadow-sm focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-300"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-2xl hover:bg-purple-100"
                      onClick={() => {
                        setIsInboxSearchOpen(false);
                        setInboxSearchInput('');
                        setInboxSearch('');
                      }}
                    >
                      <X size={16} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h1 className="font-semibold text-lg text-slate-950">Conversations</h1>
                      <p className="text-[11px] font-medium text-slate-500">{inboxCounts.all || 0} conversations</p>
                    </div>
                    <div className="flex space-x-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl bg-white border border-purple-100 hover:bg-purple-50" onClick={() => setIsInboxSearchOpen(true)}>
                        <Search size={16} />
                      </Button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2 text-[11px] font-medium">
                  {linkedPhones.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      WhatsApp connected ({linkedPhones.length} channel{linkedPhones.length === 1 ? '' : 's'})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      No WhatsApp channel connected
                    </span>
                  )}
                  {linkedPhones.length > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">{Math.max(0, (inboxCounts.all || 0) - (inboxCounts.resolved || 0))} open</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">{inboxCounts.unread || 0} unread</span>
                      {slaRiskCount > 0 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-red-600">{slaRiskCount} SLA risk</span>
                        </>
                      )}
                    </>
                  )}
                </div>
                {linkedPhones.length > 1 && (
                  <select
                    value={phoneNumberId || ''}
                    onChange={(e) => setPhoneNumberId(e.target.value || null)}
                    className="w-full text-xs border border-slate-200 rounded-2xl px-3 py-2.5 bg-white text-slate-800 shadow-sm focus:outline-none focus:ring-4 focus:ring-purple-100 focus:border-purple-300"
                  >
                    <option value="">All Channels</option>
                    {linkedPhones.map(p => (
                      <option key={p.phone_number_id} value={p.phone_number_id}>
                        {p.display_phone_number || p.phone_number_id}
                      </option>
                    ))}
                  </select>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input
                    aria-label="Conversation start date"
                    type="date"
                    value={inboxDateFrom}
                    onChange={(event) => setInboxDateFrom(event.target.value)}
                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                  <input
                    aria-label="Conversation end date"
                    type="date"
                    min={inboxDateFrom || undefined}
                    value={inboxDateTo}
                    onChange={(event) => setInboxDateTo(event.target.value)}
                    className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                </div>
                {['admin', 'super_admin', 'department_head', 'sales_manager', 'team_lead'].includes(currentUser.role) && teamMembers.length > 1 && (
                  <select
                    aria-label="Filter conversations by team member"
                    value={inboxAssigneeId}
                    onChange={(event) => setInboxAssigneeId(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  >
                    <option value="">All accessible members</option>
                    {teamMembers.map((member) => (
                      <option key={member.id || member._id} value={member.id || member._id}>
                        {getUserName(member)}
                      </option>
                    ))}
                  </select>
                )}
                {(inboxDateFrom || inboxDateTo || inboxAssigneeId) && (
                  <button
                    type="button"
                    onClick={() => { setInboxDateFrom(''); setInboxDateTo(''); setInboxAssigneeId(''); }}
                    className="mt-2 text-[11px] font-medium text-purple-700 hover:text-purple-900"
                  >
                    Clear conversation filters
                  </button>
                )}
              </div>
              <Inbox
                conversations={filteredConversations}
                hasMore={hasMoreConversations}
                isLoadingMore={isLoadingMoreConversations}
                onLoadMore={loadMoreConversations}
                selectedId={selectedId}
                onSelect={setSelectedConversation}
                onPin={handlePin}
                onResolve={handleResolve}
                onDelete={currentUser.role === 'admin' || currentUser.role === 'super_admin' ? handleDeleteConversation : null}
                currentUser={currentUser}
                filter={inboxFilter}
                setFilter={setInboxFilter}
                counts={inboxCounts}
                channelFilter={channelTypeFilter}
                setChannelFilter={setChannelTypeFilter}
                hasConnectedChannel={linkedPhones.length > 0}
                onConnectChannel={() => setActivePage('integrations')}
              />
            </div>

            <div
              role="separator"
              aria-orientation="vertical"
              onMouseDown={startPaneDrag('list')}
              className="w-1.5 flex-none cursor-col-resize bg-transparent hover:bg-purple-200 transition-colors"
            />

            <div className="flex-1 flex min-w-0 relative overflow-hidden">
            <main className="flex min-w-0 flex-1 flex-col bg-white">
              {selectedId && (
                <div className="z-10 min-h-[84px] flex-none border-b border-slate-200 bg-white px-5 py-3">
                  <div className="flex h-full items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white shadow-sm">
                      {displayContactName === 'No Name' ? 'NN' : displayContactName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="max-w-full truncate text-base font-semibold leading-6 text-slate-950" title={displayContactName}>
                        {displayContactName}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <p className="text-xs text-slate-500 leading-5">
                          {selectedConversation?.status === 'closed' ? 'Closed' : 'Open Conversation'}
                        </p>
                        {selectedConversation?.channelDisplayName && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="inline-flex max-w-[115px] items-center truncate rounded-lg border border-violet-100 bg-violet-50 px-2 py-1 text-[10px] font-medium leading-none text-violet-700">
                              via {selectedConversation.channelDisplayName}
                            </span>
                          </>
                        )}
                        <span className="text-slate-300">•</span>
                        <span className={cn("inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-medium leading-none", getSlaState(selectedConversation?.lastMessageAt).tone)}>
                          {getSlaState(selectedConversation?.lastMessageAt).label}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="max-w-[140px] truncate text-[11px] font-semibold text-slate-500" title={isAssigned ? (assigneeName || 'Assigned') : 'Unassigned'}>
                          {isAssigned ? (assigneeName || 'Assigned') : 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-none flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => setProfilePanelOpen((v) => !v)}
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors",
                        profilePanelOpen ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                      )}
                      title="Show or hide contact details"
                    >
                      {profilePanelOpen ? 'Hide details' : 'View details'}
                    </button>
                    <button
                      onClick={() => { setShowInternalChat(v => !v); setInternalChatUnread(0); }}
                      className="relative flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      title="Team Chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Chat
                      {internalChatUnread > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                          {internalChatUnread > 9 ? '9+' : internalChatUnread}
                        </span>
                      )}
                    </button>
                    <Button variant="outline" size="sm" onClick={handleResolve} className="h-9 rounded-lg px-3 font-medium shadow-none">
                      Resolve
                    </Button>
                    <Button variant="outline" size="sm" className="h-9 rounded-lg px-3 font-medium shadow-none">
                      Snooze
                    </Button>
                    <Button
                      variant={selectedConversation?.blocked ? "destructive" : "outline"}
                      size="sm"
                      onClick={handleToggleBlock}
                      className="h-9 rounded-lg px-3 font-medium shadow-none"
                    >
                      {selectedConversation?.blocked ? 'Unblock' : 'Block'}
                    </Button>
                    <div className="relative">
                      <button
                        onClick={() => setIsHeaderProfileMenuOpen((v) => !v)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-xs font-medium text-white shadow-sm shadow-violet-200 transition-colors hover:bg-violet-700"
                        title={currentUser?.name || 'Profile'}
                      >
                        {(currentUser?.name || '?').charAt(0).toUpperCase()}
                      </button>
                      {isHeaderProfileMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsHeaderProfileMenuOpen(false)} />
                          <div className="absolute right-0 mt-2 w-48 rounded-2xl border border-purple-100 bg-white shadow-xl z-50 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100">
                              <p className="text-sm font-black text-slate-900 truncate">{currentUser?.name || 'Account'}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{currentUser?.role || ''}</p>
                            </div>
                            
                            {/* Workspace Switcher */}
                            {currentUser?.teamIds?.length > 1 && (
                              <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 max-h-[160px] overflow-y-auto">
                                <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Switch Workspace</p>
                                <div className="space-y-1">
                                  {currentUser.teamIds.map(tid => (
                                    <button
                                      key={tid}
                                      onClick={() => {
                                        localStorage.setItem('activeTeamId', tid);
                                        window.location.reload();
                                      }}
                                      className={`w-full text-left px-2 py-1.5 text-xs font-semibold rounded transition-colors flex items-center justify-between ${tid === currentUser.teamId ? 'bg-violet-100 text-violet-700' : 'text-slate-600 hover:bg-slate-100'}`}
                                      title={tid}
                                    >
                                      <span className="truncate">WS: {tid.split('-')[0]}</span>
                                      {tid === currentUser.teamId && <span>✓</span>}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <button
                              onClick={() => { setIsHeaderProfileMenuOpen(false); setActivePage('profile'); }}
                              className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-purple-50 transition-colors"
                            >
                              My Profile
                            </button>
                            <button
                              onClick={() => { setIsHeaderProfileMenuOpen(false); setShowLogoutConfirm(true); }}
                              className="w-full text-left px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              Log Out
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              )}


              <div className="flex-1 overflow-hidden relative">
                <Chat
                  socket={socket}
                  conversationId={selectedId}
                  channelExternalId={selectedConversation?.channelExternalId}
                  channelType={selectedConversation?.channelType}
                  messages={messages}
                  isLoading={isLoadingMessages}
                  loadError={messagesLoadError}
                  onRetry={() => loadMessages()}
                  onRefresh={() => loadMessages(true)}
                />
              </div>
            </main>

            {selectedId && profilePanelOpen && (
              <div
                role="separator"
                aria-orientation="vertical"
                onMouseDown={startPaneDrag('profile')}
                className="w-1.5 flex-none cursor-col-resize bg-transparent hover:bg-emerald-200 transition-colors"
              />
            )}
            {selectedId && profilePanelOpen && (
              <aside style={{ width: profilePaneWidth }} className="flex-none border-l border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-white flex flex-col overflow-y-auto">
                <div className="p-4 pb-0 flex-none space-y-3">
                  <Card className="overflow-visible rounded-xl border-emerald-100 bg-white shadow-sm">
                    <CardHeader className="border-b border-emerald-50 bg-emerald-50/70 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-emerald-600" />
                          <CardTitle className="text-sm font-semibold text-slate-900">Assignment</CardTitle>
                        </div>
                        {isAssigned ? (
                          <span className="max-w-[130px] truncate rounded-full border border-emerald-100 bg-white px-2 py-0.5 text-[10px] font-medium text-emerald-700" title={assigneeName || 'Unknown Agent'}>
                            {assigneeName || 'Unknown Agent'}
                          </span>
                        ) : (
                          <span className="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 p-3">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-medium text-slate-500">Reassign to</label>
                        <div className="relative">
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isAssigneeOpen}
                            className="h-9 w-full justify-between rounded-lg border-emerald-100 px-3 py-2 text-left text-xs font-normal"
                            onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}
                          >
                            <span className="truncate">
                              {targetAssigneeId
                                ? (targetAssigneeId === selectedConversation?.assigneeId
                                  ? (assigneeName || getUserName(teamMembers.find(u => (u.id || u._id) === targetAssigneeId)))
                                  : getUserName(teamMembers.find(u => (u.id || u._id) === targetAssigneeId) || agents.find(a => a.id === targetAssigneeId)))
                                : "Unassigned"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>

                          {isAssigneeOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-40 bg-transparent"
                                onClick={() => setIsAssigneeOpen(false)}
                              />
                              <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-xl border border-emerald-100 bg-white text-slate-950 shadow-xl">
                                <div className="sticky top-0 z-10 border-b border-emerald-50 bg-white p-2">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-3 w-3 text-slate-500" />
                                    <input
                                      className="w-full rounded-lg border border-emerald-100 bg-transparent px-2 py-1.5 pl-7 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                                      placeholder="Search team..."
                                      value={assigneeSearch}
                                      onChange={(e) => setAssigneeSearch(e.target.value)}
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto py-1">
                                  <div
                                    className="relative flex cursor-default select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none hover:bg-emerald-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    onClick={() => {
                                      setTargetAssigneeId(null);
                                      setIsAssigneeOpen(false);
                                    }}
                                  >
                                    <span className="flex-1 truncate text-slate-500 italic">Unassigned</span>
                                    {!targetAssigneeId && <Check className="ml-auto h-4 w-4" />}
                                  </div>

                                  {teamMembers
                                    .filter(user =>
                                      !assigneeSearch ||
                                      (getUserName(user) || '').toLowerCase().includes(assigneeSearch.toLowerCase()) ||
                                      (user.role || '').toLowerCase().includes(assigneeSearch.toLowerCase())
                                    )
                                    .map((user) => {
                                      const userId = user.id || user._id;
                                      return (
                                        <div
                                          key={userId}
                                          className="relative flex cursor-pointer select-none items-center rounded-lg border-b border-emerald-50 px-2 py-2 text-sm outline-none last:border-0 hover:bg-emerald-50"
                                          onClick={() => {
                                            setTargetAssigneeId(userId);
                                            setIsAssigneeOpen(false);
                                          }}
                                        >
                                          <div className="flex flex-col">
                                            <span className="font-medium truncate">{getUserName(user)}</span>
                                            <span className="text-xs text-slate-500 capitalize">{user.role}</span>
                                          </div>
                                          {targetAssigneeId === userId && (
                                            <Check className="ml-auto h-4 w-4 text-emerald-600" />
                                          )}
                                        </div>
                                      )
                                    })}
                                  {teamMembers.length === 0 && (
                                    <div className="px-2 py-4 text-center text-xs text-slate-500">
                                      No team members found
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <Button
                          className="h-9 w-full rounded-lg bg-emerald-600 text-xs hover:bg-emerald-700"
                          size="sm"
                          onClick={handleExternalReassign}
                        >
                          Reassign
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {['admin', 'super_admin'].includes(currentUser.role) && selectedConversation?.contactExternalId && (() => {
                    const phoneParts = formatPhoneParts(selectedConversation.contactExternalId);
                    if (!phoneParts) return null;
                    return (
                      <Card className="overflow-visible rounded-xl border-emerald-100 bg-white shadow-sm">
                        <CardHeader className="border-b border-emerald-50 bg-emerald-50/70 px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-emerald-600" />
                            <CardTitle className="text-sm font-semibold text-slate-900">Customer</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-1 p-3">
                          <label className="block text-[11px] font-medium text-slate-500">Phone Number</label>
                          <div className="flex items-center gap-2">
                            {phoneParts.countryCode && (
                              <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-700">
                                {phoneParts.countryCode}
                              </span>
                            )}
                            <span className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-800">
                              {phoneParts.number}
                            </span>
                            <button
                              onClick={() => handleCopyPhone(phoneParts.full)}
                              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                              title="Copy phone number"
                            >
                              {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })()}
                </div>

                <div className="px-4 pb-2">
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Messages</p>
                      <p className="text-base font-semibold text-slate-900">{messages.length}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Status</p>
                      <p className="text-base font-semibold text-slate-900 capitalize">{selectedConversation?.status || 'open'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Last activity</p>
                      <p className="text-xs font-medium text-slate-700">
                        {selectedConversation?.lastMessageAt ? new Date(selectedConversation.lastMessageAt).toLocaleString() : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 pb-4">
                  <CustomerCard
                    conversationId={selectedId}
                    onLeadStageUpdated={(leadStage) => handleLeadStageUpdated(selectedId, leadStage)}
                    onContactUpdated={(newName) => handleContactNameUpdated(selectedId, newName)}
                  />
                </div>
                <div className="px-4 pb-4" style={{ minHeight: 340 }}>
                  <NotesPanel conversationId={selectedId} currentUser={currentUser} socket={socket} />
                </div>
              </aside>
            )}

            {/* Internal Team Chat panel — slides in over the right sidebar */}
            {showInternalChat && (
              <aside className="w-80 flex-none border-l border-slate-200 bg-white flex flex-col overflow-hidden" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 30, boxShadow: '-4px 0 24px rgba(0,0,0,0.08)' }}>
                <InternalChat
                  socket={socket}
                  currentUser={currentUser}
                  teamMembers={teamMembers}
                  teamId={currentUser?.teamId}
                  onClose={() => setShowInternalChat(false)}
                />
              </aside>
            )}
            </div>{/* end relative flex wrapper */}

            {/* Lead API Debug Overlay */}
            {leadDebugData && (
              <div className="fixed bottom-4 right-4 z-50 w-96 bg-white border border-green-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-green-50 px-4 py-2 border-b border-green-100 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-green-800">New Lead Created</h3>
                  <button
                    onClick={() => setLeadDebugData(null)}
                    className="text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </div>
                <div className="p-4 max-h-96 overflow-auto">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                    {JSON.stringify(leadDebugData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
        </>}
        </ErrorBoundary>
      </main>
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[32px] border border-purple-100 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Confirm logout</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Are you sure?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">You will return to the Greeto login page. Unsaved local changes may be lost.</p>
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
      <Toaster />
      <ConfirmActionHost />
      {showPreloader && !isLoggedIn && <Preloader onDone={() => setShowPreloader(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <PageBoundary label="Loading Greeto">
      <AppContent />
    </PageBoundary>
  );
}




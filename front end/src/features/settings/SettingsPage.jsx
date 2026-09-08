import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import InstagramMediaPage from '../channels/InstagramMediaPage.jsx';
import InstagramAutomationsPanel from '../channels/InstagramAutomationsPanel.jsx';
import { useWhatsAppEmbeddedSignup } from '../../hooks/useWhatsAppEmbeddedSignup.js';
import {
  MessageSquare, Trash2, Mail, Globe, Upload, ArrowRight, Download, Type,
  ArrowLeft, Send, Puzzle, CreditCard, Phone,
  Database, ExternalLink, ShieldCheck, Lock, Sparkles,
  Globe2, Code2, Clock, Copy, Eye, EyeOff, Server, CheckCircle2,
  Calendar, LifeBuoy, Calculator, FileSignature, BarChart3, ShoppingBag, Workflow,
  Building2, GitBranch, Palette, LayoutDashboard, Bot, Users, FileCheck2, Megaphone,
  Plus, Info, Target, Pencil, ArrowUp, ArrowDown, AlertCircle, Loader2, RefreshCw, KeyRound,
  RotateCcw, Slash, Zap, UserCheck, PlayCircle, Search, MoreHorizontal, X
} from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  getWhatsAppSettings, onboardWhatsApp, updateWhatsAppSettings, patchWhatsAppSettings, setPrimaryWhatsAppNumber,
  getWhatsAppAppSettings,
  disconnectWhatsApp, getTelegramSettings, connectTelegram,
  disconnectTelegram,
  connectInstagram, connectInstagramManually, getInstagramStatus, disconnectInstagram,
  getInstagramAppSettings, saveInstagramAppSettings,
  getInstagramAutomations, createInstagramAutomation,
  updateInstagramAutomation, deleteInstagramAutomation, toggleInstagramAutomation,
  getRazorpaySettings, updateRazorpaySettings, disconnectRazorpay,
  getExotelSettings, updateExotelSettings, disconnectExotel,
  initiateExotelCall, getExotelCallLogs,
  getTwilioSettings, updateTwilioSettings, disconnectTwilio,
  sendTwilioSms, initiateTwilioCall, getTwilioLogs,
  getEmailSettings, updateEmailSettings, disconnectEmail, testEmailConnection,
  getTranslationSetting, updateTranslationSetting,
  getContactChannels,
  getGenericIntegrationSettings, updateGenericIntegrationSettings, testGenericIntegration, disconnectGenericIntegration
} from './api.js';

const getPublicBackendOrigin = () => {
  const configured = import.meta.env.VITE_PUBLIC_API_URL || import.meta.env.VITE_API_URL || '';
  const normalized = String(configured).trim().replace(/\/api\/?$/, '').replace(/\/$/, '');
  if (normalized) return normalized;
  return window.location.origin;
};

// ─── Brand icon URLs (SimpleIcons CDN + Wikimedia) ────────────────────────────
const ICONS = {
  whatsapp: 'https://cdn.simpleicons.org/whatsapp/25D366',
  telegram: 'https://cdn.simpleicons.org/telegram/26A5E4',
  instagram: 'https://cdn.simpleicons.org/instagram/E4405F',
  gmail: 'https://cdn.simpleicons.org/gmail/EA4335',
  slack: 'https://cdn.simpleicons.org/slack/4A154B',
  zoho: 'https://cdn.simpleicons.org/zoho/E42527',
  salesforce: 'https://cdn.simpleicons.org/salesforce/00A1E0',
  notion: 'https://cdn.simpleicons.org/notion/000000',
  hubspot: 'https://cdn.simpleicons.org/hubspot/FF7A59',
  linear: 'https://cdn.simpleicons.org/linear/5E6AD2',
  github: 'https://cdn.simpleicons.org/github/181717',
  jira: 'https://cdn.simpleicons.org/jira/0052CC',
  stripe: 'https://cdn.simpleicons.org/stripe/635BFF',
  razorpay: 'https://cdn.simpleicons.org/razorpay/02042B',
  cashfree: 'https://logo.clearbit.com/cashfree.com',
  payu: 'https://logo.clearbit.com/payu.in',
  googlesheets: 'https://cdn.simpleicons.org/googlesheets/34A853',
  twilio: 'https://cdn.simpleicons.org/twilio/F22F46',
  airtel: 'https://logo.clearbit.com/airtel.in',
  exotel: 'https://logo.clearbit.com/exotel.com',
  openai: 'https://cdn.simpleicons.org/openai/412991',
  anthropic: 'https://cdn.simpleicons.org/anthropic/191919',
  xolox: 'https://logo.clearbit.com/xolox.in',
  messenger: 'https://cdn.simpleicons.org/messenger/00B2FF',
  facebook: 'https://cdn.simpleicons.org/facebook/1877F2',
  fast2sms: 'https://logo.clearbit.com/fast2sms.com',
  plivo: 'https://logo.clearbit.com/plivo.com',
  mailchimp: 'https://cdn.simpleicons.org/mailchimp/FFE01B',
  zeptomail: 'https://logo.clearbit.com/zeptomail.zoho.com',
  mailgun: 'https://logo.clearbit.com/mailgun.com',
  sendgrid: 'https://cdn.simpleicons.org/sendgrid/51A9DD',
  awsses: 'https://cdn.simpleicons.org/amazonses/FF9900',
  zohomail: 'https://cdn.simpleicons.org/zohomail/C13A2E',
  knowlarity: 'https://logo.clearbit.com/knowlarity.com',
  ozonetel: 'https://logo.clearbit.com/ozonetel.com',
  zoom: 'https://cdn.simpleicons.org/zoom/2D8CFF',
  kylas: 'https://logo.clearbit.com/kylas.io',
  shopify: 'https://cdn.simpleicons.org/shopify/7AB55C',
  googlecalendar: 'https://cdn.simpleicons.org/googlecalendar/4285F4',
  calendly: 'https://cdn.simpleicons.org/calendly/006BFF',
  zendesk: 'https://cdn.simpleicons.org/zendesk/03363D',
  freshdesk: 'https://logo.clearbit.com/freshworks.com',
  zohobooks: 'https://logo.clearbit.com/zoho.com',
  quickbooks: 'https://cdn.simpleicons.org/quickbooks/2CA01C',
  tally: 'https://logo.clearbit.com/tallysolutions.com',
  docusign: 'https://logo.clearbit.com/docusign.com',
  zohosign: 'https://logo.clearbit.com/zoho.com',
  googleads: 'https://cdn.simpleicons.org/googleads/4285F4',
  metaads: 'https://cdn.simpleicons.org/meta/0081FB',
  ga4: 'https://cdn.simpleicons.org/googleanalytics/E37400',
  mixpanel: 'https://cdn.simpleicons.org/mixpanel/7856FF',
  segment: 'https://cdn.simpleicons.org/segment/52BD94',
  zapier: 'https://cdn.simpleicons.org/zapier/FF4A00',
  moodle: 'https://cdn.simpleicons.org/moodle/F98012',
};

const CATEGORIES = [
  { id: 'channels', name: 'Communication Channels', icon: MessageSquare },
  { id: 'livechat', name: 'Live Chat & Website', icon: Globe2 },
  { id: 'mcp', name: 'MCP Connectors', icon: Server },
  { id: 'crm', name: 'CRM & Productivity', icon: Database },
  { id: 'payments', name: 'Payments & Billing', icon: CreditCard },
  { id: 'push', name: 'Push Notifications', icon: Zap },
  { id: 'voip', name: 'VoIP & Calling', icon: Phone },
  { id: 'ai', name: 'AI Providers', icon: Sparkles },
  { id: 'calendar', name: 'Calendar & Scheduling', icon: Calendar },
  { id: 'support', name: 'Support & Helpdesk', icon: LifeBuoy },
  { id: 'accounting', name: 'Accounting', icon: Calculator },
  { id: 'esign', name: 'E-Signature', icon: FileSignature },
  { id: 'analytics', name: 'Ads & Analytics', icon: BarChart3 },
  { id: 'commerce', name: 'Commerce', icon: ShoppingBag },
  { id: 'automation', name: 'Automation', icon: Workflow },
];

const PAYMENT_GATEWAY_IDS = new Set(['stripe', 'cashfree', 'payu', 'razorpay']);
const WORKSPACE_EMAIL_PROVIDER_IDS = new Set(['mailgun', 'sendgrid', 'aws-ses']);

const PAYMENT_GATEWAY_MODAL = {
  razorpay: {
    modalDesc: 'Connect Razorpay to create payment links from workflows, send them in conversations, and sync payment status back into Greeto.',
    permissions: ['Create Razorpay payment links', 'Check order and payment status', 'Receive payment webhook events'],
    credentialText: 'Paste live Razorpay credentials from Dashboard -> Settings -> API Keys. These stay scoped to this workspace.',
  },
  stripe: {
    modalDesc: 'Connect Stripe to create payment links, inspect billing status, and keep customer payment activity available in conversations.',
    permissions: ['Create Stripe payment links', 'Read customer payment history', 'Verify webhook signatures'],
    credentialText: 'Paste Stripe API credentials from Developers -> API keys. Use restricted live keys for production.',
  },
  cashfree: {
    modalDesc: 'Connect Cashfree so workflow payment actions can create payment links and track payment completion for this workspace.',
    permissions: ['Create Cashfree payment links', 'Check payment-link status', 'Use credentials only inside this workspace'],
    credentialText: 'Paste Cashfree App ID and Secret Key from Dashboard -> Developers -> API Keys.',
  },
  payu: {
    modalDesc: 'Connect PayU to generate workspace-scoped payment links and verify their status from workflow payment actions.',
    permissions: ['Create PayU payment links', 'Check payment-link status', 'Use OAuth credentials only inside this workspace'],
    credentialText: 'Use PayU Payment Links partner credentials: Merchant ID plus OAuth Client ID and Client Secret.',
  },
};

const ASSIGNMENT_EMPTY_FORM = {
  id: null,
  name: '',
  matchMode: 'all',
  field: 'contact.course',
  operator: 'equals',
  value: '',
  conditions: [{ field: 'contact.course', operator: 'equals', value: '' }],
  assignedMemberId: '',
  assignmentRole: '',
  priority: 'normal',
  tags: 'payment pending',
  notifyMessage: '',
  isActive: true,
};

const ASSIGNMENT_FIELDS = [
  { id: 'contact.course', label: 'Lead course' },
  { id: 'contact.city', label: 'Lead city' },
  { id: 'contact.location', label: 'Lead location' },
  { id: 'contact.name', label: 'Lead name' },
  { id: 'contact.email', label: 'Lead email' },
  { id: 'contact.profile', label: 'Custom profile values' },
  { id: 'message.text', label: 'Message text' },
  { id: 'contact.tags', label: 'Contact tags' },
  { id: 'contact.status', label: 'Contact status' },
  { id: 'contact.lifecycleStage', label: 'Lifecycle stage' },
  { id: 'payload.source', label: 'Payload source' },
];

const ASSIGNMENT_OPERATORS = ['contains', 'equals', 'not_equals', 'exists', 'not_exists', 'starts_with', 'ends_with'];
const ASSIGNMENT_PRIORITIES = ['normal', 'high', 'urgent', 'low'];

function settingsAuthHeaders(contentType = 'application/json') {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user?.role) headers['x-user-role'] = user.role;
  } catch (e) {
    // Ignore invalid local storage.
  }
  return headers;
}

async function settingsFetchJson(url, fallback, init = {}) {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      headers: settingsAuthHeaders(init.body instanceof FormData ? null : 'application/json'),
      ...init,
    });

    const responseText = await response.text();
    let payload = null;
    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        throw new Error(`Settings API returned an invalid response (${response.status})`);
      }
    }

    if (!response.ok) {
      const message = payload?.message || payload?.error || response.statusText || 'Request failed';
      throw new Error(`${message} (${response.status})`);
    }

    if (payload === null) {
      throw new Error(`Settings API returned an empty response (${response.status})`);
    }
    return payload;
  } catch (error) {
    console.error(`[Settings] Request failed for ${url}:`, error);
    throw error;
  }
}

function statusTone(status) {
  if (['healthy', 'success', 'completed', 'connected', 'ready', true].includes(status)) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  }
  if (['critical', 'failed', 'invalid_signature', 'expired', false].includes(status)) {
    return 'bg-rose-50 text-rose-700 border-rose-100';
  }
  if (['warning', 'pending', 'processing', 'retry_pending', 'no_account'].includes(status)) {
    return 'bg-amber-50 text-amber-700 border-amber-100';
  }
  return 'bg-gray-100 text-gray-600 border-gray-100';
}

function formatSettingsDate(value) {
  if (!value) return '--';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function normalizeAssignmentMembers(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.data || payload?.items || payload?.members || payload?.results || [];
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => ({
    id: String(row.id || row._id || ''),
    name: row.name || row.fullName || row.memberName || [row.firstname, row.lastname].filter(Boolean).join(' ') || row.user?.name || null,
    email: row.email || row.user?.email || null,
    status: row.status || null,
    roleName: row.roleName || row.workspaceRoleName || row.workspace_role_name || row.role || row.role?.name || row.primaryRole?.name || null,
    roleKey: row.roleKey || row.workspaceRoleKey || row.role_key || row.workspace_role_key || row.role?.key || null,
  })).filter((row) => row.id);
}

function normalizeAssignmentRules(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.data || payload?.items || payload?.rules || [];
  if (!Array.isArray(rows)) return [];
  return rows.filter((rule) => (rule.actionType || rule.action_type || rule.actions?.[0]?.type) === 'assign_agent').map((rule) => {
    const actionConfig = rule.action_config || rule.actionConfig || {};
    const firstCondition = rule.conditions?.[0] || {};
    const assignAction = (rule.actions || []).find((action) => action.type === 'assign_agent')?.config || {};
    return {
      id: String(rule.id),
      name: rule.name || 'Untitled rule',
      description: rule.description || 'Conversation assignment rule',
      eventType: rule.eventType || rule.event_type || rule.trigger || 'incoming_whatsapp',
      matchMode: rule.matchMode || 'all',
      field: (rule.event_type || rule.eventType) === 'course_equals'
        ? 'contact.course'
        : (firstCondition.field || rule.field || 'message.text'),
      operator: firstCondition.operator || rule.operator || 'contains',
      value: firstCondition.value || rule.match_value || '',
      conditions: Array.isArray(actionConfig.conditions) && actionConfig.conditions.length
        ? actionConfig.conditions.map((condition) => ({
          field: condition.field || 'contact.course',
          operator: condition.operator || 'equals',
          value: condition.value || '',
        }))
        : [{
          field: (rule.event_type || rule.eventType) === 'course_equals' ? 'contact.course' : (firstCondition.field || rule.field || 'message.text'),
          operator: firstCondition.operator || rule.operator || 'contains',
          value: firstCondition.value || rule.match_value || '',
        }],
      actionType: rule.actionType || rule.action_type || 'assign_agent',
      actionConfig,
      assignedMemberId: String(assignAction.memberId || actionConfig.memberId || actionConfig.assignedMemberId || ''),
      assignmentRole: assignAction.assignmentRole || actionConfig.assignmentRole || actionConfig.assignment_role || actionConfig.role || '',
      priority: actionConfig.priority || 'normal',
      tags: Array.isArray(actionConfig.tags) ? actionConfig.tags.join(', ') : actionConfig.tags || actionConfig.tag || '',
      notifyMessage: actionConfig.message || '',
      isActive: Boolean(rule.isActive ?? rule.is_active),
      lastRunAt: rule.lastRunAt || rule.last_run_at || null,
      updatedAt: rule.updatedAt || rule.updated_at || rule.created_at,
    };
  });
}

function assignmentBodyFromForm(form) {
  const tags = form.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  const conditions = (form.conditions || [{ field: form.field, operator: form.operator, value: form.value }])
    .map((condition) => ({
      field: condition.field,
      operator: condition.operator,
      value: condition.value,
    }))
    .filter((condition) => condition.field && (['exists', 'not_exists'].includes(condition.operator) || String(condition.value || '').trim()));
  const isLegacyCourseRule = conditions.length === 1 && conditions[0].field === 'contact.course' && conditions[0].operator === 'equals';
  return {
    name: form.name.trim(),
    description: 'Conversation assignment rule',
    event_type: isLegacyCourseRule ? 'course_equals' : 'lead_matches',
    match_value: isLegacyCourseRule ? conditions[0].value.trim() : '',
    action_type: 'assign_agent',
    action_config: {
      memberId: form.assignedMemberId || null,
      assignedMemberId: form.assignedMemberId || null,
      assignmentRole: form.assignmentRole || null,
      priority: form.priority,
      tags,
      message: form.notifyMessage.trim(),
      matchMode: form.matchMode,
      field: conditions[0]?.field || form.field,
      operator: conditions[0]?.operator || form.operator,
      conditions,
      course: isLegacyCourseRule ? conditions[0].value.trim() : undefined,
    },
    is_active: form.isActive,
  };
}

function memberLabel(member) {
  if (!member) return 'First available agent';
  return member.name || member.email || 'Workspace member';
}

const INTEGRATIONS_LIST = [
  // ─── Channels ────────────────────────────────────────────────────
  {
    id: 'whatsapp', category: 'channels', name: 'WhatsApp',
    logo: ICONS.whatsapp,
    description: 'Official Meta Cloud API for WhatsApp Business messaging — send templates, media & interactive messages.',
    accentColor: '#25D366',
    fields: [],  // handled by custom renderer
  },
  {
    id: 'telegram', category: 'channels', name: 'Telegram',
    logo: ICONS.telegram,
    description: 'Connect support bots via BotFather to handle Telegram inquiries at scale.',
    accentColor: '#26A5E4',
    fields: [],  // handled by custom renderer
  },
  {
    id: 'instagram', category: 'channels', name: 'Instagram',
    logo: ICONS.instagram,
    description: 'Manage Instagram Direct Messages, auto-replies, and comment-to-DM automations through the Meta Graph API.',
    accentColor: '#E4405F',
    docsUrl: 'https://developers.facebook.com/docs/instagram-api/overview',
    fields: [],  // handled by custom renderer
  },
  {
    id: 'email', category: 'channels', name: 'Business Email (IMAP/SMTP)',
    logo: ICONS.gmail,
    description: 'Sync a shared GSuite or Outlook inbox so all team email lands directly in your conversation feed.',
    accentColor: '#EA4335',
    docsUrl: 'https://support.google.com/mail/answer/7126229',
    fields: [],
  },
  {
    id: 'firebase-cloud-messaging', category: 'push', name: 'Firebase Cloud Messaging',
    logoFallback: 'FCM',
    description: 'Send push notifications through Firebase Cloud Messaging.',
    accentColor: '#FFCA28',
    docsUrl: 'https://firebase.google.com/docs/cloud-messaging',
    fields: [
      { label: 'Project ID', key: 'project_id', placeholder: 'firebase-project-id', hint: 'Firebase Console -> Project settings' },
      { label: 'Server Key / Service Account JSON', key: 'server_key', placeholder: 'Paste server key or service account JSON', hint: 'Use a restricted service account where possible', type: 'password' },
    ],
  },
  {
    id: 'onesignal', category: 'push', name: 'OneSignal',
    logoFallback: 'OS',
    description: 'Send push notifications to app users through OneSignal.',
    accentColor: '#E54B4D',
    docsUrl: 'https://documentation.onesignal.com/reference/rest-api-overview',
    fields: [
      { label: 'App ID', key: 'app_id', placeholder: 'OneSignal App ID', hint: 'OneSignal Dashboard -> Settings -> Keys & IDs' },
      { label: 'REST API Key', key: 'rest_api_key', placeholder: 'Paste REST API key', hint: 'Keep this key server-side only', type: 'password' },
    ],
  },
  {
    id: 'slack', category: 'channels', name: 'Slack',
    logo: ICONS.slack, isUpcoming: true,
    description: 'Forward conversations and alerts to Slack channels, and reply directly from your Slack workspace.',
    accentColor: '#4A154B',
    docsUrl: 'https://api.slack.com/apps',
    fields: [
      { label: 'Bot User OAuth Token', key: 'bot_token', placeholder: 'xoxb-...', hint: 'From Slack App → OAuth & Permissions → Bot Token', type: 'password' },
      { label: 'Signing Secret', key: 'signing_secret', placeholder: 'abcd1234...', hint: 'From Slack App → Basic Information → App Credentials', type: 'password' },
      { label: 'Default Channel ID', key: 'channel_id', placeholder: 'C0123ABC456', hint: 'Right-click a channel → View channel details → Channel ID' },
    ],
  },

  // ─── Live Chat & Website ─────────────────────────────────────────
  {
    id: 'pulse-xolox', category: 'livechat', name: 'Pulse by XOLOX',
    logo: ICONS.xolox,
    logoFallback: '⚡',
    description: 'Embed Pulse on your website to capture live visitors, qualify leads with AI, and route hot conversations directly into your Greeto inbox in real time.',
    accentColor: '#6366f1',
    docsUrl: 'https://xolox.in/pulse',
    badge: 'Featured',
    fields: [
      { label: 'Pulse Site ID', key: 'site_id', placeholder: 'pulse_xxxxxxxxxxxx', hint: 'Generated when you create a site in your XOLOX Pulse dashboard' },
      { label: 'API Secret Key', key: 'api_secret', placeholder: '••••••••••••••••••••••••', hint: 'XOLOX Pulse → Settings → API → Copy secret key', type: 'password' },
      { label: 'Webhook Endpoint', key: 'webhook_url', placeholder: 'https://yourapp.com/webhook', hint: 'Greeto will POST live-visitor events here. Leave blank to use auto-generated URL.' },
      { label: 'Widget Theme Color', key: 'theme_color', placeholder: '#6366f1', hint: 'Hex color for the Pulse chat widget launcher button' },
      { label: 'Greeting Message', key: 'greeting', placeholder: 'Hi 👋 How can we help you today?', hint: 'First message visitors see when they open the Pulse chat widget' },
    ],
  },

  // ─── MCP Connectors ──────────────────────────────────────────────
  {
    id: 'zoho-mcp', category: 'mcp', name: 'Zoho MCP',
    logo: ICONS.zoho, isUpcoming: true,
    description: 'Model Context Protocol server for Zoho CRM — lets AI read deals, contacts and tickets in real time.',
    accentColor: '#E42527',
    docsUrl: 'https://www.zoho.com/crm/developer/docs/api/v6/',
    mcpServer: 'https://mcp.zoho.com/v1/sse',
    fields: [
      { label: 'Client ID', key: 'client_id', placeholder: '1000.XXXX...', hint: 'From Zoho API Console → Self Client or Server-based app' },
      { label: 'Client Secret', key: 'client_secret', placeholder: 'xxxxxxxx...', hint: 'Keep secret — used to exchange auth code for tokens', type: 'password' },
      { label: 'Refresh Token', key: 'refresh_token', placeholder: '1000.xxxx...yyyy', hint: 'Long-lived token — generate from Zoho OAuth Playground', type: 'password' },
      { label: 'Data Center Region', key: 'region', placeholder: 'com / eu / in / au / jp', hint: 'Must match the region where your Zoho org is hosted' },
    ],
  },
  {
    id: 'salesforce-mcp', category: 'mcp', name: 'Salesforce MCP',
    logo: ICONS.salesforce, isUpcoming: true,
    description: 'Direct LLM context mapping for Salesforce Objects — Opportunities, Cases, Contacts and custom SObjects.',
    accentColor: '#00A1E0',
    docsUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/',
    mcpServer: 'https://mcp.salesforce.com/v1/sse',
    fields: [
      { label: 'Consumer Key (Client ID)', key: 'consumer_key', placeholder: 'Paste Consumer Key', hint: 'From Setup → App Manager → Connected App → View' },
      { label: 'Consumer Secret', key: 'consumer_secret', placeholder: '••••••••', hint: 'Reveal from the Connected App detail page', type: 'password' },
      { label: 'Username', key: 'username', placeholder: 'user@org.salesforce.com', hint: 'API-enabled Salesforce user (prefer a dedicated integration user)' },
      { label: 'Security Token', key: 'security_token', placeholder: 'Append to password', hint: 'Reset from My Settings → Personal → Reset My Security Token', type: 'password' },
      { label: 'Instance / Environment URL', key: 'instance_url', placeholder: 'https://yourorg.salesforce.com', hint: 'Use login.salesforce.com for prod, test.salesforce.com for sandbox' },
    ],
  },
  {
    id: 'notion-mcp', category: 'mcp', name: 'Notion MCP',
    logo: ICONS.notion, isUpcoming: true,
    description: 'Let AI read and write to your Notion Databases — wikis, project trackers and knowledge bases.',
    accentColor: '#000000',
    docsUrl: 'https://developers.notion.com/docs/getting-started',
    mcpServer: 'https://mcp.notion.com/sse',
    fields: [
      { label: 'Internal Integration Secret', key: 'token', placeholder: 'secret_xxxxxxxxxx...', hint: 'From notion.so/my-integrations → Your Integration → Show/copy secret', type: 'password' },
      { label: 'Root Page / Database ID', key: 'page_id', placeholder: '8a2b3c4d5e6f...', hint: 'Open the page in Notion → Share → Copy link → extract the 32-char ID' },
    ],
  },
  {
    id: 'hubspot-mcp', category: 'mcp', name: 'HubSpot MCP',
    logo: ICONS.hubspot, isUpcoming: true,
    description: 'MCP bridge to HubSpot — read contacts, deals, tickets and company timelines for AI-powered context.',
    accentColor: '#FF7A59',
    docsUrl: 'https://developers.hubspot.com/docs/api/overview',
    mcpServer: 'https://mcp.hubspot.com/v1/sse',
    fields: [
      { label: 'Private App Token', key: 'token', placeholder: 'pat-eu1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', hint: 'HubSpot → Settings → Integrations → Private Apps → Create or copy token', type: 'password' },
      { label: 'Portal / Hub ID', key: 'hub_id', placeholder: '12345678', hint: 'Found in HubSpot URL: app.hubspot.com/contacts/{hub_id}/...' },
    ],
  },
  {
    id: 'linear-mcp', category: 'mcp', name: 'Linear MCP',
    logo: ICONS.linear, isUpcoming: true,
    description: 'Surface Linear issues, projects and cycles inside conversations for instant engineering context.',
    accentColor: '#5E6AD2',
    docsUrl: 'https://developers.linear.app/docs',
    mcpServer: 'https://mcp.linear.app/sse',
    fields: [
      { label: 'API Key', key: 'api_key', placeholder: 'lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Linear → Settings → API → Personal API Keys → Create key', type: 'password' },
      { label: 'Team Key (optional)', key: 'team_key', placeholder: 'ENG', hint: 'Filter MCP context to a specific Linear team (leave blank for all teams)' },
    ],
  },
  {
    id: 'github-mcp', category: 'mcp', name: 'GitHub MCP',
    logo: ICONS.github, isUpcoming: true,
    description: 'Connect GitHub repos so AI can reference issues, PRs and commits directly in customer conversations.',
    accentColor: '#181717',
    docsUrl: 'https://docs.github.com/en/rest',
    mcpServer: 'https://api.githubcopilot.com/mcp/',
    fields: [
      { label: 'Personal Access Token (classic)', key: 'token', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic). Scopes: repo, read:org', type: 'password' },
      { label: 'Default Repository', key: 'repo', placeholder: 'owner/repository-name', hint: 'Used as fallback when no repo is detected from conversation context' },
    ],
  },
  {
    id: 'jira-mcp', category: 'mcp', name: 'Jira MCP',
    logo: ICONS.jira, isUpcoming: true,
    description: 'Pull Jira tickets, sprints and epics into AI context — link support issues to engineering backlog.',
    accentColor: '#0052CC',
    docsUrl: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
    mcpServer: 'https://mcp.atlassian.com/v1/sse',
    fields: [
      { label: 'Atlassian Email', key: 'email', placeholder: 'you@company.com', hint: 'The email linked to your Atlassian account' },
      { label: 'API Token', key: 'token', placeholder: 'ATATxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'id.atlassian.com → Security → API tokens → Create', type: 'password' },
      { label: 'Jira Cloud URL', key: 'base_url', placeholder: 'https://yourorg.atlassian.net', hint: 'Your Jira cloud instance base URL' },
      { label: 'Default Project Key', key: 'project', placeholder: 'ENG or SUPPORT', hint: 'Used as the fallback project when creating/searching issues' },
    ],
  },

  {
    id: 'xolox-mcp', category: 'mcp', name: 'XOLOX MCP',
    logo: ICONS.xolox,
    logoFallback: '⚡',
    description: 'Model Context Protocol server for XOLOX — gives AI agents real-time access to Pulse visitor sessions, lead scores, conversation history and CRM records.',
    accentColor: '#6366f1',
    docsUrl: 'https://xolox.in/developers/mcp',
    mcpServer: 'https://mcp.xolox.in/v1/sse',
    badge: 'New',
    fields: [
      { label: 'XOLOX API Key', key: 'api_key', placeholder: 'xolox_live_xxxxxxxxxxxxxxxxxxxx', hint: 'XOLOX Dashboard → Settings → Developer → API Keys → Create', type: 'password' },
      { label: 'Workspace ID', key: 'workspace_id', placeholder: 'ws_xxxxxxxxxxxxxxxx', hint: 'Found in XOLOX Dashboard URL: app.xolox.in/ws/{workspace_id}' },
      { label: 'MCP Scope', key: 'scope', placeholder: 'visitors,leads,crm', hint: 'Comma-separated scopes: visitors, leads, crm, conversations, analytics' },
    ],
  },

  // ─── CRM & Productivity ───────────────────────────────────────────
  {
    id: 'hubspot', category: 'crm', name: 'HubSpot',
    logo: ICONS.hubspot,
    description: 'Sync leads and conversation history directly into your HubSpot CRM timelines.',
    accentColor: '#FF7A59',
    docsUrl: 'https://developers.hubspot.com/docs/api/crm/contacts',
    fields: [
      { label: 'Private App Token', key: 'token', placeholder: 'pat-eu1-...', hint: 'Settings → Integrations → Private Apps → Create app token', type: 'password' },
      { label: 'Default Pipeline ID', key: 'pipeline_id', placeholder: 'default', hint: 'Pipeline where new deals are created from conversations (optional)' },
    ],
  },
  {
    id: 'zoho-crm', category: 'crm', name: 'Zoho CRM',
    logo: ICONS.zoho,
    description: 'Sync leads, contacts and activities bidirectionally between Greeto and Zoho CRM.',
    accentColor: '#E42527',
    docsUrl: 'https://www.zoho.com/crm/developer/docs/',
    fields: [
      { label: 'Client ID', key: 'client_id', placeholder: '1000.XXXX...', hint: 'Zoho API Console → Server-based App' },
      { label: 'Client Secret', key: 'client_secret', placeholder: '••••••••', type: 'password', hint: 'From the same API Console page' },
      { label: 'Refresh Token', key: 'refresh_token', placeholder: '1000.xxxx...', type: 'password', hint: 'Generate from accounts.zoho.com/oauth/playground' },
      { label: 'Region', key: 'region', placeholder: 'com / eu / in', hint: 'Must match where your Zoho account is registered' },
    ],
  },
  {
    id: 'greeto-crm', category: 'crm', name: 'Greeto CRM',
    logo: ICONS.xolox,
    description: 'Sync a shared GSuite or Outlook inbox so all team email lands directly in your conversation feed.',
    accentColor: '#EA4335',
    docsUrl: 'https://support.google.com/mail/answer/7126229',
    fields: [],
  },
  {
    id: 'firebase-cloud-messaging', category: 'push', name: 'Firebase Cloud Messaging',
    logoFallback: 'FCM',
    description: 'Send push notifications through Firebase Cloud Messaging.',
    accentColor: '#FFCA28',
    docsUrl: 'https://firebase.google.com/docs/cloud-messaging',
    fields: [
      { label: 'Project ID', key: 'project_id', placeholder: 'firebase-project-id', hint: 'Firebase Console -> Project settings' },
      { label: 'Server Key / Service Account JSON', key: 'server_key', placeholder: 'Paste server key or service account JSON', hint: 'Use a restricted service account where possible', type: 'password' },
    ],
  },
  {
    id: 'onesignal', category: 'push', name: 'OneSignal',
    logoFallback: 'OS',
    description: 'Send push notifications to app users through OneSignal.',
    accentColor: '#E54B4D',
    docsUrl: 'https://documentation.onesignal.com/reference/rest-api-overview',
    fields: [
      { label: 'App ID', key: 'app_id', placeholder: 'OneSignal App ID', hint: 'OneSignal Dashboard -> Settings -> Keys & IDs' },
      { label: 'REST API Key', key: 'rest_api_key', placeholder: 'Paste REST API key', hint: 'Keep this key server-side only', type: 'password' },
    ],
  },
  {
    id: 'slack', category: 'channels', name: 'Slack',
    logo: ICONS.slack, isUpcoming: true,
    description: 'Forward conversations and alerts to Slack channels, and reply directly from your Slack workspace.',
    accentColor: '#4A154B',
    docsUrl: 'https://api.slack.com/apps',
    fields: [
      { label: 'Bot User OAuth Token', key: 'bot_token', placeholder: 'xoxb-...', hint: 'From Slack App → OAuth & Permissions → Bot Token', type: 'password' },
      { label: 'Signing Secret', key: 'signing_secret', placeholder: 'abcd1234...', hint: 'From Slack App → Basic Information → App Credentials', type: 'password' },
      { label: 'Default Channel ID', key: 'channel_id', placeholder: 'C0123ABC456', hint: 'Right-click a channel → View channel details → Channel ID' },
    ],
  },

  // ─── Live Chat & Website ─────────────────────────────────────────
  {
    id: 'pulse-xolox', category: 'livechat', name: 'Pulse by XOLOX',
    logo: ICONS.xolox,
    logoFallback: '⚡',
    description: 'Embed Pulse on your website to capture live visitors, qualify leads with AI, and route hot conversations directly into your Greeto inbox in real time.',
    accentColor: '#6366f1',
    docsUrl: 'https://xolox.in/pulse',
    badge: 'Featured',
    fields: [
      { label: 'Pulse Site ID', key: 'site_id', placeholder: 'pulse_xxxxxxxxxxxx', hint: 'Generated when you create a site in your XOLOX Pulse dashboard' },
      { label: 'API Secret Key', key: 'api_secret', placeholder: '••••••••••••••••••••••••', hint: 'XOLOX Pulse → Settings → API → Copy secret key', type: 'password' },
      { label: 'Webhook Endpoint', key: 'webhook_url', placeholder: 'https://yourapp.com/webhook', hint: 'Greeto will POST live-visitor events here. Leave blank to use auto-generated URL.' },
      { label: 'Widget Theme Color', key: 'theme_color', placeholder: '#6366f1', hint: 'Hex color for the Pulse chat widget launcher button' },
      { label: 'Greeting Message', key: 'greeting', placeholder: 'Hi 👋 How can we help you today?', hint: 'First message visitors see when they open the Pulse chat widget' },
    ],
  },

  // ─── MCP Connectors ──────────────────────────────────────────────
  {
    id: 'zoho-mcp', category: 'mcp', name: 'Zoho MCP',
    logo: ICONS.zoho, isUpcoming: true,
    description: 'Model Context Protocol server for Zoho CRM — lets AI read deals, contacts and tickets in real time.',
    accentColor: '#E42527',
    docsUrl: 'https://www.zoho.com/crm/developer/docs/api/v6/',
    mcpServer: 'https://mcp.zoho.com/v1/sse',
    fields: [
      { label: 'Client ID', key: 'client_id', placeholder: '1000.XXXX...', hint: 'From Zoho API Console → Self Client or Server-based app' },
      { label: 'Client Secret', key: 'client_secret', placeholder: 'xxxxxxxx...', hint: 'Keep secret — used to exchange auth code for tokens', type: 'password' },
      { label: 'Refresh Token', key: 'refresh_token', placeholder: '1000.xxxx...yyyy', hint: 'Long-lived token — generate from Zoho OAuth Playground', type: 'password' },
      { label: 'Data Center Region', key: 'region', placeholder: 'com / eu / in / au / jp', hint: 'Must match the region where your Zoho org is hosted' },
    ],
  },
  {
    id: 'salesforce-mcp', category: 'mcp', name: 'Salesforce MCP',
    logo: ICONS.salesforce, isUpcoming: true,
    description: 'Direct LLM context mapping for Salesforce Objects — Opportunities, Cases, Contacts and custom SObjects.',
    accentColor: '#00A1E0',
    docsUrl: 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/',
    mcpServer: 'https://mcp.salesforce.com/v1/sse',
    fields: [
      { label: 'Consumer Key (Client ID)', key: 'consumer_key', placeholder: 'Paste Consumer Key', hint: 'From Setup → App Manager → Connected App → View' },
      { label: 'Consumer Secret', key: 'consumer_secret', placeholder: '••••••••', hint: 'Reveal from the Connected App detail page', type: 'password' },
      { label: 'Username', key: 'username', placeholder: 'user@org.salesforce.com', hint: 'API-enabled Salesforce user (prefer a dedicated integration user)' },
      { label: 'Security Token', key: 'security_token', placeholder: 'Append to password', hint: 'Reset from My Settings → Personal → Reset My Security Token', type: 'password' },
      { label: 'Instance / Environment URL', key: 'instance_url', placeholder: 'https://yourorg.salesforce.com', hint: 'Use login.salesforce.com for prod, test.salesforce.com for sandbox' },
    ],
  },
  {
    id: 'notion-mcp', category: 'mcp', name: 'Notion MCP',
    logo: ICONS.notion, isUpcoming: true,
    description: 'Let AI read and write to your Notion Databases — wikis, project trackers and knowledge bases.',
    accentColor: '#000000',
    docsUrl: 'https://developers.notion.com/docs/getting-started',
    mcpServer: 'https://mcp.notion.com/sse',
    fields: [
      { label: 'Internal Integration Secret', key: 'token', placeholder: 'secret_xxxxxxxxxx...', hint: 'From notion.so/my-integrations → Your Integration → Show/copy secret', type: 'password' },
      { label: 'Root Page / Database ID', key: 'page_id', placeholder: '8a2b3c4d5e6f...', hint: 'Open the page in Notion → Share → Copy link → extract the 32-char ID' },
    ],
  },
  {
    id: 'hubspot-mcp', category: 'mcp', name: 'HubSpot MCP',
    logo: ICONS.hubspot, isUpcoming: true,
    description: 'MCP bridge to HubSpot — read contacts, deals, tickets and company timelines for AI-powered context.',
    accentColor: '#FF7A59',
    docsUrl: 'https://developers.hubspot.com/docs/api/overview',
    mcpServer: 'https://mcp.hubspot.com/v1/sse',
    fields: [
      { label: 'Private App Token', key: 'token', placeholder: 'pat-eu1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', hint: 'HubSpot → Settings → Integrations → Private Apps → Create or copy token', type: 'password' },
      { label: 'Portal / Hub ID', key: 'hub_id', placeholder: '12345678', hint: 'Found in HubSpot URL: app.hubspot.com/contacts/{hub_id}/...' },
    ],
  },
  {
    id: 'linear-mcp', category: 'mcp', name: 'Linear MCP',
    logo: ICONS.linear, isUpcoming: true,
    description: 'Surface Linear issues, projects and cycles inside conversations for instant engineering context.',
    accentColor: '#5E6AD2',
    docsUrl: 'https://developers.linear.app/docs',
    mcpServer: 'https://mcp.linear.app/sse',
    fields: [
      { label: 'API Key', key: 'api_key', placeholder: 'lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Linear → Settings → API → Personal API Keys → Create key', type: 'password' },
      { label: 'Team Key (optional)', key: 'team_key', placeholder: 'ENG', hint: 'Filter MCP context to a specific Linear team (leave blank for all teams)' },
    ],
  },
  {
    id: 'github-mcp', category: 'mcp', name: 'GitHub MCP',
    logo: ICONS.github, isUpcoming: true,
    description: 'Connect GitHub repos so AI can reference issues, PRs and commits directly in customer conversations.',
    accentColor: '#181717',
    docsUrl: 'https://docs.github.com/en/rest',
    mcpServer: 'https://api.githubcopilot.com/mcp/',
    fields: [
      { label: 'Personal Access Token (classic)', key: 'token', placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic). Scopes: repo, read:org', type: 'password' },
      { label: 'Default Repository', key: 'repo', placeholder: 'owner/repository-name', hint: 'Used as fallback when no repo is detected from conversation context' },
    ],
  },
  {
    id: 'jira-mcp', category: 'mcp', name: 'Jira MCP',
    logo: ICONS.jira, isUpcoming: true,
    description: 'Pull Jira tickets, sprints and epics into AI context — link support issues to engineering backlog.',
    accentColor: '#0052CC',
    docsUrl: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
    mcpServer: 'https://mcp.atlassian.com/v1/sse',
    fields: [
      { label: 'Atlassian Email', key: 'email', placeholder: 'you@company.com', hint: 'The email linked to your Atlassian account' },
      { label: 'API Token', key: 'token', placeholder: 'ATATxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'id.atlassian.com → Security → API tokens → Create', type: 'password' },
      { label: 'Jira Cloud URL', key: 'base_url', placeholder: 'https://yourorg.atlassian.net', hint: 'Your Jira cloud instance base URL' },
      { label: 'Default Project Key', key: 'project', placeholder: 'ENG or SUPPORT', hint: 'Used as the fallback project when creating/searching issues' },
    ],
  },

  {
    id: 'xolox-mcp', category: 'mcp', name: 'XOLOX MCP',
    logo: ICONS.xolox,
    logoFallback: '⚡',
    description: 'Model Context Protocol server for XOLOX — gives AI agents real-time access to Pulse visitor sessions, lead scores, conversation history and CRM records.',
    accentColor: '#6366f1',
    docsUrl: 'https://xolox.in/developers/mcp',
    mcpServer: 'https://mcp.xolox.in/v1/sse',
    badge: 'New',
    fields: [
      { label: 'XOLOX API Key', key: 'api_key', placeholder: 'xolox_live_xxxxxxxxxxxxxxxxxxxx', hint: 'XOLOX Dashboard → Settings → Developer → API Keys → Create', type: 'password' },
      { label: 'Workspace ID', key: 'workspace_id', placeholder: 'ws_xxxxxxxxxxxxxxxx', hint: 'Found in XOLOX Dashboard URL: app.xolox.in/ws/{workspace_id}' },
      { label: 'MCP Scope', key: 'scope', placeholder: 'visitors,leads,crm', hint: 'Comma-separated scopes: visitors, leads, crm, conversations, analytics' },
    ],
  },

  // ─── CRM & Productivity ───────────────────────────────────────────
  {
    id: 'hubspot', category: 'crm', name: 'HubSpot',
    logo: ICONS.hubspot,
    description: 'Sync leads and conversation history directly into your HubSpot CRM timelines.',
    accentColor: '#FF7A59',
    docsUrl: 'https://developers.hubspot.com/docs/api/crm/contacts',
    fields: [
      { label: 'Private App Token', key: 'token', placeholder: 'pat-eu1-...', hint: 'Settings → Integrations → Private Apps → Create app token', type: 'password' },
      { label: 'Default Pipeline ID', key: 'pipeline_id', placeholder: 'default', hint: 'Pipeline where new deals are created from conversations (optional)' },
    ],
  },
  {
    id: 'zoho-crm', category: 'crm', name: 'Zoho CRM',
    logo: ICONS.zoho,
    description: 'Sync leads, contacts and activities bidirectionally between Greeto and Zoho CRM.',
    accentColor: '#E42527',
    docsUrl: 'https://www.zoho.com/crm/developer/docs/',
    fields: [
      { label: 'Client ID', key: 'client_id', placeholder: '1000.XXXX...', hint: 'Zoho API Console → Server-based App' },
      { label: 'Client Secret', key: 'client_secret', placeholder: '••••••••', type: 'password', hint: 'From the same API Console page' },
      { label: 'Refresh Token', key: 'refresh_token', placeholder: '1000.xxxx...', type: 'password', hint: 'Generate from accounts.zoho.com/oauth/playground' },
      { label: 'Region', key: 'region', placeholder: 'com / eu / in', hint: 'Must match where your Zoho account is registered' },
    ],
  },
  {
    id: 'greeto-crm', category: 'crm', name: 'Greeto CRM',
    logo: ICONS.xolox,
    logoFallback: 'G',
    description: 'Use Greeto contacts as the internal CRM action target for workflows and conversation updates.',
    accentColor: '#8b5cf6',
    badge: 'Internal',
    fields: [
      { label: 'Default Owner ID', key: 'default_owner_id', placeholder: 'Optional team user ID', hint: 'Used when workflows create contacts without a selected owner (optional)' },
      { label: 'Default Pipeline', key: 'pipeline_id', placeholder: 'default', hint: 'Internal pipeline key for CRM actions (optional)' },
    ],
  },
  {
    id: 'xolox-crm', category: 'crm', name: 'XOLOX CRM',
    logo: ICONS.xolox,
    logoFallback: '⚡',
    description: 'Native two-way sync with XOLOX CRM — auto-create contacts from conversations, push deal stages, and pull visitor intelligence directly into your Greeto inbox.',
    accentColor: '#6366f1',
    docsUrl: 'https://xolox.in/developers/crm-api',
    badge: 'New',
    fields: [
      { label: 'Base URL', key: 'base_url', placeholder: 'https://api.starforze.com/api', hint: 'Required API base URL for this workspace\'s XOLOX/Starforze instance. The auth token is obtained automatically when a team member logs in via XOLOX.' },
    ],

  },
  {
    id: 'google-sheets', category: 'crm', name: 'Google Sheets',
    logo: ICONS.googlesheets,
    description: 'Export new leads, conversations and tags directly to a Google Sheet for reporting.',
    accentColor: '#34A853',
    docsUrl: 'https://developers.google.com/sheets/api/guides/concepts',
    fields: [
      { label: 'Service Account JSON Key', key: 'sa_json', placeholder: 'Paste full JSON contents...', hint: 'GCP Console → IAM → Service Accounts → Create key (JSON). Share the sheet with the service account email.' },
      { label: 'Spreadsheet ID', key: 'sheet_id', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms', hint: 'Extract from the Google Sheets URL between /d/ and /edit' },
      { label: 'Sheet / Tab Name', key: 'tab_name', placeholder: 'Lead Data', hint: 'The exact name of the worksheet tab to write to' },
    ],
  },

  // ─── Payments ─────────────────────────────────────────────────────
  {
    id: 'razorpay', category: 'payments', name: 'Razorpay',
    logo: ICONS.razorpay,
    description: 'Accept payments, send payment links via WhatsApp, and auto-sync order status to conversations.',
    accentColor: '#02042B',
    docsUrl: 'https://razorpay.com/docs/api/',
    fields: [
      { label: 'Key ID', key: 'key_id', placeholder: 'rzp_live_xxxxxxxxxxxxxxxxxx', hint: 'Dashboard → Settings → API Keys → Generate live key' },
      { label: 'Key Secret', key: 'key_secret', placeholder: '••••••••••••••••••••••••', hint: 'Copy immediately — Razorpay only shows it once', type: 'password' },
      { label: 'Webhook Secret', key: 'webhook_secret', placeholder: 'whsec_...', hint: 'Dashboard → Settings → Webhooks → Add new endpoint → copy secret', type: 'password' },
    ],
  },
  {
    id: 'stripe', category: 'payments', name: 'Stripe',
    logo: ICONS.stripe,
    description: 'Global payment infrastructure — send payment links and track invoice status within conversations.',
    accentColor: '#635BFF',
    docsUrl: 'https://stripe.com/docs/api',
    fields: [
      { label: 'Secret Key', key: 'secret_key', placeholder: 'sk_live_...', hint: 'Dashboard → Developers → API keys → Secret key (use restricted key for least privilege)', type: 'password' },
      { label: 'Webhook Signing Secret', key: 'webhook_secret', placeholder: 'whsec_...', hint: 'Stripe → Webhooks → Add endpoint → Signing secret', type: 'password' },
      { label: 'Publishable Key', key: 'publishable_key', placeholder: 'pk_live_...', hint: 'Safe to expose client-side — used for Stripe.js' },
    ],
  },
  {
    id: 'cashfree', category: 'payments', name: 'Cashfree',
    logo: ICONS.cashfree,
    description: 'Payment gateway and payout automation for Indian merchants.',
    accentColor: '#1D8348',
    docsUrl: 'https://docs.cashfree.com/docs/',
    fields: [
      { label: 'App ID', key: 'app_id', placeholder: 'CF_APP_ID', hint: 'Cashfree Dashboard → Settings → Credentials' },
      { label: 'Secret Key', key: 'secret_key', placeholder: '••••••••', hint: 'Production secret from the same credentials page', type: 'password' },
      { label: 'Environment', key: 'env', placeholder: 'PROD / TEST', hint: 'Use TEST for sandbox, PROD for live transactions' },
    ],
  },
  {
    id: 'payu', category: 'payments', name: 'PayU',
    logo: ICONS.payu,
    description: 'Create payment links and fetch payment status through PayU.',
    accentColor: '#6F2DBD',
    docsUrl: 'https://docs.payu.in/',
    fields: [
      { label: 'Merchant ID', key: 'merchant_id', placeholder: 'PayU merchant ID', hint: 'PayU Dashboard -> Payment Links / Merchant profile' },
      { label: 'Client ID', key: 'client_id', placeholder: 'PayU OAuth client ID', hint: 'PayU Dashboard -> Developer credentials' },
      { label: 'Client Secret', key: 'client_secret', placeholder: 'Paste OAuth client secret', hint: 'Used only server-side to request PayU payment-link access tokens', type: 'password' },
      { label: 'Environment', key: 'environment', placeholder: 'test / live', hint: 'Use test for UAT, live for production transactions' },
    ],
  },

  // ─── VoIP & Calling ───────────────────────────────────────────────
  {
    id: 'twilio', category: 'voip', name: 'Twilio',
    logo: ICONS.twilio,
    description: 'SMS, Voice and WhatsApp communication — click-to-call, bulk SMS and call recording synced to conversations.',
    accentColor: '#F22F46',
    docsUrl: 'https://www.twilio.com/docs',
    fields: [],
  },
  {
    id: 'exotel', category: 'voip', name: 'Exotel',
    logo: ICONS.exotel,
    description: 'Cloud telephony for India — IVR, click-to-call and call recording synced to conversation history.',
    accentColor: '#E56000',
    docsUrl: 'https://developer.exotel.com/api/',
    fields: [
      { label: 'SID (Account ID)', key: 'sid', placeholder: 'exotel_sid', hint: 'Exotel Dashboard → Settings → API Credentials' },
      { label: 'API Key', key: 'api_key', placeholder: 'xxxxxxxx', hint: 'From the same API Credentials page' },
      { label: 'API Token', key: 'api_token', placeholder: '••••••••', hint: 'Token paired with the API Key above', type: 'password' },
      { label: 'Subdomain', key: 'subdomain', placeholder: '@api.exotel.com', hint: 'Your Exotel account subdomain (e.g. mycompany@api.in.exotel.com)' },
    ],
  },
  {
    id: 'airtel', category: 'voip', name: 'Airtel IQ',
    logo: ICONS.airtel, isUpcoming: true,
    description: 'Enterprise cloud calling and verified SMS via Airtel IQ API.',
    accentColor: '#E40000',
    docsUrl: 'https://developers.airtel.in/',
    fields: [
      { label: 'Client ID', key: 'client_id', placeholder: 'Enter Airtel Client ID', hint: 'Airtel Developer Console → My Applications → Client ID' },
      { label: 'Client Secret', key: 'client_secret', placeholder: '••••••••', hint: 'Paired secret for OAuth token generation', type: 'password' },
      { label: 'DID Number', key: 'did', placeholder: '+91XXXXXXXXXX', hint: 'Your Airtel IQ virtual number in E.164 format' },
    ],
  },

  // ─── AI Providers ─────────────────────────────────────────────────
  {
    id: 'voice-ai-calls', category: 'voip', name: 'Voice & AI Calls',
    logoFallback: 'AI',
    description: 'Enable AI-powered voice calls and automated IVR flows for lead qualification and routing.',
    accentColor: '#8b5cf6',
    badge: 'New',
    fields: [
      { label: 'Provider', key: 'provider', placeholder: 'twilio / exotel / custom', hint: 'Underlying voice provider used for AI calls' },
      { label: 'Webhook URL', key: 'webhook_url', placeholder: 'https://your-voice-agent/webhook', hint: 'AI voice agent callback endpoint' },
      { label: 'API Key', key: 'api_key', placeholder: 'Paste provider API key', hint: 'Key used by the voice automation service', type: 'password' },
      { label: 'Default Caller ID', key: 'caller_id', placeholder: '+91XXXXXXXXXX', hint: 'Verified outbound caller ID' },
    ],
  },

  {
    id: 'openai', category: 'ai', name: 'OpenAI',
    logo: ICONS.openai,
    description: 'Power AI-assisted replies, summarisation and classification with GPT-4o and embedding models.',
    accentColor: '#412991',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    fields: [
      { label: 'API Key', key: 'api_key', placeholder: 'sk-proj-...', hint: 'platform.openai.com → API keys → Create new secret key', type: 'password' },
      { label: 'Organization ID', key: 'org_id', placeholder: 'org-xxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Optional — needed if your key belongs to multiple orgs' },
      { label: 'Default Model', key: 'model', placeholder: 'gpt-4o', hint: 'e.g. gpt-4o, gpt-4o-mini — affects cost and quality' },
    ],
  },
  {
    id: 'anthropic', category: 'ai', name: 'Anthropic / Claude',
    logo: ICONS.anthropic, isUpcoming: true,
    description: 'Use Claude models for nuanced, long-context AI assistance within conversations.',
    accentColor: '#191919',
    docsUrl: 'https://docs.anthropic.com/en/api/getting-started',
    fields: [
      { label: 'API Key', key: 'api_key', placeholder: 'sk-ant-api03-...', hint: 'console.anthropic.com → Settings → API Keys → Create Key', type: 'password' },
      { label: 'Default Model', key: 'model', placeholder: 'claude-sonnet-4-6', hint: 'e.g. claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5' },
    ],
  },

  // ─── Channels (additional) ─────────────────────────────────────────
  {
    id: 'messenger', category: 'channels', name: 'Facebook Messenger',
    logo: ICONS.messenger,
    description: 'Reply to Facebook Messenger conversations from the same inbox as WhatsApp and Instagram.',
    accentColor: '#00B2FF',
    docsUrl: 'https://developers.facebook.com/docs/messenger-platform',
    fields: [
      { label: 'Page ID', key: 'page_id', placeholder: '1234567890', hint: 'Facebook Page → About → Page ID' },
      { label: 'Page Access Token', key: 'page_token', placeholder: 'EAAG...', hint: 'Meta for Developers → Your App → Messenger → Access Tokens', type: 'password' },
      { label: 'Meta App Secret', key: 'app_secret', placeholder: 'App secret', hint: 'Meta for Developers → App Settings → Basic', type: 'password' },
      { label: 'Webhook Verify Token', key: 'verify_token', placeholder: 'Create a strong private token', hint: 'Use this same value while configuring the Meta webhook', type: 'password' },
    ],
  },
  {
    id: 'facebook-page', category: 'channels', name: 'Facebook Page',
    logo: ICONS.facebook, isUpcoming: true,
    description: 'Turn public comments on your Facebook Page posts and ads into private DM conversations automatically.',
    accentColor: '#1877F2',
    docsUrl: 'https://developers.facebook.com/docs/graph-api/webhooks/reference/page',
    fields: [
      { label: 'Page Access Token', key: 'page_token', placeholder: 'EAAG...', hint: 'Meta for Developers → Your App → Page Access Tokens', type: 'password' },
      { label: 'Page ID', key: 'page_id', placeholder: '1234567890', hint: 'Facebook Page → About → Page ID' },
    ],
  },
  {
    id: 'livechat-widget', category: 'livechat', name: 'Live Chat',
    logoFallback: '💬', isUpcoming: true,
    description: 'Embed a lightweight live chat widget on your website that lands directly in this inbox.',
    accentColor: '#7c3aed',
    docsUrl: '',
    fields: [
      { label: 'Widget Domain', key: 'domain', placeholder: 'yourbusiness.com', hint: 'Domain where the chat widget script will be embedded' },
      { label: 'Widget Theme Color', key: 'theme_color', placeholder: '#7c3aed', hint: 'Hex color for the chat launcher button' },
    ],
  },
  {
    id: 'fast2sms', category: 'channels', name: 'Fast2SMS',
    logo: ICONS.fast2sms,
    description: 'Send transactional and promotional SMS in India via the Fast2SMS API.',
    accentColor: '#F97316',
    docsUrl: 'https://docs.fast2sms.com/',
    fields: [
      { label: 'API Key', key: 'api_key', placeholder: 'Paste Fast2SMS API key', hint: 'Fast2SMS Dashboard → Dev API → API Key', type: 'password' },
      { label: 'Sender ID', key: 'sender_id', placeholder: 'FSTSMS', hint: 'Optional approved DLT sender ID; OTP route does not require it' },
    ],
  },
  {
    id: 'plivo', category: 'channels', name: 'Plivo',
    logo: ICONS.plivo, isUpcoming: true,
    description: 'Global SMS and voice API — an alternative to Twilio/Exotel for outbound messaging and calls.',
    accentColor: '#E2202D',
    docsUrl: 'https://www.plivo.com/docs/',
    fields: [
      { label: 'Auth ID', key: 'auth_id', placeholder: 'MAXXXXXXXXXXXXXXXXXX', hint: 'Plivo Console → Overview → Auth ID' },
      { label: 'Auth Token', key: 'auth_token', placeholder: '••••••••', hint: 'Plivo Console → Overview → Auth Token', type: 'password' },
      { label: 'Plivo Number', key: 'phone_number', placeholder: '+91XXXXXXXXXX', hint: 'A number purchased in your Plivo account' },
    ],
  },
  {
    id: 'mailchimp', category: 'channels', name: 'Mailchimp',
    logo: ICONS.mailchimp,
    description: 'Connect your Mailchimp Marketing API for workspace audiences and campaign automation.',
    accentColor: '#FFE01B',
    docsUrl: 'https://mailchimp.com/developer/marketing/api/',
    fields: [
      { label: 'API Key', key: 'api_key', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx-us21', hint: 'Mailchimp → Account → Extras → API keys', type: 'password' },
      { label: 'Server Prefix', key: 'server_prefix', placeholder: 'us21', hint: 'Optional. The suffix of your API key after the dash is used automatically.' },
    ],
  },
  {
    id: 'zeptomail', category: 'channels', name: 'Zeptomail',
    logo: ICONS.zeptomail,
    description: 'Zoho’s transactional email API for reliable delivery of receipts, OTPs and notifications.',
    accentColor: '#C13A2E',
    docsUrl: 'https://www.zoho.com/zeptomail/help/api/',
    fields: [
      { label: 'Send Mail Token', key: 'token', placeholder: 'Zoho-enczapikey ...', hint: 'Zeptomail → Mail Agents → Send Mail Token', type: 'password' },
      { label: 'From Address', key: 'from_address', placeholder: 'noreply@yourdomain.com', hint: 'Verified sender address in Zeptomail' },
    ],
  },
  {
    id: 'mailgun', category: 'channels', name: 'Mailgun',
    logo: ICONS.mailgun,
    description: 'Use your verified Mailgun domain as this workspace\'s default automated email sender, with delivery tooling and analytics.',
    accentColor: '#C02127',
    docsUrl: 'https://documentation.mailgun.com/en/latest/api_reference.html',
    fields: [
      { label: 'API Key', key: 'api_key', placeholder: 'key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Mailgun → Settings → API Keys → Private API key', type: 'password' },
      { label: 'Domain', key: 'domain', placeholder: 'mg.yourdomain.com', hint: 'Verified sending domain in Mailgun' },
      { label: 'From Address', key: 'from_address', placeholder: 'hello@mg.yourdomain.com', hint: 'A verified sender address on the Mailgun domain' },
      { label: 'Display Name', key: 'display_name', placeholder: 'Your company', hint: 'Optional name shown to recipients' },
      { label: 'Region', key: 'region', type: 'select', options: [{ value: 'us', label: 'US (api.mailgun.net)' }, { value: 'eu', label: 'EU (api.eu.mailgun.net)' }], hint: 'Choose the Mailgun account region. US is the default.' },
      { label: 'API Base URL', key: 'api_base_url', placeholder: 'https://api.mailgun.net', hint: 'Optional. Leave blank for the selected region default.' },
    ],
  },
  {
    id: 'sendgrid', category: 'channels', name: 'SendGrid',
    logo: ICONS.sendgrid,
    description: 'Use your verified SendGrid sender for workspace transactional email and workflow delivery.',
    accentColor: '#51A9DD',
    docsUrl: 'https://www.twilio.com/docs/sendgrid/api-reference',
    fields: [
      { label: 'API Key', key: 'api_key', placeholder: 'SG.xxxxxxxxxxxxxxxxxxxxxx', hint: 'SendGrid → Settings → API Keys → Create API Key', type: 'password' },
      { label: 'From Address', key: 'from_address', placeholder: 'noreply@yourdomain.com', hint: 'Verified sender identity in SendGrid' },
      { label: 'Display Name', key: 'display_name', placeholder: 'Your company', hint: 'Optional sender name shown to recipients' },
    ],
  },
  {
    id: 'aws-ses', category: 'channels', name: 'AWS SES',
    logo: ICONS.awsses,
    description: 'Use your workspace AWS SES sender for high-volume transactional and workflow email delivery.',
    accentColor: '#FF9900',
    docsUrl: 'https://docs.aws.amazon.com/ses/latest/APIReference-V2/Welcome.html',
    fields: [
      { label: 'Access Key ID', key: 'access_key_id', placeholder: 'AKIAXXXXXXXXXXXXXXXX', hint: 'IAM user with SES send permissions' },
      { label: 'Secret Access Key', key: 'secret_access_key', placeholder: '••••••••', hint: 'Paired secret for the access key', type: 'password' },
      { label: 'AWS Region', key: 'region', placeholder: 'ap-south-1', hint: 'Region where your SES sending identity is verified' },
      { label: 'From Address', key: 'from_address', placeholder: 'noreply@yourdomain.com', hint: 'Verified email identity in this AWS SES region' },
      { label: 'Display Name', key: 'display_name', placeholder: 'Your company', hint: 'Optional sender name shown to recipients' },
      { label: 'Session Token', key: 'session_token', placeholder: 'Optional AWS STS session token', hint: 'Only required when using temporary IAM credentials', type: 'password' },
    ],
  },
  {
    id: 'zoho-mail', category: 'channels', name: 'Zoho Mail',
    logo: ICONS.zohomail, isUpcoming: true,
    description: 'Sync a Zoho Workplace mailbox directly into your conversation feed.',
    accentColor: '#C13A2E',
    docsUrl: 'https://www.zoho.com/mail/help/imap-access.html',
    fields: [
      { label: 'Email Address', key: 'email_address', placeholder: 'support@yourdomain.com', hint: 'Zoho Mail address to sync' },
      { label: 'App Password', key: 'app_password', placeholder: '••••••••', hint: 'Zoho Mail → Security → App Passwords → Generate', type: 'password' },
    ],
  },

  // ─── VoIP (additional) ──────────────────────────────────────────────
  {
    id: 'knowlarity', category: 'voip', name: 'Knowlarity',
    logo: ICONS.knowlarity, isUpcoming: true,
    description: 'Cloud telephony with IVR and click-to-call, synced to conversation history.',
    accentColor: '#F26522',
    docsUrl: 'https://developer.knowlarity.com/',
    fields: [
      { label: 'API Key', key: 'api_key', placeholder: 'Paste Knowlarity API key', hint: 'Knowlarity Dashboard → Developer → API Key', type: 'password' },
      { label: 'Channel/Caller ID', key: 'caller_id', placeholder: '+91XXXXXXXXXX', hint: 'Your Knowlarity virtual number' },
    ],
  },
  {
    id: 'ozonetel', category: 'voip', name: 'Ozonetel',
    logo: ICONS.ozonetel, isUpcoming: true,
    description: 'Cloud contact-center telephony — click-to-call and call recordings synced to conversations.',
    accentColor: '#0A4B78',
    docsUrl: 'https://www.ozonetel.com/developers/',
    fields: [
      { label: 'API Key', key: 'api_key', placeholder: 'Paste Ozonetel API key', hint: 'Ozonetel Dashboard → API Credentials', type: 'password' },
      { label: 'Agent/DID Number', key: 'did', placeholder: '+91XXXXXXXXXX', hint: 'Your Ozonetel virtual number' },
    ],
  },
  {
    id: 'zoom', category: 'voip', name: 'Zoom',
    logo: ICONS.zoom,
    description: 'Server-to-Server OAuth connection to Zoom for scheduling and verifying meetings from conversations and workflows.',
    accentColor: '#2D8CFF',
    docsUrl: 'https://developers.zoom.us/docs/internal-apps/s2s-oauth/',
    fields: [
      { label: 'Account ID', key: 'account_id', placeholder: 'Paste Zoom Account ID', hint: 'Zoom App Marketplace → Your Server-to-Server OAuth App → Account ID' },
      { label: 'Client ID', key: 'client_id', placeholder: 'Paste Zoom Client ID', hint: 'Same app → App Credentials → Client ID' },
      { label: 'Client Secret', key: 'client_secret', placeholder: '••••••••', hint: 'Same app → App Credentials → Client Secret', type: 'password' },
      { label: 'Webhook Secret Token', key: 'webhook_secret_token', placeholder: 'Paste Zoom webhook secret token', hint: 'Zoom App Marketplace -> Feature -> Event Subscriptions -> Secret Token', type: 'password' },
    ],
  },

  // ─── CRM (additional) ───────────────────────────────────────────────
  {
    id: 'kylas', category: 'crm', name: 'Kylas CRM',
    logo: ICONS.kylas,
    description: 'Kylas already sends lead/deal webhooks into your workflows — no credentials needed, just paste the webhook URL below into Kylas.',
    accentColor: '#6C5CE7',
    docsUrl: 'https://developer.kylas.io/',
    fields: [],
  },

  // ─── Commerce ───────────────────────────────────────────────────────
  {
    id: 'shopify', category: 'commerce', name: 'Shopify',
    logo: ICONS.shopify,
    description: 'Shopify already sends order/customer webhooks into your workflows — no credentials needed, just paste the webhook URL below into your Shopify admin.',
    accentColor: '#7AB55C',
    docsUrl: 'https://shopify.dev/docs/apps/build/webhooks',
    fields: [],
  },

  // ─── Calendar & Scheduling ──────────────────────────────────────────
  {
    id: 'google-calendar', category: 'calendar', name: 'Google Calendar',
    logo: ICONS.googlecalendar, isUpcoming: true,
    description: 'Create and check calendar events from conversations — book demos and follow-ups without leaving the inbox.',
    accentColor: '#4285F4',
    docsUrl: 'https://developers.google.com/calendar/api/guides/overview',
    fields: [
      { label: 'Service Account JSON Key', key: 'sa_json', placeholder: 'Paste full JSON contents...', hint: 'GCP Console → IAM → Service Accounts → Create key (JSON)' },
      { label: 'Calendar ID', key: 'calendar_id', placeholder: 'yourteam@group.calendar.google.com', hint: 'Google Calendar → Settings → Integrate calendar → Calendar ID' },
    ],
  },
  {
    id: 'calendly', category: 'calendar', name: 'Calendly',
    logo: ICONS.calendly, isUpcoming: true,
    description: 'Share Calendly booking links in conversations and auto-log booked meetings.',
    accentColor: '#006BFF',
    docsUrl: 'https://developer.calendly.com/',
    fields: [
      { label: 'Personal Access Token', key: 'token', placeholder: 'eyJraWQ...', hint: 'Calendly → Integrations & API → API & Webhooks → Get a token', type: 'password' },
    ],
  },

  // ─── Support & Helpdesk ─────────────────────────────────────────────
  {
    id: 'zendesk', category: 'support', name: 'Zendesk',
    logo: ICONS.zendesk, isUpcoming: true,
    description: 'Create and sync Zendesk tickets from conversations for escalations that need helpdesk tracking.',
    accentColor: '#03363D',
    docsUrl: 'https://developer.zendesk.com/api-reference/',
    fields: [
      { label: 'Subdomain', key: 'subdomain', placeholder: 'yourcompany', hint: 'From yourcompany.zendesk.com' },
      { label: 'API Token', key: 'api_token', placeholder: '••••••••', hint: 'Zendesk Admin → Apps and integrations → APIs → Add API token', type: 'password' },
      { label: 'Agent Email', key: 'email', placeholder: 'agent@yourcompany.com', hint: 'Email of the agent account used for API auth' },
    ],
  },
  {
    id: 'freshdesk', category: 'support', name: 'Freshdesk',
    logo: ICONS.freshdesk, isUpcoming: true,
    description: 'Create and track Freshdesk tickets directly from conversations.',
    accentColor: '#25C16F',
    docsUrl: 'https://developers.freshdesk.com/api/',
    fields: [
      { label: 'Domain', key: 'domain', placeholder: 'yourcompany.freshdesk.com', hint: 'Your Freshdesk portal domain' },
      { label: 'API Key', key: 'api_key', placeholder: '••••••••', hint: 'Freshdesk → Profile Settings → API Key', type: 'password' },
    ],
  },

  // ─── Accounting ─────────────────────────────────────────────────────
  {
    id: 'zoho-books', category: 'accounting', name: 'Zoho Books',
    logo: ICONS.zohobooks, isUpcoming: true,
    description: 'Auto-generate invoices in Zoho Books from paid conversations and orders.',
    accentColor: '#E42527',
    docsUrl: 'https://www.zoho.com/books/api/v3/',
    fields: [
      { label: 'Client ID', key: 'client_id', placeholder: '1000.XXXX...', hint: 'Zoho API Console → Server-based App' },
      { label: 'Client Secret', key: 'client_secret', placeholder: '••••••••', hint: 'Same API Console page', type: 'password' },
      { label: 'Refresh Token', key: 'refresh_token', placeholder: '1000.xxxx...', hint: 'Generate from accounts.zoho.com/oauth/playground', type: 'password' },
      { label: 'Organization ID', key: 'organization_id', placeholder: '60012345678', hint: 'Zoho Books → Settings → Organization Profile' },
    ],
  },
  {
    id: 'quickbooks', category: 'accounting', name: 'QuickBooks',
    logo: ICONS.quickbooks, isUpcoming: true,
    description: 'Sync invoices and payments with QuickBooks Online for conversations tied to a sale.',
    accentColor: '#2CA01C',
    docsUrl: 'https://developer.intuit.com/app/developer/qbo/docs/get-started',
    fields: [
      { label: 'Client ID', key: 'client_id', placeholder: 'ABxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Intuit Developer → My Apps → Keys & OAuth' },
      { label: 'Client Secret', key: 'client_secret', placeholder: '••••••••', hint: 'Same app credentials page', type: 'password' },
      { label: 'Realm / Company ID', key: 'realm_id', placeholder: '123145678901234', hint: 'The company ID from the OAuth redirect' },
    ],
  },
  {
    id: 'tally', category: 'accounting', name: 'Tally',
    logo: ICONS.tally, isUpcoming: true,
    description: 'Push conversation-linked orders and payments into TallyPrime via its integration API.',
    accentColor: '#4B4B4B',
    docsUrl: 'https://help.tallysolutions.com/tally-prime/api/',
    fields: [
      { label: 'Tally Server URL', key: 'server_url', placeholder: 'http://localhost:9000', hint: 'Local/remote Tally ODBC/HTTP server address' },
      { label: 'Company Name', key: 'company_name', placeholder: 'Your Company Pvt Ltd', hint: 'Exact company name as configured in Tally' },
    ],
  },

  // ─── E-Signature ────────────────────────────────────────────────────
  {
    id: 'docusign', category: 'esign', name: 'DocuSign',
    logo: ICONS.docusign, isUpcoming: true,
    description: 'Send contracts for e-signature and track completion status from conversations.',
    accentColor: '#FFB600',
    docsUrl: 'https://developers.docusign.com/docs/esign-rest-api/',
    fields: [
      { label: 'Integration Key', key: 'integration_key', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', hint: 'DocuSign Admin → Apps and Keys → Add App' },
      { label: 'User ID', key: 'user_id', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', hint: 'DocuSign → Apps and Keys → API Username' },
      { label: 'RSA Private Key', key: 'private_key', placeholder: 'Paste PEM private key...', hint: 'Generated when creating an RSA keypair for JWT auth', type: 'password' },
    ],
  },
  {
    id: 'zoho-sign', category: 'esign', name: 'Zoho Sign',
    logo: ICONS.zohosign, isUpcoming: true,
    description: 'Send documents for e-signature via Zoho Sign directly from conversations.',
    accentColor: '#E42527',
    docsUrl: 'https://www.zoho.com/sign/api/',
    fields: [
      { label: 'Client ID', key: 'client_id', placeholder: '1000.XXXX...', hint: 'Zoho API Console → Server-based App' },
      { label: 'Client Secret', key: 'client_secret', placeholder: '••••••••', hint: 'Same API Console page', type: 'password' },
      { label: 'Refresh Token', key: 'refresh_token', placeholder: '1000.xxxx...', hint: 'Generate from accounts.zoho.com/oauth/playground', type: 'password' },
    ],
  },

  // ─── Ads & Analytics ────────────────────────────────────────────────
  {
    id: 'google-ads', category: 'analytics', name: 'Google Ads',
    logo: ICONS.googleads, isUpcoming: true,
    description: 'Attribute conversations and conversions back to Google Ads campaigns.',
    accentColor: '#4285F4',
    docsUrl: 'https://developers.google.com/google-ads/api/docs/start',
    fields: [
      { label: 'Developer Token', key: 'developer_token', placeholder: 'Paste developer token', hint: 'Google Ads → Tools → API Center', type: 'password' },
      { label: 'Customer ID', key: 'customer_id', placeholder: '123-456-7890', hint: 'Your Google Ads account ID' },
      { label: 'OAuth Refresh Token', key: 'refresh_token', placeholder: 'Paste refresh token', hint: 'Generated via Google OAuth playground for an Ads-scoped app', type: 'password' },
    ],
  },
  {
    id: 'meta-ads', category: 'analytics', name: 'Meta Ads',
    logo: ICONS.metaads, isUpcoming: true,
    description: 'Attribute WhatsApp/Instagram conversations back to Meta (Facebook/Instagram) ad campaigns.',
    accentColor: '#0081FB',
    docsUrl: 'https://developers.facebook.com/docs/marketing-apis',
    fields: [
      { label: 'Access Token', key: 'access_token', placeholder: 'EAAG...', hint: 'Meta for Developers → Marketing API → Access Token', type: 'password' },
      { label: 'Ad Account ID', key: 'ad_account_id', placeholder: 'act_1234567890', hint: 'Meta Ads Manager → Account Settings' },
    ],
  },
  {
    id: 'ga4', category: 'analytics', name: 'Google Analytics 4',
    logo: ICONS.ga4, isUpcoming: true,
    description: 'Send conversation and conversion events to GA4 for full-funnel reporting.',
    accentColor: '#E37400',
    docsUrl: 'https://developers.google.com/analytics/devguides/collection/protocol/ga4',
    fields: [
      { label: 'Measurement ID', key: 'measurement_id', placeholder: 'G-XXXXXXXXXX', hint: 'GA4 → Admin → Data Streams → Measurement ID' },
      { label: 'API Secret', key: 'api_secret', placeholder: '••••••••', hint: 'GA4 → Admin → Data Streams → Measurement Protocol API secrets', type: 'password' },
    ],
  },
  {
    id: 'mixpanel', category: 'analytics', name: 'Mixpanel',
    logo: ICONS.mixpanel, isUpcoming: true,
    description: 'Track conversation and conversion events as Mixpanel product-analytics events.',
    accentColor: '#7856FF',
    docsUrl: 'https://developer.mixpanel.com/reference/overview',
    fields: [
      { label: 'Project Token', key: 'project_token', placeholder: 'Paste project token', hint: 'Mixpanel → Project Settings → Access Keys', type: 'password' },
    ],
  },
  {
    id: 'segment', category: 'analytics', name: 'Segment',
    logo: ICONS.segment, isUpcoming: true,
    description: 'Forward conversation events to every downstream tool wired into your Segment workspace.',
    accentColor: '#52BD94',
    docsUrl: 'https://segment.com/docs/connections/sources/catalog/libraries/server/http-api/',
    fields: [
      { label: 'Write Key', key: 'write_key', placeholder: 'Paste write key', hint: 'Segment → Sources → HTTP API Source → Write Key', type: 'password' },
    ],
  },

  // ─── Automation ─────────────────────────────────────────────────────
  {
    id: 'zapier', category: 'automation', name: 'Zapier',
    logo: ICONS.zapier, isUpcoming: true,
    description: 'Trigger Zaps from new conversations/leads and pipe data into thousands of connected apps.',
    accentColor: '#FF4A00',
    docsUrl: 'https://platform.zapier.com/docs/getting-started',
    fields: [
      { label: 'Webhook URL', key: 'webhook_url', placeholder: 'https://hooks.zapier.com/hooks/catch/xxxx/xxxx/', hint: 'Zapier → Create Zap → Webhooks by Zapier trigger → Copy URL' },
    ],
  },
  {
    id: 'moodle', category: 'automation', name: 'Moodle',
    logo: ICONS.moodle, isUpcoming: true,
    description: 'Sync learner enrollments and course progress from Moodle into conversation context.',
    accentColor: '#F98012',
    docsUrl: 'https://docs.moodle.org/dev/Web_service_API_functions',
    fields: [
      { label: 'Moodle Site URL', key: 'site_url', placeholder: 'https://learn.yourdomain.com', hint: 'Base URL of your Moodle instance' },
      { label: 'Web Service Token', key: 'token', placeholder: '••••••••', hint: 'Moodle → Site administration → Server → Web services → Manage tokens', type: 'password' },
    ],
  },
];

// Do not advertise credential forms for providers that do not yet have an
// operational backend adapter. Adding the adapter and removing `isUpcoming`
// makes a provider available without changing the marketplace renderer.
//
// TEMPORARY: only WhatsApp is exposed in the Integrations UI for now (all
// other providers, including CRM/XOLOX, stay fully implemented underneath —
// this only hides the marketplace entry point). Remove ONLY_SHOW_WHATSAPP to
// restore the full catalog.
const ONLY_SHOW_WHATSAPP = false;
const AVAILABLE_INTEGRATIONS = INTEGRATIONS_LIST.filter((integration) => !integration.isUpcoming && (!ONLY_SHOW_WHATSAPP || integration.id === 'whatsapp'));
const UPCOMING_INTEGRATIONS = ONLY_SHOW_WHATSAPP ? [] : INTEGRATIONS_LIST.filter((integration) => integration.isUpcoming);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="ml-2 text-slate-400 hover:text-slate-700 transition-colors" title="Copy">
      <Copy className={cn("w-3.5 h-3.5", copied && "text-green-500")} />
    </button>
  );
}

function RevealInput({ placeholder, value, onChange, disabled }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="h-11 rounded-xl bg-white border-slate-200 px-4 font-mono text-sm pr-10 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function isOptionalIntegrationField(field) {
  return `${field?.hint || ''} ${field?.label || ''}`.toLowerCase().includes('optional');
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage({ currentUser, onNavigate, initialMode = 'overview', autoOpenWhatsApp = false, onAutoOpenWhatsAppHandled }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    const ids = Array.isArray(currentUser.teamIds) ? currentUser.teamIds : [];
    return ids.length > 0 ? ids[0] : currentUser.teamId || 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22';
  }, [currentUser]);

  const [activeIntegrationId, setActiveIntegrationId] = useState(null);
  const [activeCategoryId, setActiveCategoryId] = useState('all');
  const [integrationSearch, setIntegrationSearch] = useState('');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState(null);
  const [settingsMode, setSettingsMode] = useState(initialMode);
  const [activeCrmSettingsTab, setActiveCrmSettingsTab] = useState('Lead Stages');
  const [fieldValues, setFieldValues] = useState({});
  const [integrationFormError, setIntegrationFormError] = useState('');
  const [connectedChannels, setConnectedChannels] = useState([]);
  const [genericIntegrations, setGenericIntegrations] = useState([]);
  const [isTestingGenericIntegration, setIsTestingGenericIntegration] = useState(false);
  const workspaceLogoInputRef = useRef(null);
  const [workspaceName, setWorkspaceName] = useState('Acme Growth Marketing');
  const [workspaceTimezone, setWorkspaceTimezone] = useState('(GMT-08:00) Pacific Time (US & Canada)');
  const [workspaceLocale, setWorkspaceLocale] = useState('English (United States)');
  const [workspaceLogoUrl, setWorkspaceLogoUrl] = useState(null);
  const primaryBrandLogoRef = useRef(null);
  const darkBrandLogoRef = useRef(null);
  const primaryBrandColorRef = useRef(null);
  const secondaryBrandColorRef = useRef(null);
  const accentBrandColorRef = useRef(null);
  const [primaryBrandLogo, setPrimaryBrandLogo] = useState(null);
  const [darkBrandLogo, setDarkBrandLogo] = useState(null);
  const [brandColors, setBrandColors] = useState({ primary: '#6F00D2', secondary: '#62FAE3', accent: '#873900' });
  const [headerBrandFont, setHeaderBrandFont] = useState('Hanken Grotesk');
  const [headerBrandWeight, setHeaderBrandWeight] = useState(700);
  const [bodyBrandFont, setBodyBrandFont] = useState('Inter');
  const [bodyBrandWeight, setBodyBrandWeight] = useState(400);
  const [systemStatus, setSystemStatus] = useState({
    health: { status: 'unknown' },
    providers: [],
    retryJobs: [],
    webhookEvents: [],
    rateLimitEvents: [],
    deliveryJobs: [],
    logs: [],
    generatedAt: null,
  });
  const [systemStatusLoading, setSystemStatusLoading] = useState(false);
  const [systemStatusError, setSystemStatusError] = useState('');
  const [assignmentRules, setAssignmentRules] = useState([]);
  const [assignmentMembers, setAssignmentMembers] = useState([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentForm, setAssignmentForm] = useState(null);
  const [assignmentModalError, setAssignmentModalError] = useState('');
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentTestResult, setAssignmentTestResult] = useState('');

  useEffect(() => {
    setSettingsMode(initialMode);
  }, [initialMode]);

  async function loadSystemStatus() {
    setSystemStatusLoading(true);
    setSystemStatusError('');
    try {
      const [health, whatsapp, telegram, instagram, razorpay, exotel, twilio, email] = await Promise.all([
        settingsFetchJson('/health', { status: 'unknown' }),
        settingsFetchJson('/api/settings/whatsapp', null),
        settingsFetchJson('/api/auth/telegram/status', null),
        settingsFetchJson('/api/auth/instagram/status', null),
        settingsFetchJson('/api/settings/razorpay', null),
        settingsFetchJson('/api/settings/exotel', null),
        settingsFetchJson('/api/settings/twilio', null),
        settingsFetchJson('/api/settings/email', null),
      ]);

      const providers = [
        {
          providerKey: 'whatsapp',
          providerName: 'WhatsApp Business',
          category: 'channels',
          status: whatsapp?.is_active || whatsapp?.settings?.is_active || whatsapp?.connected ? 'healthy' : 'warning',
          checks: [
            { key: 'cloud-api', label: 'Cloud API', message: whatsapp ? 'Settings endpoint responded.' : 'Not connected yet.' },
            { key: 'webhook', label: 'Webhook', message: 'Use /webhooks/whatsapp for inbound and delivery events.' },
          ],
        },
        {
          providerKey: 'telegram',
          providerName: 'Telegram Bot',
          category: 'channels',
          status: telegram?.connected || telegram?.is_active ? 'healthy' : 'warning',
          checks: [{ key: 'bot', label: 'Bot token', message: telegram?.connected ? 'Bot connection active.' : 'No active bot connection.' }],
        },
        {
          providerKey: 'instagram',
          providerName: 'Instagram DMs',
          category: 'channels',
          status: instagram?.connected || instagram?.is_active ? 'healthy' : 'warning',
          checks: [{ key: 'meta', label: 'Meta status', message: instagram?.connected ? 'Instagram connection active.' : 'Connect Meta page to enable DMs.' }],
        },
        {
          providerKey: 'razorpay',
          providerName: 'Razorpay',
          category: 'payments',
          status: razorpay?.is_active || razorpay?.key_id ? 'healthy' : 'warning',
          checks: [{ key: 'checkout', label: 'Payment links', message: razorpay?.key_id ? 'Credentials are configured.' : 'Payment gateway not connected.' }],
        },
        {
          providerKey: 'exotel',
          providerName: 'Exotel',
          category: 'voip',
          status: exotel?.is_active || exotel?.sid ? 'healthy' : 'warning',
          checks: [{ key: 'calls', label: 'Calls', message: exotel?.sid ? 'Exotel settings are configured.' : 'No Exotel account configured.' }],
        },
        {
          providerKey: 'twilio',
          providerName: 'Twilio',
          category: 'sms',
          status: twilio?.is_active || twilio?.account_sid ? 'healthy' : 'warning',
          checks: [{ key: 'sms', label: 'SMS', message: twilio?.account_sid ? 'Twilio account configured.' : 'SMS provider not connected.' }],
        },
        {
          providerKey: 'email',
          providerName: 'Business Email',
          category: 'email',
          status: email?.is_active || email?.smtp_host ? 'healthy' : 'warning',
          checks: [{ key: 'smtp', label: 'SMTP/IMAP', message: email?.smtp_host ? 'Mail settings are configured.' : 'Email channel not connected.' }],
        },
      ];

      setSystemStatus({
        health,
        providers,
        retryJobs: [],
        webhookEvents: [],
        rateLimitEvents: [],
        deliveryJobs: [],
        logs: providers.map((provider) => ({
          id: provider.providerKey,
          category: provider.category,
          action: `${provider.providerName} health check`,
          status: provider.status,
          createdAt: new Date().toISOString(),
        })),
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      setSystemStatusError(error instanceof Error ? error.message : 'Unable to load system status');
    } finally {
      setSystemStatusLoading(false);
    }
  }

  async function loadAssignmentRules() {
    setAssignmentLoading(true);
    setAssignmentError('');
    try {
      const [rulesPayload, membersPayload] = await Promise.all([
        settingsFetchJson('/api/rules/rules', []),
        settingsFetchJson(`/api/team-users${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`, { data: [] }),
      ]);
      setAssignmentRules(normalizeAssignmentRules(rulesPayload));
      setAssignmentMembers(normalizeAssignmentMembers(membersPayload));
    } catch (error) {
      setAssignmentError(error instanceof Error ? error.message : 'Unable to load assignment rules');
    } finally {
      setAssignmentLoading(false);
    }
  }

  useEffect(() => {
    if (settingsMode === 'status') {
      void loadSystemStatus();
    }
    if (settingsMode === 'assignment') {
      void loadAssignmentRules();
    }
  }, [settingsMode, teamId]);

  async function saveAssignmentRule() {
    if (!assignmentForm) return;
    const payload = assignmentBodyFromForm(assignmentForm);
    if (!payload.name) {
      setAssignmentModalError('Rule name is required.');
      return;
    }
    if (!payload.action_config.conditions.length) {
      setAssignmentModalError('Add at least one complete lead condition before saving.');
      return;
    }
    setAssignmentSaving(true);
    setAssignmentModalError('');
    try {
      const body = JSON.stringify(payload);
      const url = assignmentForm.id ? `/api/rules/rules/${assignmentForm.id}` : '/api/rules/rules';
      const method = assignmentForm.id ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: settingsAuthHeaders(),
        credentials: 'include',
        body,
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseBody.error || responseBody.message || 'Unable to save rule');
      setAssignmentForm(null);
      await loadAssignmentRules();
    } catch (error) {
      setAssignmentModalError(error instanceof Error ? error.message : 'Unable to save rule');
    } finally {
      setAssignmentSaving(false);
    }
  }

  async function testAssignmentRule() {
    if (!assignmentForm) return;
    const rulePayload = assignmentBodyFromForm(assignmentForm);
    if (!rulePayload.name) {
      setAssignmentModalError('Rule name is required before testing.');
      return;
    }
    if (!rulePayload.action_config.conditions.length) {
      setAssignmentModalError('Add at least one complete lead condition before testing.');
      return;
    }
    setAssignmentSaving(true);
    setAssignmentModalError('');
    setAssignmentTestResult('');
    try {
      const response = await fetch('/api/rules/rules/test', {
        method: 'POST',
        headers: settingsAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(rulePayload),
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseBody.error || responseBody.message || 'Unable to test rule');
      setAssignmentTestResult(responseBody.preview || (responseBody.matched ? 'Rule matched the sample event.' : 'Rule did not match the sample event.'));
    } catch (error) {
      setAssignmentModalError(error instanceof Error ? error.message : 'Unable to test rule');
    } finally {
      setAssignmentSaving(false);
    }
  }

  async function toggleAssignmentRule(rule) {
    const ok = await confirmAction({
      title: `${rule.isActive ? 'Deactivate' : 'Activate'} assignment rule?`,
      message: rule.isActive
        ? `"${rule.name}" will stop assigning new matching conversations.`
        : `"${rule.name}" will start assigning new matching conversations.`,
      confirmLabel: rule.isActive ? 'Deactivate' : 'Activate',
      tone: 'toggle',
    });
    if (!ok) return;
    await fetch(`/api/rules/rules/${rule.id}`, {
      method: 'PUT',
      headers: settingsAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ is_active: !rule.isActive }),
    });
    await loadAssignmentRules();
  }

  async function deleteAssignmentRule(rule) {
    const ok = await confirmAction({
      title: 'Delete assignment rule?',
      message: `"${rule.name}" will be deleted. Existing conversations will not be deleted.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    await fetch(`/api/rules/rules/${rule.id}`, {
      method: 'DELETE',
      headers: settingsAuthHeaders(),
      credentials: 'include',
    });
    await loadAssignmentRules();
  }

  // WhatsApp
  const [whatsappSettings, setWhatsappSettings] = useState({ phone_number_id: '', business_account_id: '', permanent_token: '', display_phone_number: '', is_active: false });
  const [allWhatsappSettings, setAllWhatsappSettings] = useState([]);
  const [whatsappAppSettings, setWhatsappAppSettings] = useState(null);
  const [isWhatsAppMetaIntroOpen, setIsWhatsAppMetaIntroOpen] = useState(false);
  const [whatsappConnectMode, setWhatsappConnectMode] = useState('meta');
  const [manualWhatsAppFields, setManualWhatsAppFields] = useState({
    phone_number_id: '', business_account_id: '', permanent_token: '', display_phone_number: '',
  });
  const [editingWhatsAppNumber, setEditingWhatsAppNumber] = useState(null);
  const [isSavingManualWhatsApp, setIsSavingManualWhatsApp] = useState(false);
  const [manualWhatsAppError, setManualWhatsAppError] = useState('');
  const [isWhatsAppConnectionSummaryOpen, setIsWhatsAppConnectionSummaryOpen] = useState(false);
  const [expandedWhatsAppPhoneId, setExpandedWhatsAppPhoneId] = useState(null);
  const [razorpaySettings, setRazorpaySettings] = useState(null);
  const [isSavingRazorpay, setIsSavingRazorpay] = useState(false);
  const [isTestingZoom, setIsTestingZoom] = useState(false);

  // Exotel
  const [exotelSettings, setExotelSettings] = useState(null);
  const [isSavingExotel, setIsSavingExotel] = useState(false);
  const [exotelFields, setExotelFields] = useState({ sid: '', api_key: '', api_token: '', subdomain: 'api.in.exotel.com', caller_id: '' });
  const [exotelCallLogs, setExotelCallLogs] = useState([]);
  const [exotelLoadingLogs, setExotelLoadingLogs] = useState(false);
  const [dialerNumber, setDialerNumber] = useState('');
  const [dialerFrom, setDialerFrom] = useState('');
  const [isDialing, setIsDialing] = useState(false);
  const [dialerStatus, setDialerStatus] = useState(null); // null | 'calling' | 'success' | 'error'
  const [dialerMessage, setDialerMessage] = useState('');
  const [loadingWhatsapp, setLoadingWhatsapp] = useState(false);

  // Twilio
  const [twilioSettings, setTwilioSettings] = useState(null);
  const [isSavingTwilio, setIsSavingTwilio] = useState(false);
  const [twilioFields, setTwilioFields] = useState({ account_sid: '', auth_token: '', phone_number: '', messaging_service_sid: '' });
  const [twilioLogs, setTwilioLogs] = useState([]);
  const [twilioLoadingLogs, setTwilioLoadingLogs] = useState(false);
  const [twilioTabType, setTwilioTabType] = useState('all');
  const [twilioSmsTo, setTwilioSmsTo] = useState('');
  const [twilioSmsBody, setTwilioSmsBody] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [twilioCallTo, setTwilioCallTo] = useState('');
  const [isDialingTwilio, setIsDialingTwilio] = useState(false);
  const [twilioActionResult, setTwilioActionResult] = useState(null);

  // Email
  const [emailSettings, setEmailSettings] = useState(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState(null);
  const [emailFields, setEmailFields] = useState({
    provider: 'smtp', api_token: '', api_base_url: 'https://api.zeptomail.com',
    display_name: '', email_address: '',
    smtp_host: '', smtp_port: '587', smtp_secure: false, smtp_user: '', smtp_pass: '',
    imap_host: '', imap_port: '993', imap_secure: true, imap_user: '', imap_pass: '',
  });

  // Telegram
  const [telegramSettings, setTelegramSettings] = useState([]);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [botTokenInput, setBotTokenInput] = useState('');
  const [botDisplayName, setBotDisplayName] = useState('');

  // Instagram
  const [instagramStatus, setInstagramStatus] = useState({ connected: false, channels: [] });
  const [loadingInstagram, setLoadingInstagram] = useState(false);
  const [savingInstagramApp, setSavingInstagramApp] = useState(false);
  const [instagramAppSettings, setInstagramAppSettings] = useState(null);
  const [instagramAppFields, setInstagramAppFields] = useState({ meta_app_id: '', meta_app_secret: '', verify_token: '' });
  const [instagramManualFields, setInstagramManualFields] = useState({ pageAccessToken: '', pageId: '' });

  // Translation
  const [translationSetting, setTranslationSettingState] = useState({ enabled: true, hasOpenAiKey: true });
  const [isSavingTranslation, setIsSavingTranslation] = useState(false);
  useEffect(() => {
    getTranslationSetting().then((data) => {
      if (data && typeof data.enabled === 'boolean') setTranslationSettingState(data);
    }).catch(() => {});
  }, []);
  const handleToggleTranslation = async () => {
    const next = !translationSetting.enabled;
    const ok = await confirmAction({
      title: next ? 'Enable translation?' : 'Disable translation?',
      message: next
        ? 'Incoming messages can be auto-translated when supported by the server configuration.'
        : 'Auto-translation will stop until enabled again.',
      confirmLabel: next ? 'Enable' : 'Disable',
      tone: 'toggle',
    });
    if (!ok) return;
    setIsSavingTranslation(true);
    setTranslationSettingState((prev) => ({ ...prev, enabled: next }));
    try {
      const data = await updateTranslationSetting(next);
      if (data && typeof data.enabled === 'boolean') setTranslationSettingState(data);
    } catch (err) {
      console.error('Failed to update translation setting:', err);
      setTranslationSettingState((prev) => ({ ...prev, enabled: !next }));
    } finally {
      setIsSavingTranslation(false);
    }
  };

  // WhatsApp and Instagram Embedded Signup share one Meta App in this
  // platform's setup — prefer the WhatsApp app id but fall back to
  // Instagram's so the SDK still loads if only one is configured yet.
  const metaAppId = whatsappAppSettings?.meta_app_id || instagramAppSettings?.meta_app_id;
  const { sdkReady: sdkLoaded, launch: launchWhatsAppEmbeddedSignup } = useWhatsAppEmbeddedSignup({
    appId: metaAppId,
    configId: whatsappAppSettings?.embedded_signup_config_id,
  });

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      try {
        const [wa, waApp, tg, ig, igApp, rzp, ext, twl, eml, generic] = await Promise.all([
          getWhatsAppSettings(teamId),
          getWhatsAppAppSettings(teamId),
          getTelegramSettings(teamId),
          getInstagramStatus(),
          getInstagramAppSettings(),
          getRazorpaySettings(teamId),
          getExotelSettings(teamId),
          getTwilioSettings(teamId),
          getEmailSettings(teamId),
          getGenericIntegrationSettings(teamId)
        ]);
        if (wa?.settings) setWhatsappSettings(wa.settings);
        if (waApp?.settings) {
          setWhatsappAppSettings(waApp.settings);
        }
        const normalizedWhatsappSettings = Array.isArray(wa?.allSettings)
          ? wa.allSettings
          : wa?.settings?.phone_number_id
            ? [wa.settings]
            : [];
        setAllWhatsappSettings(normalizedWhatsappSettings);
        setTelegramSettings(Array.isArray(tg?.settings) ? tg.settings : tg?.settings ? [tg.settings] : []);
        if (ig) setInstagramStatus(ig);
        if (igApp?.settings) {
          setInstagramAppSettings(igApp.settings);
          setInstagramAppFields({ meta_app_id: igApp.settings.meta_app_id || '', meta_app_secret: '', verify_token: '' });
        }
        if (rzp?.settings) {
          setRazorpaySettings(rzp.settings);
          setFieldValues(prev => ({
            ...prev,
            razorpay: {
              key_id: rzp.settings.key_id || '',
              key_secret: '',
              webhook_secret: ''
            }
          }));
        }
        if (ext?.settings) {
          setExotelSettings(ext.settings);
          setExotelFields({
            sid: ext.settings.sid || '',
            api_key: ext.settings.api_key || '',
            api_token: ext.settings.api_token || '',
            subdomain: ext.settings.subdomain || 'api.in.exotel.com',
            caller_id: ext.settings.caller_id || ''
          });
        }
        if (twl?.settings) {
          setTwilioSettings(twl.settings);
          setTwilioFields({
            account_sid: twl.settings.account_sid || '',
            auth_token: twl.settings.auth_token || '',
            phone_number: twl.settings.phone_number || '',
            messaging_service_sid: twl.settings.messaging_service_sid || ''
          });
        }
        if (eml?.settings) {
          setEmailSettings(eml.settings);
          setEmailFields({
            provider: eml.settings.provider || 'smtp',
            api_token: eml.settings.api_token || '',
            api_base_url: eml.settings.api_base_url || 'https://api.zeptomail.com',
            display_name: eml.settings.display_name || '',
            email_address: eml.settings.email_address || '',
            smtp_host: eml.settings.smtp_host || '',
            smtp_port: String(eml.settings.smtp_port || '587'),
            smtp_secure: !!eml.settings.smtp_secure,
            smtp_user: eml.settings.smtp_user || '',
            smtp_pass: eml.settings.smtp_pass || '',
            imap_host: eml.settings.imap_host || '',
            imap_port: String(eml.settings.imap_port || '993'),
            imap_secure: eml.settings.imap_secure !== false,
            imap_user: eml.settings.imap_user || '',
            imap_pass: eml.settings.imap_pass || '',
          });
        }
        const genericRows = Array.isArray(generic?.integrations) ? generic.integrations : [];
        setGenericIntegrations(genericRows);
        if (genericRows.length > 0) {
          setFieldValues(prev => {
            const next = { ...prev };
            genericRows.forEach((row) => {
              if (row.provider_id) next[row.provider_id] = row.config || {};
            });
            return next;
          });
        }
      } catch (err) { console.error('Error loading integrations', err); }
    })();
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      try {
        const res = await getContactChannels();
        setConnectedChannels(Array.isArray(res?.channels) ? res.channels : []);
      } catch (err) {
        console.error('Error loading connected channels', err);
        setConnectedChannels([]);
      }
    })();
  }, [teamId]);

  const activeIntegration = useMemo(() =>
    AVAILABLE_INTEGRATIONS.find(i => i.id === activeIntegrationId), [activeIntegrationId]);
  const selectedIntegration = useMemo(() =>
    AVAILABLE_INTEGRATIONS.find(i => i.id === selectedIntegrationId), [selectedIntegrationId]);
  const getChannelCount = (type) => connectedChannels.filter((channel) => channel.type === type).length;
  const connectedServices = useMemo(() => ([
    { name: 'WhatsApp', count: Math.max(allWhatsappSettings.length, getChannelCount('whatsapp')), url: `${window.location.origin}/webhooks/whatsapp` },
    { name: 'Instagram', count: Math.max(instagramStatus.connected ? Math.max(instagramStatus.channels?.length || 0, 1) : 0, getChannelCount('instagram')), url: `${window.location.origin}/webhooks/instagram` },
    { name: 'Telegram', count: Math.max(telegramSettings.length, getChannelCount('telegram')), url: `${window.location.origin}/webhooks/telegram` },
    { name: 'Twilio', count: twilioSettings ? 1 : 0, url: `${window.location.origin}/webhooks/twilio/sms` },
    { name: 'Exotel', count: exotelSettings ? 1 : 0, url: `${window.location.origin}/webhooks/exotel/status` },
    { name: 'Email', count: emailSettings ? 1 : 0, url: 'IMAP / SMTP' },
    { name: 'Razorpay', count: razorpaySettings ? 1 : 0, url: `${window.location.origin}/webhooks/razorpay` },
    ...genericIntegrations
      .filter((row) => row.is_active !== false)
      .map((row) => ({
        id: row.provider_id,
        name: row.provider_name || row.provider_id,
        count: 1,
        url: `${window.location.origin}/webhooks/${row.provider_id}`,
      })),
  ]), [allWhatsappSettings.length, connectedChannels, emailSettings, exotelSettings, genericIntegrations, instagramStatus.channels?.length, instagramStatus.connected, razorpaySettings, telegramSettings.length, twilioSettings]);
  const connectedIntegrationCount = useMemo(() =>
    connectedServices.reduce((total, service) => total + Number(service.count || 0), 0),
  [connectedServices]);
  const connectedProviderCount = useMemo(() =>
    connectedServices.filter((service) => Number(service.count || 0) > 0).length,
  [connectedServices]);
  const integrationCategoryTabs = useMemo(() => [
    { id: 'all', name: 'All Integrations', count: AVAILABLE_INTEGRATIONS.length },
    { id: 'connected', name: 'Connected', count: connectedIntegrationCount },
    { id: 'upcoming', name: 'Upcoming', count: UPCOMING_INTEGRATIONS.length },
    ...CATEGORIES.map((cat) => ({
      id: cat.id,
      name: cat.name,
      count: AVAILABLE_INTEGRATIONS.filter((item) => item.category === cat.id).length,
    })),
  ], [connectedIntegrationCount]);
  const activeWebhookCount = useMemo(() =>
    connectedServices.filter((service) => service.count > 0 && service.url.startsWith('http')).length,
  [connectedServices]);
  const getIntegrationConnection = (item) => {
    const generic = genericIntegrations.find((entry) => entry.provider_id === item.id && entry.is_active !== false);
    const service = connectedServices.find((entry) =>
      entry.id === item.id ||
      entry.name.toLowerCase() === item.name.toLowerCase().split(' ')[0]
    );
    if (item.id === 'whatsapp') {
      const count = Math.max(allWhatsappSettings.length, getChannelCount('whatsapp'));
      return { connected: count > 0, count, label: count === 1 ? '1 number' : `${count} numbers` };
    }
    if (item.id === 'telegram') {
      const count = Math.max(telegramSettings.length, getChannelCount('telegram'));
      return { connected: count > 0, count, label: count === 1 ? '1 bot' : `${count} bots` };
    }
    if (item.id === 'instagram') {
      const count = Math.max(instagramStatus.connected ? Math.max(instagramStatus.channels?.length || 0, 1) : 0, getChannelCount('instagram'));
      return { connected: count > 0, count, label: count === 1 ? '1 account' : `${count} accounts` };
    }
    if (item.id === 'razorpay') return { connected: !!razorpaySettings, count: razorpaySettings ? 1 : 0, label: '1 account' };
    if (item.id === 'exotel') return { connected: !!exotelSettings, count: exotelSettings ? 1 : 0, label: '1 account' };
    if (item.id === 'twilio') return { connected: !!twilioSettings, count: twilioSettings ? 1 : 0, label: '1 account' };
    if (item.id === 'email') return { connected: !!emailSettings, count: emailSettings ? 1 : 0, label: '1 mailbox' };
    if (item.id === 'zeptomail') {
      const connected = emailSettings?.provider === 'zeptomail' && emailSettings?.is_active !== false;
      return { connected, count: connected ? 1 : 0, label: connected ? '1 sender' : '' };
    }
    if (generic) return { connected: true, count: 1, label: '1 account' };
    return { connected: Boolean(service?.count), count: service?.count || 0, label: service?.count ? `${service.count} connected` : '' };
  };

  const getIntegrationPermissions = (item) => {
    if (PAYMENT_GATEWAY_MODAL[item.id]) return PAYMENT_GATEWAY_MODAL[item.id].permissions;
    const byId = {
      whatsapp: ['Send and receive WhatsApp messages', 'Sync templates, media, and delivery status', 'Receive Meta webhook events'],
      instagram: ['Read and send Instagram direct messages', 'Receive Instagram webhook events', 'Access connected business profile data'],
      telegram: ['Send Telegram bot messages', 'Register webhook updates', 'Route replies into inbox conversations'],
      email: ['Send email through SMTP', 'Read inbound mailbox settings', 'Track delivery or test results'],
      zeptomail: ['Send workspace email through ZeptoMail', 'Use the configured sender in workflows and campaigns', 'Validate credentials with a secure test email'],
      razorpay: ['Create payment links', 'Verify payment status', 'Receive payment webhook events'],
      twilio: ['Send SMS messages', 'Initiate configured calls', 'Receive delivery and call status webhooks'],
      fast2sms: ['Send OTP messages from workflows', 'Use workspace-owned API credentials', 'Validate account access without sending an SMS'],
      exotel: ['Initiate Exotel calls', 'Track call status callbacks', 'Store encrypted account credentials'],
      hubspot: ['Read and write contact records', 'Sync CRM timeline and deal data', 'Trigger workflows from CRM updates'],
      zohocrm: ['Create and update CRM leads', 'Read lead and contact details', 'Trigger automations from CRM events'],
      googlesheets: ['Append rows to configured sheets', 'Update reporting tabs', 'Export leads and events'],
      openai: ['Generate AI replies', 'Use knowledge and prompt settings', 'Assist workflows and inbox responses'],
      anthropic: ['Generate AI replies', 'Assist workflow actions', 'Use configured model settings'],
    };
    if (byId[item.id]) return byId[item.id];
    if (item.category === 'channels') return ['Send outbound messages', 'Receive inbound events', 'Create inbox conversations'];
    if (item.category === 'crm') return ['Read and update contacts', 'Sync lead status and notes', 'Trigger CRM workflows'];
    if (item.category === 'payments') return ['Create payment requests', 'Check transaction status', 'Receive webhook events'];
    if (item.category === 'ai') return ['Use configured AI model', 'Generate agent responses', 'Store encrypted provider keys'];
    if (item.category === 'mcp') return ['Connect external tool server', 'Run approved actions', 'Use workflow tool calls'];
    return ['Store encrypted credentials', 'Run provider actions', 'Track connection health'];
  };

  const getIntegrationWebhookUrl = (item) => {
    const direct = connectedServices.find((service) =>
      item.name.toLowerCase().includes(service.name.toLowerCase()) ||
      service.name.toLowerCase().includes(item.name.toLowerCase().split(' ')[0])
    );
    if (direct?.url) return direct.url;
    if (item.id === 'hubspot') return `${window.location.origin}/webhooks/hubspot`;
    if (item.id === 'zohocrm') return `${window.location.origin}/webhooks/zoho`;
    if (item.id === 'messenger') return `${getPublicBackendOrigin()}/webhooks/messenger`;
    if (item.id === 'googlesheets') return 'OAuth callback / scheduled export';
    if (item.id === 'zoom') return `${window.location.origin}/webhooks/zoom?teamId=${encodeURIComponent(teamId || '')}`;
    if (item.id === 'zeptomail') return 'Outbound email API - no inbound webhook required';
    if (item.category === 'channels') return `${window.location.origin}/webhooks/${item.id}`;
    if (item.category === 'payments') return `${window.location.origin}/webhooks/${item.id}`;
    return 'Configured during setup';
  };

  const openIntegrationSetup = (item) => {
    setSelectedIntegrationId(null);
    setIntegrationFormError('');
    if (item.id === 'zeptomail') {
      setEmailFields((current) => ({ ...current, provider: 'zeptomail' }));
    }
    setActiveIntegrationId(item.id);
  };

  // Handlers
  const handleConnectWhatsApp = () => {
    if (!whatsappAppSettings?.ready) return alert('WhatsApp platform setup is incomplete. Please contact the platform administrator.');
    setEditingWhatsAppNumber(null);
    setManualWhatsAppError('');
    setIsWhatsAppMetaIntroOpen(true);
  };

  const handleEditWhatsAppNumber = (setting) => {
    setEditingWhatsAppNumber(setting);
    setWhatsappConnectMode('manual');
    setManualWhatsAppError('');
    setManualWhatsAppFields({
      phone_number_id: setting.phone_number_id || '',
      business_account_id: setting.business_account_id || '',
      // Tokens are never returned to the browser. Leaving this blank preserves
      // the existing encrypted token; pasting a value rotates it.
      permanent_token: '',
      display_phone_number: setting.display_phone_number || '',
    });
    setIsWhatsAppMetaIntroOpen(true);
  };

  // Lets the dashboard's "Connect WhatsApp" banner deep-link straight into the
  // connect flow instead of landing the user on the integrations list.
  const autoOpenWhatsAppTriggered = useRef(false);
  useEffect(() => {
    if (!autoOpenWhatsApp || autoOpenWhatsAppTriggered.current) return;
    if (!whatsappAppSettings?.ready) return;
    autoOpenWhatsAppTriggered.current = true;
    handleConnectWhatsApp();
    onAutoOpenWhatsAppHandled?.();
  }, [autoOpenWhatsApp, whatsappAppSettings]);

  const startWhatsAppMetaSignup = async () => {
    if (!whatsappAppSettings?.ready) return alert('WhatsApp Embedded Signup is not configured by the platform yet.');
    setIsWhatsAppMetaIntroOpen(false);
    setLoadingWhatsapp(true);
    try {
      const payload = await launchWhatsAppEmbeddedSignup();
      const res = await onboardWhatsApp(payload, teamId);
      if (res.success) {
        const numbers = Array.isArray(res.data?.numbers) ? res.data.numbers : [];
        setAllWhatsappSettings(numbers);
        setWhatsappSettings(numbers.find((number) => number.is_primary) || numbers[0] || whatsappSettings);
        setIsWhatsAppConnectionSummaryOpen(true);
      } else {
        alert(res.message || res.error || 'Meta connection could not be completed.');
      }
    } catch (error) {
      alert(error.message || 'Meta connection could not be completed.');
    } finally {
      setLoadingWhatsapp(false);
    }
  };

  const handleSaveManualWhatsApp = async () => {
    setManualWhatsAppError('');
    const { phone_number_id, business_account_id, permanent_token, display_phone_number } = manualWhatsAppFields;
    if (!phone_number_id.trim() || !business_account_id.trim() || (!editingWhatsAppNumber && !permanent_token.trim())) {
      setManualWhatsAppError(editingWhatsAppNumber
        ? 'Phone Number ID and Business Account ID are required.'
        : 'Phone Number ID, Business Account ID, and Access Token are required.');
      return;
    }
    setIsSavingManualWhatsApp(true);
    try {
      const payload = {
        phone_number_id: phone_number_id.trim(),
        business_account_id: business_account_id.trim(),
        permanent_token: permanent_token.trim(),
        display_phone_number: display_phone_number.trim() || undefined,
        is_active: true,
      };
      const res = editingWhatsAppNumber
        ? await patchWhatsAppSettings(editingWhatsAppNumber.phone_number_id, payload, teamId)
        : await updateWhatsAppSettings(payload, teamId);
      if (res?.error || res?.success === false) {
        setManualWhatsAppError(res.message || res.error || 'Failed to save WhatsApp settings.');
        return;
      }
      const refreshed = await getWhatsAppSettings(teamId);
      const numbers = Array.isArray(refreshed?.allSettings) ? refreshed.allSettings : refreshed?.settings ? [refreshed.settings] : [];
      setAllWhatsappSettings(numbers);
      setWhatsappSettings(numbers.find((n) => n.is_primary) || numbers[0] || whatsappSettings);
      setIsWhatsAppMetaIntroOpen(false);
      setIsWhatsAppConnectionSummaryOpen(true);
      setEditingWhatsAppNumber(null);
      setManualWhatsAppFields({ phone_number_id: '', business_account_id: '', permanent_token: '', display_phone_number: '' });
    } catch (error) {
      setManualWhatsAppError(error.message || 'Failed to save WhatsApp settings.');
    } finally {
      setIsSavingManualWhatsApp(false);
    }
  };

  const handleConnectTelegram = async () => {
    try {
      setSavingTelegram(true);
      const res = await connectTelegram(botTokenInput, botDisplayName || 'Bot', teamId);
      if (res.success) {
        setBotTokenInput('');
        const up = await getTelegramSettings(teamId);
        setTelegramSettings(Array.isArray(up?.settings) ? up.settings : up?.settings ? [up.settings] : []);
        if (!res.data?.webhook_configured) {
          alert(`Bot saved, but Telegram webhook registration failed: ${res.data?.last_webhook_error || 'Check PUBLIC_API_URL and HTTPS availability.'}`);
        }
      } else {
        alert(res.error || res.details || 'Failed to connect Telegram bot.');
      }
    } catch (err) {
      alert(err.message || 'Failed to connect Telegram bot.');
    } finally { setSavingTelegram(false); }
  };

  const handleSetPrimaryWhatsApp = async (phoneNumberId) => {
    try {
      const response = await setPrimaryWhatsAppNumber(phoneNumberId, teamId);
      const primary = response?.setting;
      if (!primary) throw new Error('Could not set the primary WhatsApp number.');
      setAllWhatsappSettings((current) => current.map((number) => ({
        ...number,
        is_primary: number.phone_number_id === primary.phone_number_id,
      })));
      setWhatsappSettings(primary);
    } catch (error) {
      alert(error.message || 'Failed to update the primary WhatsApp number.');
    }
  };

  const setField = (key, value) => {
    setIntegrationFormError('');
    setFieldValues(prev => ({ ...prev, [activeIntegrationId]: { ...(prev[activeIntegrationId] || {}), [key]: value } }));
  };

  const getField = (key) => fieldValues[activeIntegrationId]?.[key] || '';
  const isSecretConfigured = (integrationId, key) => {
    if (integrationId === 'razorpay') {
      if (key === 'key_secret') return Boolean(razorpaySettings?.key_secret_configured);
      if (key === 'webhook_secret') return Boolean(razorpaySettings?.webhook_secret_configured);
      return false;
    }
    const row = genericIntegrations.find((entry) => entry.provider_id === integrationId);
    return Boolean(row?.secret_configured?.[key]);
  };
  const secretPlaceholder = (integrationId, field) =>
    isSecretConfigured(integrationId, field.key)
      ? 'Configured - leave blank to keep existing'
      : (field.placeholder || field.label);

  // Instagram handlers
  const handleConnectInstagram = () => {
    if (!window.FB) return alert('Facebook SDK loading...');
    setLoadingInstagram(true);
    window.FB.login((response) => {
      if (response.authResponse) {
        connectInstagram(response.authResponse.accessToken).then(res => {
          if (res.success) {
            getInstagramStatus().then(s => setInstagramStatus(s));
          } else {
            alert(res.error || 'Failed to connect Instagram. Ensure your Instagram is a Business/Creator account linked to a Facebook Page.');
          }
        }).catch(err => {
          console.error('Instagram connect error:', err);
          alert('Failed to connect Instagram.');
        }).finally(() => setLoadingInstagram(false));
      } else {
        setLoadingInstagram(false);
      }
    }, {
      scope: 'instagram_basic,instagram_manage_messages,pages_messaging,pages_show_list,pages_manage_metadata,business_management,public_profile'
    });
  };

  const handleSaveInstagramApp = async () => {
    const hasSavedSecret = Boolean(instagramAppSettings?.app_secret_configured);
    const hasSavedVerifyToken = Boolean(instagramAppSettings?.verify_token_configured);
    if (!instagramAppFields.meta_app_id.trim()
      || (!instagramAppFields.meta_app_secret.trim() && !hasSavedSecret)
      || (!instagramAppFields.verify_token.trim() && !hasSavedVerifyToken)) {
      alert('Meta App ID, Meta App Secret, and Webhook Verify Token are required.');
      return;
    }
    setSavingInstagramApp(true);
    try {
      const result = await saveInstagramAppSettings(instagramAppFields);
      setInstagramAppSettings(result.settings);
      setInstagramAppFields((current) => ({ ...current, meta_app_secret: '', verify_token: '' }));
    } catch (err) {
      alert(err.message || 'Failed to save Instagram Meta App settings.');
    } finally {
      setSavingInstagramApp(false);
    }
  };

  const handleConnectInstagramManually = async () => {
    setLoadingInstagram(true);
    try {
      const res = await connectInstagramManually(instagramManualFields.pageAccessToken, instagramManualFields.pageId);
      if (res.success) {
        const s = await getInstagramStatus();
        setInstagramStatus(s);
        setInstagramManualFields({ pageAccessToken: '', pageId: '' });
      } else {
        alert([res.error, res.details].filter(Boolean).join('\n\n') || 'Failed to connect with the supplied Page credentials.');
      }
    } catch (err) {
      console.error('Instagram manual connect error:', err);
      alert(err.message || 'Failed to connect Instagram.');
    } finally {
      setLoadingInstagram(false);
    }
  };

  const handleDisconnectInstagram = async (channelId) => {
    if (!(await confirmAction({
      title: 'Disconnect Instagram?',
      message: 'Are you sure you want to disconnect this Instagram account?',
      confirmLabel: 'Disconnect',
      tone: 'danger',
    }))) return;
    try {
      await disconnectInstagram(channelId);
      const s = await getInstagramStatus();
      setInstagramStatus(s);
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  const handleSaveGenericIntegration = async () => {
    const intg = activeIntegration;
    if (!intg) return;
    const connection = getIntegrationConnection(intg);
    const requiredField = intg.fields?.find((field) => {
      const hint = `${field.hint || ''} ${field.label || ''}`.toLowerCase();
      if (field.type === 'password' && connection.connected && !String(getField(field.key) || '').trim()) {
        return false;
      }
      return !hint.includes('optional') && !String(getField(field.key) || '').trim();
    });
    if (requiredField) {
      setIntegrationFormError(`${requiredField.label} is required.`);
      return;
    }

    if (intg.id === 'razorpay') {
      try {
        setIsSavingRazorpay(true);
        const values = fieldValues['razorpay'] || {};
        const res = await updateRazorpaySettings(values, teamId);
        setRazorpaySettings(res);
        setFieldValues(prev => ({
          ...prev,
          razorpay: {
            key_id: res.key_id || values.key_id || '',
            key_secret: '',
            webhook_secret: ''
          }
        }));
        alert('Razorpay settings saved and connected!');
      } catch (err) {
        alert('Failed to save Razorpay settings: ' + (err.message || 'Unknown error'));
      } finally {
        setIsSavingRazorpay(false);
      }
      return;
    }

    if (intg.id === 'zoom') {
      try {
        setIsTestingZoom(true);
        const rawValues = fieldValues['zoom'] || {};
        const existingGeneric = genericIntegrations.find((row) => row.provider_id === intg.id);
        const values = { ...(existingGeneric?.config || {}), ...rawValues };
        const saved = await updateGenericIntegrationSettings(intg.id, {
          providerName: intg.name,
          category: intg.category,
          config: values,
        }, teamId);
        if (saved?.integration) {
          setGenericIntegrations(prev => [
            ...prev.filter((row) => row.provider_id !== intg.id),
            saved.integration,
          ]);
          setFieldValues(prev => ({ ...prev, zoom: saved.integration.config || {} }));
        }
        alert('Zoom connection successful!');
      } catch (err) {
        alert('Failed to test Zoom connection: ' + (err.message || 'Unknown error'));
      } finally {
        setIsTestingZoom(false);
      }
      return;
    }

    try {
      setIsSavingRazorpay(true);
      const rawValues = fieldValues[intg.id] || {};
      const existingGeneric = genericIntegrations.find((row) => row.provider_id === intg.id);
      const values = { ...(existingGeneric?.config || {}), ...rawValues };
      intg.fields?.forEach((field) => {
        if (field.type === 'password' && !String(rawValues[field.key] || '').trim() && existingGeneric?.config?.[field.key]) {
          values[field.key] = existingGeneric.config[field.key];
        }
      });
      const saved = await updateGenericIntegrationSettings(intg.id, {
        providerName: intg.name,
        category: intg.category,
        config: values,
        isDefault: PAYMENT_GATEWAY_IDS.has(intg.id) || WORKSPACE_EMAIL_PROVIDER_IDS.has(intg.id),
      }, teamId);
      if (saved?.integration) {
        setGenericIntegrations(prev => [
          ...prev.filter((row) => row.provider_id !== intg.id),
          saved.integration,
        ]);
        setFieldValues(prev => ({ ...prev, [intg.id]: saved.integration.config || {} }));
      }
      setIntegrationFormError('');
      alert(`${intg.name} settings saved and connected!`);
    } catch (err) {
      setIntegrationFormError(err.message || `Failed to save ${intg.name}.`);
    } finally {
      setIsSavingRazorpay(false);
    }
  };

  const handleDisconnectGeneric = async () => {
    const intg = activeIntegration;
    if (!intg) return;
    if (!(await confirmAction({
      title: `Disconnect ${intg.name}?`,
      message: `Are you sure you want to disconnect ${intg.name}?`,
      confirmLabel: 'Disconnect',
      tone: 'danger',
    }))) return;

    if (intg.id === 'razorpay') {
      try {
        await disconnectRazorpay(teamId);
        setRazorpaySettings(null);
        setFieldValues(prev => ({ ...prev, razorpay: {} }));
      } catch (err) {
        alert('Failed to disconnect: ' + err.message);
      }
      return;
    }

    try {
      await disconnectGenericIntegration(intg.id, teamId);
      setGenericIntegrations(prev => prev.map((row) =>
        row.provider_id === intg.id ? { ...row, is_active: false } : row
      ));
    } catch (err) {
      alert('Failed to disconnect: ' + err.message);
    }
  };

  const handleTestGenericIntegration = async () => {
    const intg = activeIntegration;
    if (!intg || intg.id === 'razorpay') return;
    setIsTestingGenericIntegration(true);
    setIntegrationFormError('');
    try {
      const result = await testGenericIntegration(intg.id, teamId);
      alert(result?.message || `${intg.name} connection verified successfully.`);
    } catch (err) {
      setIntegrationFormError(err.message || `Unable to verify ${intg.name}.`);
    } finally {
      setIsTestingGenericIntegration(false);
    }
  };

  // ─── Card Grid ──────────────────────────────────────────────────────
  const settingsPageShell = "min-h-full space-y-6 bg-[#f5f4fb] p-6";
  const settingsTitle = "text-2xl font-bold text-gray-900";
  const settingsSubtitle = "mt-1 text-sm text-gray-500";
  const settingsCard = "group rounded-[22px] border border-gray-100 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-lg hover:shadow-purple-100/60";
  const settingsMiniCard = "rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md hover:shadow-purple-100/50";

  const renderIntegrationCard = (item) => {
    const connection = getIntegrationConnection(item);
    const isConnected = connection.connected;
    const isUpcoming = item.isUpcoming === true;
    const isPaymentGateway = PAYMENT_GATEWAY_IDS.has(item.id);
    const logoNode = item.logoFallback ? (
      <span className="text-xl leading-none">{item.logoFallback}</span>
    ) : (
      <img
        src={item.logo}
        alt={item.name}
        className="h-full w-full object-contain"
        onError={(e) => { e.target.style.display = 'none'; }}
      />
    );
    return (
      <div
        key={item.id}
        onClick={() => {
          if (isUpcoming) return;
          // WhatsApp is the most important channel — skip the generic
          // "Step 1 of 2" auth modal and go straight to the connect flow
          // (or the manage screen, if already connected) instead of
          // stacking three screens before reaching Meta.
          if (item.id === 'whatsapp') {
            return allWhatsappSettings.length > 0 ? setActiveIntegrationId('whatsapp') : handleConnectWhatsApp();
          }
          setSelectedIntegrationId(item.id);
        }}
        className={cn(
          "group flex min-h-[270px] flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200",
          isUpcoming ? "cursor-default border-slate-200 bg-slate-50/70" : "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
          isPaymentGateway
            ? "border-purple-100 hover:border-purple-300 hover:shadow-purple-100/70"
            : "border-gray-100 hover:border-purple-200 hover:shadow-purple-100/60"
        )}
      >
        <div className="mb-4 flex items-start justify-between">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border p-2.5 text-lg font-bold text-slate-900"
            style={{ background: isPaymentGateway ? `${item.accentColor || '#8b5cf6'}12` : item.logoFallback ? `${item.accentColor}14` : '#f8fafc', border: `1px solid ${isPaymentGateway ? `${item.accentColor || '#8b5cf6'}30` : item.logoFallback ? item.accentColor + '25' : '#ede9fe'}` }}>
            {item.logoFallback ? (
              <span className="text-xl leading-none">{item.logoFallback}</span>
            ) : (
              <img
                src={item.logo} alt={item.name}
                className="w-full h-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = `<span style="font-size:18px">🔌</span>`; }}
              />
            )}
          </div>
          {isConnected ? (
            <span className="bg-green-50 text-green-600 border border-green-200 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
              Live
            </span>
          ) : isPaymentGateway ? (
            <span className="bg-purple-50 text-purple-600 border border-purple-200 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">
              Payment
            </span>
          ) : item.badge === 'New' ? (
            <span className="text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest"
              style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.25)' }}>
              New
            </span>
          ) : item.badge === 'Featured' ? (
            <span className="text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}>
              ⚡ Featured
            </span>
          ) : isUpcoming ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-700">
              Upcoming
            </span>
          ) : (
            <span className="bg-purple-50 text-purple-600 border border-purple-200 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase">
              Connect
            </span>
          )}
        </div>
        <h4 className="text-base font-bold leading-tight text-slate-900 transition-colors group-hover:text-purple-700">{item.name}</h4>
        {isPaymentGateway && (
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-purple-500">Payment Gateway</p>
        )}
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-500">{item.description}</p>
        {isConnected && connection.label && (
          <p className="mt-3 truncate text-xs font-bold text-green-600">{connection.label}</p>
        )}
        <button
          type="button"
          disabled={isUpcoming}
          className={cn(
            "mt-5 h-11 rounded-xl text-sm font-bold text-white shadow-md transition-all",
            isUpcoming
              ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-500 shadow-none"
              : "bg-linear-to-b from-[#9200cc] to-[#34075a] shadow-purple-200 hover:opacity-95"
          )}
        >
          {isUpcoming ? 'Coming Soon' : isConnected ? 'Manage' : 'Connect'}
        </button>
      </div>
    );
  };

  const renderSettingsHub = () => {
    const sections = [
      {
        Icon: KeyRound,
        title: 'Account & Security',
        desc: 'Update your profile, password, avatar, and two-factor authentication.',
        action: () => onNavigate?.('profile'),
      },
      {
        Icon: Users,
        title: 'Team, Roles & Departments',
        desc: 'Invite members and manage workspace access, teams, roles, and departments.',
        action: () => setSettingsMode('team'),
      },
      {
        Icon: FileCheck2,
        title: 'Business Verification',
        desc: 'Submit KYB details and track manual verification status.',
        action: () => setSettingsMode('kyb'),
      },
      {
        Icon: FileCheck2,
        title: 'Template Governance',
        desc: 'Control whether templates launch immediately or require internal approval.',
        action: () => setSettingsMode('template-governance'),
      },
      {
        Icon: Bot,
        title: 'AI Agent & Knowledge Base',
        desc: 'Train AI replies with FAQs, policies, website content, and handoff rules.',
        action: () => onNavigate?.('ai-agent'),
      },
      {
        Icon: Building2,
        title: 'Workspace',
        desc: 'General workspace settings, name, and regional preferences.',
        action: () => setSettingsMode('workspace'),
      },
      {
        Icon: GitBranch,
        title: 'CRM & Lead Stages',
        desc: 'Configure opportunity stages, lead status, and CRM mapping.',
        action: () => setSettingsMode('crm'),
      },
      {
        Icon: Users,
        title: 'Team Management',
        desc: 'Manage users, invite team members, and define roles/permissions.',
        action: () => setSettingsMode('team'),
      },
      {
        Icon: Palette,
        title: 'Branding & Identity',
        desc: 'Customize logos, colors, and global communication styles.',
        action: () => setSettingsMode('branding'),
      },
      {
        Icon: Palette,
        title: 'Conversation Assignment Rules',
        desc: 'Define how incoming conversations are routed to your team members and bots.',
        action: () => setSettingsMode('assignment'),
      },
      {
        Icon: Puzzle,
        title: 'API & Integrations',
        desc: 'Manage API keys, webhooks, and third-party app connections.',
        action: () => onNavigate?.('integrations'),
      },
      {
        Icon: LayoutDashboard,
        title: 'Configure CRM',
        desc: 'Define lead stages, lead status, working hours, deals pipelines and campaigns.',
        action: () => setSettingsMode('configure-crm'),
      },
    ];

    return (
      <div className={settingsPageShell}>
        <div>
          <h1 className={settingsTitle}>Settings Overview</h1>
          <p className={settingsSubtitle}>
            Select a category to manage your workspace preferences and platform configuration.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sections.map(({ Icon, title, desc, action }, i) => (
            <button
              key={i}
              type="button"
              onClick={action}
              className={settingsCard}
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 transition-colors group-hover:bg-purple-100">
                <Icon size={18} className="text-purple-600" />
              </div>
              <p className="text-sm font-bold text-gray-900">{title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-400">{desc}</p>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-b from-[#9200cc] to-[#34075a] p-7 text-white xl:col-span-2">
            <div className="absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-white/5" />
            <div className="absolute -bottom-14 -right-2 h-56 w-56 rounded-full bg-white/5" />

            <h2 className="relative z-10 text-xl font-bold">Optimization Checkup</h2>
            <p className="relative z-10 mb-5 mt-2 max-w-sm text-sm text-white/70">
              Your workspace is 85% configured. Completing your CRM mapping will unlock advanced
              automation features and lead scoring metrics.
            </p>
            <button
              type="button"
              onClick={() => onNavigate?.('integrations')}
              className="relative z-10 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50"
            >
              Complete Setup
              <span>⚡</span>
            </button>
          </div>

          <div className={`flex flex-col ${settingsMiniCard}`}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
                <ShieldCheck size={18} className="text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  System Health
                </p>
                <p className="text-sm font-bold text-gray-800">All systems functional</p>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 text-xs text-gray-500">
              <p>
                API Latency: <span className="font-semibold text-gray-700">42ms</span>
              </p>
              <p>
                Webhooks: <span className="font-semibold text-green-600">Active</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettingsMode('status')}
              className="mt-4 flex items-center gap-1 self-start text-xs font-medium text-purple-600 hover:underline"
            >
              View status page
              <span className="text-[10px]">↗</span>
            </button>
          </div>
        </div>

        <div className={`flex items-center gap-4 ${settingsMiniCard}`}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-purple-100">
            <Bot size={22} className="text-purple-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-800">Need help with Greeto?</p>
            <p className="mt-0.5 text-xs text-gray-400">
              Check our knowledge base or schedule a configuration call with an expert.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Read Docs
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('integrations')}
              className="rounded-xl bg-linear-to-b from-[#9200cc] to-[#34075a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6d28d9]"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    );
  };

  const BackToSettings = ({ title, desc }) => (
    <div>
      <button
        type="button"
        onClick={() => setSettingsMode('overview')}
        className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500 transition-colors hover:text-purple-600"
      >
        <ArrowLeft size={13} />
        Back to Settings
      </button>
      <h1 className={settingsTitle}>{title}</h1>
      <p className={settingsSubtitle}>{desc}</p>
    </div>
  );

  const renderSettingsSubpage = () => {
    const page = settingsMode;
    if (page === 'status') {
      const healthy = systemStatus.providers.filter((provider) => provider.status === 'healthy').length;
      const warning = systemStatus.providers.filter((provider) => provider.status === 'warning').length;
      const critical = systemStatus.providers.filter((provider) => provider.status === 'critical').length;
      const total = healthy + warning + critical;
      const healthScore = total ? Math.max(0, Math.round(((healthy + warning * 0.55) / total) * 100)) : 100;
      const chartData = [
        { label: 'Healthy', value: healthy, color: '#10b981' },
        { label: 'Warning', value: warning, color: '#f59e0b' },
        { label: 'Critical', value: critical, color: '#f43f5e' },
        { label: 'Retries', value: systemStatus.retryJobs.length, color: '#7c3aed' },
        { label: 'Webhooks', value: systemStatus.webhookEvents.length, color: '#0f766e' },
      ];
      const statusList = (title, subtitle, rows, empty, Icon = CheckCircle2) => (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-bold text-gray-950">{title}</h2>
            <p className="mt-1 text-xs font-medium text-gray-500">{subtitle}</p>
          </div>
          <div className="space-y-3">
            {rows.slice(0, 8).map((row, index) => (
              <div key={row.id || row.providerKey || index} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900">{row.providerKey || row.category || row.action || 'Provider'}</p>
                    <p className="mt-1 text-xs text-gray-500">{row.lastError || row.errorMessage || row.sourceAction || row.action || `Created ${formatSettingsDate(row.createdAt)}`}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusTone(row.status || 'warning')}`}>
                    {String(row.status || `${row.count || 0} events`).replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
            {!rows.length && (
              <p className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
                <Icon size={16} /> {empty}
              </p>
            )}
          </div>
        </section>
      );

      return (
        <div className="min-h-full space-y-5 bg-[#f6f7fb] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => setSettingsMode('overview')}
                className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-purple-600"
              >
                <ArrowLeft size={13} /> Back to Settings
              </button>
              <h1 className={settingsTitle}>Workspace Health & Audit</h1>
              <p className={settingsSubtitle}>Provider health, webhook failures, retry queues, rate limits, and delivery polling.</p>
            </div>
            <button
              type="button"
              onClick={() => void loadSystemStatus()}
              disabled={systemStatusLoading}
              className="flex items-center gap-2 rounded-xl bg-gray-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {systemStatusLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Refresh
            </button>
          </div>

          {systemStatusError && (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {systemStatusError}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-4">
            {[
              { label: 'Health score', value: `${healthScore}%`, icon: ShieldCheck, tone: healthScore >= 80 ? 'text-emerald-600 bg-emerald-50' : 'text-amber-700 bg-amber-50' },
              { label: 'Retry jobs', value: systemStatus.retryJobs.length, icon: RotateCcw, tone: systemStatus.retryJobs.length ? 'text-amber-700 bg-amber-50' : 'text-emerald-600 bg-emerald-50' },
              { label: 'Webhook issues', value: systemStatus.webhookEvents.length, icon: Zap, tone: systemStatus.webhookEvents.length ? 'text-rose-700 bg-rose-50' : 'text-emerald-600 bg-emerald-50' },
              { label: 'Rate-limit events', value: systemStatus.rateLimitEvents.length, icon: Clock, tone: systemStatus.rateLimitEvents.length ? 'text-amber-700 bg-amber-50' : 'text-emerald-600 bg-emerald-50' },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                  <Icon size={18} />
                </div>
                <p className="text-2xl font-bold text-gray-950">{value}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-950">Integration Health</h2>
                  <p className="mt-1 text-xs font-medium text-gray-500">Live readiness checks from connected vendor accounts.</p>
                </div>
                <span className="text-xs font-semibold text-gray-400">Updated {formatSettingsDate(systemStatus.generatedAt)}</span>
              </div>
              <div className="grid gap-3">
                {systemStatus.providers.slice(0, 8).map((provider) => (
                  <div key={provider.providerKey} className="rounded-xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900">{provider.providerName}</p>
                        <p className="mt-1 text-xs font-semibold text-gray-400">{provider.category} / {provider.providerKey}</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusTone(provider.status)}`}>{provider.status}</span>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {provider.checks.slice(0, 4).map((check) => (
                        <div key={check.key} className="rounded-lg bg-gray-50 px-3 py-2">
                          <p className="text-xs font-bold text-gray-700">{check.label}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-gray-500">{check.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!systemStatusLoading && !systemStatus.providers.length && (
                  <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">No connected integrations yet.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="mb-4 font-bold text-gray-950">Operational Mix</h2>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={chartData}>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 8px 24px rgba(15,23,42,0.12)', fontSize: 12 }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry) => <Cell key={entry.label} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {statusList('Provider Retry Queue', 'Retryable outbound delivery failures.', systemStatus.retryJobs, 'No retry jobs need attention.')}
            {statusList('Webhook Failure Audit', 'Inbound provider events that need review or retry.', systemStatus.webhookEvents, 'No webhook events need attention.')}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {statusList('Rate Limit Events', 'Provider throttling and retry pressure.', systemStatus.rateLimitEvents, 'No rate-limit pressure in the selected window.', Slash)}
            {statusList('Delivery Status Polling', 'Message and payment status polling jobs.', systemStatus.deliveryJobs, 'No delivery polling jobs need attention.', Slash)}
          </div>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="font-bold text-gray-950">Recent Integration Logs</h2>
            <div className="mt-4 divide-y divide-gray-50">
              {systemStatus.logs.map((log) => (
                <div key={log.id} className="grid gap-3 py-3 text-sm md:grid-cols-[1fr_auto_auto]">
                  <span className="font-semibold text-gray-800">{log.category} / {log.action}</span>
                  <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-bold capitalize ${statusTone(log.status)}`}>{log.status}</span>
                  <span className="text-gray-400">{formatSettingsDate(log.createdAt)}</span>
                </div>
              ))}
              {!systemStatus.logs.length && <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">No integration logs yet.</p>}
            </div>
          </section>
        </div>
      );
    }

    if (page === 'workspace') {
      const timezones = [
        '(GMT-12:00) International Date Line West',
        '(GMT-08:00) Pacific Time (US & Canada)',
        '(GMT-07:00) Mountain Time (US & Canada)',
        '(GMT-06:00) Central Time (US & Canada)',
        '(GMT-05:00) Eastern Time (US & Canada)',
        '(GMT+00:00) UTC',
        '(GMT+01:00) London',
        '(GMT+05:30) Mumbai',
        '(GMT+08:00) Singapore',
        '(GMT+09:00) Tokyo',
      ];
      const locales = [
        'English (United States)',
        'English (United Kingdom)',
        'Spanish (Spain)',
        'French (France)',
        'German (Germany)',
        'Portuguese (Brazil)',
        'Japanese',
      ];
      return (
        <div className="min-h-full space-y-5 bg-[#f5f4fb] p-6">
          <div>
            <button
              type="button"
              onClick={() => setSettingsMode('overview')}
              className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500 transition-colors hover:text-purple-600"
            >
              <ArrowLeft size={13} />
              Back to Settings
            </button>
            <h1 className={settingsTitle}>Workspace Settings</h1>
            <p className={settingsSubtitle}>
              Manage your Greeto workspace identity, regional preferences, and regional settings.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className={`${settingsCard} lg:col-span-2`}>
              <h2 className="mb-5 font-bold text-gray-800">General Information</h2>

              <div className="mb-5">
                <label className="mb-2 block text-xs font-medium text-gray-500">Workspace Name</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <p className="mt-1.5 text-xs text-gray-400">This will be visible to all members of this workspace.</p>
              </div>

              <div className="mb-6 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-500">Primary Time Zone</label>
                  <div className="relative">
                    <select
                      value={workspaceTimezone}
                      onChange={(event) => setWorkspaceTimezone(event.target.value)}
                      className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 pr-9 text-sm text-gray-800 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      {timezones.map((timezone) => (
                        <option key={timezone}>{timezone}</option>
                      ))}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-gray-500">Locale / Language</label>
                  <div className="relative">
                    <select
                      value={workspaceLocale}
                      onChange={(event) => setWorkspaceLocale(event.target.value)}
                      className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 pr-9 text-sm text-gray-800 transition focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-300"
                    >
                      {locales.map((locale) => (
                        <option key={locale}>{locale}</option>
                      ))}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>

              <button className="rounded-xl bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6d28d9]">Save Changes</button>
            </div>

            <div className={`flex flex-col items-center text-center ${settingsMiniCard}`}>
              <h2 className="mb-5 self-start font-bold text-gray-800">Workspace Logo</h2>

              <div
                className="mb-3 flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#3b1a6e] to-[#1a0533]"
                onClick={() => workspaceLogoInputRef.current?.click()}
              >
                {workspaceLogoUrl ? (
                  <img src={workspaceLogoUrl} alt="Workspace logo" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                )}
              </div>

              <input
                ref={workspaceLogoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setWorkspaceLogoUrl(URL.createObjectURL(file));
                }}
              />

              <button
                type="button"
                onClick={() => workspaceLogoInputRef.current?.click()}
                className="mb-1 flex items-center gap-1 text-xs font-semibold text-purple-600 hover:underline"
              >
                <Upload size={12} />
                Click to upload
              </button>
              <p className="text-[11px] leading-relaxed text-gray-400">
                Recommended: Square<br />PNG/JPG,<br />min 400x400px
              </p>

              <div className="my-4 w-full border-t border-gray-100" />

              <div className="flex w-full items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setWorkspaceLogoUrl(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-red-500 hover:underline"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => workspaceLogoInputRef.current?.click()}
                  className="rounded-lg bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200"
                >
                  Update
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
                <Mail size={18} className="text-teal-600" />
              </div>
              <h3 className="mb-2 text-sm font-bold text-gray-800">Email Defaults</h3>
              <p className="mb-4 text-xs leading-relaxed text-gray-400">
                Set your global sending domain and default footer signature.
              </p>
              <button className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline">
                Configure <ArrowRight size={13} />
              </button>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                <Globe size={18} className="text-orange-500" />
              </div>
              <h3 className="mb-2 text-sm font-bold text-gray-800">Custom Domain</h3>
              <p className="mb-4 text-xs leading-relaxed text-gray-400">
                White-label your workflow links with your own subdomain.
              </p>
              <button className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline">
                Manage DNS <ArrowRight size={13} />
              </button>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
                <Code2 size={18} className="text-purple-600" />
              </div>
              <h3 className="mb-2 text-sm font-bold text-gray-800">API Access</h3>
              <p className="mb-4 text-xs leading-relaxed text-gray-400">
                Generate secret keys to integrate Greeto with your own tools.
              </p>
              <button className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline">
                View Keys <ArrowRight size={13} />
              </button>
            </div>
          </div>

          <div className={`flex items-center justify-between ${settingsMiniCard}`}>
            <div>
              <h3 className="mb-1 text-base font-bold text-red-500">Archive Workspace</h3>
              <p className="text-sm text-gray-500">
                Once archived, workflow sends will be paused. This action can be undone.
              </p>
            </div>
            <button className="shrink-0 rounded-xl border-2 border-red-400 px-5 py-3 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50">
              Archive<br />Workspace
            </button>
          </div>
        </div>
      );
    }

    if (page === 'template-governance') {
      const approvalOn = false;
      return (
        <div className="min-h-full bg-[#f5f4fb] p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => setSettingsMode('overview')}
                className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 transition-colors hover:text-purple-700"
              >
                <ArrowLeft size={14} /> BACK TO SETTINGS
              </button>
              <h1 className={settingsTitle}>Template Governance</h1>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Choose whether templates should go through an internal approval gate before campaigns and workflows can use them.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Current mode</p>
              <p className={cn("mt-1 text-sm font-bold", approvalOn ? "text-amber-700" : "text-emerald-700")}>
                {approvalOn ? "Approval required" : "Fast launch"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <button
              type="button"
              className={cn(
                "rounded-2xl border bg-white p-6 text-left shadow-sm transition-all",
                !approvalOn ? "border-emerald-300 ring-2 ring-emerald-100" : "border-gray-100 hover:border-emerald-200"
              )}
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={24} />
                </span>
                {!approvalOn && (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Active
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-900">Fast launch</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Best for small teams. Templates become usable immediately after creation, unless a template is explicitly rejected.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-gray-600">
                <li>Templates auto-mark as ready.</li>
                <li>Campaign/workflow setup is faster.</li>
                <li>Meta WhatsApp approval still remains separate.</li>
              </ul>
            </button>

            <button
              type="button"
              className={cn(
                "rounded-2xl border bg-white p-6 text-left shadow-sm transition-all",
                approvalOn ? "border-amber-300 ring-2 ring-amber-100" : "border-gray-100 hover:border-amber-200"
              )}
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <ShieldCheck size={24} />
                </span>
                {approvalOn && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    Active
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-gray-900">Approval required</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Best for managed teams. Templates must be reviewed before they can be selected in campaigns and workflows.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-gray-600">
                <li>Draft to pending approval flow.</li>
                <li>Approver can approve or reject with reason.</li>
                <li>Only approved templates can launch outreach.</li>
              </ul>
            </button>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                <FileCheck2 size={20} />
              </span>
              <div>
                <p className="text-sm font-bold text-gray-900">How this affects templates</p>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  When fast launch is active, campaign and workflow screens show usable templates without forcing a separate approval step.
                  When approval is required, those screens only show approved templates.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              { label: 'Draft templates', value: 'Saved but not submitted', Icon: FileCheck2 },
              { label: 'Pending review', value: 'Waiting for internal approval', Icon: ShieldCheck },
              { label: 'Approved inventory', value: 'Ready for outreach', Icon: CheckCircle2 },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                  <Icon size={18} />
                </div>
                <p className="text-sm font-bold text-gray-900">{label}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">{value}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (page === 'crm' || page === 'configure-crm') {
      const crmTabs = ['Lead Stages', 'Lead Status', 'Deal Pipeline', 'Sources', 'Campaigns'];
      const crmActionLabels = {
        'Lead Stages': 'Create Lead Stages',
        'Lead Status': 'Create Status',
        'Deal Pipeline': 'Add Deal',
        Sources: 'Add Source',
        Campaigns: 'Create Campaign',
      };
      const stageRows = [
        { name: 'N2 Fresh Leads', desc: 'Imported from Cheerio team b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', contacts: 71, inbox: 0, type: 'Open', color: '#3b82f6' },
        { name: 'N2 Minus', desc: 'Imported from Cheerio team b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', contacts: 0, inbox: 0, type: 'Open', color: '#10b981' },
        { name: 'Contacted', desc: 'Agent has spoken with this lead.', contacts: 384, inbox: 16, type: 'Open', color: '#6366f1' },
        { name: 'Converted Or Won', desc: 'Won opportunities and converted leads.', contacts: 21, inbox: 2, type: 'Closed', color: '#f59e0b' },
      ];
      const statusRows = [
        { name: 'New', desc: 'Fresh lead waiting for first touch.', contacts: 830, inbox: 42, active: true, color: '#7c3aed' },
        { name: 'Follow Up', desc: 'Needs a scheduled callback or WhatsApp follow-up.', contacts: 612, inbox: 18, active: true, color: '#2563eb' },
        { name: 'Not Interested', desc: 'Lead opted out or declined.', contacts: 118, inbox: 4, active: false, color: '#64748b' },
      ];
      const dealColumns = [
        { title: 'Uncontacted', count: 4, cards: [{ name: 'Alex Thompson', value: '$12,400', tag: 'COLD LEAD', bg: 'bg-emerald-500' }, { name: 'Sarah Jenkins', value: '$8,900', tag: 'DIRECT MESSAGE', bg: 'bg-red-500' }] },
        { title: 'Contacted', count: 2, cards: [{ name: 'Michael Chen', value: '$45,000', tag: 'REPLIED', bg: 'bg-slate-700' }] },
        { title: 'Qualified', count: 3, cards: [{ name: 'Elena Rodriguez', value: '$120,000', tag: 'HIGH VALUE', bg: 'bg-indigo-500' }] },
        { title: 'Negotiation', count: 2, cards: [{ name: 'Sam Patel', value: '$67,000', tag: 'PROPOSAL SENT', bg: 'bg-purple-500' }] },
      ];
      const sources = [
        { name: 'google_ads', leads: 824, quality: 'High', color: 'bg-blue-50 text-blue-600' },
        { name: 'facebook', leads: 411, quality: 'Medium', color: 'bg-purple-50 text-purple-600' },
        { name: 'direct_import', leads: 207, quality: 'High', color: 'bg-emerald-50 text-emerald-600' },
      ];
      const crmCampaigns = [
        { name: 'N2 Fresh Leads 10-Day Follow-up', status: 'Running', sent: 2310, conversion: '18.4%' },
        { name: 'Webinar Follow-up', status: 'Draft', sent: 0, conversion: '-' },
        { name: 'Converted Or Won Nurture', status: 'Completed', sent: 914, conversion: '27.1%' },
      ];
      const renderStats = (stats) => (
        <div className="grid gap-4 md:grid-cols-3">
          {stats.map(({ label, value, Icon, tone }) => (
            <div key={label} className={settingsMiniCard}>
              <div className={cn("mb-5 flex h-12 w-12 items-center justify-center rounded-2xl", tone)}>
                <Icon size={22} />
              </div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{label}</p>
              <p className="text-3xl font-black text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      );
      const renderRowActions = () => (
        <div className="flex items-center justify-end gap-1">
          {[ArrowUp, ArrowDown, Pencil, Trash2].map((ActionIcon, index) => (
            <button key={index} type="button" className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
              <ActionIcon size={14} />
            </button>
          ))}
        </div>
      );
      const renderActiveCrmTab = () => {
        if (activeCrmSettingsTab === 'Lead Status') {
          return (
            <>
              {renderStats([
                { label: 'Total Status', value: statusRows.length, Icon: LayoutDashboard, tone: 'bg-purple-50 text-purple-600' },
                { label: 'Active Status', value: statusRows.filter((item) => item.active).length, Icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
                { label: 'Tracked Leads', value: '1.5K', Icon: Target, tone: 'bg-blue-50 text-blue-600' },
              ])}
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <div className="border-b border-gray-100 px-6 py-4">
                  <p className="text-sm font-bold text-gray-900">Lead Status</p>
                  <p className="text-xs text-gray-500">Status labels are visible in contacts, inbox and Customer 360.</p>
                </div>
                <div className="grid grid-cols-[1fr_120px_120px_110px_120px] border-b border-gray-100 bg-gray-50/60 px-6 py-3">
                  {['Status', 'Contacts', 'Inbox', 'State', 'Actions'].map((label) => <p key={label} className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>)}
                </div>
                {statusRows.map((status) => (
                  <div key={status.name} className="grid grid-cols-[1fr_120px_120px_110px_120px] items-center border-b border-gray-50 px-6 py-4 last:border-0 hover:bg-gray-50/60">
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
                      <div><p className="text-sm font-bold text-gray-900">{status.name}</p><p className="text-xs text-gray-500">{status.desc}</p></div>
                    </div>
                    <p className="text-sm font-bold text-gray-800">{status.contacts}</p>
                    <p className="text-sm font-bold text-gray-800">{status.inbox}</p>
                    <span className={cn("w-fit rounded-full px-3 py-1 text-xs font-bold", status.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600')}>{status.active ? 'Active' : 'Inactive'}</span>
                    {renderRowActions()}
                  </div>
                ))}
              </div>
            </>
          );
        }
        if (activeCrmSettingsTab === 'Deal Pipeline') {
          return (
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                {dealColumns.map((column) => (
                  <div key={column.title} className="flex w-[260px] min-w-[260px] flex-col gap-3">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2"><p className="text-sm font-bold text-gray-800">{column.title}</p><span className="text-xs font-medium text-gray-400">{column.count}</span></div>
                      <button className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 text-gray-400 hover:border-purple-400 hover:text-purple-500"><Plus size={14} /></button>
                    </div>
                    <div className="flex min-h-[500px] flex-col gap-3 rounded-2xl bg-gray-100/70 p-3">
                      {column.cards.map((card) => (
                        <div key={card.name} className="flex cursor-pointer flex-col gap-2 rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md">
                          <span className="self-start rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-purple-600">{card.tag}</span>
                          <p className="text-sm font-bold text-gray-900">{card.name}</p>
                          <div className="flex items-center justify-between"><p className="text-sm font-bold text-purple-600">{card.value}</p><span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white", card.bg)}>{card.name.split(' ').map((part) => part[0]).join('')}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        if (activeCrmSettingsTab === 'Sources') {
          return (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4"><p className="text-sm font-bold text-gray-900">Sources</p><p className="text-xs text-gray-500">Track where leads enter the CRM.</p></div>
              {sources.map((source) => (
                <div key={source.name} className="grid grid-cols-[1fr_140px_140px_120px] items-center border-b border-gray-50 px-6 py-4 last:border-0">
                  <div><p className="text-sm font-bold text-gray-900">{source.name}</p><p className="text-xs text-gray-500">Mapped from inbound payload and campaign UTM.</p></div>
                  <p className="text-sm font-bold text-gray-800">{source.leads}</p>
                  <span className={cn("w-fit rounded-full px-3 py-1 text-xs font-bold", source.color)}>{source.quality}</span>
                  {renderRowActions()}
                </div>
              ))}
            </div>
          );
        }
        if (activeCrmSettingsTab === 'Campaigns') {
          return (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4"><p className="text-sm font-bold text-gray-900">Campaigns</p><p className="text-xs text-gray-500">Campaigns connected with CRM segments, templates, and workflow triggers.</p></div>
              {crmCampaigns.map((campaign) => (
                <div key={campaign.name} className="grid grid-cols-[1fr_120px_120px_120px_120px] items-center border-b border-gray-50 px-6 py-4 last:border-0">
                  <div><p className="text-sm font-bold text-gray-900">{campaign.name}</p><p className="text-xs text-gray-500">Uses WhatsApp templates and CRM audience filters.</p></div>
                  <span className="w-fit rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">{campaign.status}</span>
                  <p className="text-sm font-bold text-gray-800">{campaign.sent}</p>
                  <p className="text-sm font-bold text-gray-800">{campaign.conversion}</p>
                  {renderRowActions()}
                </div>
              ))}
            </div>
          );
        }
        return (
          <>
            {renderStats([
              { label: 'Total Stages', value: stageRows.length + 14, Icon: BarChart3, tone: 'bg-purple-50 text-purple-600' },
              { label: 'Open Stages', value: 14, Icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
              { label: 'Tracked Leads', value: 2072, Icon: Target, tone: 'bg-blue-50 text-blue-600' },
            ])}
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4"><p className="text-sm font-bold text-gray-900">Lead Stages</p><p className="text-xs text-gray-500">Same pipeline stages are used by inbox, automation, and Customer 360.</p></div>
              <div className="grid grid-cols-[64px_1fr_120px_120px_100px_132px] border-b border-gray-100 bg-gray-50/60 px-6 py-3">
                {['Order', 'Stage', 'Contacts', 'Inbox', 'Type', 'Actions'].map((label) => <p key={label} className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>)}
              </div>
              {stageRows.map((stage, index) => (
                <div key={stage.name} className="grid grid-cols-[64px_1fr_120px_120px_100px_132px] items-center border-b border-gray-50 px-6 py-4 last:border-0 hover:bg-gray-50/60">
                  <p className="text-sm font-medium text-gray-400">{String(index + 1).padStart(2, '0')}</p>
                  <div className="flex items-center gap-3"><span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: stage.color }} /><div><p className="text-sm font-bold text-gray-900">{stage.name}</p><p className="text-xs text-gray-500">{stage.desc}</p></div></div>
                  <p className="text-sm font-bold text-gray-800">{stage.contacts}</p>
                  <p className="text-sm font-bold text-gray-800">{stage.inbox}</p>
                  <span className={cn("w-fit rounded-full px-3 py-1 text-xs font-bold", stage.type === 'Closed' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700')}>{stage.type}</span>
                  {renderRowActions()}
                </div>
              ))}
            </div>
          </>
        );
      };
      return (
        <div className="flex min-h-full flex-col gap-5 bg-[#f5f4fb] p-6">
          <div className="flex items-start justify-between">
            <div>
              <button
                type="button"
                onClick={() => setSettingsMode('overview')}
                className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500 transition-colors hover:text-purple-600"
              >
                <ArrowLeft size={13} />
                Back to Settings
              </button>
              <h1 className={settingsTitle}>Configure CRM</h1>
              <p className={settingsSubtitle}>Manage your Greeto CRM Settings, Lead stages, and other settings.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeCrmSettingsTab === 'Lead Stages') onNavigate?.('lead-stages');
                if (activeCrmSettingsTab === 'Lead Status') onNavigate?.('lead-status');
                if (activeCrmSettingsTab === 'Campaigns') onNavigate?.('campaigns');
              }}
              className="mt-6 flex shrink-0 items-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6d28d9]"
            >
              <Plus size={16} />
              {crmActionLabels[activeCrmSettingsTab]}
            </button>
          </div>

          <div className="flex border-b border-gray-200">
            {crmTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveCrmSettingsTab(tab)}
                className={cn(
                  "px-5 py-2.5 -mb-px border-b-2 text-sm font-semibold transition-colors",
                  activeCrmSettingsTab === tab
                    ? "border-purple-600 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex flex-1 flex-col gap-5">
            {renderActiveCrmTab()}
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-6 py-4 shadow-sm">
            <Info size={15} className="shrink-0 text-gray-400" />
            <p className="flex-1 text-xs text-gray-500">CRM configuration changes are saved immediately and reflected in inbox, contacts, workflows, and Customer 360.</p>
          </div>
        </div>
      );
    }

    if (page === 'kyb') {
      return (
        <div className="min-h-full space-y-6 bg-[#f5f4fb] p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            <button
              type="button"
              onClick={() => setSettingsMode('overview')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-600 transition-colors hover:text-purple-700"
            >
              <ArrowLeft size={14} /> Back to Settings
            </button>

            <div className="overflow-hidden rounded-3xl bg-linear-to-b from-[#9200cc] to-[#34075a] p-6 text-white shadow-xl shadow-purple-200/60">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <FileCheck2 size={24} />
              </div>
              <h1 className="text-2xl font-bold">KYC / KYB Verification</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-white/75">
                Submit KYC/KYB business details. This flow works now as manual admin review; external provider verification can be added later when credentials are available.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-purple-600" size={22} />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">KYC / KYB Status</p>
                    <span className="mt-2 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                      Under review
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-gray-500">
                  Your KYB details are with the Greeto admin team.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-sm font-bold text-gray-900">Business verification checklist</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    'Legal business name',
                    'GST / registration number',
                    'Business website',
                    'Registered address',
                  ].map((item) => (
                    <div key={item} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="text-xs font-semibold text-gray-700">{item}</p>
                      <p className="mt-1 text-[11px] text-gray-400">Required for manual review</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: 'Legal Business Name', placeholder: 'Enter registered business name' },
                  { label: 'GST / Registration Number', placeholder: 'Enter GSTIN or company registration' },
                  { label: 'Business Website', placeholder: 'https://yourcompany.com' },
                  { label: 'Registered Address', placeholder: 'Enter complete registered address' },
                ].map((field) => (
                  <label key={field.label} className="block">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{field.label}</span>
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      className="mt-2 h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition-colors focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between rounded-2xl bg-purple-50 px-4 py-3">
                <p className="text-xs font-medium text-purple-700">
                  Submitted details go to admin review before verification is marked approved.
                </p>
                <button
                  type="button"
                  className="rounded-xl bg-linear-to-b from-[#9200cc] to-[#34075a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:opacity-95"
                >
                  Submit for Review
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (page === 'branding') {
      const fontOptions = [
        'Hanken Grotesk', 'Inter', 'DM Sans', 'Plus Jakarta Sans',
        'Poppins', 'Nunito', 'Lato', 'Open Sans', 'Roboto', 'Montserrat',
      ];
      const weightLabels = {
        100: '100 (Thin)',
        200: '200 (ExtraLight)',
        300: '300 (Light)',
        400: '400 (Regular)',
        500: '500 (Medium)',
        600: '600 (SemiBold)',
        700: '700 (Bold)',
        800: '800 (ExtraBold)',
        900: '900 (Black)',
      };
      const colorFields = [
        { label: 'Primary Brand Color', key: 'primary', ref: primaryBrandColorRef },
        { label: 'Secondary Color', key: 'secondary', ref: secondaryBrandColorRef },
        { label: 'Accent Color', key: 'accent', ref: accentBrandColorRef },
      ];
      const setHexColor = (key, value) => {
        const clean = value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
        if (clean.length === 6) {
          setBrandColors((prev) => ({ ...prev, [key]: `#${clean}` }));
        }
      };
      const handleBrandLogo = (event, setter) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setter(URL.createObjectURL(file));
      };

      return (
        <div className="min-h-full space-y-5 bg-[#f5f4fb] p-6">
          <div>
            <button
              type="button"
              onClick={() => setSettingsMode('overview')}
              className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gray-500 transition-colors hover:text-purple-600"
            >
              <ArrowLeft size={13} />
              Back to Settings
            </button>
            <h1 className={settingsTitle}>Branding</h1>
            <p className={settingsSubtitle}>
              Centralize your visual assets and communication style for consistent marketing across all channels.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                  <h2 className="font-bold text-gray-800">Asset Library</h2>
                </div>
                <button className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:underline">
                  <Download size={12} /> Download All Assets
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div
                  className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-gray-200 p-5 transition-colors hover:border-purple-300"
                  onClick={() => primaryBrandLogoRef.current?.click()}
                >
                  <div className="mb-3 flex h-36 w-full items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                    {primaryBrandLogo ? (
                      <img src={primaryBrandLogo} alt="Primary logo" loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
                        <path d="M24 4 L36 28 L24 52 L12 28 Z" fill="#7c3aed" opacity="0.7" />
                        <path d="M16 18 L24 4 L32 18" fill="#38bdf8" opacity="0.8" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Primary Logo</p>
                  <p className="mb-3 text-xs text-gray-400">SVG, PNG, or JPG (max. 2MB)</p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      primaryBrandLogoRef.current?.click();
                    }}
                    className="rounded-lg bg-[#7c3aed] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#6d28d9]"
                  >
                    Replace Logo
                  </button>
                  <input ref={primaryBrandLogoRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleBrandLogo(event, setPrimaryBrandLogo)} />
                </div>

                <div
                  className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-gray-700 bg-[#1a1f2e] p-5 transition-colors hover:border-purple-400"
                  onClick={() => darkBrandLogoRef.current?.click()}
                >
                  <div className="mb-3 flex h-36 w-full items-center justify-center overflow-hidden rounded-lg bg-[#0f1219]">
                    {darkBrandLogo ? (
                      <img src={darkBrandLogo} alt="Dark mode logo" loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                        <path d="M26 6 L42 26 L26 46 L10 26 Z" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.6" />
                        <path d="M18 26 L26 14 L34 26 L26 38 Z" fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity="0.8" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">Dark Mode Logo</p>
                  <p className="mb-3 text-xs text-gray-400">Use for dark backgrounds</p>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      darkBrandLogoRef.current?.click();
                    }}
                    className="rounded-lg bg-gray-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-gray-600"
                  >
                    Replace Logo
                  </button>
                  <input ref={darkBrandLogoRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleBrandLogo(event, setDarkBrandLogo)} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <Palette size={18} className="text-purple-600" />
                <h2 className="font-bold text-gray-800">Brand Palette</h2>
              </div>

              <div className="space-y-4">
                {colorFields.map(({ label, key, ref }) => (
                  <div key={key}>
                    <p className="mb-2 text-xs font-medium text-gray-500">{label}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-10 w-10 shrink-0 rounded-lg border border-gray-200 transition-transform hover:scale-105"
                        style={{ backgroundColor: brandColors[key] }}
                        onClick={() => ref.current?.click()}
                      />
                      <input
                        type="color"
                        ref={ref}
                        value={brandColors[key]}
                        onChange={(event) => setBrandColors((prev) => ({ ...prev, [key]: event.target.value }))}
                        className="sr-only"
                      />
                      <input
                        type="text"
                        value={brandColors[key].replace('#', '').toUpperCase()}
                        onChange={(event) => setHexColor(key, event.target.value)}
                        maxLength={6}
                        className="flex-1 rounded-xl border border-gray-200 px-3 py-2 font-mono text-sm uppercase text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button className="mt-5 w-full rounded-xl border border-purple-300 py-2.5 text-sm font-semibold text-purple-600 transition-colors hover:bg-purple-50">
                Generate Contrast Report
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Type size={18} className="text-purple-600" />
                <h2 className="font-bold text-gray-800">Communication Style</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHeaderBrandFont('Hanken Grotesk');
                    setHeaderBrandWeight(700);
                    setBodyBrandFont('Inter');
                    setBodyBrandWeight(400);
                  }}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Discard
                </button>
                <button className="rounded-xl bg-[#7c3aed] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6d28d9]">
                  Save Changes
                </button>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                {[
                  { title: 'Email Header Font', value: headerBrandFont, setValue: setHeaderBrandFont, weight: headerBrandWeight, setWeight: setHeaderBrandWeight },
                  { title: 'Email Body Font', value: bodyBrandFont, setValue: setBodyBrandFont, weight: bodyBrandWeight, setWeight: setBodyBrandWeight },
                ].map(({ title, value, setValue, weight, setWeight }) => (
                  <div key={title} className="rounded-xl border border-gray-100 p-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</p>
                    <div className="relative mb-3">
                      <select
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2.5 pr-9 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-300"
                      >
                        {fontOptions.map((font) => (
                          <option key={font}>{font}</option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                    <div className="mb-1.5 flex items-center justify-between text-xs text-gray-400">
                      <span>Weight</span>
                      <span className="font-medium text-gray-600">{weightLabels[weight]}</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={900}
                      step={100}
                      value={weight}
                      onChange={(event) => setWeight(Number(event.target.value))}
                      className="h-1.5 w-full cursor-pointer rounded-full accent-purple-600"
                    />
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-100">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                  <p className="text-xs font-medium text-gray-500">Preview: Email Template</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-400" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400" />
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  </div>
                </div>
                <div className="bg-white p-5">
                  <div className="mb-4 h-3 w-16 rounded-full" style={{ backgroundColor: brandColors.secondary }} />
                  <p
                    className="mb-3 leading-tight text-gray-900"
                    style={{ fontFamily: headerBrandFont, fontWeight: headerBrandWeight, fontSize: '1.15rem' }}
                  >
                    Welcome to the future of automation.
                  </p>
                  <p
                    className="mb-5 text-sm leading-relaxed text-gray-500"
                    style={{ fontFamily: bodyBrandFont, fontWeight: bodyBrandWeight }}
                  >
                    Hello there! We are thrilled to have you join Greeto. This is a live preview of how your brand fonts and primary color look in a real communication context.
                  </p>
                  <button
                    className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
                    style={{ backgroundColor: brandColors.primary }}
                  >
                    Get Started Now
                  </button>
                </div>
                <div className="border-t border-gray-100 py-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Sent via Greeto Automation</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (page === 'assignment') {
      const filteredRules = assignmentRules.filter((rule) => {
        const needle = assignmentSearch.trim().toLowerCase();
        if (!needle) return true;
        return [rule.name, rule.description, rule.eventType, rule.value, rule.tags]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      });
      const activeRules = assignmentRules.filter((rule) => rule.isActive).length;
      const assignmentActions = assignmentRules.filter((rule) => rule.actionType === 'assign_agent').length;
      const assignmentRoleOptions = Object.values(assignmentMembers.reduce((roles, member) => {
        const value = String(member.roleKey || member.roleName || '').trim();
        if (value && !roles[value]) roles[value] = { value, label: member.roleName || value };
        return roles;
      }, {})).sort((left, right) => left.label.localeCompare(right.label));
      const openForm = (rule = null) => {
        if (!rule) {
          setAssignmentForm({ ...ASSIGNMENT_EMPTY_FORM });
        } else {
          setAssignmentForm({
            id: rule.id,
            name: rule.name,
            matchMode: rule.matchMode || 'all',
            field: rule.field || 'message.text',
            operator: rule.operator || 'contains',
            value: rule.value || '',
            conditions: rule.conditions?.length ? rule.conditions : [{ field: rule.field || 'message.text', operator: rule.operator || 'contains', value: rule.value || '' }],
            assignedMemberId: rule.assignedMemberId || '',
            assignmentRole: rule.assignmentRole || '',
            priority: rule.priority || 'normal',
            tags: rule.tags || '',
            notifyMessage: rule.notifyMessage || '',
            isActive: rule.isActive,
          });
        }
        setAssignmentModalError('');
        setAssignmentTestResult('');
      };

      return (
        <div className="min-h-full bg-[#f6f5fb] p-6">
          {assignmentForm && (
            <Modal
              isOpen
              onClose={() => {
                setAssignmentForm(null);
                setAssignmentModalError('');
                setAssignmentTestResult('');
              }}
              title={assignmentForm.id ? 'Edit Assignment Rule' : 'Create Assignment Rule'}
              className="max-w-3xl"
            >
              <div className="space-y-5">
                <div className="rounded-xl border border-purple-100 bg-purple-50/70 px-4 py-3 text-sm text-purple-900">
                  <span className="font-bold">Local lead routing.</span> Match course, city, email, name, or saved profile values; then route to a member or role pool.
                </div>
                {(assignmentModalError || assignmentTestResult) && (
                  <div className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold",
                    assignmentModalError ? "border-red-100 bg-red-50 text-red-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"
                  )}>
                    <AlertCircle size={16} />
                    {assignmentModalError || assignmentTestResult}
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="md:col-span-2">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Rule name</span>
                    <input
                      value={assignmentForm.name}
                      onChange={(event) => setAssignmentForm({ ...assignmentForm, name: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300"
                      placeholder="Payment issue routing"
                    />
                  </label>
                  <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="block text-xs font-bold uppercase tracking-wider text-gray-500">Lead conditions</span>
                        <span className="text-xs text-gray-500">Use All for course + city routing, or Any for alternative matches.</span>
                      </div>
                      <select
                        value={assignmentForm.matchMode}
                        onChange={(event) => setAssignmentForm({ ...assignmentForm, matchMode: event.target.value })}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 outline-none focus:border-purple-300"
                      >
                        <option value="all">Match all conditions</option>
                        <option value="any">Match any condition</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      {(assignmentForm.conditions || []).map((condition, index) => (
                        <div key={`${condition.field}-${index}`} className="grid gap-2 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1.25fr)_auto]">
                          <select
                            value={condition.field}
                            onChange={(event) => {
                              const conditions = assignmentForm.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value } : item);
                              setAssignmentForm({ ...assignmentForm, conditions, field: conditions[0]?.field || assignmentForm.field });
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-300"
                          >
                            {ASSIGNMENT_FIELDS.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
                          </select>
                          <select
                            value={condition.operator}
                            onChange={(event) => {
                              const conditions = assignmentForm.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value } : item);
                              setAssignmentForm({ ...assignmentForm, conditions, operator: conditions[0]?.operator || assignmentForm.operator });
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-300"
                          >
                            {ASSIGNMENT_OPERATORS.map((operator) => <option key={operator} value={operator}>{operator.replaceAll('_', ' ')}</option>)}
                          </select>
                          <input
                            value={condition.value}
                            onChange={(event) => {
                              const conditions = assignmentForm.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item);
                              setAssignmentForm({ ...assignmentForm, conditions, value: conditions[0]?.value || '' });
                            }}
                            disabled={['exists', 'not_exists'].includes(condition.operator)}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-purple-300 disabled:bg-gray-100"
                            placeholder={condition.field === 'contact.profile' ? 'Match any saved custom value' : 'Value'}
                          />
                          <button
                            type="button"
                            aria-label="Remove condition"
                            disabled={(assignmentForm.conditions || []).length === 1}
                            onClick={() => setAssignmentForm({ ...assignmentForm, conditions: assignmentForm.conditions.filter((_, itemIndex) => itemIndex !== index) })}
                            className="rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-500 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setAssignmentForm({ ...assignmentForm, conditions: [...(assignmentForm.conditions || []), { field: 'contact.city', operator: 'equals', value: '' }] })}
                      className="mt-3 text-sm font-bold text-purple-700 hover:text-purple-800"
                    >
                      + Add condition
                    </button>
                  </div>
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Assign to</span>
                    <select
                      value={assignmentForm.assignedMemberId}
                      onChange={(event) => setAssignmentForm({ ...assignmentForm, assignedMemberId: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300"
                    >
                      <option value="">First available agent</option>
                      {assignmentMembers.map((member) => (
                        <option key={member.id} value={member.id}>{memberLabel(member)}{member.roleName ? ` - ${member.roleName}` : ''}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Eligible role</span>
                    <select
                      value={assignmentForm.assignmentRole}
                      onChange={(event) => setAssignmentForm({ ...assignmentForm, assignmentRole: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300"
                    >
                      <option value="">Any active workspace member</option>
                      {assignmentRoleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Priority</span>
                    <select
                      value={assignmentForm.priority}
                      onChange={(event) => setAssignmentForm({ ...assignmentForm, priority: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300"
                    >
                      {ASSIGNMENT_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Tags</span>
                    <input
                      value={assignmentForm.tags}
                      onChange={(event) => setAssignmentForm({ ...assignmentForm, tags: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300"
                      placeholder="payment pending, high priority"
                    />
                  </label>
                  <label className="md:col-span-2">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Internal notification</span>
                    <input
                      value={assignmentForm.notifyMessage}
                      onChange={(event) => setAssignmentForm({ ...assignmentForm, notifyMessage: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-purple-300"
                      placeholder="Payment message matched. Check link/payment status."
                    />
                  </label>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <span>
                    <span className="block text-sm font-bold text-gray-900">Rule active</span>
                    <span className="text-xs text-gray-500">Inactive rules stay saved but do not run.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setAssignmentForm({ ...assignmentForm, isActive: !assignmentForm.isActive })}
                    className={`relative h-6 w-11 rounded-full transition ${assignmentForm.isActive ? 'bg-purple-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${assignmentForm.isActive ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </label>

                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <button
                    type="button"
                    onClick={() => void testAssignmentRule()}
                    disabled={assignmentSaving || !assignmentForm.name.trim()}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <PlayCircle size={16} />
                    Test
                  </button>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setAssignmentForm(null)} className="rounded-xl px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-50">Cancel</button>
                    <button
                      type="button"
                      onClick={() => void saveAssignmentRule()}
                      disabled={assignmentSaving || !assignmentForm.name.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {assignmentSaving && <Loader2 size={16} className="animate-spin" />}
                      Save Rule
                    </button>
                  </div>
                </div>
              </div>
            </Modal>
          )}

          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => setSettingsMode('overview')}
                className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-purple-600"
              >
                <ArrowLeft size={14} />
                Back to Settings
              </button>
              <h1 className={settingsTitle}>Conversation Assignment Rules</h1>
              <p className={settingsSubtitle}>Route local Greeto leads and incoming conversations by course, location, contact details, and workspace role.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadAssignmentRules()}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => openForm()}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-700"
              >
                <Plus size={16} />
                Create Rule
              </button>
            </div>
          </div>

          {assignmentError && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <AlertCircle size={16} />
              {assignmentError}
            </div>
          )}

          <div className="mb-5 grid gap-4 md:grid-cols-4">
            {[
              { label: 'Routing Rules', value: assignmentRules.length, Icon: Workflow, tone: 'bg-purple-50 text-purple-700' },
              { label: 'Active', value: activeRules, Icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
              { label: 'Assignment Actions', value: assignmentActions, Icon: UserCheck, tone: 'bg-blue-50 text-blue-700' },
              { label: 'Success Rate', value: `${assignmentRules.length ? 100 : 0}%`, Icon: Bot, tone: 'bg-amber-50 text-amber-700' },
            ].map(({ label, value, Icon, tone }) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
                    <Icon size={18} />
                  </span>
                  <span className="text-2xl font-black text-gray-950">{value}</span>
                </div>
                <p className="mt-3 text-xs font-bold uppercase tracking-wider text-gray-400">{label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
            <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-950">Routing Rules</h2>
                  <p className="text-xs text-gray-500">Course, city, contact attributes, and profile data decide the local assignment path.</p>
                </div>
                <div className="relative w-full sm:w-72">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={assignmentSearch}
                    onChange={(event) => setAssignmentSearch(event.target.value)}
                    placeholder="Search rules"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-purple-300"
                  />
                </div>
              </div>

              {assignmentLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-gray-400">
                  <Loader2 size={18} className="animate-spin" />
                  Loading assignment rules
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="py-16 text-center">
                  <UserCheck size={28} className="mx-auto text-gray-300" />
                  <p className="mt-3 text-sm font-bold text-gray-800">No assignment rules found</p>
                  <button
                    type="button"
                    onClick={() => openForm()}
                    className="mt-4 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700"
                  >
                    Create First Rule
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredRules.map((rule) => {
                    const member = assignmentMembers.find((item) => item.id === rule.assignedMemberId);
                    return (
                      <div key={rule.id} className="group px-5 py-4 hover:bg-gray-50/70">
                        <div className="flex items-start gap-4">
                          <button
                            type="button"
                            onClick={() => void toggleAssignmentRule(rule)}
                            className={`mt-1 h-6 w-11 shrink-0 rounded-full transition ${rule.isActive ? 'bg-purple-600' : 'bg-gray-300'}`}
                            title={rule.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${rule.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-gray-950">{rule.name}</h3>
                              <span className="rounded-lg bg-purple-50 px-2 py-1 text-[11px] font-bold text-purple-700">
                                {String(rule.eventType).replaceAll('_', ' ')}
                              </span>
                              {rule.priority !== 'normal' && (
                                <span className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700">{rule.priority}</span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              Assign to {memberLabel(member)}{rule.assignmentRole ? ` from the ${rule.assignmentRole} pool` : ''} when {rule.matchMode === 'any' ? 'any rule condition matches' : 'all rule conditions match'}.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(rule.conditions || [{ field: rule.field, operator: rule.operator, value: rule.value }]).map((condition, index) => (
                                <span key={`${condition.field}-${index}`} className="rounded-lg border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700">
                                  {(ASSIGNMENT_FIELDS.find((field) => field.id === condition.field)?.label || condition.field).replace('Lead ', '')} {String(condition.operator || 'matches').replaceAll('_', ' ')} {condition.value || 'present'}
                                </span>
                              ))}
                              {rule.tags && rule.tags.split(',').map((tag) => (
                                <span key={tag.trim()} className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">{tag.trim()}</span>
                              ))}
                              <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">Last run: {formatSettingsDate(rule.lastRunAt)}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" onClick={() => openForm(rule)} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-purple-600" title="Edit">
                              <Pencil size={16} />
                            </button>
                            <button type="button" onClick={() => void deleteAssignmentRule(rule)} className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-red-600" title="Delete">
                              <Trash2 size={16} />
                            </button>
                            <MoreHorizontal size={16} className="text-gray-300" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={17} className="text-purple-600" />
                    <h2 className="font-bold text-gray-950">Workspace Agents</h2>
                  </div>
                  <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">{assignmentMembers.length}</span>
                </div>
                <div className="space-y-3">
                  {assignmentMembers.slice(0, 8).map((member) => (
                    <div key={member.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-sm font-black text-purple-700">
                        {(member.name || member.email || 'A').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900">{memberLabel(member)}</p>
                        <p className="truncate text-xs text-gray-400">{member.roleName || member.status || 'member'}</p>
                      </div>
                    </div>
                  ))}
                  {!assignmentMembers.length && <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-sm text-gray-400">No workspace agents found.</p>}
                </div>
              </div>

              <div className="rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 p-5 text-white shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-purple-200">Live behavior</p>
                <p className="mt-2 text-lg font-black leading-snug">Rules execute automatically when inbound messages are received.</p>
                <p className="mt-3 text-sm text-purple-100">
                  Assignment changes also emit socket updates and create notifications for the assigned member.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Example route</p>
                <p className="mt-2 text-sm font-bold text-gray-950">CPA US + Bangalore</p>
                <p className="mt-1 text-sm leading-6 text-gray-500">Create two conditions, set “Match all conditions”, then choose the CPA Bangalore member or role pool.</p>
              </div>
            </aside>
          </div>
        </div>
      );
    }

    if (page === 'team' || page === 'ai-agent') {
      const config = {
        team: { title: 'Team, Roles & Departments', desc: 'Invite members and manage workspace access, teams, roles, and departments.', icon: Users, button: 'Open Team Management', go: 'team' },
        'ai-agent': { title: 'AI Agent & Knowledge Base', desc: 'Train AI replies with FAQs, policies, website content, and handoff rules.', icon: Bot, button: 'Open AI Agent', go: 'ai-agent' },
      }[page];
      const Icon = config.icon;
      return (
        <div className="min-h-full space-y-5 bg-[#f5f4fb] p-6">
          <BackToSettings title={config.title} desc={config.desc} />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className={`${settingsCard} lg:col-span-2`}>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600"><Icon size={20} /></span>
                <div>
                  <p className="text-sm font-bold text-gray-900">{config.title}</p>
                  <p className="text-xs text-gray-400">Greeto-style settings workspace</p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {['Configuration', 'Access control', 'Audit readiness', 'Workspace visibility'].map((item) => (
                  <div key={item} className="rounded-xl border border-gray-100 bg-gray-50 p-3.5 transition-all duration-200 hover:border-purple-200 hover:bg-white hover:shadow-sm">
                    <p className="text-sm font-semibold text-gray-800">{item}</p>
                    <p className="mt-1 text-xs text-gray-400">Manage and verify this setting from the linked working module.</p>
                  </div>
                ))}
              </div>
              <button onClick={() => onNavigate?.(config.go)} className="mt-5 rounded-xl bg-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6d28d9]">{config.button}</button>
            </div>
            <div className={settingsMiniCard}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Status</p>
              <p className="mt-1 text-sm font-bold text-gray-800">Ready to configure</p>
              <div className="mt-4 space-y-2 text-xs text-gray-500">
                <p><span className="font-semibold text-green-600">Active</span> workspace mode</p>
                <p><span className="font-semibold text-gray-700">Internal</span> application flow</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderOverview = () => {
    const normalizedSearch = integrationSearch.trim().toLowerCase();
    const catalogForView = activeCategoryId === 'upcoming' ? UPCOMING_INTEGRATIONS : AVAILABLE_INTEGRATIONS;
    const visibleIntegrations = catalogForView.filter((item) => {
      const category = CATEGORIES.find((entry) => entry.id === item.category)?.name || item.category || '';
      const matchesSearch = !normalizedSearch || [
        item.name,
        item.description,
        item.id,
        category,
        ...(Array.isArray(item.keywords) ? item.keywords : []),
      ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
      if (!matchesSearch) return false;
      if (activeCategoryId === 'all') return true;
      if (activeCategoryId === 'connected') return getIntegrationConnection(item).connected;
      if (activeCategoryId === 'upcoming') return true;
      return item.category === activeCategoryId;
    });

    const activeRate = AVAILABLE_INTEGRATIONS.length
      ? Math.round((connectedIntegrationCount / AVAILABLE_INTEGRATIONS.length) * 100)
      : 0;

    return (
    <div className="min-h-full bg-[#f5f4fb] p-5 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-slate-950">Integrations</h1>
          <p className="mt-1 text-sm text-slate-500">Connect channels, payments, CRM, AI, and communication providers to your workspace.</p>
        </header>

      <section className="grid gap-5 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-b from-[#9200cc] to-[#34075a] p-6 text-white shadow-lg shadow-purple-200/60 lg:col-span-2">
          <div className="relative max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-purple-200">New integration</p>
            <h2 className="mt-2 text-2xl font-bold">WhatsApp Business</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-purple-100">Connect a workspace number, receive customer messages, send approved templates, and power workflow automation.</p>
            <button type="button" onClick={() => setSelectedIntegrationId('whatsapp')} className="mt-5 h-10 rounded-xl bg-white px-5 text-sm font-bold text-purple-700 shadow-sm transition hover:bg-purple-50">
              Get Started
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Connectivity</p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">Workspace health</h3>
            </div>
            <span className={cn("rounded-full px-3 py-1 text-xs font-bold", connectedIntegrationCount ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
              {connectedIntegrationCount ? 'Healthy' : 'Setup needed'}
            </span>
          </div>
          <div className="mt-5 flex items-end justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-950">{activeRate}%</p>
              <p className="mt-1 text-xs text-slate-500">Active flows</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-slate-900">{connectedIntegrationCount}</p>
              <p className="text-xs text-slate-500">integrations connected</p>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-purple-100">
            <div className="h-full rounded-full bg-linear-to-r from-purple-600 to-fuchsia-500 transition-all" style={{ width: `${activeRate}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
            <div><p className="text-lg font-bold text-slate-900">{activeWebhookCount}</p><p className="text-xs text-slate-500">Webhooks ready</p></div>
            <div><p className="text-lg font-bold text-slate-900">{connectedProviderCount}</p><p className="text-xs text-slate-500">Providers live</p></div>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        {integrationCategoryTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategoryId(tab.id)}
            className={cn(
              "whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-semibold transition-all",
              activeCategoryId === tab.id
                ? "border-transparent bg-linear-to-b from-[#9200cc] to-[#55008f] text-white shadow-md shadow-purple-200"
                : "border-purple-100 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
            )}
          >
            {tab.name}
            <span className={cn(
              "ml-2 rounded-full px-2 py-0.5 text-[10px]",
              activeCategoryId === tab.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
            )}>{tab.count}</span>
          </button>
        ))}
      </div>

      <section>
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">{activeCategoryId === 'upcoming' ? 'Upcoming integrations' : 'Available integrations'}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {activeCategoryId === 'upcoming'
                ? `${visibleIntegrations.length} provider${visibleIntegrations.length === 1 ? '' : 's'} planned for future releases.`
                : `${visibleIntegrations.length} provider${visibleIntegrations.length === 1 ? '' : 's'} available in this view.`}
            </p>
          </div>
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={integrationSearch}
              onChange={(event) => setIntegrationSearch(event.target.value)}
              placeholder="Search integrations..."
              aria-label="Search integrations"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
            />
            {integrationSearch && (
              <button
                type="button"
                onClick={() => setIntegrationSearch('')}
                aria-label="Clear integration search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        {visibleIntegrations.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleIntegrations.map(renderIntegrationCard)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-purple-200 bg-white px-6 py-12 text-center">
            <p className="text-sm font-semibold text-slate-700">{normalizedSearch ? 'No integrations found' : 'No connected integrations yet'}</p>
            <p className="mt-1 text-xs text-slate-500">
              {normalizedSearch ? `No provider matches “${integrationSearch.trim()}”. Try another name or category.` : 'Choose another category and connect your first provider.'}
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-purple-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-950">Need a custom integration?</h2>
          <p className="mt-1 text-sm text-slate-500">Use webhooks and workspace credentials to connect an internal provider.</p>
        </div>
        <button type="button" onClick={() => setActiveCategoryId('developer')} className="h-10 shrink-0 rounded-xl border border-purple-200 bg-purple-50 px-5 text-sm font-bold text-purple-700 transition hover:bg-purple-100">
          View developer tools
        </button>
      </section>
      </div>
    </div>
    );
  };

  // ─── Generic Detail (Coming Soon) ───────────────────────────────────
  const renderGenericDetail = () => {
    const intg = activeIntegration;
    const isDisabled = false;
    const isMCP = intg.category === 'mcp';
    const paymentMeta = PAYMENT_GATEWAY_MODAL[intg.id];
    const isPaymentGateway = Boolean(paymentMeta);
    const connection = getIntegrationConnection(intg);
    const isConnected = connection.connected;
    const webhookUrl = intg.id === 'messenger'
      ? `${getPublicBackendOrigin()}/webhooks/messenger`
      : intg.id === 'zoom'
      ? `${window.location.origin}/webhooks/zoom?teamId=${encodeURIComponent(teamId || '')}`
      : intg.id === 'cashfree'
        ? `${window.location.origin}/webhooks/cashfree/${encodeURIComponent(teamId || '')}`
        : intg.id === 'stripe'
          ? `${getPublicBackendOrigin()}/webhooks/stripe/${encodeURIComponent(teamId || '')}`
        : `${window.location.origin}/webhooks/${intg.id}`;
    const categoryName = CATEGORIES.find((cat) => cat.id === intg.category)?.name || 'Integration';
    const logoNode = intg.logoFallback ? (
      <span className="text-xl leading-none">{intg.logoFallback}</span>
    ) : (
      <img
        src={intg.logo}
        alt={intg.name}
        className="h-6 w-6 object-contain"
        onError={(event) => { event.currentTarget.style.display = 'none'; }}
      />
    );

    return (
      <div className="-m-7">
        <div className="flex items-center gap-4 border-b border-slate-100 px-7 py-5">
          <button
            type="button"
            onClick={() => {
              setActiveIntegrationId(null);
              setSelectedIntegrationId(intg.id);
            }}
            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft size={17} />
          </button>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: `${intg.accentColor || '#8b5cf6'}12` }}
          >
            {logoNode}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-black text-slate-900">Connect {intg.name}</h2>
            <p className="mt-0.5 text-xs leading-5 text-slate-400">
              {isPaymentGateway
                ? `${intg.name} payment credentials are stored per workspace/customer and used by workflow payment actions.`
                : `${intg.name} credentials are stored per vendor/customer, not as global environment secrets.`}
            </p>
          </div>
        </div>

        <div className="space-y-6 px-7 py-7">
          <section className="rounded-3xl border border-slate-100 bg-slate-50/80 p-5">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-b from-[#b217ff] to-[#7900c8] text-sm font-black text-white shadow-lg shadow-purple-200">
                1
              </span>
              <div>
                <h3 className="text-base font-black text-slate-900">Vendor credentials</h3>
                <p className="text-sm leading-6 text-slate-500">
                  {paymentMeta?.credentialText || `Paste credentials from your ${intg.name} dashboard. They are encrypted per customer.`}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {intg.fields.map((f) => (
                <div key={f.key} className={intg.fields.length === 1 ? 'md:col-span-2' : ''}>
                  <label className="mb-2 block text-sm font-black text-slate-700">
                    {f.label} {!isOptionalIntegrationField(f) && <span className="text-red-400">*</span>}
                  </label>
                  {f.type === 'password' ? (
                    <>
                      <RevealInput
                        placeholder={secretPlaceholder(intg.id, f)}
                        value={getField(f.key)}
                        onChange={(event) => setField(f.key, event.target.value)}
                        disabled={isDisabled}
                      />
                      {isSecretConfigured(intg.id, f.key) && (
                        <p className="mt-1.5 text-[11px] font-bold text-emerald-600">Configured securely. Leave blank to keep the saved value.</p>
                      )}
                    </>
                  ) : f.type === 'select' ? (
                    <select
                      value={getField(f.key) || f.options?.[0]?.value || ''}
                      onChange={(event) => setField(f.key, event.target.value)}
                      disabled={isDisabled}
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {(f.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <Input
                      placeholder={f.placeholder || f.label}
                      value={getField(f.key)}
                      onChange={(event) => setField(f.key, event.target.value)}
                      disabled={isDisabled}
                      className="h-14 rounded-2xl border-slate-200 bg-white px-4 text-sm"
                    />
                  )}
                  {f.hint && <p className="mt-1.5 text-[11px] leading-4 text-slate-400">{f.hint}</p>}
                </div>
              ))}
            </div>
          </section>

          <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-600">Webhook Callback URL</p>
                <code className="mt-1 block truncate text-xs font-mono text-slate-700">{webhookUrl}</code>
                <p className="mt-1 text-xs text-slate-500">
                  {isPaymentGateway
                    ? 'Use this URL in the payment gateway dashboard for payment status events.'
                    : 'Use this URL in the provider dashboard for inbound events and workflow triggers.'}
                </p>
              </div>
              <CopyButton value={webhookUrl} />
            </div>
          </div>

          {isPaymentGateway && (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-purple-100 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-500">Workflow Use</p>
                <p className="mt-1 text-sm font-black text-slate-900">Payment Request</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Create payment links from workflow nodes.</p>
              </div>
              <div className="rounded-2xl border border-green-100 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-600">Status Sync</p>
                <p className="mt-1 text-sm font-black text-slate-900">Webhook Ready</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Track paid, failed, and pending events.</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Scope</p>
                <p className="mt-1 text-sm font-black text-slate-900">Workspace Level</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">No global .env dependency for this connector.</p>
              </div>
            </div>
          )}

          {integrationFormError && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-600">
              {integrationFormError}
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => {
                setActiveIntegrationId(null);
                setSelectedIntegrationId(intg.id);
              }}
              className="h-14 flex-1 rounded-2xl border border-slate-200 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Back
            </button>
            {isConnected && (
              <button
                type="button"
                disabled={isTestingGenericIntegration || intg.id === 'razorpay'}
                onClick={handleTestGenericIntegration}
                className="h-14 rounded-2xl border border-emerald-100 px-5 text-sm font-black text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isTestingGenericIntegration ? 'Testing...' : 'Test connection'}
              </button>
            )}
            {isConnected && (
              <button
                type="button"
                onClick={handleDisconnectGeneric}
                className="h-14 rounded-2xl border border-red-100 px-5 text-sm font-black text-red-500 transition hover:bg-red-50"
              >
                Disconnect
              </button>
            )}
            <button
              type="button"
              disabled={isDisabled || isSavingRazorpay || isTestingZoom}
              onClick={handleSaveGenericIntegration}
              className="h-14 flex-1 rounded-2xl bg-linear-to-b from-[#b217ff] to-[#7900c8] text-sm font-black text-white shadow-lg shadow-purple-200 transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
            >
              ↪ {intg.id === 'zoom'
                ? (isTestingZoom ? 'Testing...' : 'Test Connection')
                : (isSavingRazorpay ? 'Saving...' : isConnected ? 'Save Changes' : 'Connect')}
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2" onClick={() => setActiveIntegrationId(null)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
        </Button>

        {/* Header card */}
        <div className="bg-white/95 border border-purple-100 rounded-3xl overflow-hidden shadow-xl shadow-purple-100/50">
          <div className="p-6 flex items-center gap-5 border-b border-slate-100" style={{ background: `linear-gradient(135deg, ${intg.accentColor}10 0%, #fff 60%)` }}>
            <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center p-3 shrink-0">
              <img src={intg.logo} alt={intg.name} className="w-full h-full object-contain"
                onError={(e) => { e.target.src = "https://cdn.simpleicons.org/zapier/FF4A00"; }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900">{intg.name}</h2>
                {isDisabled && (
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    <Clock className="w-3 h-3" /> Coming Soon
                  </span>
                )}
                {!isDisabled && isConnected && (
                  <span className="inline-flex items-center gap-1 bg-green-50 text-green-600 border border-green-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    <CheckCircle2 className="w-3 h-3" /> {connection.label || 'Connected'}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">{intg.description}</p>
              {intg.docsUrl && (
                <a href={intg.docsUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-500 hover:text-blue-700 font-medium">
                  <ExternalLink className="w-3 h-3" /> Official Documentation
                </a>
              )}
            </div>
          </div>

          <div className="p-5 grid gap-3 md:grid-cols-3">
            <div className={cn(
              "rounded-2xl border p-4",
              isConnected ? "border-green-100 bg-green-50/70" : "border-purple-100 bg-purple-50/70"
            )}>
              <p className={cn(
                "text-[10px] font-black uppercase tracking-[0.18em]",
                isConnected ? "text-green-600" : "text-purple-600"
              )}>Connection</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{connection.count || 0}</p>
              <p className="text-xs text-slate-500">{isConnected ? connection.label : `No ${categoryName.toLowerCase()} account connected`}</p>
            </div>
            <div className="rounded-2xl border border-purple-100 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-600">Provider Type</p>
              <p className="mt-1 text-lg font-black text-slate-950">{categoryName}</p>
              <p className="text-xs text-slate-500">{isDisabled ? 'Preview only' : 'Ready for setup'}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Security</p>
              <p className="mt-1 text-lg font-black text-slate-950">Encrypted</p>
              <p className="text-xs text-slate-500">Secrets stay in the backend vault</p>
            </div>
          </div>

          <div className="mx-5 rounded-2xl border border-purple-100 bg-gradient-to-r from-purple-50 to-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-600">Webhook Callback URL</p>
                <code className="mt-1 block truncate text-xs font-mono text-slate-700">{webhookUrl}</code>
                <p className="mt-1 text-xs text-slate-500">Use this URL in the provider dashboard for inbound events, status updates, and automation triggers.</p>
              </div>
              <CopyButton value={webhookUrl} />
            </div>
          </div>

          {/* Coming soon notice */}
          {isDisabled && (
            <div className="mx-5 mt-5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <Lock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-700">Integration in Beta Testing</p>
                <p className="text-[11px] text-amber-600 mt-0.5">
                  Preview the required credentials below. You can fill them in advance — we'll activate this connection in the next release.
                </p>
              </div>
            </div>
          )}

          {/* MCP Server info */}
          {isMCP && intg.mcpServer && (
            <div className="mx-5 mt-5 bg-slate-900 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">MCP Server Endpoint</p>
              <div className="flex items-center justify-between gap-2">
                <code className="text-green-400 text-xs font-mono break-all">{intg.mcpServer}</code>
                <CopyButton value={intg.mcpServer} />
              </div>
              <p className="text-[10px] text-slate-500 mt-2">Transport: HTTP+SSE — configure your MCP client to point to this URL with your credentials below.</p>
            </div>
          )}

          {/* Credential fields */}
          {intg.fields.length > 0 && (
            <div className="p-5 space-y-5">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Credential Configuration</p>
                {isDisabled && <span className="text-[10px] text-slate-300 font-medium">(read-only preview)</span>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {intg.fields.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                      {f.label}
                      {f.type === 'password' && <Lock className="w-2.5 h-2.5 text-slate-300" />}
                      {f.type === 'password' && isSecretConfigured(intg.id, f.key) && (
                        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-600">Configured</span>
                      )}
                    </label>
                    {f.type === 'password' ? (
                      <RevealInput
                        placeholder={secretPlaceholder(intg.id, f)}
                        value={getField(f.key)}
                        onChange={(e) => setField(f.key, e.target.value)}
                        disabled={isDisabled}
                      />
                    ) : f.type === 'select' ? (
                      <select
                        value={getField(f.key) || f.options?.[0]?.value || ''}
                        onChange={(e) => setField(f.key, e.target.value)}
                        disabled={isDisabled}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-800 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {(f.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : (
                      <Input
                        placeholder={f.placeholder}
                        value={getField(f.key)}
                        onChange={(e) => setField(f.key, e.target.value)}
                        disabled={isDisabled}
                        className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm disabled:opacity-50"
                      />
                    )}
                    {f.hint && <p className="text-[10px] text-slate-400 leading-snug">{f.hint}</p>}
                  </div>
                ))}
              </div>

              {/* Webhook URL row */}
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { title: 'Add credentials', desc: `${intg.name} API keys and account ID.` },
                  { title: 'Verify webhook', desc: 'Copy callback URL into provider dashboard.' },
                  { title: 'Run test event', desc: 'Send a real event to confirm sync.' },
                ].map((step, index) => (
                  <div key={step.title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-purple-100 text-xs font-black text-purple-700">{index + 1}</span>
                    <p className="mt-3 text-sm font-black text-slate-900">{step.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{step.desc}</p>
                  </div>
                ))}
              </div>

              {/* Save / footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShieldCheck className="w-4 h-4" />
                  <p className="text-[10px] font-medium">Credentials encrypted with AES-256-GCM</p>
                </div>
                <div className="flex items-center gap-3">
                  {isConnected && (
                    <Button
                      variant="ghost"
                      disabled={isTestingGenericIntegration || intg.id === 'razorpay'}
                      className="h-10 px-4 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-sm font-bold disabled:opacity-50"
                      onClick={handleTestGenericIntegration}
                    >
                      {isTestingGenericIntegration ? 'Testing...' : 'Test connection'}
                    </Button>
                  )}
                  {isConnected && (
                    <Button
                      variant="ghost"
                      className="h-10 px-4 text-red-500 hover:text-red-700 hover:bg-red-50 text-sm font-bold"
                      onClick={handleDisconnectGeneric}
                    >
                      Disconnect
                    </Button>
                  )}
                  <Button
                    disabled={isDisabled || isSavingRazorpay || isTestingZoom}
                    className="h-10 px-6 rounded-full bg-slate-900 text-white text-sm font-bold shadow-lg disabled:opacity-40"
                    onClick={handleSaveGenericIntegration}
                  >
                    {intg.id === 'zoom'
                      ? (isTestingZoom ? 'Testing...' : 'Test Connection')
                      : (isSavingRazorpay ? 'Saving...' : 'Save & Connect')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: ExternalLink, title: 'Developer Console', desc: `Open ${intg.name} dashboard to create API credentials.` },
            { icon: Globe2, title: 'Help Docs', desc: `Step-by-step setup guide for this integration.` },
            { icon: Code2, title: 'API Reference', desc: `Explore the ${intg.name} API schema and endpoints.` },
          ].map((tile) => {
            const TIcon = tile.icon;
            return (
              <div key={tile.title} className="bg-white border border-slate-100 rounded-xl p-4">
                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                  <TIcon className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-xs font-bold text-slate-900">{tile.title}</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{tile.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── WhatsApp Detail ────────────────────────────────────────────────
  const renderWhatsAppDetail = () => (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" className="text-slate-500 -ml-2" onClick={() => setActiveIntegrationId(null)}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
      </Button>
      <div className="bg-white/95 border border-purple-100 rounded-3xl overflow-hidden shadow-xl shadow-purple-100/50">
        <div className="bg-gradient-to-br from-[#25D366] to-[#128C7E] p-6 text-white flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl p-2.5 flex items-center justify-center ring-1 ring-white/30">
            <img src={ICONS.whatsapp} className="w-full h-full" alt="WhatsApp" />
          </div>
          <div>
            <h2 className="text-2xl font-black">WhatsApp Business</h2>
            <p className="text-green-100 text-sm">Official Meta Cloud API</p>
          </div>
        </div>
        <div className="p-6">
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-black text-slate-900">Secure Meta connection</h3>
                {whatsappAppSettings?.ready
                  ? <span className="rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-black text-green-700">READY</span>
                  : <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">PLATFORM SETUP REQUIRED</span>}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-600">Connect with Meta to choose your WhatsApp Business account and number. App secrets, webhook verification, and account IDs stay protected by Greeto.</p>
            </div>
          </div>
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-600">Connected Numbers</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{allWhatsappSettings.length}</p>
              <p className="text-xs text-slate-500">Meta phone channels in this workspace</p>
            </div>
            <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4 md:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-600">Meta Webhook URL</p>
                  <code className="mt-1 block truncate text-xs font-mono text-slate-700">{`${getPublicBackendOrigin()}/webhooks/whatsapp`}</code>
                  <p className="mt-1 text-xs text-slate-500">Managed once by the Greeto platform for incoming messages and delivery/status events.</p>
                </div>
                <CopyButton value={`${getPublicBackendOrigin()}/webhooks/whatsapp`} />
              </div>
            </div>
          </div>
          {!allWhatsappSettings.length ? (
            <div className="flex flex-col items-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-white rounded-2xl shadow border border-slate-100 flex items-center justify-center mb-5 p-3">
                <img src={ICONS.whatsapp} className="w-full h-full object-contain" alt="WhatsApp" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">One-Click Meta Sync</h3>
              <p className="text-sm text-slate-500 text-center max-w-xs mb-6">We'll automatically discover your verified numbers and WABA accounts.</p>
              <Button onClick={handleConnectWhatsApp} disabled={loadingWhatsapp || !sdkLoaded || !whatsappAppSettings?.ready}
                className="bg-[#1877F2] hover:bg-[#166fe5] text-white px-10 h-12 rounded-full font-black text-sm shadow-lg shadow-blue-400/30">
                {loadingWhatsapp ? 'Authorizing...' : 'Connect with Meta'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {allWhatsappSettings.map(s => (
                <div key={s.phone_number_id}
                  className={cn("border-2 p-4 rounded-xl transition-all",
                    whatsappSettings.phone_number_id === s.phone_number_id ? "border-green-400 bg-green-50/30" : "border-slate-100")}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="w-10 h-10 shrink-0 rounded-xl bg-green-100 flex items-center justify-center">
                        <img src={ICONS.whatsapp} className="w-6 h-6" alt="WA" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-900">{s.display_phone_number || 'Business Account'}</p>
                          {s.is_primary && <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-700">PRIMARY</span>}
                        </div>
                        <p className="mt-0.5 text-[10px] text-slate-400 font-mono">Phone ID: {s.phone_number_id}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {s.is_active && <span className="bg-green-100 text-green-600 text-[10px] font-bold px-2.5 py-1 rounded-full">CONNECTED</span>}
                      {!s.is_primary && <Button variant="outline" size="sm" onClick={() => handleSetPrimaryWhatsApp(s.phone_number_id)} className="h-8 rounded-lg px-3 text-xs font-bold">Set primary</Button>}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditWhatsAppNumber(s)}
                        className="h-9 w-9 rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                        title="Edit WhatsApp connection"
                        aria-label="Edit WhatsApp connection"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={async () => {
                        const confirmed = await confirmAction({
                          title: 'Disconnect this WhatsApp number?',
                          message: `${s.display_phone_number || 'This WhatsApp number'} will stop receiving incoming messages and cannot be used for new outbound messages in this workspace. Existing conversation history will remain available.`,
                          hint: `${s.is_primary ? 'This is the primary sender. Another connected number will become primary automatically. ' : ''}This does not remove the number from Meta. You can add it back later through Manage numbers.`,
                          confirmLabel: 'Disconnect number',
                          tone: 'danger',
                        });
                        if (!confirmed) return;
                        try {
                          await disconnectWhatsApp(s.phone_number_id, teamId);
                          const remaining = allWhatsappSettings.filter((number) => number.phone_number_id !== s.phone_number_id);
                          setAllWhatsappSettings(remaining);
                          setWhatsappSettings((selected) => selected.phone_number_id === s.phone_number_id ? (remaining.find((number) => number.is_primary) || remaining[0] || { phone_number_id: '', business_account_id: '', permanent_token: '', display_phone_number: '', is_active: false }) : selected);
                          setExpandedWhatsAppPhoneId((current) => current === s.phone_number_id ? null : current);
                        } catch (error) {
                          alert(error.message || 'Failed to disconnect this WhatsApp number.');
                        }
                      }}
                        className="w-9 h-9 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50" aria-label="Disconnect WhatsApp number">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedWhatsAppPhoneId((current) => current === s.phone_number_id ? null : s.phone_number_id)}
                    className="mt-3 text-left text-xs font-bold text-slate-500 hover:text-purple-700"
                  >
                    {expandedWhatsAppPhoneId === s.phone_number_id ? 'Hide advanced details' : 'Show advanced details'}
                  </button>
                  {expandedWhatsAppPhoneId === s.phone_number_id && (() => {
                    const metadata = s.connection_metadata && typeof s.connection_metadata === 'object' ? s.connection_metadata : {};
                    return (
                      <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 text-xs sm:grid-cols-2">
                        <div><p className="font-bold text-slate-400">Business Account ID</p><p className="mt-1 break-all font-mono text-slate-700">{s.business_account_id || 'Not available'}</p></div>
                        <div><p className="font-bold text-slate-400">Business Name</p><p className="mt-1 text-slate-700">{metadata.business_account_name || 'Not reported by Meta'}</p></div>
                        <div><p className="font-bold text-slate-400">Phone Number ID</p><p className="mt-1 break-all font-mono text-slate-700">{s.phone_number_id}</p></div>
                        <div><p className="font-bold text-slate-400">Verified Name</p><p className="mt-1 text-slate-700">{s.verified_name || 'Not reported by Meta'}</p></div>
                        <div><p className="font-bold text-slate-400">Verification Status</p><p className="mt-1 capitalize text-slate-700">{metadata.verification_status || 'Not reported by Meta'}</p></div>
                        <div><p className="font-bold text-slate-400">Quality Rating</p><p className="mt-1 capitalize text-slate-700">{s.quality_rating || 'Not reported by Meta'}</p></div>
                        <div><p className="font-bold text-slate-400">Platform</p><p className="mt-1 capitalize text-slate-700">{metadata.platform_type || 'Cloud API'}</p></div>
                        <div><p className="font-bold text-slate-400">Access Token</p><p className="mt-1 text-slate-700">{s.token_configured ? 'Configured and encrypted' : 'Not configured'}</p></div>
                        <div><p className="font-bold text-slate-400">Expires</p><p className="mt-1 text-slate-700">{s.token_expires_at ? new Date(s.token_expires_at).toLocaleString() : 'Not reported by Meta'}</p></div>
                        <div><p className="font-bold text-slate-400">Connection Method</p><p className="mt-1 text-slate-700">{metadata.code_exchange ? 'Meta Embedded Signup' : 'Meta authorization'}</p></div>
                        <div><p className="font-bold text-slate-400">Throughput</p><p className="mt-1 text-slate-700">{metadata.throughput_level || 'Not reported by Meta'}</p></div>
                        <div className="sm:col-span-2"><p className="font-bold text-slate-400">Granted Permissions</p><p className="mt-1 break-words text-slate-700">{Array.isArray(s.granted_permissions) && s.granted_permissions.length ? s.granted_permissions.join(', ') : 'Not reported by Meta'}</p></div>
                      </div>
                    );
                  })()}
                </div>
              ))}
              <div className="pt-4 border-t border-slate-100 flex flex-col items-end gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-700">Manage connected numbers</p>
                  <p className="mt-0.5 text-xs text-slate-500">Add another Meta number, or reconnect a number removed from this workspace. Your other connected numbers remain active.</p>
                </div>
                <Button
                  onClick={handleConnectWhatsApp}
                  disabled={loadingWhatsapp || !sdkLoaded || !whatsappAppSettings?.ready}
                  className="h-10 px-6 rounded-full bg-[#1877F2] font-bold text-sm text-white hover:bg-[#166fe5]"
                >
                  {loadingWhatsapp ? 'Authorizing...' : 'Manage / add numbers'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ─── Telegram Detail ────────────────────────────────────────────────
  const renderTelegramDetail = () => (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" className="text-slate-500 -ml-2" onClick={() => setActiveIntegrationId(null)}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
      </Button>
      <div className="bg-white/95 border border-purple-100 rounded-3xl overflow-hidden shadow-xl shadow-purple-100/50">
        <div className="bg-gradient-to-br from-[#26A5E4] to-[#1a8bc5] p-6 text-white flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl p-2.5 flex items-center justify-center ring-1 ring-white/30">
            <img src={ICONS.telegram} className="w-full h-full" alt="Telegram" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Telegram Bot</h2>
            <p className="text-blue-100 text-sm">BotFather-powered channels</p>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {telegramSettings.length > 0 && (
            <div className="space-y-3">
              {telegramSettings.map(bot => (
                <div key={bot.id} className="flex items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
                      <Send className="w-4 h-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">@{bot.bot_username}</p>
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{bot.display_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${bot.webhook_configured ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {bot.webhook_configured ? 'Webhook ready' : 'Webhook needs attention'}
                    </span>
                  <Button variant="ghost" size="sm" onClick={async () => {
                    await disconnectTelegram(bot.id, teamId);
                    const updated = await getTelegramSettings(teamId);
                    setTelegramSettings(Array.isArray(updated?.settings) ? updated.settings : []);
                  }}
                    className="text-red-500 text-xs font-bold hover:bg-red-50 rounded-lg px-3 h-8">
                    Disconnect
                  </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Add New Bot</p>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                HTTP API Token <Lock className="w-2.5 h-2.5 text-slate-300" />
              </label>
              <RevealInput
                placeholder="000000000:AAHxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxx"
                value={botTokenInput}
                onChange={(e) => setBotTokenInput(e.target.value)}
              />
              <p className="text-[10px] text-slate-400">Get this from <a href="https://t.me/botfather" target="_blank" rel="noreferrer" className="text-blue-500 font-medium">@BotFather</a> → /newbot or /mybots → API Token</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">Display Name</label>
              <Input
                value={botDisplayName} onChange={(e) => setBotDisplayName(e.target.value)}
                placeholder="Support Bot — Primary"
                className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm"
              />
              <p className="text-[10px] text-slate-400">Internal label to identify this bot in your workspace</p>
            </div>
            <Button onClick={handleConnectTelegram} disabled={savingTelegram || !botTokenInput}
              className="w-full bg-slate-900 hover:bg-black h-11 rounded-xl text-white font-bold text-sm shadow-lg disabled:opacity-40">
              {savingTelegram ? 'Validating...' : 'Connect Bot'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // ─── Instagram Detail ────────────────────────────────────────────────
  const renderInstagramDetail = () => (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <Button variant="ghost" size="sm" className="text-slate-500 -ml-2" onClick={() => setActiveIntegrationId(null)}>
        <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
      </Button>
      <div className="bg-white/95 border border-purple-100 rounded-3xl overflow-hidden shadow-xl shadow-purple-100/50">
        <div className="p-6 text-white flex items-center gap-4" style={{ background: 'linear-gradient(135deg, #833AB4, #E1306C, #F77737)' }}>
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl p-2.5 flex items-center justify-center ring-1 ring-white/30">
            <img src={ICONS.instagram} className="w-full h-full" alt="Instagram" />
          </div>
          <div>
            <h2 className="text-2xl font-black">Instagram DMs</h2>
            <p className="text-pink-100 text-sm">Meta Graph API</p>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900">Meta App credentials</h3>
                <p className="mt-1 text-xs text-slate-500">Saved for this workspace and used for OAuth and webhook verification.</p>
              </div>
              {instagramAppSettings?.is_active && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">Configured</span>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1.5 text-xs font-bold text-slate-700">
                Meta App ID
                <Input value={instagramAppFields.meta_app_id} placeholder="Enter Meta App ID"
                  onChange={(event) => setInstagramAppFields((current) => ({ ...current, meta_app_id: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-xs font-bold text-slate-700">
                Meta App Secret
                <Input type="password" value={instagramAppFields.meta_app_secret}
                  placeholder={instagramAppSettings?.app_secret_configured ? 'Configured - leave blank to keep' : 'Enter Meta App Secret'}
                  onChange={(event) => setInstagramAppFields((current) => ({ ...current, meta_app_secret: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-xs font-bold text-slate-700">
                Webhook Verify Token
                <Input type="password" value={instagramAppFields.verify_token}
                  placeholder={instagramAppSettings?.verify_token_configured ? 'Configured - leave blank to keep' : 'Create a private verify token'}
                  onChange={(event) => setInstagramAppFields((current) => ({ ...current, verify_token: event.target.value }))} />
              </label>
            </div>
            <p className="mt-3 text-[11px] text-slate-500">The verify token is your own private value used by Meta to verify this workspace webhook. It is not a Page Access Token.</p>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSaveInstagramApp} disabled={savingInstagramApp}
                className="h-10 rounded-xl bg-purple-700 px-5 font-bold text-white hover:bg-purple-800">
                {savingInstagramApp ? 'Validating...' : 'Save App Settings'}
              </Button>
            </div>
          </div>
          {!instagramStatus.connected ? (
            <div className="flex flex-col items-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-white rounded-2xl shadow border border-slate-100 flex items-center justify-center mb-5 p-3">
                <img src={ICONS.instagram} className="w-full h-full object-contain" alt="Instagram" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">Connect Instagram Business</h3>
              <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                Link your Instagram Business/Creator account through Facebook Login to manage DMs, set up auto-replies, and comment-to-DM automations.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 max-w-sm">
                <p className="text-xs font-bold text-amber-700 mb-1">📋 Prerequisites</p>
                <ul className="text-[11px] text-amber-600 space-y-1">
                  <li>• Instagram account must be Business or Creator type</li>
                  <li>• Must be linked to a Facebook Page</li>
                  <li>• Webhook must be configured in Meta App Dashboard</li>
                </ul>
              </div>
              <Button onClick={handleConnectInstagram} disabled={loadingInstagram || !sdkLoaded || !instagramAppSettings?.is_active}
                className="text-white px-10 h-12 rounded-full font-black text-sm shadow-lg shadow-pink-400/30"
                style={{ background: 'linear-gradient(135deg, #833AB4, #E1306C)' }}>
                {loadingInstagram ? 'Connecting...' : 'Connect with Facebook'}
              </Button>
              <div className="flex items-center gap-3 mt-3 w-full max-w-sm">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400 font-medium">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div className="mt-3 grid w-full max-w-2xl gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <label className="space-y-1.5 text-left text-xs font-bold text-slate-700">
                  Facebook Page Access Token
                  <Input type="password" value={instagramManualFields.pageAccessToken} placeholder="Enter a current Page Access Token"
                    onChange={(event) => setInstagramManualFields((current) => ({ ...current, pageAccessToken: event.target.value }))} />
                </label>
                <label className="space-y-1.5 text-left text-xs font-bold text-slate-700">
                  Facebook Page ID
                  <Input value={instagramManualFields.pageId} placeholder="Enter Facebook Page ID"
                    onChange={(event) => setInstagramManualFields((current) => ({ ...current, pageId: event.target.value }))} />
                </label>
                <Button onClick={handleConnectInstagramManually}
                  disabled={loadingInstagram || !instagramAppSettings?.is_active || !instagramManualFields.pageAccessToken || !instagramManualFields.pageId}
                  variant="outline" className="h-10 rounded-xl border-2 font-bold text-slate-700">
                  Connect
                </Button>
              </div>
              <p className="mt-2 max-w-2xl text-center text-[11px] text-slate-500">If Meta reports code 190, reconnect through Facebook or generate a fresh Page Access Token. Logged-out or revoked tokens cannot be reused.</p>
              {!instagramAppSettings?.is_active && <p className="mt-2 text-[11px] font-medium text-amber-600">Save Meta App credentials above before connecting an account.</p>}
            </div>
          ) : (
            <div className="space-y-4">
              {instagramStatus.channels?.map(ch => (
                <div key={ch.id}
                  className="flex items-center justify-between border-2 p-4 rounded-xl transition-all border-pink-300 bg-pink-50/30">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center overflow-hidden">
                      {ch.profilePicture ? (
                        <img src={ch.profilePicture} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <img src={ICONS.instagram} className="w-6 h-6" alt="IG" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 leading-none">{ch.username || ch.name}</p>
                        <a
                          href={`https://instagram.com/${(ch.username || ch.name)?.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-pink-600 hover:text-pink-700 bg-pink-50 px-1.5 py-0.5 rounded font-medium border border-pink-100 transition-colors"
                        >
                          View Profile
                        </a>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        ID: <span className="font-mono text-slate-500">{ch.externalId}</span>
                        {ch.followersCount ? ` • ${ch.followersCount.toLocaleString()} followers` : ''}
                        {ch.pageName ? ` • Page: ${ch.pageName}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="bg-green-100 text-green-600 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleDisconnectInstagram(ch.id)}
                      className="w-9 h-9 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {instagramStatus.channels?.[0] && (
                <div className="rounded-2xl overflow-hidden border border-slate-200" style={{ height: 480 }}>
                  <InstagramMediaPage activeChannelId={instagramStatus.channels[0].id} embedded />
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <Button onClick={handleConnectInstagram} variant="outline"
                  className="h-10 px-6 rounded-full border-2 font-bold text-sm text-slate-600">
                  + Add Another Account
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Automation Rules Section */}
      {instagramStatus.connected && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <InstagramAutomationsPanel channelId={instagramStatus.channels?.[0]?.id} />
        </div>
      )}

      {/* Quick Setup Guide */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-sm font-black text-slate-900 mb-3">📋 Meta Developers Setup</h3>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Create Meta App', desc: 'Go to developers.facebook.com → My Apps → Create App' },
            { step: '2', title: 'Add Instagram Product', desc: 'In your app, go to Add Products → Instagram → Set Up' },
            { step: '3', title: 'Configure Webhooks', desc: 'Webhooks → Instagram → Callback URL: https://inbox.xolox.io/webhooks/instagram' },
            { step: '4', title: 'Subscribe to Fields', desc: 'Enable: messages, messaging_postbacks, comments, mentions' },
            { step: '5', title: 'Connect Account', desc: 'Click "Connect with Facebook" above and grant permissions' },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <span className="w-6 h-6 bg-slate-900 text-white text-[10px] font-black rounded-full flex items-center justify-center shrink-0">{s.step}</span>
              <div>
                <p className="text-xs font-bold text-slate-700">{s.title}</p>
                <p className="text-[10px] text-slate-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );

  // ─── Exotel Detail ──────────────────────────────────────────────────
  const handleSaveExotel = async () => {
    if (!exotelFields.sid || !exotelFields.api_key || !exotelFields.api_token || !exotelFields.subdomain) {
      alert('SID, API Key, API Token and Subdomain are required.');
      return;
    }
    setIsSavingExotel(true);
    try {
      const res = await updateExotelSettings(exotelFields, teamId);
      if (res.error) throw new Error(res.error);
      setExotelSettings(res.settings);
      alert('Exotel connected successfully!');
    } catch (err) {
      alert('Failed to save Exotel settings: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingExotel(false);
    }
  };

  const handleDisconnectExotel = async () => {
    if (!(await confirmAction({
      title: 'Disconnect Exotel?',
      message: 'Disconnect Exotel? This will remove all stored credentials.',
      confirmLabel: 'Disconnect',
      tone: 'danger',
    }))) return;
    try {
      await disconnectExotel(teamId);
      setExotelSettings(null);
      setExotelFields({ sid: '', api_key: '', api_token: '', subdomain: 'api.in.exotel.com', caller_id: '' });
    } catch (err) {
      alert('Failed to disconnect: ' + err.message);
    }
  };

  const handleLoadCallLogs = async () => {
    setExotelLoadingLogs(true);
    try {
      const res = await getExotelCallLogs(teamId);
      setExotelCallLogs(res.calls || []);
    } catch (err) {
      console.error('Failed to load call logs:', err);
    } finally {
      setExotelLoadingLogs(false);
    }
  };

  const handleInitiateCall = async () => {
    if (!dialerNumber) { alert('Enter a phone number to call'); return; }
    setIsDialing(true);
    setDialerStatus('calling');
    setDialerMessage('');
    try {
      const res = await initiateExotelCall({ to: dialerNumber, from: dialerFrom || undefined }, teamId);
      if (res.error) throw new Error(res.error);
      setDialerStatus('success');
      setDialerMessage(`Call initiated! SID: ${res.call?.callSid || '—'}`);
      // Refresh logs
      handleLoadCallLogs();
    } catch (err) {
      setDialerStatus('error');
      setDialerMessage(err.message || 'Call failed');
    } finally {
      setIsDialing(false);
    }
  };

  const renderExotelDetail = () => {
    const isConnected = !!exotelSettings;
    const webhookUrl = `${window.location.origin}/webhooks/exotel/status`;

    return (
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2" onClick={() => setActiveIntegrationId(null)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
        </Button>

        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="p-6 flex items-center gap-5 border-b border-slate-100" style={{ background: 'linear-gradient(135deg, #E5600010 0%, #fff 60%)' }}>
            <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center p-3 shrink-0">
              <img src={ICONS.exotel} alt="Exotel" className="w-full h-full object-contain" onError={e => { e.target.src = 'https://cdn.simpleicons.org/phone/E56000'; }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900">Exotel</h2>
                {isConnected
                  ? <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">● Connected</span>
                  : <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-500 border border-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">Not Connected</span>
                }
              </div>
              <p className="text-sm text-slate-500 mt-1">Cloud telephony for India — IVR, click-to-call and call recording synced to conversation history.</p>
              <a href="https://developer.exotel.com/api/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-500 hover:text-blue-700 font-medium">
                <ExternalLink className="w-3 h-3" /> Official Documentation
              </a>
            </div>
          </div>

          {/* Setup Guide */}
          <div className="p-5 border-b border-slate-100">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Setup Guide</p>
            <ol className="space-y-3">
              {[
                { step: '1', title: 'Log in to Exotel Dashboard', desc: 'Go to my.exotel.com → Settings → API Credentials. You will find your Account SID, API Key, and API Token here.' },
                { step: '2', title: 'Copy your API Credentials', desc: 'Copy the SID, API Key, API Token and your account subdomain (e.g. api.in.exotel.com for India).' },
                { step: '3', title: 'Note your ExoPhone (Caller ID)', desc: 'From the Exotel dashboard, go to Phone Numbers and copy the virtual number you want to use as caller ID.' },
                { step: '4', title: 'Paste credentials below & Save', desc: 'Fill in the form below and click Save & Connect.' },
                { step: '5', title: 'Configure the Status Callback URL', desc: 'In Exotel Dashboard → Apps → your app, set the Status Callback URL to the webhook URL shown below so call events are synced back.' },
              ].map(g => (
                <li key={g.step} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">{g.step}</span>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{g.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{g.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Credentials form */}
          <div className="p-5 space-y-4 border-b border-slate-100">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Credentials</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Account SID', key: 'sid', placeholder: 'exotel_sid', hint: 'Exotel Dashboard → Settings → API Credentials' },
                { label: 'API Key', key: 'api_key', placeholder: 'xxxxxxxx', hint: 'From the same API Credentials page' },
                { label: 'API Token', key: 'api_token', placeholder: '••••••••', hint: 'Token paired with the API Key above', secret: true },
                { label: 'Subdomain', key: 'subdomain', placeholder: 'api.in.exotel.com', hint: 'Your regional subdomain — India: api.in.exotel.com' },
                { label: 'Default Caller ID (ExoPhone)', key: 'caller_id', placeholder: '+91XXXXXXXXXX', hint: 'Virtual number shown to customers when you call them' },
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    {f.label} {f.secret && <Lock className="w-2.5 h-2.5 text-slate-300" />}
                  </label>
                  {f.secret
                    ? <RevealInput placeholder={f.placeholder} value={exotelFields[f.key]} onChange={e => setExotelFields(p => ({ ...p, [f.key]: e.target.value }))} />
                    : <Input placeholder={f.placeholder} value={exotelFields[f.key]} onChange={e => setExotelFields(p => ({ ...p, [f.key]: e.target.value }))} className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm" />
                  }
                  {f.hint && <p className="text-[10px] text-slate-400 leading-snug">{f.hint}</p>}
                </div>
              ))}
            </div>

            {/* Webhook URL */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">Status Callback / Webhook URL</label>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 h-11">
                <code className="text-xs text-slate-600 font-mono flex-1 truncate">{webhookUrl}</code>
                <CopyButton value={webhookUrl} />
              </div>
              <p className="text-[10px] text-slate-400">Set this as the StatusCallback in your Exotel app to receive real-time call status updates.</p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-slate-400">
                <ShieldCheck className="w-4 h-4" /><p className="text-[10px] font-medium">Credentials stored encrypted</p>
              </div>
              <div className="flex items-center gap-3">
                {isConnected && (
                  <Button variant="ghost" className="h-10 px-4 text-red-500 hover:text-red-700 hover:bg-red-50 text-sm font-bold" onClick={handleDisconnectExotel}>
                    Disconnect
                  </Button>
                )}
                <Button disabled={isSavingExotel} className="h-10 px-6 rounded-full bg-slate-900 text-white text-sm font-bold shadow-lg disabled:opacity-40" onClick={handleSaveExotel}>
                  {isSavingExotel ? 'Saving…' : isConnected ? 'Update Credentials' : 'Save & Connect'}
                </Button>
              </div>
            </div>
          </div>

          {/* Dialer — only when connected */}
          {isConnected && (
            <div className="p-5 border-b border-slate-100">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Click-to-Call Dialer</p>
              <div className="bg-slate-900 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-bold text-white">Initiate an Outbound Call</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Customer Number (To)</label>
                    <input
                      type="tel"
                      placeholder="+91XXXXXXXXXX"
                      value={dialerNumber}
                      onChange={e => setDialerNumber(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Agent / From Number (optional)</label>
                    <input
                      type="tel"
                      placeholder={exotelFields.caller_id || '+91XXXXXXXXXX'}
                      value={dialerFrom}
                      onChange={e => setDialerFrom(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleInitiateCall}
                    disabled={isDialing}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {isDialing ? 'Initiating…' : 'Call Now'}
                  </button>
                  {dialerStatus === 'success' && <span className="text-xs text-green-400 font-medium">{dialerMessage}</span>}
                  {dialerStatus === 'error' && <span className="text-xs text-red-400 font-medium">{dialerMessage}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Call Logs — only when connected */}
          {isConnected && (
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Recent Call Logs</p>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleLoadCallLogs} disabled={exotelLoadingLogs}>
                  {exotelLoadingLogs ? 'Loading…' : 'Refresh'}
                </Button>
              </div>
              {exotelCallLogs.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">No call logs yet. Make a call to see history here.</p>
                : (
                  <div className="space-y-2">
                    {exotelCallLogs.map(log => (
                      <div key={log.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${log.direction === 'inbound' ? 'bg-blue-100' : 'bg-orange-100'}`}>
                          <Phone className={`w-4 h-4 ${log.direction === 'inbound' ? 'text-blue-600' : 'text-orange-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 truncate">{log.to_number || log.from_number}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${log.status === 'completed' ? 'bg-green-100 text-green-700'
                              : log.status === 'failed' || log.status === 'busy' ? 'bg-red-100 text-red-700'
                                : 'bg-slate-200 text-slate-600'
                              }`}>{log.status}</span>
                            <span className="text-[10px] text-slate-400 uppercase">{log.direction}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {log.duration > 0 && <span>{log.duration}s · </span>}
                            {log.contact_name && <span>{log.contact_name} · </span>}
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </div>
                        {log.recording_url && (
                          <a href={log.recording_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline shrink-0">Recording</a>
                        )}
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}
        </div>

        {/* Workflow events info */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Workflow Events & Actions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'call_answered', desc: 'Triggered when a call is picked up', color: 'bg-blue-50 text-blue-700 border-blue-100' },
              { label: 'call_completed', desc: 'Triggered when a call ends successfully', color: 'bg-green-50 text-green-700 border-green-100' },
              { label: 'call_failed', desc: 'Triggered on busy / no-answer / failed', color: 'bg-red-50 text-red-700 border-red-100' },
              { label: 'Initiate Call (node)', desc: 'Workflow action to place an outbound call', color: 'bg-orange-50 text-orange-700 border-orange-100' },
            ].map(e => (
              <div key={e.label} className={`flex items-start gap-2 p-3 rounded-xl border ${e.color}`}>
                <div>
                  <p className="text-xs font-bold">{e.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-80">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: ExternalLink, title: 'Exotel Dashboard', desc: 'Login to my.exotel.com to manage numbers, apps and call logs.' },
            { icon: Globe2, title: 'API Docs', desc: 'Full REST API reference at developer.exotel.com/api/.' },
            { icon: Code2, title: 'Webhook Reference', desc: 'Callback parameters sent by Exotel on call status changes.' },
          ].map(tile => {
            const TIcon = tile.icon;
            return (
              <div key={tile.title} className="bg-white border border-slate-100 rounded-xl p-4">
                <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                  <TIcon className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-xs font-bold text-slate-900">{tile.title}</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{tile.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── Twilio handlers ──────────────────────────────────────────────
  const handleSaveTwilio = async () => {
    if (!twilioFields.account_sid || !twilioFields.auth_token || !twilioFields.phone_number) {
      alert('Account SID, Auth Token and Phone Number are required.');
      return;
    }
    setIsSavingTwilio(true);
    try {
      const res = await updateTwilioSettings(twilioFields, teamId);
      if (res.error) throw new Error(res.error);
      setTwilioSettings(res.settings);
      alert('Twilio connected successfully!');
    } catch (err) {
      alert('Failed to save Twilio settings: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingTwilio(false);
    }
  };

  const handleDisconnectTwilio = async () => {
    if (!(await confirmAction({
      title: 'Disconnect Twilio?',
      message: 'Disconnect Twilio? This will remove all stored credentials.',
      confirmLabel: 'Disconnect',
      tone: 'danger',
    }))) return;
    try {
      await disconnectTwilio(teamId);
      setTwilioSettings(null);
      setTwilioFields({ account_sid: '', auth_token: '', phone_number: '', messaging_service_sid: '' });
    } catch (err) {
      alert('Failed to disconnect: ' + (err.message || 'Unknown error'));
    }
  };

  const handleLoadTwilioLogs = async () => {
    setTwilioLoadingLogs(true);
    try {
      const res = await getTwilioLogs(teamId, { type: twilioTabType === 'all' ? undefined : twilioTabType });
      setTwilioLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load Twilio logs', err);
    } finally {
      setTwilioLoadingLogs(false);
    }
  };

  const handleSendTwilioSms = async () => {
    if (!twilioSmsTo || !twilioSmsBody) return;
    setIsSendingSms(true);
    setTwilioActionResult(null);
    try {
      const res = await sendTwilioSms({ to: twilioSmsTo, body: twilioSmsBody }, teamId);
      if (res.error) throw new Error(res.error);
      setTwilioActionResult({ success: true, message: `SMS sent! SID: ${res.message?.sid || '—'}` });
      setTwilioSmsTo('');
      setTwilioSmsBody('');
      setTimeout(() => { handleLoadTwilioLogs(); setTwilioActionResult(null); }, 2000);
    } catch (err) {
      setTwilioActionResult({ success: false, message: err.message || 'Failed to send SMS' });
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleTwilioCall = async () => {
    if (!twilioCallTo) return;
    setIsDialingTwilio(true);
    setTwilioActionResult(null);
    try {
      const res = await initiateTwilioCall({ to: twilioCallTo }, teamId);
      if (res.error) throw new Error(res.error);
      setTwilioActionResult({ success: true, message: `Call initiated! SID: ${res.call?.sid || '—'}` });
      setTwilioCallTo('');
      setTimeout(() => { handleLoadTwilioLogs(); setTwilioActionResult(null); }, 3000);
    } catch (err) {
      setTwilioActionResult({ success: false, message: err.message || 'Failed to initiate call' });
    } finally {
      setIsDialingTwilio(false);
    }
  };

  const renderTwilioDetail = () => {
    const isConnected = !!twilioSettings;
    const smsCbUrl = `${window.location.origin}/webhooks/twilio/sms`;
    const callCbUrl = `${window.location.origin}/webhooks/twilio/call`;

    return (
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2" onClick={() => setActiveIntegrationId(null)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
        </Button>

        {/* Header */}
        <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
          <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center p-3 shrink-0">
            <img src={ICONS.twilio} alt="Twilio" className="w-full h-full object-contain" onError={e => { e.target.src = 'https://cdn.simpleicons.org/twilio/F22F46'; }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900">Twilio</h2>
              {isConnected
                ? <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Connected</span>
                : <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Not Connected</span>
              }
            </div>
            <p className="text-sm text-slate-500 mt-1">SMS, Voice and WhatsApp communication — click-to-call, bulk SMS and call recording synced to conversations.</p>
            <a href="https://www.twilio.com/docs" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-500 hover:text-blue-700 font-medium">
              <ExternalLink className="w-3 h-3" /> Official Documentation
            </a>
          </div>
        </div>

        {/* Setup Guide */}
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <h3 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">?</span>
            How to connect Twilio
          </h3>
          <ol className="space-y-3">
            {[
              { step: '1', title: 'Create a Twilio Account', desc: 'Sign up at twilio.com. After verification you will land on the Console Dashboard.' },
              { step: '2', title: 'Copy your Account SID & Auth Token', desc: 'Go to Console → Dashboard. Your Account SID and Auth Token are shown at the top.' },
              { step: '3', title: 'Buy or verify a phone number', desc: 'In Console → Phone Numbers → Manage → Buy a Number. Copy the number (e.g. +1 415 XXXXXXX).' },
              { step: '4', title: 'Paste credentials below & Save', desc: 'Fill in Account SID, Auth Token, and Phone Number, then click Save & Connect.' },
              { step: '5', title: 'Set Webhook URLs in Twilio Console', desc: 'In Phone Numbers → Active Numbers → click your number. Set the SMS Webhook and Voice Webhook URLs shown below (A Call Comes In / A Message Comes In).' },
            ].map(g => (
              <li key={g.step} className="flex gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">{g.step}</span>
                <div><span className="font-bold text-slate-800">{g.title}</span> — <span className="text-slate-500">{g.desc}</span></div>
              </li>
            ))}
          </ol>
        </div>

        {/* Credentials Form */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <h3 className="font-black text-slate-800 text-sm">API Credentials</h3>
          {[
            { label: 'Account SID', key: 'account_sid', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', hint: 'Console Dashboard → top of page' },
            { label: 'Auth Token', key: 'auth_token', placeholder: '••••••••', hint: 'Console Dashboard → click eye icon to reveal', secret: true },
            { label: 'Default Phone Number', key: 'phone_number', placeholder: '+14155552671', hint: 'E.164 format — the number used to send SMS and make calls' },
            { label: 'Messaging Service SID (optional)', key: 'messaging_service_sid', placeholder: 'MGxxxxxxxx', hint: 'Use a Messaging Service for number pools and advanced routing' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-bold text-slate-700 block mb-1">{f.label}</label>
              {f.secret
                ? <RevealInput placeholder={f.placeholder} value={twilioFields[f.key]} onChange={e => setTwilioFields(p => ({ ...p, [f.key]: e.target.value }))} />
                : <Input placeholder={f.placeholder} value={twilioFields[f.key]} onChange={e => setTwilioFields(p => ({ ...p, [f.key]: e.target.value }))} className="h-11 rounded-xl bg-white border-slate-200 px-4 text-sm" />
              }
              {f.hint && <p className="text-[10px] text-slate-400 mt-1">{f.hint}</p>}
            </div>
          ))}
        </div>

        {/* Webhook URLs */}
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-3">
          <h3 className="font-black text-slate-800 text-sm mb-1">Webhook URLs</h3>
          {[
            { label: 'SMS Status Callback', url: smsCbUrl, hint: 'Set in Console → Phone Numbers → your number → "A Message Comes In"' },
            { label: 'Call Status Callback', url: callCbUrl, hint: 'Set in Console → Phone Numbers → your number → "A Call Comes In"' },
          ].map(w => (
            <div key={w.label}>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">{w.label}</label>
              <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2">
                <code className="flex-1 text-xs font-mono text-slate-700 truncate">{w.url}</code>
                <button onClick={() => navigator.clipboard.writeText(w.url)} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 shrink-0">Copy</button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">{w.hint}</p>
            </div>
          ))}
        </div>

        {/* Save / Disconnect */}
        <div className="flex items-center justify-between pt-2">
          {isConnected && (
            <Button variant="ghost" className="h-10 px-4 text-red-500 hover:text-red-700 hover:bg-red-50 text-sm font-bold" onClick={handleDisconnectTwilio}>
              Disconnect
            </Button>
          )}
          <div className="ml-auto">
            <Button disabled={isSavingTwilio} className="h-10 px-6 rounded-full bg-slate-900 text-white text-sm font-bold shadow-lg disabled:opacity-40" onClick={handleSaveTwilio}>
              {isSavingTwilio ? 'Saving…' : isConnected ? 'Update Credentials' : 'Save & Connect'}
            </Button>
          </div>
        </div>

        {/* SMS + Call actions (only when connected) */}
        {isConnected && (
          <>
            {/* Send SMS */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
              <h3 className="font-black text-slate-800 text-sm">Send SMS</h3>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">To (phone number)</label>
                <Input type="tel" placeholder="+91XXXXXXXXXX" value={twilioSmsTo} onChange={e => setTwilioSmsTo(e.target.value)} className="h-10 rounded-xl bg-white border-slate-200 px-4 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Message</label>
                <textarea
                  value={twilioSmsBody}
                  onChange={e => setTwilioSmsBody(e.target.value)}
                  placeholder="Type your SMS message…"
                  rows={3}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400/30 resize-none"
                />
              </div>
              <Button disabled={!twilioSmsTo || !twilioSmsBody || isSendingSms} className="h-9 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold disabled:opacity-40" onClick={handleSendTwilioSms}>
                {isSendingSms ? 'Sending…' : 'Send SMS'}
              </Button>
            </div>

            {/* Voice Call */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
              <h3 className="font-black text-slate-800 text-sm">Initiate Voice Call</h3>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">To (phone number)</label>
                <Input type="tel" placeholder="+91XXXXXXXXXX" value={twilioCallTo} onChange={e => setTwilioCallTo(e.target.value)} className="h-10 rounded-xl bg-white border-slate-200 px-4 text-sm" />
              </div>
              <Button disabled={!twilioCallTo || isDialingTwilio} className="h-9 px-4 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-bold disabled:opacity-40" onClick={handleTwilioCall}>
                {isDialingTwilio ? 'Calling…' : 'Call'}
              </Button>

              {twilioActionResult && (
                <div className={`p-3 rounded-xl flex items-center gap-2 text-sm font-medium ${twilioActionResult.success ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                  {twilioActionResult.message}
                </div>
              )}
            </div>

            {/* Logs */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-800 text-sm">Activity Logs</h3>
                <div className="flex items-center gap-2">
                  <select value={twilioTabType} onChange={e => setTwilioTabType(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none">
                    <option value="all">All</option>
                    <option value="sms">SMS</option>
                    <option value="call">Calls</option>
                  </select>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleLoadTwilioLogs} disabled={twilioLoadingLogs}>
                    {twilioLoadingLogs ? 'Loading…' : 'Refresh'}
                  </Button>
                </div>
              </div>
              {twilioLogs.length === 0
                ? <p className="text-sm text-slate-400 text-center py-8">No logs yet. Send an SMS or make a call to see history.</p>
                : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {twilioLogs.map(log => (
                      <div key={log.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${log.type === 'sms' ? 'bg-blue-100' : 'bg-green-100'}`}>
                          <span className="text-[9px] font-black uppercase tracking-wide text-slate-600">{log.type}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{log.contact_name || log.to_number}</p>
                          {log.body && <p className="text-[11px] text-slate-400 truncate">{log.body}</p>}
                          <p className="text-[10px] text-slate-400">{log.direction} · {log.status} {log.duration ? `· ${log.duration}s` : ''}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0">{log.created_at ? new Date(log.created_at).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>

            {/* Workflow Events */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
              <h3 className="font-black text-slate-800 text-sm mb-3">Workflow Trigger Events</h3>
              <div className="space-y-2">
                {[
                  { event: 'sms_delivered', desc: 'Fires when an outbound SMS is delivered to the recipient.' },
                  { event: 'sms_failed', desc: 'Fires when an SMS delivery fails.' },
                  { event: 'call_completed', desc: 'Fires when a call ends successfully.' },
                  { event: 'call_answered', desc: 'Fires when a call is picked up (in-progress).' },
                  { event: 'call_failed', desc: 'Fires when a call is not answered or fails.' },
                ].map(e => (
                  <div key={e.event} className="flex items-start gap-2">
                    <code className="text-[10px] font-black bg-white border border-amber-200 text-amber-700 px-2 py-0.5 rounded-lg shrink-0">{e.event}</code>
                    <p className="text-[11px] text-slate-500">{e.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // ─── Email handlers ───────────────────────────────────────────────
  const handleSaveEmail = async () => {
    const missingSmtp = emailFields.provider === 'smtp' && (!emailFields.smtp_host || !emailFields.smtp_user || !emailFields.smtp_pass || !emailFields.imap_host);
    const missingZepto = emailFields.provider === 'zeptomail'
      && !emailFields.api_token
      && !emailSettings?.api_token_configured;
    if (!emailFields.email_address || missingSmtp || missingZepto) {
      alert(emailFields.provider === 'zeptomail'
        ? 'Sender email and ZeptoMail API token are required.'
        : 'Email address, SMTP host/user/pass and IMAP host are required.');
      return;
    }
    setIsSavingEmail(true);
    try {
      const res = await updateEmailSettings({
        ...emailFields,
        smtp_port: parseInt(emailFields.smtp_port) || 587,
        imap_port: parseInt(emailFields.imap_port) || 993,
      }, teamId);
      if (res.error) throw new Error(res.error);
      setEmailSettings(res.settings);
      alert('Email connected successfully!');
    } catch (err) {
      alert('Failed to save email settings: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleDisconnectEmail = async () => {
    if (!(await confirmAction({
      title: 'Disconnect email?',
      message: 'Disconnect email? This will remove all stored credentials.',
      confirmLabel: 'Disconnect',
      tone: 'danger',
    }))) return;
    try {
      await disconnectEmail(teamId);
      setEmailSettings(null);
      setEmailFields({ provider: 'smtp', api_token: '', api_base_url: 'https://api.zeptomail.com', display_name: '', email_address: '', smtp_host: '', smtp_port: '587', smtp_secure: false, smtp_user: '', smtp_pass: '', imap_host: '', imap_port: '993', imap_secure: true, imap_user: '', imap_pass: '' });
    } catch (err) {
      alert('Failed to disconnect: ' + (err.message || 'Unknown error'));
    }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    setEmailTestResult(null);
    try {
      const res = await testEmailConnection(teamId);
      setEmailTestResult({ success: res.success, message: res.message || res.error || 'Unknown result' });
    } catch (err) {
      setEmailTestResult({ success: false, message: err.message || 'Connection failed' });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const renderEmailDetail = () => {
    const isZeptoFlow = activeIntegration?.id === 'zeptomail';
    const isConnected = isZeptoFlow
      ? emailSettings?.provider === 'zeptomail' && emailSettings?.is_active !== false
      : !!emailSettings;
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-5">
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 -ml-2" onClick={() => setActiveIntegrationId(null)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> All Integrations
        </Button>

        {/* Header */}
        <div className="flex items-start gap-4 pb-4 border-b border-slate-100">
          <div className="w-14 h-14 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center p-3 shrink-0">
            <img src={isZeptoFlow ? ICONS.zeptomail : ICONS.gmail} alt={isZeptoFlow ? 'ZeptoMail' : 'Email'} className="w-full h-full object-contain" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900">{isZeptoFlow ? 'ZeptoMail' : 'Business Email'}</h2>
              {isConnected
                ? <span className="bg-green-50 text-green-700 border border-green-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Connected</span>
                : <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Not Connected</span>}
            </div>
            <p className="text-sm text-slate-500 mt-1">Connect any IMAP/SMTP mailbox — Gmail, Outlook, Zoho, custom domains — to send and receive emails from your inbox.</p>
            <a href="https://support.google.com/mail/answer/7126229" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-500 hover:text-blue-700 font-medium">
              <ExternalLink className="w-3 h-3" /> Gmail App Password Guide
            </a>
          </div>
        </div>

        {/* Setup Guide */}
        <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
          <h3 className="font-black text-slate-800 text-sm mb-3 flex items-center gap-2">
            <span className="w-5 h-5 bg-blue-500 text-white text-[10px] font-black rounded-full flex items-center justify-center">?</span>
            How to connect your email
          </h3>
          <ol className="space-y-3">
            {[
              { step: '1', title: 'Enable IMAP in your mailbox', desc: 'Gmail: Settings → See all settings → Forwarding and POP/IMAP → Enable IMAP. Outlook: Settings → Mail → Sync email → enable IMAP.' },
              { step: '2', title: 'Create an App Password', desc: 'Gmail with 2FA: myaccount.google.com/apppasswords → generate a 16-char app password. Use this instead of your real password.' },
              { step: '3', title: 'Find your server settings', desc: 'Gmail: IMAP imap.gmail.com:993 / SMTP smtp.gmail.com:587. Outlook: IMAP outlook.office365.com:993 / SMTP smtp.office365.com:587.' },
              { step: '4', title: 'Fill in the form below and Save', desc: 'Enter your email address, app password, and server details, then click Save & Connect.' },
              { step: '5', title: 'Test the connection', desc: 'Click "Test Connection" to verify both SMTP (outbound) and IMAP (inbound) are working correctly.' },
            ].map(g => (
              <li key={g.step} className="flex gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">{g.step}</span>
                <div><span className="font-bold text-slate-800">{g.title}</span> — <span className="text-slate-500">{g.desc}</span></div>
              </li>
            ))}
          </ol>
        </div>

        {/* Credentials Form */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-5">
          <h3 className="font-black text-slate-800 text-sm">Account Details</h3>

          {!isZeptoFlow && <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Email Provider</label>
            <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={emailFields.provider} onChange={e => setEmailFields(p => ({ ...p, provider: e.target.value }))}>
              <option value="smtp">SMTP / IMAP</option>
              <option value="zeptomail">ZeptoMail API</option>
            </select>
          </div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Display Name</label>
              <Input placeholder="Support Team" value={emailFields.display_name} onChange={e => setEmailFields(p => ({ ...p, display_name: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200 text-sm" />
              <p className="text-[10px] text-slate-400 mt-1">Shown as the sender name in outgoing emails</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Email Address <span className="text-red-500">*</span></label>
              <Input placeholder="support@company.com" type="email" value={emailFields.email_address} onChange={e => setEmailFields(p => ({ ...p, email_address: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200 text-sm" />
            </div>
          </div>

          {(isZeptoFlow || emailFields.provider === 'zeptomail') && (
            <div className="border-t border-slate-50 pt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">ZeptoMail API Token <span className="text-red-500">*</span></label>
                <RevealInput placeholder={emailSettings?.api_token_configured ? 'Saved - leave unchanged to keep' : 'ZeptoMail API token'} value={emailFields.api_token} onChange={e => setEmailFields(p => ({ ...p, api_token: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">API Base URL</label>
                <Input placeholder="https://api.zeptomail.com" value={emailFields.api_base_url} onChange={e => setEmailFields(p => ({ ...p, api_base_url: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200 text-sm" />
              </div>
            </div>
          )}

          {!isZeptoFlow && emailFields.provider === 'smtp' && <div className="border-t border-slate-50 pt-4">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3">SMTP — Outbound (Sending)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">SMTP Host <span className="text-red-500">*</span></label>
                <Input placeholder="smtp.gmail.com" value={emailFields.smtp_host} onChange={e => setEmailFields(p => ({ ...p, smtp_host: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">SMTP Port</label>
                <Input placeholder="587" value={emailFields.smtp_port} onChange={e => setEmailFields(p => ({ ...p, smtp_port: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200 text-sm" />
                <p className="text-[10px] text-slate-400 mt-1">587 STARTTLS · 465 SSL</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">SMTP Username <span className="text-red-500">*</span></label>
                <Input placeholder="you@gmail.com" value={emailFields.smtp_user} onChange={e => setEmailFields(p => ({ ...p, smtp_user: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">SMTP Password / App Password <span className="text-red-500">*</span></label>
                <RevealInput placeholder="••••••••" value={emailFields.smtp_pass} onChange={e => setEmailFields(p => ({ ...p, smtp_pass: e.target.value }))} />
                <p className="text-[10px] text-slate-400 mt-1">Use an App Password, not your account password</p>
              </div>
            </div>
          </div>}

          {!isZeptoFlow && emailFields.provider === 'smtp' && <div className="border-t border-slate-50 pt-4">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-3">IMAP — Inbound (Receiving)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="text-xs font-bold text-slate-700 block mb-1">IMAP Host <span className="text-red-500">*</span></label>
                <Input placeholder="imap.gmail.com" value={emailFields.imap_host} onChange={e => setEmailFields(p => ({ ...p, imap_host: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">IMAP Port</label>
                <Input placeholder="993" value={emailFields.imap_port} onChange={e => setEmailFields(p => ({ ...p, imap_port: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200 text-sm" />
                <p className="text-[10px] text-slate-400 mt-1">993 SSL · 143 STARTTLS</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">IMAP Username <span className="text-[10px] text-slate-400">(defaults to SMTP user)</span></label>
                <Input placeholder="Leave blank to use SMTP username" value={emailFields.imap_user} onChange={e => setEmailFields(p => ({ ...p, imap_user: e.target.value }))} className="h-10 rounded-xl bg-white border-slate-200 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">IMAP Password <span className="text-[10px] text-slate-400">(defaults to SMTP pass)</span></label>
                <RevealInput placeholder="Leave blank to use SMTP password" value={emailFields.imap_pass} onChange={e => setEmailFields(p => ({ ...p, imap_pass: e.target.value }))} />
              </div>
            </div>
          </div>}
        </div>

        {/* Test result */}
        {emailTestResult && (
          <div className={`p-3 rounded-xl flex items-center gap-2 text-sm font-medium ${emailTestResult.success ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
            {emailTestResult.message}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {isConnected && (
              <Button variant="ghost" className="h-10 px-4 text-red-500 hover:text-red-700 hover:bg-red-50 text-sm font-bold" onClick={handleDisconnectEmail}>
                Disconnect
              </Button>
            )}
            {isConnected && (
              <Button variant="outline" disabled={isTestingEmail} className="h-10 px-4 text-sm font-bold" onClick={handleTestEmail}>
                {isTestingEmail ? 'Testing…' : 'Test Connection'}
              </Button>
            )}
          </div>
          <Button disabled={isSavingEmail} className="h-10 px-6 rounded-full bg-slate-900 text-white text-sm font-bold shadow-lg disabled:opacity-40" onClick={handleSaveEmail}>
            {isSavingEmail ? 'Saving…' : isConnected ? 'Update Credentials' : 'Save & Connect'}
          </Button>
        </div>

        {/* Common settings reference */}
        <div className="bg-slate-50 rounded-2xl border border-slate-100 p-5">
          <h3 className="font-black text-slate-800 text-sm mb-3">Common Server Settings</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left pb-2">Provider</th>
                  <th className="text-left pb-2">IMAP Host</th>
                  <th className="text-left pb-2">SMTP Host</th>
                  <th className="text-left pb-2">Auth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { p: 'Gmail', imap: 'imap.gmail.com:993', smtp: 'smtp.gmail.com:587', auth: 'App Password' },
                  { p: 'Outlook', imap: 'outlook.office365.com:993', smtp: 'smtp.office365.com:587', auth: 'App Password' },
                  { p: 'Yahoo', imap: 'imap.mail.yahoo.com:993', smtp: 'smtp.mail.yahoo.com:587', auth: 'App Password' },
                  { p: 'Zoho', imap: 'imap.zoho.in:993', smtp: 'smtp.zoho.in:587', auth: 'Account Password' },
                  { p: 'GoDaddy', imap: 'imap.secureserver.net:993', smtp: 'smtpout.secureserver.net:465', auth: 'Account Password' },
                ].map(r => (
                  <tr key={r.p} className="text-slate-700">
                    <td className="py-2 font-bold">{r.p}</td>
                    <td className="py-2 font-mono text-[10px]">{r.imap}</td>
                    <td className="py-2 font-mono text-[10px]">{r.smtp}</td>
                    <td className="py-2 text-slate-500">{r.auth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderDetail = () => {
    if (!activeIntegration) return null;
    if (activeIntegration.id === 'whatsapp') return renderWhatsAppDetail();
    if (activeIntegration.id === 'telegram') return renderTelegramDetail();
    if (activeIntegration.id === 'instagram') return renderInstagramDetail();
    if (activeIntegration.id === 'exotel') return renderExotelDetail();
    if (activeIntegration.id === 'twilio') return renderTwilioDetail();
    if (activeIntegration.id === 'email') return renderEmailDetail();
    if (activeIntegration.id === 'zeptomail') return renderEmailDetail();
    return renderGenericDetail();
  };

  const renderIntegrationConnectModal = () => {
    if (!selectedIntegration) return null;
    const connection = getIntegrationConnection(selectedIntegration);
    const permissions = getIntegrationPermissions(selectedIntegration);
    const paymentMeta = PAYMENT_GATEWAY_MODAL[selectedIntegration.id];
    const modalPermissions = paymentMeta?.permissions || permissions;
    const modalDescription = paymentMeta?.modalDesc || selectedIntegration.description;
    const webhookUrl = getIntegrationWebhookUrl(selectedIntegration);
    const Icon = CATEGORIES.find((cat) => cat.id === selectedIntegration.category)?.icon || Puzzle;
    const actionLabel = connection.connected
      ? 'Manage Setup'
      : `Connect ${selectedIntegration.name}`;

    const logoNode = selectedIntegration.logoFallback ? (
      <span className="text-2xl leading-none">{selectedIntegration.logoFallback}</span>
    ) : (
      <img
        src={selectedIntegration.logo}
        alt={selectedIntegration.name}
        className="h-7 w-7 object-contain"
        onError={(event) => { event.currentTarget.style.display = 'none'; }}
      />
    );

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
        onClick={() => setSelectedIntegrationId(null)}
      >
        <div
          className="relative w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-2xl shadow-purple-950/20"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setSelectedIntegrationId(null)}
            className="absolute right-5 top-5 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            ×
          </button>

          <div className="px-8 pb-4 pt-10 text-center">
            <div className="mb-5 flex items-center justify-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg shadow-purple-200"
                style={{ background: 'linear-gradient(180deg, #b217ff 0%, #7900c8 100%)' }}
              >
                {logoNode}
              </div>
              <div className="text-2xl font-black text-slate-300">⇄</div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-orange-500 shadow-lg shadow-slate-200">
                <Sparkles size={24} />
              </div>
            </div>
            <h2 className="text-xl font-black text-slate-900">
              {connection.connected ? 'Manage' : 'Connect'} {selectedIntegration.name}
            </h2>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.22em] text-purple-600">
              Step 1 of 2: Authentication
            </p>
          </div>

          <div className="mx-8 border-t border-slate-100" />

          <div className="space-y-5 px-8 py-6">
            <p className="text-center text-sm leading-6 text-slate-500">
              {modalDescription}
            </p>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-700">Greeto will be able to:</p>
              <div className="mt-3 space-y-2">
                {modalPermissions.map((permission) => (
                  <div key={permission} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <CheckCircle2 size={16} className="shrink-0 text-purple-500" />
                    <span>{permission}</span>
                  </div>
                ))}
              </div>
            </div>
            {connection.connected && (
              <div className="rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-xs font-bold text-green-700">
                {connection.label || 'Connected and live in this workspace.'}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-t border-slate-100 px-8 py-5">
            <button
              type="button"
              onClick={() => setSelectedIntegrationId(null)}
              className="h-12 flex-1 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => openIntegrationSetup(selectedIntegration)}
              className="h-12 flex-1 rounded-2xl bg-linear-to-b from-[#b217ff] to-[#7900c8] text-sm font-black text-white shadow-lg shadow-purple-200 transition hover:opacity-95"
            >
              ↪ {actionLabel}
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <Modal
        isOpen={!!selectedIntegration}
        onClose={() => setSelectedIntegrationId(null)}
        title={`${connection.connected ? 'Manage' : 'Connect'} ${selectedIntegration.name}`}
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border bg-white p-3 shadow-lg shadow-purple-100"
              style={{ borderColor: `${selectedIntegration.accentColor}33`, background: `${selectedIntegration.accentColor}10` }}
            >
              {selectedIntegration.logoFallback ? (
                <span className="text-3xl leading-none">{selectedIntegration.logoFallback}</span>
              ) : (
                <img
                  src={selectedIntegration.logo}
                  alt={selectedIntegration.name}
                  className="h-full w-full object-contain"
                  onError={(event) => { event.currentTarget.style.display = 'none'; }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-2xl font-black tracking-tight text-slate-950">{selectedIntegration.name}</h3>
                {connection.connected ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-black text-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                  </span>
                ) : selectedIntegration.isUpcoming ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">Coming soon</span>
                ) : (
                  <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-black text-purple-700">Ready to connect</span>
                )}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-500">{selectedIntegration.description}</p>
              {connection.connected && connection.label && (
                <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-green-600">{connection.label}</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-purple-100 bg-purple-50/70 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-purple-700 shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-500">Category</p>
              <p className="mt-1 text-sm font-black text-slate-950">{CATEGORIES.find((cat) => cat.id === selectedIntegration.category)?.name || 'Integration'}</p>
            </div>
            <div className="rounded-3xl border border-green-100 bg-green-50/70 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-green-700 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-green-600">Security</p>
              <p className="mt-1 text-sm font-black text-slate-950">Encrypted credentials</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                <Server className="h-5 w-5" />
              </div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Status</p>
              <p className="mt-1 text-sm font-black text-slate-950">{connection.connected ? 'Live in workspace' : 'Setup required'}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Webhook / callback</p>
                <p className="mt-1 truncate font-mono text-xs text-slate-600">{webhookUrl}</p>
              </div>
              {webhookUrl.startsWith('http') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-2xl"
                  onClick={() => navigator.clipboard?.writeText(webhookUrl)}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/70 p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-purple-500">Permissions</p>
            <div className="grid gap-2">
              {permissions.map((permission) => (
                <div key={permission} className="flex items-center gap-2 rounded-2xl bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  <span>{permission}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-purple-100 pt-5 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-2xl border-slate-200 px-5 font-black"
              onClick={() => setSelectedIntegrationId(null)}
            >
              Close
            </Button>
            <Button
              type="button"
              className="h-11 rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-6 font-black text-white shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700"
              onClick={() => openIntegrationSetup(selectedIntegration)}
            >
              {actionLabel} <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-[#fbf7ff] via-[#f7f3fb] to-[#eef2ff]">
      {settingsMode === 'overview' ? (
        renderSettingsHub()
      ) : settingsMode !== 'integrations' ? (
        renderSettingsSubpage()
      ) : (
        <>
      {/* Header */}
      <div className="bg-white/90 border-b border-purple-100 sticky top-0 z-30 backdrop-blur-xl">
        <div className="px-8 py-5 max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (initialMode === 'integrations' ? onNavigate?.('settings') : setSettingsMode('overview'))}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-100 bg-purple-50 text-purple-700 transition-colors hover:bg-purple-100"
              title="Back to Settings"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="p-2 bg-gradient-to-br from-purple-700 to-fuchsia-600 rounded-2xl shadow-sm"><Puzzle className="w-5 h-5 text-white" /></div>
            <div>
              {/* <p className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Customer channels</p> */}
              <h1 className="text-xl font-black text-slate-950 tracking-tight">Integrations</h1>
              <p className="text-xs text-slate-400 font-medium">Connect your stack — channels, CRM, payments & AI</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-purple-50 px-3 py-1.5 rounded-full border border-purple-100"
              title={translationSetting.hasOpenAiKey ? '' : 'Connect OpenAI in Integrations first - auto-translation needs saved OpenAI credentials'}
            >
              <Globe2 className="w-3 h-3" />
              <span>Auto-Translate</span>
              <button
                type="button"
                onClick={handleToggleTranslation}
                disabled={isSavingTranslation}
                aria-label="Toggle auto-translation"
                className={cn(
                  "relative inline-flex h-4 w-8 items-center rounded-full transition-colors disabled:opacity-50",
                  translationSetting.enabled ? "bg-green-500" : "bg-slate-300"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                    translationSetting.enabled ? "translate-x-4" : "translate-x-0.5"
                  )}
                />
              </button>
              {!translationSetting.hasOpenAiKey && (
                <span className="text-amber-500 normal-case font-semibold">No API key</span>
              )}
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-white px-3 py-1.5 rounded-full border border-purple-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> API Nominal
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-white px-3 py-1.5 rounded-full border border-purple-100">
              <ShieldCheck className="w-3 h-3" /> AES-256 Encrypted
            </span>
          </div>
        </div>
      </div>

      {renderOverview()}
        </>
      )}

      <Modal
        isOpen={activeIntegrationId !== null}
        onClose={() => setActiveIntegrationId(null)}
        title={activeIntegration?.name || 'Configure Integration'}
        className="max-w-3xl"
      >
        <div className="-m-7 max-h-[75vh] overflow-y-auto p-7">
          {activeIntegrationId !== null && renderDetail()}
        </div>
      </Modal>

      {renderIntegrationConnectModal()}

      <Modal
        isOpen={isWhatsAppMetaIntroOpen}
        onClose={() => {
          setIsWhatsAppMetaIntroOpen(false);
          setEditingWhatsAppNumber(null);
          setManualWhatsAppError('');
        }}
        title={editingWhatsAppNumber ? 'Edit WhatsApp connection' : 'Connect WhatsApp Business'}
        className="max-w-md"
      >
        <div className="-m-7 overflow-hidden rounded-b-2xl">
          <div className="bg-gradient-to-br from-[#25D366] to-[#128C7E] px-7 pb-7 pt-5 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <MessageSquare className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm text-white/85">Bring your customer conversations into Greeto in under two minutes.</p>
          </div>

          <div className="space-y-5 px-7 py-6">
            {!editingWhatsAppNumber && <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setWhatsappConnectMode('meta')}
                className={cn("flex-1 rounded-lg py-2 transition-colors", whatsappConnectMode === 'meta' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
              >
                Connect with Meta
              </button>
              <button
                type="button"
                onClick={() => setWhatsappConnectMode('manual')}
                className={cn("flex-1 rounded-lg py-2 transition-colors", whatsappConnectMode === 'manual' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
              >
                Enter details manually
              </button>
            </div>}

            {!editingWhatsAppNumber && whatsappConnectMode === 'meta' ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { icon: ShieldCheck, label: 'Authorize' },
                    { icon: Building2, label: 'Select business' },
                    { icon: CheckCircle2, label: 'Connected' },
                  ].map(({ icon: StepIcon, label }, i) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 py-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                        <StepIcon className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{i + 1}. {label}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5">
                  {[
                    'Send and receive WhatsApp messages in one shared inbox',
                    'Use Meta-approved message templates for outreach',
                    'Automate replies and route conversations to your team',
                    'Connect one or more verified business phone numbers',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#25D366]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>
                    A secure Meta window will ask you to pick your Facebook Business and WhatsApp
                    Business Account. Greeto never sees your Meta password, and access tokens are
                    stored securely on our servers — never in your browser.
                  </span>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => setIsWhatsAppMetaIntroOpen(false)}>Not now</Button>
                  <Button
                    className="flex-1 gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5b]"
                    onClick={startWhatsAppMetaSignup}
                    disabled={!sdkLoaded || loadingWhatsapp}
                  >
                    {loadingWhatsapp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Opening Meta...
                      </>
                    ) : (
                      <>Continue with Meta <ArrowRight className="h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">Phone Number ID</label>
                    <Input
                      value={manualWhatsAppFields.phone_number_id}
                      onChange={(e) => setManualWhatsAppFields((f) => ({ ...f, phone_number_id: e.target.value }))}
                      placeholder="e.g. 921055841100882"
                      disabled={Boolean(editingWhatsAppNumber)}
                    />
                    {editingWhatsAppNumber && <p className="mt-1 text-[11px] text-slate-500">Phone Number ID cannot be changed because it is linked to existing channels and conversations.</p>}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">WhatsApp Business Account ID</label>
                    <Input
                      value={manualWhatsAppFields.business_account_id}
                      onChange={(e) => setManualWhatsAppFields((f) => ({ ...f, business_account_id: e.target.value }))}
                      placeholder="e.g. 3836731576631503"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">{editingWhatsAppNumber ? 'New Access Token (optional)' : 'Access Token'}</label>
                    <Input
                      type="password"
                      value={manualWhatsAppFields.permanent_token}
                      onChange={(e) => setManualWhatsAppFields((f) => ({ ...f, permanent_token: e.target.value }))}
                      placeholder={editingWhatsAppNumber ? 'Leave blank to keep the current encrypted token' : 'Permanent or long-lived access token'}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-slate-600">Display Phone Number <span className="font-normal text-slate-400">(optional)</span></label>
                    <Input
                      value={manualWhatsAppFields.display_phone_number}
                      onChange={(e) => setManualWhatsAppFields((f) => ({ ...f, display_phone_number: e.target.value }))}
                      placeholder="e.g. +91 81474 70707"
                    />
                  </div>
                </div>

                {manualWhatsAppError && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{manualWhatsAppError}</p>
                )}

                <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span>Find these values in Meta Business Suite → WhatsApp Accounts → API Setup. The access token is stored securely and never shown again after saving.</span>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => {
                    setIsWhatsAppMetaIntroOpen(false);
                    setEditingWhatsAppNumber(null);
                    setManualWhatsAppError('');
                  }}>Cancel</Button>
                  <Button
                    className="flex-1 gap-2 bg-[#25D366] text-white hover:bg-[#1ebe5b]"
                    onClick={handleSaveManualWhatsApp}
                    disabled={isSavingManualWhatsApp}
                  >
                    {isSavingManualWhatsApp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>{editingWhatsAppNumber ? 'Save changes' : 'Save & Connect'}</>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isWhatsAppConnectionSummaryOpen}
        onClose={() => setIsWhatsAppConnectionSummaryOpen(false)}
        title="WhatsApp Business connected"
        className="max-w-lg"
      >
        <div className="space-y-4 p-1">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle2 className="h-6 w-6" /></div>
            <p className="text-sm text-slate-500">{allWhatsappSettings.length} WhatsApp number{allWhatsappSettings.length === 1 ? '' : 's'} are ready for this workspace.</p>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {allWhatsappSettings.map((number) => (
              <div key={number.phone_number_id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{number.display_phone_number || number.phone_number_id}</p>
                    <p className="truncate text-xs text-slate-500">{number.verified_name || 'WhatsApp Business'}{number.is_primary ? ' · Primary sender' : ''}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!number.is_primary && <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSetPrimaryWhatsApp(number.phone_number_id)}>Set primary</Button>}
                    <span className="text-xs font-bold text-green-600">Connected</span>
                  </div>
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-1.5 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 sm:grid-cols-2">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                    <span className="truncate">Phone ID: <span className="font-mono text-slate-600">{number.phone_number_id}</span></span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText(number.phone_number_id)}
                      className="shrink-0 text-slate-400 hover:text-slate-700"
                      title="Copy phone number ID"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                    <span className="truncate">Business ID: <span className="font-mono text-slate-600">{number.business_account_id || '—'}</span></span>
                    {number.business_account_id && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(number.business_account_id)}
                        className="shrink-0 text-slate-400 hover:text-slate-700"
                        title="Copy business account ID"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    <Clock className="h-3 w-3 shrink-0 text-slate-400" />
                    <span>
                      Access token: {number.token_configured ? 'Active' : 'Not saved'}
                      {number.token_expires_at ? ` · Expires ${new Date(number.token_expires_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button className="w-full bg-[#16a89a] text-white hover:bg-[#11877c]" onClick={() => { setIsWhatsAppConnectionSummaryOpen(false); onNavigate?.('conversations'); }}>
            Open WhatsApp Inbox
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setIsWhatsAppConnectionSummaryOpen(false)}>Manage settings</Button>
          <button type="button" className="block w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800" onClick={handleConnectWhatsApp}>Reconnect WhatsApp</button>
        </div>
      </Modal>

    </div>
  );
}

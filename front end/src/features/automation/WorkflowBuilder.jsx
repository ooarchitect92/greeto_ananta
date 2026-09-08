import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import dagre from 'dagre';
import {
  ReactFlow,
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
  Handle,
  Position,
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  EdgeLabelRenderer
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '../../components/ui/Button.jsx';
import { Save, ArrowLeft, Plus, Clock, MessageSquare, GitBranch, Zap, StopCircle, Loader2, Play, MessageCircle, Code, UserCheck, Tag, Mic, Workflow as WorkflowIcon, Megaphone, Filter, Link, Copy, Check, RefreshCw, Trash2, Globe, Send, ChevronDown, ChevronUp, Image, Video, FileText as FileIcon, Upload, X, Star, CreditCard, BellRing, Bell, Mail, ListChecks, List, Phone, Download, Settings, Keyboard, Info, Table as TableIcon, XCircle, FileDown, Repeat, CalendarClock, PlayCircle, Search, UserPlus, Undo2, Redo2, Wand2, Eye, AlertTriangle } from 'lucide-react'; const LinkIcon = Link;
import { getTemplates, createTemplate, getWhatsAppSettings, uploadTemplateExampleMedia, runWorkflow, publishWorkflow, aiGenerateWorkflow, getWorkflows, getCampaigns, getWorkflowStageContext, getWebhookEvents, clearWebhookEvents, fetchMediaLibrary, uploadFlowMedia, createPaymentLink, getLabels, getEmailTemplates, getLeadStages, getWorkspaceMembers, testZoomConnection, postWebhookSample } from './api.js';
import { GallerySelectModal } from '../media/GallerySelectModal.jsx';
import { connectSocket } from '../../services/realtime/socket.js';

const getPublicBackendOrigin = () => {
  const configured = import.meta.env.VITE_PUBLIC_API_URL || import.meta.env.VITE_API_URL || '';
  const normalized = String(configured).trim().replace(/\/api\/?$/, '').replace(/\/$/, '');
  if (normalized) return normalized;

  const { protocol, hostname, port, origin } = window.location;
  const isViteDevServer = ['5173', '5174', '5175'].includes(port);
  return isViteDevServer ? `${protocol}//${hostname}:3000` : origin;
};

const getWorkflowWebhookUrl = (workflowId) => (
  `${getPublicBackendOrigin()}/webhooks/workflow/${workflowId}`
);

const extractTemplateVariables = (...values) => {
  const source = values.filter(Boolean).map(String).join(' ');
  const matches = source.match(/{{\s*([^}]+?)\s*}}/g) || [];
  return Array.from(new Set(matches.map((token) => token.replace(/[{}]/g, '').trim()).filter(Boolean)));
};

const normalizeEmailTemplateList = (response) => {
  const candidates = [
    response,
    response?.data,
    response?.items,
    response?.templates,
    response?.emailTemplates,
    response?.data?.items,
    response?.data?.templates,
    response?.data?.emailTemplates,
  ];
  const list = candidates.find(Array.isArray) || [];

  return list.map((template, index) => {
    const id = template.id || template.template_id || template.slug || template.name || `email_template_${index}`;
    const name = template.name || template.title || template.template_name || template.subject || `Email Template ${index + 1}`;
    const subject = template.subject || template.email_subject || '';
    const htmlBody = template.html_body || template.htmlBody || template.html || template.body || '';
    const textBody = template.text_body || template.textBody || template.text || template.content || '';
    const variables = Array.isArray(template.variables)
      ? template.variables
      : extractTemplateVariables(subject, htmlBody, textBody);

    return {
      ...template,
      id,
      name,
      subject,
      html_body: htmlBody,
      text_body: textBody,
      variables,
    };
  });
};

const getAssignMode = (data = {}) => {
  if (data.assignMode) return data.assignMode;
  const actionValue = String(data.actionValue || '').trim();
  if (actionValue.includes('xolox_response')) return 'xolox_dynamic';
  if (actionValue.startsWith('{') && !actionValue.startsWith('{{')) return 'round_robin';
  return 'direct';
};

const WORKFLOW_START_NODE_TYPES = new Set([
  'trigger',
  'campaign_trigger',
  'customer_message_trigger',
  'incoming_webhook',
  'new_contact',
  'xolox_event',
  'starforze_lead_updated',
  'lead_stage_updated_webhook',
]);

const getDelayMinutes = (data = {}) => {
  const unit = String(data.unit || '').toLowerCase();
  const legacyValue = Number(data.duration || data.delayValue || 0);
  return Number(data.minutes || 0)
    + Number(data.hours || 0) * 60
    + Number(data.days || 0) * 24 * 60
    + (unit === 'minutes' ? legacyValue : 0)
    + (unit === 'hours' ? legacyValue * 60 : 0)
    + (unit === 'days' ? legacyValue * 24 * 60 : 0);
};

function collectNodeValidationIssues(nodes = [], edges = []) {
  const incomingNodeIds = new Set(edges.map((edge) => edge.target).filter(Boolean));
  const issuesByNodeId = {};

  for (const node of nodes) {
    const data = node?.data || {};
    const issues = [];

    if (!WORKFLOW_START_NODE_TYPES.has(node?.type) && !incomingNodeIds.has(node?.id)) {
      issues.push({ severity: 'error', message: 'This node is not connected to a previous step.' });
    }

    if ((node?.type === 'send_template' || node?.type === 'whatsapp') && !String(data.template || data.templateName || '').trim()) {
      issues.push({ severity: 'error', message: 'Select an approved WhatsApp template.' });
    }

    if (node?.type === 'send_message' && !String(data.message || data.text || '').trim()) {
      issues.push({ severity: 'error', message: 'Enter the message to send.' });
    }

    if (node?.type === 'delay' && (!Number.isFinite(getDelayMinutes(data)) || getDelayMinutes(data) <= 0)) {
      issues.push({ severity: 'error', message: 'Set a delay greater than zero.' });
    }

    if (node?.type === 'wait_for_stage' && !String(data.targetStageId || '').trim()) {
      issues.push({ severity: 'error', message: 'Select the lead stage to wait for.' });
    }

    if (node?.type === 'condition' && data.conditionType === 'variable_match' && !String(data.variableName || data.variable || '').trim()) {
      issues.push({ severity: 'warning', message: 'Choose a variable for this condition.' });
    }

    if (node?.type === 'attribute_condition' && !(data.groups || []).some((group) => Array.isArray(group?.clauses) && group.clauses.length)) {
      issues.push({ severity: 'warning', message: 'Add at least one attribute rule.' });
    }

    if (issues.length) issuesByNodeId[node.id] = issues;
  }

  return issuesByNodeId;
}

// --- Custom Node Components ---

const getRuntimeStatus = (status) => {
  let current = status;
  const seen = new Set();

  // Older in-memory layout snapshots may contain canvas metadata nested more
  // than once. Only a string is ever valid as a persisted runtime status.
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    current = current.runtime;
  }

  return typeof current === 'string' ? current : undefined;
};

const sanitizeWorkflowNodes = (workflowNodes = []) => workflowNodes.map((node) => {
  const runtimeStatus = getRuntimeStatus(node?.data?.nodeStatus);
  if (node?.data?.nodeStatus === runtimeStatus) return node;

  return {
    ...node,
    data: {
      ...node.data,
      nodeStatus: runtimeStatus,
    },
  };
});

const NodeWrapper = ({ children, selected, title, icon: Icon, colorClass, status }) => {
  const runtimeStatus = getRuntimeStatus(status);
  const validationIssues = typeof status === 'object' && Array.isArray(status.validationIssues)
    ? status.validationIssues
    : [];
  const primaryIssue = validationIssues.find((issue) => issue.severity === 'error') || validationIssues[0];
  let statusClass = 'bg-white/20 text-white';
  let statusText = '';
  if (runtimeStatus === 'running') { statusClass = 'bg-white/20 text-white shadow-sm'; statusText = 'Running'; }
  else if (runtimeStatus === 'completed') { statusClass = 'bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200'; statusText = 'Completed'; }
  else if (runtimeStatus === 'waiting') { statusClass = 'bg-amber-100 text-amber-700 shadow-sm border border-amber-200'; statusText = 'Waiting'; }
  else if (runtimeStatus === 'error') { statusClass = 'bg-rose-100 text-rose-700 shadow-sm border border-rose-200'; statusText = 'Error'; }

  // Extract color name to map to modern gradient (e.g. bg-green-600 -> green)
  const colorMatch = colorClass?.match(/bg-([a-z]+)-/);
  const colorName = colorMatch ? colorMatch[1] : 'purple';
  
  const gradients = {
    green: 'from-emerald-400 to-emerald-600',
    purple: 'from-fuchsia-500 to-purple-600',
    blue: 'from-blue-400 to-indigo-600',
    orange: 'from-amber-400 to-orange-500',
    amber: 'from-amber-400 to-orange-500',
    indigo: 'from-indigo-400 to-violet-600',
    violet: 'from-violet-400 to-purple-600',
    teal: 'from-teal-400 to-emerald-500',
    yellow: 'from-yellow-400 to-amber-500',
    gray: 'from-slate-500 to-slate-700',
    slate: 'from-slate-500 to-slate-700',
    red: 'from-rose-400 to-rose-600',
    cyan: 'from-cyan-400 to-blue-500',
    emerald: 'from-emerald-400 to-green-600'
  };

  const gradient = gradients[colorName] || gradients.purple;

  return (
    <div className={`group transition-all duration-300 hover:-translate-y-1 shadow-xl hover:shadow-2xl rounded-3xl bg-white/95 backdrop-blur-xl border min-w-[260px] max-w-[320px] ${selected ? 'border-purple-400 ring-4 ring-purple-500/20' : primaryIssue?.severity === 'error' ? 'border-rose-400 ring-2 ring-rose-100' : primaryIssue ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200/60'}`}>
      <div className={`flex items-center px-4 py-3 bg-gradient-to-br ${gradient} text-white rounded-t-[23px] border-b border-white/20 shadow-inner`}>
        <div className="p-1.5 bg-white/20 rounded-xl mr-3 shadow-sm backdrop-blur-md">
          <Icon size={16} className="text-white drop-shadow-sm" />
        </div>
        <span className="font-bold text-sm tracking-wide drop-shadow-sm">{title}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {primaryIssue && (
            <span
              title={validationIssues.map((issue) => issue.message).join('\n')}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold shadow-sm ${primaryIssue.severity === 'error' ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}
            >
              <AlertTriangle size={12} />
              {primaryIssue.severity === 'error' ? 'Fix' : 'Check'}
            </span>
          )}
          {runtimeStatus && <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${statusClass}`}>{statusText || runtimeStatus}</span>}
        </div>
      </div>
      <div className="p-4 rounded-b-[23px]">
        {children}
      </div>
    </div>
  );
};


const MediaPreview = ({ type, url, fileName }) => {
  if (!type || type === 'none' || !url) return null;

  // Simple check for cloudinary/external URLs that might be variables
  const isVariable = url.startsWith('{{') && url.endsWith('}}');

  return (
    <div className="mb-2 bg-slate-50 border border-slate-200 rounded overflow-hidden">
      {type === 'image' ? (
        isVariable ? (
          <div className="w-full h-20 bg-teal-50 flex items-center justify-center p-2 text-center border-b border-teal-100 italic text-[9px] text-teal-600">
            Image: {url}
          </div>
        ) : (
          <img src={url} alt="preview" className="w-full h-24 object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
        )
      ) : type === 'video' ? (
        <div className="w-full h-20 bg-slate-800 flex flex-col items-center justify-center gap-1">
          <Video size={24} className="text-white opacity-60" />
          <span className="text-[8px] text-slate-400 px-2 truncate w-full text-center">
            {isVariable ? url : (fileName || 'Video')}
          </span>
        </div>
      ) : type === 'document' ? (
        <div className="w-full h-20 bg-slate-100 flex flex-col items-center justify-center p-2 text-center">
          <FileIcon size={24} className="text-slate-400 mb-1" />
          <span className="text-[9px] text-slate-500 truncate w-full">
            {isVariable ? url : (fileName || 'Document')}
          </span>
        </div>
      ) : (
        <div className="p-2 flex items-center gap-2">
          <Link size={14} className="text-slate-400" />
          <span className="text-[10px] text-slate-500 truncate">{isVariable ? url : (fileName || url)}</span>
        </div>
      )}
    </div>
  );
};

const TriggerNode = ({ data, selected }) => {
  return (
    <NodeWrapper
      selected={selected}
      title="WhatsApp Incoming"
      icon={MessageSquare}
      colorClass="bg-green-600"
      status={data.nodeStatus}
    >
      <div className="text-xs font-bold text-slate-700 mb-2 px-1">
        {data.label || 'WhatsApp Keyword Trigger'}
      </div>
      {(data.keywords && data.keywords.trim() !== '') && (
        <div className="text-[10px] text-slate-600 bg-green-50/80 p-2 rounded-xl border border-green-200/60 mb-1 flex flex-wrap gap-1.5 items-center shadow-sm">
          <span className="font-bold text-green-800 uppercase tracking-wider text-[9px]">Keywords:</span>
          {data.keywords.split(',').map((kw, i) => (
            <span key={i} className="bg-white border text-green-700 font-semibold border-green-200 px-1.5 py-0.5 rounded-lg truncate max-w-[120px] shadow-sm">
              {kw.trim()}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-4 h-4 bg-white border-2 border-green-500 shadow-sm" />
    </NodeWrapper>
  );
};

const TemplateNode = ({ data, selected }) => {
  const buttons = data.buttons || [];

  return (
    <NodeWrapper selected={selected} title="Send Template" icon={MessageSquare} colorClass="bg-green-600" status={data.nodeStatus}>
      <MediaPreview type={data.headerType} url={data.headerUrl} fileName={data.headerFileName} />
      <div className="text-xs text-slate-600 mb-2 font-medium">Template: <span className="text-green-700">{data.template || 'Select...'}</span></div>

      {/* Template Content Preview */}
      {data.content && (
        <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded mb-2 border border-slate-100 whitespace-pre-wrap break-words leading-relaxed">
          {data.content}
        </div>
      )}

      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />

      {/* Button branches on the right */}
      {buttons.length > 0 && (
        <div className="space-y-2 mt-2 border-t border-slate-50 pt-2">
          {buttons.map((btnText, idx) => (
            <div key={idx} className="relative flex items-center justify-end">
              <span className="text-[10px] text-slate-500 mr-2 bg-slate-100 px-1 rounded truncate max-w-[140px]">{btnText}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`button-${idx}`}
                className="w-3 h-3 bg-blue-400 !right-[-6px] border-2 border-white"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Main output source if no buttons or as fallback */}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const DelayNode = ({ data, selected }) => {
  const mode = data.delayMode || (data.targetAt ? 'specific' : 'relative');
  let summary = '';
  if (mode === 'specific' && data.targetAt) {
    const d = new Date(data.targetAt);
    summary = isNaN(d.getTime()) ? '' : `Until: ${d.toLocaleString()}`;
  } else if (typeof data.days === 'number' || typeof data.hours === 'number' || typeof data.minutes === 'number') {
    const days = Number.isFinite(Number(data.days)) ? Number(data.days) : 0;
    const hours = Number.isFinite(Number(data.hours)) ? Number(data.hours) : 0;
    const minutes = Number.isFinite(Number(data.minutes)) ? Number(data.minutes) : 0;
    summary = `Wait: ${days}d ${hours}h ${minutes}m`;
  } else {
    summary = `Wait: ${data.duration || 0} ${data.unit || 'minutes'}`;
  }

  return (
    <NodeWrapper selected={selected} title="Time Delay" icon={Clock} colorClass="bg-orange-500" status={data.nodeStatus}>
      <div className="flex flex-col items-center justify-center py-2 px-3 bg-amber-50/80 rounded-xl border border-amber-200/50 shadow-sm mt-1">
        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Delay Config</span>
        <div className="text-xs text-slate-800 font-bold">{summary}</div>
      </div>
      <Handle type="target" position={Position.Top} className="w-4 h-4 bg-white border-2 border-orange-500 shadow-sm" />
      <Handle type="source" position={Position.Bottom} className="w-4 h-4 bg-white border-2 border-orange-500 shadow-sm" />
    </NodeWrapper>
  );
};

const ConditionNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Condition" icon={GitBranch} colorClass="bg-blue-600" status={data.nodeStatus}>
      <div className="bg-blue-50/50 border border-blue-100/50 rounded-xl p-2.5 mb-3 text-center">
        <span className="text-xs font-bold text-blue-900">{data.condition || 'Configure condition'}</span>
      </div>
      <div className="flex justify-between px-2 pb-1 relative">
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">YES</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black text-rose-600 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">NO</span>
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="w-4 h-4 bg-white border-2 border-blue-500 shadow-sm" />
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '25%' }} className="w-3.5 h-3.5 bg-emerald-500 border-2 border-white shadow-sm" />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '75%' }} className="w-3.5 h-3.5 bg-rose-500 border-2 border-white shadow-sm" />
    </NodeWrapper>
  );
};

const AttributeConditionNode = ({ data, selected }) => {
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const total = groups.length + 1;
  return (
    <NodeWrapper selected={selected} title="Custom Attributes" icon={GitBranch} colorClass="bg-violet-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-600 mb-2">Groups: {groups.length} • Default route</div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      {groups.map((g, idx) => (
        <Handle
          key={`g-${idx}`}
          type="source"
          position={Position.Bottom}
          id={`group-${idx}`}
          className="w-3 h-3 bg-emerald-500"
          style={{ left: `${Math.round(((idx + 1) / (total + 1)) * 100)}%` }}
        />
      ))}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="w-3 h-3 bg-slate-500"
        style={{ left: `${Math.round(((total) / (total + 1)) * 100)}%` }}
      />
    </NodeWrapper>
  );
};

const SendMessageNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Send Message" icon={MessageCircle} colorClass="bg-teal-500" status={data.nodeStatus}>
      {/* WhatsApp Chat Bubble Style */}
      <div className="relative mt-1">
        <div className="absolute top-0 right-[-6px] w-4 h-4 bg-[#dcf8c6] rotate-45 transform origin-bottom-left" style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}></div>
        <div className="relative bg-[#dcf8c6] text-slate-800 p-3 rounded-2xl rounded-tr-none shadow-sm text-[11px] whitespace-pre-wrap break-words leading-relaxed">
          {data.message || 'Enter message...'}
        </div>
      </div>
      <Handle type="target" position={Position.Top} className="w-4 h-4 bg-white border-2 border-teal-500 shadow-sm" />
      <Handle type="source" position={Position.Bottom} className="w-4 h-4 bg-white border-2 border-teal-500 shadow-sm" />
    </NodeWrapper>
  );
};

const ListMessageNode = ({ data, selected }) => {
  const items = data.items || [];
  return (
    <NodeWrapper selected={selected} title="List Menu" icon={List} colorClass="bg-teal-700" status={data.nodeStatus}>
      <div className="text-xs font-bold text-teal-800 mb-1 truncate px-1 border-b border-teal-50 bg-teal-50/50 rounded py-1">
        {data.buttonText || 'Select Option'}
      </div>
      <div className="text-[10px] text-slate-500 mb-2 truncate line-clamp-2 px-1">
        {data.body || 'Choose an option...'}
      </div>

      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />

      <div className="space-y-1.5 mt-2 pt-2 border-t border-slate-100">
        {(items.slice(0, 10)).map((it, idx) => {
          const label = typeof it === 'object' ? it.title : it;
          return (
            <div key={idx} className="relative flex items-center justify-end">
              <span className="text-[9px] text-teal-600 font-medium mr-2 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded truncate max-w-[140px]">
                {label}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`item-${idx}`}
                className="w-3 h-3 bg-teal-500 !right-[-6px] border-2 border-white"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          );
        })}
      </div>
      <div className="relative flex items-center justify-center pt-2 border-t border-slate-100 mt-2">
        <span className="text-[9px] text-slate-400 italic font-medium uppercase tracking-tight">Main Flow</span>
        <Handle type="source" position={Position.Bottom} id="default" className="w-3 h-3 bg-slate-400 border-2 border-white" />
      </div>
    </NodeWrapper>
  );
};

const ResponseMessageNode = ({ data, selected }) => {
  const buttons = data.buttons || [];
  const hasMedia = data.headerType && data.headerType !== 'none';

  return (
    <NodeWrapper selected={selected} title="Response Message" icon={MessageSquare} colorClass="bg-teal-600" status={data.nodeStatus}>
      <MediaPreview type={data.headerType} url={data.headerUrl} fileName={data.headerFileName} />
      <div className="text-xs text-slate-600 mb-2 whitespace-pre-wrap break-words leading-relaxed">
        {data.message || 'Enter message...'}
      </div>

      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />

      {buttons.length > 0 ? (
        <div className="space-y-2 mt-2 pt-2 border-t border-slate-100">
          {buttons.map((btnText, idx) => (
            <div key={idx} className="relative flex items-center justify-end">
              <span className="text-[10px] text-slate-500 mr-2 bg-slate-100 px-1 rounded truncate max-w-[120px]">{btnText}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`btn-${idx}`}
                className="w-3 h-3 bg-blue-400 !right-[-6px]"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          ))}
          {/* Main sequential output at the bottom */}
          <div className="relative flex items-center justify-center pt-2 border-t border-slate-100 mt-2">
            <span className="text-[9px] text-slate-400 italic font-medium uppercase tracking-tight">Main Flow</span>
            <Handle type="source" position={Position.Bottom} id="default" className="w-3 h-3 bg-slate-400 border-3 border-white" />
          </div>
        </div>
      ) : (
        <div className="relative flex items-center justify-center pt-2 border-t border-slate-100 mt-2">
           <span className="text-[9px] text-slate-400 italic font-medium uppercase tracking-tight">Main Flow</span>
           <Handle type="source" position={Position.Bottom} id="default" className="w-3 h-3 bg-slate-400 border-2 border-white" />
        </div>
      )}
    </NodeWrapper>
  );
};

const FeedbackNode = ({ data, selected }) => {
  const style = data.buttonStyle || 'numbers'; // 'numbers' | 'emojis' | 'stars'

  const getDisplay = (val) => {
    if (style === 'emojis') {
      const emojis = ['😠', '🙁', '😐', '🙂', '😄'];
      return emojis[val - 1] || val;
    }
    if (style === 'stars') {
      return `${val} ⭐`;
    }
    return val;
  };

  return (
    <NodeWrapper selected={selected} title="Feedback" icon={Star} colorClass="bg-yellow-600" status={data.nodeStatus}>
      <div className="text-[10px] text-slate-600 mb-2 italic line-clamp-2">
        "{data.question || 'Your feedback matters! Please rate this chat on scale of 1-5'}"
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {[1, 2, 3, 4, 5].map(v => (
          <div key={v} className="bg-yellow-50 border border-yellow-200 rounded px-1.5 py-1 text-[10px] text-yellow-700 whitespace-nowrap min-w-[28px] text-center font-bold">
            {getDisplay(v)}
          </div>
        ))}
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </NodeWrapper>
  );
};

const PaymentRequestNode = ({ data, selected }) => {
  const type = data.requestType || 'course';
  return (
    <NodeWrapper selected={selected} title="Payment Request" icon={CreditCard} colorClass="bg-indigo-600" status={data.nodeStatus}>
      <div className="bg-slate-50 -mx-3 -mb-3 p-3 rounded-b-xl border-t border-slate-100">
        <div className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter mb-1 border-b border-indigo-100 pb-1">
          {data.headerText || 'Secure Payment'}
        </div>
        <div className="space-y-1 py-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-700 truncate mr-2">
              {type === 'webinar' ? (data.webinarName || 'Webinar') : (data.course || 'Course')}
            </span>
            <span className="text-[10px] font-bold text-emerald-600">₹{data.amount || '0'}</span>
          </div>
          {type === 'course' && data.papers && data.papers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.papers.map(p => (
                <span key={p} className="text-[7px] font-bold bg-white border border-slate-200 text-slate-500 px-1 rounded">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 border-t border-slate-200 pt-2 flex items-center justify-center gap-1.5 text-indigo-600 font-bold text-[10px] bg-white rounded-lg py-1.5 shadow-sm border border-slate-100">
          <Link size={10} />
          {data.buttonText || 'Pay Now'}
        </div>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </NodeWrapper>
  );
};

const PaymentReminderNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Payment Reminder" icon={BellRing} colorClass="bg-orange-500" status={data.nodeStatus}>
    <div className="space-y-1">
      <div className="text-[10px] text-slate-500 flex items-center gap-1">
        <Clock size={10} />
        <span>Wait: {data.duration || '24'} {data.unit || 'hours'}</span>
      </div>
      <div className="text-[11px] font-bold text-slate-800">Branch on: Paid/Unpaid</div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="h-6 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-600 uppercase">PAID</div>
        <div className="h-6 rounded bg-red-50 border border-red-100 flex items-center justify-center text-[8px] font-bold text-red-600 uppercase">UNPAID</div>
      </div>
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} id="paid" style={{ left: '25%' }} />
    <Handle type="source" position={Position.Bottom} id="unpaid" style={{ left: '75%' }} />
  </NodeWrapper>
);

const UserRepliedNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="User Replied?" icon={UserCheck} colorClass="bg-blue-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-600 mb-2 font-medium italic">Wait for any reply...</div>
      <div className="text-[10px] text-slate-500 mb-1 flex items-center gap-1">
        <Clock size={10} />
        <span>Timeout: {data.timeoutMins || data.timeout || 60}m</span>
      </div>
      <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1 mt-2">
        <span className="text-green-600">REPLIED</span>
        <span className="text-red-500">TIMEOUT</span>
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} className="w-3 h-3 bg-green-500" />
      <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} className="w-3 h-3 bg-red-500" />
    </NodeWrapper>
  );
};


const CustomCodeNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Custom Code" icon={Code} colorClass="bg-gray-800" status={data.nodeStatus}>
      <div className="text-xs text-slate-600 mb-2 font-mono truncate max-w-[180px]">{data.code || '// Enter code...'}</div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const ActionNode = ({ data, selected }) => {
  const isAssign = data.actionType === 'assign_agent';
  const isTag = data.actionType === 'add_tag' || data.actionType === 'remove_tag';
  const isVar = data.actionType === 'set_variable';
  const isWorkflow = data.actionType === 'start_workflow';
  const isStatus = data.actionType === 'update_chat_status';
  const isLeadStage = data.actionType === 'update_lead_stage';

  return (
    <NodeWrapper
      selected={selected}
      title="Action"
      icon={isLeadStage ? ListChecks : isAssign ? UserCheck : isWorkflow ? WorkflowIcon : isTag ? Tag : Plus}
      colorClass="bg-indigo-600"
      status={data.nodeStatus}
    >
      <div className="text-xs text-slate-600 font-medium mb-1">
        {data.actionType === 'assign_agent'
          ? (getAssignMode(data) === 'xolox_dynamic' ? 'Assign from Xolox' : 'Assign Agent')
          : data.actionType === 'add_tag'
            ? 'Add Contact Tag'
            : data.actionType === 'remove_tag'
              ? 'Remove Contact Tag'
            : data.actionType === 'add_to_label'
              ? 'Add CRM Label'
              : data.actionType === 'set_variable'
                ? 'Update Attribute'
                : data.actionType === 'start_workflow'
                  ? 'Start Workflow'
                  : data.actionType === 'update_chat_status'
                    ? 'Update Chat Status'
                    : data.actionType === 'update_lead_stage'
                      ? 'Update Lead Stage'
                      : 'Action'}
      </div>
      <div className="text-xs text-slate-500 truncate max-w-[180px]">
        {isVar
          ? `${data.variableName || 'Key'} = ${data.variableValue || 'Val'}`
          : isWorkflow
            ? data.targetWorkflowName || 'Select workflow...'
            : isStatus
              ? data.actionValue || 'open'
              : isLeadStage
                ? data.leadStageName || 'Select stage...'
                : data.actionValue || 'Configure...'}
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const NotificationNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Internal Alert" icon={Bell} colorClass="bg-orange-500" status={data.nodeStatus}>
      <div className="text-xs text-slate-500 font-medium mb-1 truncate max-w-[180px]">
        {data.message || 'Configure internal alert...'}
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const EndNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="End" icon={StopCircle} colorClass="bg-slate-600" status={data.nodeStatus}>
      <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">End Workflow</div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const CampaignTriggerNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Campaign Sent" icon={Megaphone} colorClass="bg-purple-600" status={data.nodeStatus}>
    <div className="text-xs text-slate-600 mb-1">
      Campaign: <b>{data.campaignName || 'Select campaign...'}</b>
    </div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
  </NodeWrapper>
);

const CustomerMessageTriggerNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Customer Message" icon={MessageSquare} colorClass="bg-emerald-600" status={data.nodeStatus}>
    <div className="text-xs text-slate-600 mb-1">Stage-aware inbound WhatsApp trigger</div>
    <div className="text-[11px] bg-emerald-50 border border-emerald-100 rounded px-2 py-1 text-emerald-700">
      Uses this workflow's assigned Kanban stage
    </div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
  </NodeWrapper>
);

const CampaignConditionNode = ({ data, selected }) => {
  const d = data.checkDays || 0;
  const h = data.checkHours || 0;
  const m = data.checkMinutes || 0;
  const isSpecific = data.timingMode === 'specific';
  const timeLabel = isSpecific
    ? (data.specificTime ? `At: ${new Date(data.specificTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}` : 'Specific time not set')
    : (d || h || m) ? `After ${d ? d + 'd ' : ''}${h ? h + 'h ' : ''}${m ? m + 'm' : ''}`.trim() : 'Timing not set';
  const conditions = data.conditions || [
    { variable: 'WA message', operator: 'eq', value: 'delivered' }
  ];
  return (
    <NodeWrapper selected={selected} title="Campaign Condition" icon={Filter} colorClass="bg-violet-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-900 font-bold mb-1.5">{timeLabel}</div>
      <div className="space-y-1 mb-3">
        {conditions.map((cond, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="text-[11px] flex-1 bg-violet-50 border border-violet-100 rounded px-2 py-1 text-violet-800 font-medium">
              {cond.variable} {cond.operator === 'eq' ? '==' : '!='} <span className="text-violet-600 font-semibold">{cond.value}</span>
            </div>
          </div>
        ))}
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1">
        <span className="text-emerald-600">MATCH</span>
        <span className="text-rose-500">NO MATCH</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} className="w-3 h-3 bg-emerald-500" />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} className="w-3 h-3 bg-rose-500" />
    </NodeWrapper>
  );
};

const normalizeCampaignList = (response) => {
  const candidates = [
    response,
    response?.campaigns,
    response?.data,
    response?.items,
    response?.data?.campaigns,
    response?.data?.items,
  ];

  return candidates.find(Array.isArray) || [];
};

const IncomingWebhookNode = ({ data, selected }) => {
  const paramCount = data.paramMapping ? Object.keys(data.paramMapping).length : 0;
  return (
    <NodeWrapper selected={selected} title="Incoming Webhook" icon={Link} colorClass="bg-cyan-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-500 mb-1">Trigger: any HTTP POST</div>
      {paramCount > 0 && (
        <div className="text-[11px] bg-cyan-50 border border-cyan-100 rounded px-2 py-1 text-cyan-700">
          {paramCount} param{paramCount > 1 ? 's' : ''} mapped
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const NEW_CONTACT_FIELDS = [
  { key: 'contact_name', label: 'Name', defaultVar: 'name' },
  { key: 'contact_phone', label: 'Phone', defaultVar: 'phone' },
  { key: 'contact_email', label: 'Email', defaultVar: 'email' },
  { key: 'contact_course', label: 'Course', defaultVar: 'course' },
  { key: 'contact_tags', label: 'Tags', defaultVar: 'tags' },
  { key: 'contact_source', label: 'Source', defaultVar: 'source' },
  { key: 'contact_id', label: 'Contact ID', defaultVar: 'contact_id' },
];

const NewContactCreatedNode = ({ data, selected }) => {
  const mappedCount = data.fieldMapping
    ? Object.values(data.fieldMapping).filter(Boolean).length
    : NEW_CONTACT_FIELDS.length;
  return (
    <NodeWrapper selected={selected} title="New Contact Created" icon={UserCheck} colorClass="bg-emerald-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-500 mb-1">Trigger: contact is created</div>
      <div className="text-[11px] bg-emerald-50 border border-emerald-100 rounded px-2 py-1 text-emerald-700">
        {mappedCount} field{mappedCount !== 1 ? 's' : ''} mapped
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const XoloxEventNode = ({ data, selected }) => {
  const fieldCount = Array.isArray(data.payloadFields) ? data.payloadFields.length : 0;
  return (
    <NodeWrapper selected={selected} title={data.eventName || 'XOLOX Event'} icon={Globe} colorClass="bg-orange-600">
      <div className="text-[10px] text-slate-400 mb-1 truncate max-w-[180px]">{data.webhookUrl || 'Set webhook URL...'}</div>
      <div className="flex gap-1 mb-2 flex-wrap">
        {fieldCount > 0 && (
          <span className="text-[10px] bg-orange-50 border border-orange-200 text-orange-700 rounded px-1.5 py-0.5">{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
        )}
        <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-500 rounded px-1.5 py-0.5">{data.method || 'POST'}</span>
      </div>
      <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1 mb-0.5">
        <span className="text-green-600">SUCCESS</span>
        <span className="text-red-500">FAIL</span>
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} id="success" style={{ left: '30%' }} className="w-3 h-3 bg-green-500" />
      <Handle type="source" position={Position.Bottom} id="fail" style={{ left: '70%' }} className="w-3 h-3 bg-red-400" />
    </NodeWrapper>
  );
};

const XoloxLookupAgentNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Look Up Assigned Agent" icon={Search} colorClass="bg-indigo-600" status={data.nodeStatus}>
    <div className="text-xs text-slate-500 mb-1">Looks up the lead owner in Xolox</div>
    <div className="text-[11px] bg-indigo-50 border border-indigo-100 rounded px-2 py-1 text-indigo-700">
      Sets {'{{assigned_to}}'} for later steps
    </div>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
  </NodeWrapper>
);

// ─── Proper component so hooks are called at top level (fixes Rules of Hooks) ──
function WebhookNodeConfig({ node, workflowId, updateNodeFields }) {
  // Validate it's a real UUID (not a name slug)
  const isRealId = workflowId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workflowId);
  const webhookUrl = isRealId
    ? getWorkflowWebhookUrl(workflowId)
    : null;


  const [copied, setCopied] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [postingSample, setPostingSample] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [eventError, setEventError] = useState('');

  const copyUrl = () => {
    if (!workflowId) return;
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fetchLastEvent = async () => {
    if (!workflowId) return;
    setLoadingEvents(true);
    setEventError('');
    try {
      const res = await getWebhookEvents(workflowId);
      if (res.success && res.events.length > 0) {
        const ev = res.events[0];
        setLastEvent(ev);
        const payload = ev.payload || {};
        const existing = node.data.paramMapping || {};
        const merged = { ...existing };
        Object.keys(payload).forEach(k => { if (!(k in merged)) merged[k] = k; });
        updateNodeFields(node.id, { paramMapping: merged, lastPayload: payload });
      } else {
        setLastEvent(null);
        setEventError('No events received yet. Send a test POST to the webhook URL.');
      }
    } catch (e) {
      setEventError('Failed to fetch events: ' + e.message);
    } finally {
      setLoadingEvents(false);
    }
  };

  const buildSamplePayload = () => {
    const existingPayload = node.data.lastPayload || {};
    const mapping = node.data.paramMapping || {};
    const payload = { ...existingPayload };
    const fallbackValues = {
      phone: '9999999999',
      mobile: '9999999999',
      whatsapp: '9999999999',
      contact: '9999999999',
      name: 'Test Lead',
      email: 'testlead@example.com',
      course: 'ACCA',
      source: 'workflow_test',
      lead_source: 'workflow_test',
    };

    Object.keys(mapping).forEach((key) => {
      if (payload[key] === undefined || payload[key] === null || payload[key] === '') {
        payload[key] = fallbackValues[key] || `sample_${key}`;
      }
    });

    if (!payload.phone && !payload.mobile && !payload.whatsapp && !payload.contact) {
      payload.phone = fallbackValues.phone;
    }
    if (!payload.name) payload.name = fallbackValues.name;
    if (!payload.email) payload.email = fallbackValues.email;
    if (!payload.source) payload.source = fallbackValues.source;

    return payload;
  };

  const sendSampleEvent = async () => {
    if (!isRealId || !webhookUrl) return;
    setPostingSample(true);
    setEventError('');
    try {
      const payload = buildSamplePayload();
      await postWebhookSample(workflowId, payload);
      await new Promise((resolve) => setTimeout(resolve, 250));
      await fetchLastEvent();
    } catch (e) {
      setEventError('Sample POST failed: ' + (e.message || 'Unknown error'));
    } finally {
      setPostingSample(false);
    }
  };

  const clearEvents = async () => {
    if (!workflowId) return;
    await clearWebhookEvents(workflowId);
    setLastEvent(null);
    setEventError('');
  };

  const paramMapping = node.data.paramMapping || {};
  const payloadKeys = lastEvent
    ? Object.keys(lastEvent.payload || {})
    : Object.keys(node.data.lastPayload || {});

  return (
    <div className="space-y-5">
      {/* Webhook URL */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Webhook URL</label>
        {isRealId ? (
          <>
            <div className="bg-slate-900 rounded-lg px-3 py-2.5 flex items-center gap-2">
              <code className="text-cyan-300 text-[11px] flex-1 break-all leading-snug">{webhookUrl}</code>
              <button type="button" onClick={copyUrl}
                className="shrink-0 text-slate-400 hover:text-white transition-colors">
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">POST any JSON body to this URL. No auth needed.</p>
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3">
            <p className="text-xs text-amber-700 font-medium">⚠ Save the workflow first to generate the webhook URL.</p>
            <p className="text-[10px] text-amber-500 mt-1">The URL requires the workflow's database ID which is assigned on first save.</p>
          </div>
        )}
      </div>

      {/* Last Received Payload */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Last Received Payload</label>
          <div className="flex gap-1.5">
            <button type="button" onClick={fetchLastEvent} disabled={loadingEvents || !isRealId}
              className="flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-800 border border-cyan-200 rounded-md px-2 py-1 hover:bg-cyan-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {loadingEvents ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Fetch
            </button>
            <button type="button" onClick={sendSampleEvent} disabled={postingSample || loadingEvents || !isRealId}
              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 border border-purple-200 rounded-md px-2 py-1 hover:bg-purple-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {postingSample ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Send sample
            </button>
            <button type="button" onClick={clearEvents} disabled={!isRealId}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-md px-2 py-1 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Trash2 size={11} /> Clear
            </button>
          </div>
        </div>

        {eventError && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-md p-2">{eventError}</div>
        )}
        {lastEvent && (
          <div className="space-y-1.5">
            <div className="text-[10px] text-slate-400">
              Received: {new Date(lastEvent.received_at).toLocaleString('en-IN')}
              {lastEvent.source_ip && ` · from ${lastEvent.source_ip}`}
            </div>
            <pre className="bg-slate-900 text-green-300 text-[10px] rounded-lg p-3 overflow-auto max-h-[180px] leading-relaxed">
              {JSON.stringify(lastEvent.payload, null, 2)}
            </pre>
          </div>
        )}
        {!lastEvent && !eventError && (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
            <div className="text-slate-400 text-xs">No payload received yet</div>
            <div className="text-[10px] text-slate-300 mt-1">Click Fetch after sending a test POST</div>
          </div>
        )}
      </div>

      {/* Parameter Mapping */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Parameter Mapping</label>
        <p className="text-[10px] text-slate-400 mb-2">
          Map each incoming JSON key to a variable name for use in later steps as <code className="bg-slate-100 px-1 rounded">{"{{variable}}"}</code>
        </p>
        {payloadKeys.length > 0 ? (
          <div className="space-y-2">
            {payloadKeys.map(key => (
              <div key={key} className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-mono text-slate-600 truncate">{key}</div>
                <span className="text-slate-400 text-xs shrink-0">→</span>
                <input type="text"
                  className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-xs"
                  placeholder={key}
                  value={paramMapping[key] || ''}
                  onChange={e => {
                    const next = { ...paramMapping, [key]: e.target.value };
                    updateNodeFields(node.id, { paramMapping: next });
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 italic">Fetch a payload first — keys will appear here automatically.</div>
        )}
      </div>

      {/* Usage guide */}
      {Object.keys(paramMapping).length > 0 && (
        <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-3 space-y-1">
          <div className="text-xs font-semibold text-cyan-800 mb-1.5">How to use in later nodes</div>
          {Object.entries(paramMapping).filter(([, v]) => v).map(([key, varName]) => (
            <div key={key} className="flex items-center gap-2 text-[11px]">
              <code className="bg-white border border-cyan-200 rounded px-1.5 py-0.5 text-cyan-700 font-mono">{`{{${varName}}}`}</code>
              <span className="text-slate-400">← payload.{key}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TwilioSmsNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Send SMS (Twilio)" icon={MessageSquare} colorClass="bg-red-500" status={data.nodeStatus}>
    <div className="space-y-1.5">
      <div className="text-[10px] text-slate-600 flex items-center gap-1">
        <MessageSquare size={10} className="text-red-500" />
        <span className="font-semibold">To:</span>
        <span className="truncate font-mono">{data.toNumber || '{{contact.phone}}'}</span>
      </div>
      {data.message && (
        <div className="text-[10px] text-slate-500 line-clamp-2 italic">"{data.message}"</div>
      )}
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} id="sent" style={{ left: '30%' }} />
    <Handle type="source" position={Position.Bottom} id="failed" style={{ left: '70%' }} />
  </NodeWrapper>
);

const TwilioCallNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Voice Call (Twilio)" icon={Phone} colorClass="bg-red-600" status={data.nodeStatus}>
    <div className="space-y-1.5">
      <div className="text-[10px] text-slate-600 flex items-center gap-1">
        <Phone size={10} className="text-red-600" />
        <span className="font-semibold">To:</span>
        <span className="truncate font-mono">{data.toNumber || '{{contact.phone}}'}</span>
      </div>
      {data.record && (
        <span className="inline-block text-[8px] font-bold bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded">REC</span>
      )}
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} id="answered" style={{ left: '25%' }} />
    <Handle type="source" position={Position.Bottom} id="failed" style={{ left: '75%' }} />
  </NodeWrapper>
);

const ExotelCallNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Initiate Call" icon={Phone} colorClass="bg-orange-500" status={data.nodeStatus}>
    <div className="space-y-1.5">
      <div className="text-[10px] text-slate-600 flex items-center gap-1">
        <Phone size={10} className="text-orange-500" />
        <span className="font-semibold">To:</span>
        <span className="truncate font-mono">{data.toNumber || '{{contact.phone}}'}</span>
      </div>
      {data.callerId && (
        <div className="text-[10px] text-slate-500 flex items-center gap-1">
          <span className="font-semibold">From:</span>
          <span className="font-mono">{data.callerId}</span>
        </div>
      )}
      {data.record && (
        <span className="inline-block text-[8px] font-bold bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-0.5 rounded">REC</span>
      )}
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} id="answered" style={{ left: '25%' }} />
    <Handle type="source" position={Position.Bottom} id="failed" style={{ left: '75%' }} />
  </NodeWrapper>
);

const AgentCallDispatchNode = ({ data, selected }) => {
  const modeLabels = {
    assigned_agent: 'Assigned agent',
    round_robin: 'Available agent',
    specific_agent: 'Specific agent',
  };
  return (
    <NodeWrapper selected={selected} title="Agent Call Dispatch" icon={Phone} colorClass="bg-orange-500" status={data.nodeStatus}>
      <div className="space-y-1.5">
        <div className="text-[10px] text-slate-600 flex items-center gap-1">
          <Phone size={10} className="text-orange-500" />
          <span className="font-semibold">Customer:</span>
          <span className="truncate font-mono">{data.toNumber || '{{contact.phone}}'}</span>
        </div>
        <div className="text-[10px] text-slate-500">
          Agent: <span className="font-semibold text-orange-700">{modeLabels[data.agentMode] || modeLabels.assigned_agent}</span>
        </div>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} id="dispatched" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="failed" style={{ left: '70%' }} />
    </NodeWrapper>
  );
};

// Legacy workflows created in Cherio use these exact node types. Keep them as
// first-class renderers so importing or opening an older graph never turns
// meaningful steps into React Flow's anonymous fallback boxes.
const SetVariableNode = ({ data, selected }) => {
  const summary = data.sourcePath
    ? `${data.alwaysOverride ? 'Always set' : 'If empty, set'} ${data.sourcePath} -> ${data.fallbackValue || data.targetPath || ''}`
    : data.variableName
      ? `${data.variableName} = ${data.variableValue || ''}`
      : 'Configure variable';
  return (
    <NodeWrapper selected={selected} title="Set Variable" icon={GitBranch} colorClass="bg-teal-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-600 line-clamp-2">{summary}</div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const LeadStageUpdatedWebhookNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title={data.label || 'Lead Stage Updated (Webhook)'} icon={RefreshCw} colorClass="bg-fuchsia-600" status={data.nodeStatus}>
    <div className="text-xs text-slate-600">Trigger: a lead stage update is posted to this workflow URL.</div>
    <div className="mt-2 rounded-lg border border-fuchsia-100 bg-fuchsia-50 px-2 py-1 text-[11px] text-fuchsia-700">Lead data is enriched before the next step.</div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
  </NodeWrapper>
);

const StarforzeLeadUpdatedNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title={data.label || 'Starforze Lead Updated'} icon={RefreshCw} colorClass="bg-purple-600" status={data.nodeStatus}>
    <div className="text-xs text-slate-600">Trigger: Starforze sends a lead update to this workflow.</div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
  </NodeWrapper>
);

function LeadStageUpdatedWebhookConfig({ workflowId }) {
  const isRealId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(workflowId || ''));
  const webhookUrl = isRealId ? getWorkflowWebhookUrl(workflowId) : null;
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Workflow webhook URL</label>
        {webhookUrl ? (
          <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5">
            <code className="flex-1 break-all text-[11px] leading-snug text-fuchsia-300">{webhookUrl}</code>
            <button type="button" onClick={copyUrl} className="shrink-0 text-slate-300 hover:text-white" title="Copy webhook URL">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>
        ) : <p className="text-xs italic text-slate-400">Save this workflow first to generate its webhook URL.</p>}
      </div>
      <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50 p-3 text-xs leading-relaxed text-fuchsia-800">
        Configure this URL in XOLOX for lead-stage updates. Include a phone number in the payload; Greeto resolves the matching lead before running the next node.
      </div>
    </div>
  );
}

const ZoomFetchNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Zoom: Fetch webinars" icon={Video} colorClass="bg-blue-600" status={data.nodeStatus}>
    <div className="text-[10px] text-slate-500 mb-1">Fetches webinar list into variable:</div>
    <div className="text-[11px] bg-blue-50 border border-blue-100 rounded px-2 py-1 text-blue-700 font-mono italic">
      {"{{zoom_webinars}}"}
    </div>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
  </NodeWrapper>
);

const LoopNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Loop / For Each" icon={Repeat} colorClass="bg-indigo-500" status={data.nodeStatus}>
    <div className="text-[10px] text-slate-500 mb-1">Iterate: <b>{data.itemsVariable || 'Select array...'}</b></div>
    <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1 mt-2">
      <span className="text-indigo-600">EACH</span>
      <span className="text-slate-400">DONE</span>
    </div>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
    <Handle type="source" position={Position.Bottom} id="each" style={{ left: '30%' }} className="w-3 h-3 bg-indigo-500" />
    <Handle type="source" position={Position.Bottom} id="done" style={{ left: '70%' }} className="w-3 h-3 bg-slate-400" />
  </NodeWrapper>
);

const RelativeDelayNode = ({ data, selected }) => {
  const amount = data.offsetAmount || 0;
  const unit = data.offsetUnit || 'minutes';
  const direction = data.offsetDirection || 'before';
  return (
    <NodeWrapper selected={selected} title="Wait Relative To" icon={CalendarClock} colorClass="bg-amber-600" status={data.nodeStatus}>
      <div className="text-[10px] text-slate-500 mb-1">Trigger: <b>{amount} {unit} {direction}</b></div>
      <div className="text-[10px] text-slate-400 truncate italic mb-2">Base: {data.referenceVariable || '{{time}}'}</div>
      <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1 mt-1">
        <span className="text-amber-600">EXECUTE</span>
        <span className="text-red-400">SKIP (Past)</span>
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} id="execute" style={{ left: '30%' }} className="w-3 h-3 bg-amber-500" />
      <Handle type="source" position={Position.Bottom} id="skip" style={{ left: '70%' }} className="w-3 h-3 bg-red-400" />
    </NodeWrapper>
  );
};

const ZoomMatchNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Zoom Smart Match" icon={Search} colorClass="bg-indigo-600" status={data.nodeStatus}>
    <div className="text-[10px] text-slate-500 mb-1">Topic: <span className="text-indigo-700 font-bold">{data.topicVariable || 'Select...'}</span></div>
    <div className="text-[9px] text-slate-400 italic">Finding in: {data.itemsVariable || 'zoom_webinars'}</div>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500" />
  </NodeWrapper>
);

const ZoomRegisterNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Zoom Auto-Register" icon={UserPlus} colorClass="bg-rose-600" status={data.nodeStatus}>
    <div className="text-[10px] text-slate-500 mb-1">Webinar: <span className="text-rose-700 font-bold truncate block">{data.webinarIdVariable || '{{matched_webinar.id}}'}</span></div>
    <div className="text-[9px] text-slate-400">Target: {data.emailVariable || '{{email}}'}</div>
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-rose-500" />
  </NodeWrapper>
);

const nodeTypes = {
  trigger: TriggerNode,
  zoom_fetch: ZoomFetchNode,
  zoom_match: ZoomMatchNode,
  zoom_register: ZoomRegisterNode,
  loop: LoopNode,
  relative_delay: RelativeDelayNode,
  whatsapp: TemplateNode,
  send_template: TemplateNode,
  delay: DelayNode,
  condition: ConditionNode,
  attribute_condition: AttributeConditionNode,
  send_message: SendMessageNode,
  custom_code: CustomCodeNode,
  action: ActionNode,
  end: EndNode,
  list_message: ListMessageNode,
  response_message: ResponseMessageNode,
  feedback: FeedbackNode,
  payment_request: PaymentRequestNode,
  payment_reminder: PaymentReminderNode,
  razorpay_link: PaymentRequestNode,
  razorpay_status: PaymentReminderNode,
  campaign_trigger: CampaignTriggerNode,
  customer_message_trigger: CustomerMessageTriggerNode,
  campaign_condition: CampaignConditionNode,
  user_replied: UserRepliedNode,
  wait_for_reply: UserRepliedNode,
  wait_for_stage: WaitForStageNode,
  incoming_webhook: IncomingWebhookNode,
  set_variable: SetVariableNode,
  starforze_lead_updated: StarforzeLeadUpdatedNode,
  lead_stage_updated_webhook: LeadStageUpdatedWebhookNode,
  new_contact: NewContactCreatedNode,
  xolox_event: XoloxEventNode,
  xolox_lookup_agent: XoloxLookupAgentNode,
  notification: NotificationNode,
  exotel_call: ExotelCallNode,
  agent_call_dispatch: AgentCallDispatchNode,
  twilio_sms: TwilioSmsNode,
  twilio_call: TwilioCallNode,
};

function InlineMetaTemplateModal({ isOpen, onClose, onSubmitted }) {
  const [phones, setPhones] = useState([]);
  const [loadingPhones, setLoadingPhones] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('MARKETING');
  const [language, setLanguage] = useState('en_US');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [headerType, setHeaderType] = useState('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerFile, setHeaderFile] = useState(null);
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoadingPhones(true);
    getWhatsAppSettings()
      .then((result) => {
        if (!active) return;
        const activePhones = (Array.isArray(result?.allSettings) ? result.allSettings : [])
          .filter((phone) => phone?.is_active !== false && phone?.phone_number_id);
        setPhones(activePhones);
        setPhoneNumberId((current) => current || activePhones.find((phone) => phone.is_primary)?.phone_number_id || activePhones[0]?.phone_number_id || '');
      })
      .catch(() => active && setPhones([]))
      .finally(() => active && setLoadingPhones(false));
    return () => { active = false; };
  }, [isOpen]);

  const close = () => {
    if (submitting) return;
    setError('');
    setSuccess('');
    onClose();
  };

  const templateVariables = (text) => [...String(text || '').matchAll(/\{\{(\d+)\}\}/g)];

  const submit = async () => {
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!cleanName) return setError('Enter a template name using letters, numbers, or underscores.');
    if (!bodyText.trim()) return setError('Enter the template body text.');
    if (!phoneNumberId) return setError('Connect and select an active WhatsApp number first.');
    if (headerType !== 'NONE' && headerType !== 'TEXT' && !headerFile) {
      return setError(`Upload an example ${headerType.toLowerCase()} file for the Meta header.`);
    }

    const components = [];
    setSubmitting(true);
    setError('');
    try {
      if (headerType !== 'NONE') {
        const header = { type: 'HEADER', format: headerType };
        if (headerType === 'TEXT') {
          if (!headerText.trim()) throw new Error('Enter header text or choose no header.');
          header.text = headerText.trim();
          if (templateVariables(headerText).length) header.example = { header_text: ['Example header'] };
        } else {
          const upload = await uploadTemplateExampleMedia(headerFile, phoneNumberId);
          const handle = upload?.data?.id || upload?.id || upload?.handle || upload?.h;
          if (!handle) throw new Error('Meta did not return a media handle for the header example.');
          header.example = { header_handle: [handle] };
        }
        components.push(header);
      }

      const body = { type: 'BODY', text: bodyText.trim() };
      const bodyVariables = templateVariables(bodyText);
      if (bodyVariables.length) body.example = { body_text: [bodyVariables.map((_, index) => `Example ${index + 1}`)] };
      components.push(body);
      if (footerText.trim()) components.push({ type: 'FOOTER', text: footerText.trim() });

      const result = await createTemplate({ name: cleanName, category, language, components, phoneNumberId });
      if (result?.success === false || result?.error) {
        const detail = result?.meta?.error?.message || result?.message || result?.error;
        throw new Error(typeof detail === 'string' ? detail : 'Meta rejected the template submission.');
      }

      setSuccess(`"${cleanName}" was submitted to Meta. It will appear in this workflow selector only after Meta approves it.`);
      onSubmitted?.({ name: cleanName, phoneNumberId, status: 'PENDING' });
    } catch (submissionError) {
      setError(submissionError?.message || 'Unable to submit this template to Meta.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create WhatsApp template">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div><h2 className="text-lg font-bold text-slate-900">Create WhatsApp template</h2><p className="mt-1 text-xs text-slate-500">Submit a draft to the selected workspace Meta account.</p></div>
          <button type="button" onClick={close} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={18} /></button>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-5">
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">{success}</div>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Template name<input value={name} onChange={(event) => setName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="course_welcome" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500" /></label>
            <label className="text-xs font-semibold text-slate-600">WhatsApp sender<select value={phoneNumberId} onChange={(event) => setPhoneNumberId(event.target.value)} disabled={loadingPhones || !phones.length} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500"><option value="">{loadingPhones ? 'Loading numbers...' : 'Select connected number'}</option>{phones.map((phone) => <option key={phone.phone_number_id} value={phone.phone_number_id}>{phone.display_phone_number || phone.phone_number_id}{phone.is_primary ? ' (Primary)' : ''}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500"><option value="MARKETING">Marketing</option><option value="UTILITY">Utility</option><option value="AUTHENTICATION">Authentication</option></select></label>
            <label className="text-xs font-semibold text-slate-600">Language<input value={language} onChange={(event) => setLanguage(event.target.value)} placeholder="en_US" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500" /></label>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold text-slate-800">Header</span><select value={headerType} onChange={(event) => { setHeaderType(event.target.value); setHeaderFile(null); }} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"><option value="NONE">None</option><option value="TEXT">Text</option><option value="IMAGE">Image</option><option value="VIDEO">Video</option><option value="DOCUMENT">Document</option></select></div>
            {headerType === 'TEXT' && <input value={headerText} onChange={(event) => setHeaderText(event.target.value)} placeholder="Welcome {{1}}" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-violet-500" />}
            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && <label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-violet-300 bg-violet-50 px-3 py-3 text-xs font-medium text-violet-800"><span>{headerFile ? headerFile.name : `Upload ${headerType.toLowerCase()} example for Meta`}</span><Upload size={15} /><input type="file" className="sr-only" accept={headerType === 'IMAGE' ? 'image/*' : headerType === 'VIDEO' ? 'video/*' : 'application/pdf,.doc,.docx,.xlsx,.pptx'} onChange={(event) => setHeaderFile(event.target.files?.[0] || null)} /></label>}
          </div>
          <label className="block text-xs font-semibold text-slate-600">Body text<textarea rows={5} value={bodyText} onChange={(event) => setBodyText(event.target.value)} placeholder="Hi {{1}}, thank you for your interest in {{2}}." className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500" /></label>
          <p className="-mt-2 text-[11px] text-slate-500">Use positional variables such as {'{{1}}'} and {'{{2}}'}; Meta examples are added automatically for review.</p>
          <label className="block text-xs font-semibold text-slate-600">Footer <span className="font-normal text-slate-400">(optional)</span><input value={footerText} onChange={(event) => setFooterText(event.target.value)} placeholder="Reply STOP to opt out" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-500" /></label>
          <div className="rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">Meta controls approval. This creates a pending template in the selected WhatsApp Business Account; the workflow remains safe because only approved templates can be selected and published.</div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4"><Button type="button" variant="outline" onClick={close} disabled={submitting}>Cancel</Button><Button type="button" onClick={submit} disabled={submitting || Boolean(success)} className="bg-violet-700 text-white hover:bg-violet-800">{submitting ? 'Submitting to Meta...' : success ? 'Submitted to Meta' : 'Submit template'}</Button></div>
      </div>
    </div>
  );
}

const COURSE_PAPERS = {
  'CPA US': [
    { id: 'FAR', name: 'Financial Accounting and Reporting (FAR)' },
    { id: 'REG', name: 'Regulation (REG)' },
    { id: 'BEC', name: 'Business Environment and Concepts (BEC)' },
    { id: 'AUD', name: 'Auditing and Attestation (AUD)' },
    { id: 'ISC', name: 'Information Systems and Controls (ISC)' },
    { id: 'TCP', name: 'Tax Compliance and Planning (TCP)' },
  ],
  'CMA US': [
    { id: 'Part 1', name: 'Part 1: Financial Planning, Performance, and Analytics' },
    { id: 'Part 2', name: 'Part 2: Strategic Financial Management' },
  ],
  'ACCA': [
    {
      level: 'Applied Knowledge', papers: [
        { id: 'BT', name: 'Business and Technology (BT)' },
        { id: 'MA', name: 'Management Accounting (MA)' },
        { id: 'FA', name: 'Financial Accounting (FA)' },
      ]
    },
    {
      level: 'Applied Skills', papers: [
        { id: 'LW', name: 'Corporate and Business Law (LW)' },
        { id: 'PM', name: 'Performance Management (PM)' },
        { id: 'TX', name: 'Taxation (TX)' },
        { id: 'FR', name: 'Financial Reporting (FR)' },
        { id: 'AA', name: 'Audit and Assurance (AA)' },
        { id: 'FM', name: 'Financial Management (FM)' },
      ]
    },
    {
      level: 'Strategic Professional', papers: [
        { id: 'SBL', name: 'Strategic Business Leader (SBL)' },
        { id: 'SBR', name: 'Strategic Business Reporting (SBR)' },
        { id: 'AFM', name: 'Advanced Financial Management (AFM)' },
        { id: 'APM', name: 'Advanced Performance Management (APM)' },
        { id: 'ATX', name: 'Advanced Taxation (ATX)' },
        { id: 'AAA', name: 'Advanced Audit and Assurance (AAA)' },
      ]
    }
  ],
  'EA': [
    { id: 'Part 1', name: 'Part 1: Individuals' },
    { id: 'Part 2', name: 'Part 2: Businesses' },
    { id: 'Part 3', name: 'Part 3: Representation, Practices, and Procedures' },
  ],
};

// --- Helper Functions ---

let nodeIdCounter = 0;
const getId = () => {
  nodeIdCounter += 1;
  return `node_${Date.now()}_${nodeIdCounter}`;
};

const extractTemplatePlaceholders = (bodyText) => {
  if (!bodyText) return [];
  const vars = [];
  const regex = /{{([a-zA-Z0-9_]+)}}/g;
  let match;
  while ((match = regex.exec(bodyText)) !== null) {
    if (!vars.includes(match[1])) vars.push(match[1]);
  }
  return vars;
};

// The Templates page can contain Meta-approved and workspace-local templates.
// Keep this decision in one place so a template accepted while loading is not
// accidentally hidden again by the workflow picker.
const isWorkflowSelectableTemplate = (template) => {
  if (!template) return false;
  if (template.isLocal || template.is_local) return true;
  const status = String(template.status || '').trim().toUpperCase();
  return status === 'APPROVED' || status === 'LOCAL' || status === 'APPROVED_LOCAL';
};

const buildTemplateComponentsPayload = (tmpl, variables, header) => {
  if (!tmpl || !tmpl.bodyText) return [];
  const keys = extractTemplatePlaceholders(tmpl.bodyText);
  const components = [];

  // Header media/text (if template has header format and header provided)
  const headerType = header?.headerType || 'none';
  const headerUrl = header?.headerUrl || '';
  const headerFileName = header?.headerFileName || '';
  const hf = (tmpl && tmpl.headerFormat) ? String(tmpl.headerFormat).toUpperCase() : null; // IMAGE | VIDEO | DOCUMENT | TEXT | null

  if (hf && hf !== 'NONE') {
    if (hf === 'IMAGE' && headerType === 'image' && headerUrl) {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: headerUrl } }],
      });
    } else if (hf === 'VIDEO' && headerType === 'video' && headerUrl) {
      components.push({
        type: 'header',
        parameters: [{ type: 'video', video: { link: headerUrl } }],
      });
    } else if (hf === 'DOCUMENT' && headerType === 'document' && headerUrl) {
      const doc = { link: headerUrl };
      if (headerFileName) doc.filename = headerFileName;
      components.push({
        type: 'header',
        parameters: [{ type: 'document', document: doc }],
      });
    } else if (hf === 'TEXT') {
      // If header text exists (and includes variables), derive from variables map using 'header_' prefix
      const headerKeys = extractTemplatePlaceholders(tmpl.headerText || '');
      if (headerKeys.length > 0) {
        components.push({
          type: 'header',
          parameters: headerKeys.map((k) => ({
            type: 'text',
            text: (variables && (variables[`header_${k}`] || variables[k])) || '',
            ...(tmpl.parameterFormat === 'NAMED' ? { parameter_name: k } : {}),
          })),
        });
      }
    }
  }

  // Body parameters
  if (keys.length > 0) {
    const bodyParams = keys.map((k) => {
      const value = (variables && variables[k]) || '';
      const param = {
        type: 'text',
        text: value,
      };
      if (tmpl.parameterFormat === 'NAMED') {
        param.parameter_name = k;
      }
      return param;
    });
    components.push({
      type: 'body',
      parameters: bodyParams,
    });
  }

  return components;
};

/**
 * Centrally manages the collection of all {{variables}} available to a given node
 * by walking backward through the workflow graph (BFS).
 */
const getUpstreamVariables = (targetNodeId, nodes, edges, externalVars = []) => {
  const vars = [...externalVars];
  const visited = new Set();
  const queue = [targetNodeId];

  while (queue.length > 0) {
    const nid = queue.shift();
    if (visited.has(nid)) continue;
    visited.add(nid);

    // Find all edges pointing to this node
    const incomingEdges = edges.filter(e => e.target === nid);
    for (const edge of incomingEdges) {
      const srcNode = nodes.find(n => n.id === edge.source);
      if (!srcNode) continue;

      if (srcNode.type === 'new_contact') {
        const fm = srcNode.data.fieldMapping || {};
        Object.values(fm).forEach(v => {
          if (v && !vars.includes(`{{${v}}}`)) vars.push(`{{${v}}}`);
        });
        // Core defaults
        ['name', 'phone', 'email', 'course', 'tags', 'source', 'contact_id'].forEach(def => {
          if (!vars.includes(`{{${def}}}`)) vars.push(`{{${def}}}`);
        });
      } else if (srcNode.type === 'incoming_webhook') {
        const pm = srcNode.data.paramMapping || {};
        Object.values(pm).forEach(v => {
          if (v && !vars.includes(`{{${v}}}`)) vars.push(`{{${v}}}`);
        });
      } else if (srcNode.type === 'response_message') {
        // Collect the variable name the user defined to save their choice
        const saveVar = srcNode.data.saveVariable;
        if (saveVar && !vars.includes(`{{${saveVar}}}`)) {
          vars.push(`{{${saveVar}}}`);
        }
      } else if (srcNode.type === 'feedback') {
        const saveVar = srcNode.data.saveVariable;
        if (saveVar && !vars.includes(`{{${saveVar}}}`)) {
          vars.push(`{{${saveVar}}}`);
        }
      } else if (srcNode.type === 'action' && srcNode.data && srcNode.data.actionType === 'set_variable') {
        const varName = srcNode.data.variableName;
        if (varName && !vars.includes(`{{${varName}}}`)) {
          vars.push(`{{${varName}}}`);
        }
      } else if (srcNode.type === 'action' && srcNode.data && srcNode.data.actionType === 'send_sms_otp') {
        const saveVar = srcNode.data.saveVariable;
        if (saveVar && !vars.includes(`{{${saveVar}}}`)) {
          vars.push(`{{${saveVar}}}`);
        }
      } else if (srcNode.type === 'xolox_event') {
        if (!vars.includes('{{xolox_response.assignedTo}}')) vars.push('{{xolox_response.assignedTo}}');
        if (!vars.includes('{{xolox_success}}')) vars.push('{{xolox_success}}');
      } else if (srcNode.type === 'zoom_fetch') {
        if (!vars.includes('{{zoom_webinars}}')) vars.push('{{zoom_webinars}}');
      } else if (srcNode.type === 'zoom_match') {
        ['matched_webinar', 'matched_webinar.topic', 'matched_webinar.start_time', 'matched_webinar.date', 'matched_webinar.time', 'matched_webinar.id'].forEach(v => {
           if (!vars.includes(`{{${v}}}`)) vars.push(`{{${v}}}`);
        });
      } else if (srcNode.type === 'zoom_register') {
        ['zoom_registration', 'zoom_registration.join_url', 'zoom_registration.registrant_id'].forEach(v => {
           if (!vars.includes(`{{${v}}}`)) vars.push(`{{${v}}}`);
        });
      } else if (srcNode.type === 'loop') {
        ['loopItem', 'loopItem.topic', 'loopItem.start_time', 'loopItem.date', 'loopItem.time', 'loopItem.join_url', 'loopItem.id'].forEach(v => {
           if (!vars.includes(`{{${v}}}`)) vars.push(`{{${v}}}`);
        });
      }

      // Continue walking backward
      queue.push(edge.source);
    }
  }

  // Fallback defaults if the graph is empty or disconnected
  if (vars.length === 0) {
    ['{{name}}', '{{phone}}', '{{email}}', '{{tags}}', '{{source}}', '{{contact_id}}'].forEach(v => vars.push(v));
  }

  return vars;
};

const getAllDefinedVariables = (nodes) => {
  const vars = [];
  (nodes || []).forEach((n) => {
    if (!n || !n.data) return;
    if (n.type === 'new_contact') {
      const fm = n.data.fieldMapping || {};
      Object.values(fm).forEach((v) => {
        if (v && !vars.includes(`{{${v}}}`)) vars.push(`{{${v}}}`);
      });
      ['name', 'phone', 'email', 'tags', 'source', 'contact_id'].forEach((def) => {
        if (!vars.includes(`{{${def}}}`)) vars.push(`{{${def}}}`);
      });
    } else if (n.type === 'incoming_webhook') {
      const pm = n.data.paramMapping || {};
      Object.values(pm).forEach((v) => {
        if (v && !vars.includes(`{{${v}}}`)) vars.push(`{{${v}}}`);
      });
    } else if (n.type === 'response_message' || n.type === 'feedback') {
      const saveVar = n.data.saveVariable;
      if (saveVar && !vars.includes(`{{${saveVar}}}`)) vars.push(`{{${saveVar}}}`);
    } else if (n.type === 'action' && n.data.actionType === 'set_variable') {
      const varName = n.data.variableName;
      if (varName && !vars.includes(`{{${varName}}}`)) vars.push(`{{${varName}}}`);
    } else if (n.type === 'action' && n.data.actionType === 'send_sms_otp') {
      const saveVar = n.data.saveVariable;
      if (saveVar && !vars.includes(`{{${saveVar}}}`)) vars.push(`{{${saveVar}}}`);
    }
  });
  if (vars.length === 0) {
    ['{{name}}', '{{phone}}', '{{email}}', '{{tags}}', '{{source}}', '{{contact_id}}'].forEach((v) => vars.push(v));
  }
  return vars;
};

// --- Custom Edge Component ---
const PlusEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  source,
  target,
  sourceHandleId,
  targetHandleId,
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (evt, id) => {
    evt.stopPropagation();
    // Dispatch custom event to open the inline menu in WorkflowBuilder
    window.dispatchEvent(
      new CustomEvent('open-inline-menu', {
        detail: {
          edgeId: id,
          source,
          target,
          sourceHandleId,
          targetHandleId,
          clientX: evt.clientX,
          clientY: evt.clientY,
        },
      })
    );
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: 2, stroke: '#94a3b8' }} className="hover:stroke-blue-500 transition-colors duration-300" />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-6 h-6 bg-white border border-slate-300 rounded-full flex items-center justify-center shadow-sm text-slate-500 hover:text-blue-600 hover:border-blue-500 hover:shadow-md transition-all z-50 cursor-pointer"
            onClick={(event) => onEdgeClick(event, id)}
            title="Add Node"
          >
            <Plus size={14} strokeWidth={3} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

function WaitForStageNode({ data, selected }) {
  return (
    <NodeWrapper selected={selected} title="Wait for Stage" icon={ListChecks} colorClass="bg-indigo-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-600 mb-1">Pause until lead reaches</div>
      <div className="text-[11px] bg-indigo-50 border border-indigo-100 rounded px-2 py-1 text-indigo-700">
        {data.targetStageName || 'Select a lead stage'}
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500" />
    </NodeWrapper>
  );
}

const edgeTypes = {
  plus: PlusEdge,
};

// --- Main Component ---

export default function WorkflowBuilder({ onBack, onSave, initialWorkflow, linkedPhones = [] }) {
  const reactFlowWrapper = useRef(null);
  
  // draft_nodes takes priority over published nodes, but ONLY if it has actual content.
  // An empty draft_nodes ([] with no items) means no draft was ever saved – fall back to published.
  const pickNodes = (draft, published) => {
    if (Array.isArray(draft) && draft.length > 0) return draft;
    if (draft && typeof draft === 'object' && !Array.isArray(draft)) return draft; // non-empty object
    return published || [];
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(
    pickNodes(initialWorkflow?.draft_nodes, initialWorkflow?.nodes || initialWorkflow?.steps?.nodes)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    pickNodes(initialWorkflow?.draft_edges, initialWorkflow?.edges || initialWorkflow?.steps?.edges)
  );
  const validationIssuesByNodeId = useMemo(
    () => collectNodeValidationIssues(nodes, edges),
    [nodes, edges]
  );
  const canvasNodes = useMemo(
    () => nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        nodeStatus: {
          // Canvas-only validation metadata must never become the persisted
          // runtime status when layout/history reuses a rendered node.
          runtime: getRuntimeStatus(node.data?.nodeStatus),
          validationIssues: validationIssuesByNodeId[node.id] || [],
        },
      },
    })),
    [nodes, validationIssuesByNodeId]
  );
  const cellRefs = useRef([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [isInlineTemplateModalOpen, setIsInlineTemplateModalOpen] = useState(false);
  const [inlineTemplateNotice, setInlineTemplateNotice] = useState('');
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [loadingEmailTemplates, setLoadingEmailTemplates] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [availableCampaigns, setAvailableCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignLoadError, setCampaignLoadError] = useState('');
  const [availableLabels, setAvailableLabels] = useState([]);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [pipelineStages, setPipelineStages] = useState([]);
  const [loadingPipelineStages, setLoadingPipelineStages] = useState(false);
  const [availableCallAgents, setAvailableCallAgents] = useState([]);
  const [viewMode, setViewMode] = useState('canvas');
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [branchTarget, setBranchTarget] = useState(null);
  const [workflowStage, setWorkflowStage] = useState(initialWorkflow?.stageName || null);
  const [socket, setSocket] = useState(null);

  // --- History & Auto-Layout ---
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);

  const takeSnapshot = useCallback((snapshotNodes = nodes, snapshotEdges = edges) => {
    setPast((p) => {
      const newPast = [...p, { nodes: sanitizeWorkflowNodes(snapshotNodes), edges: snapshotEdges }];
      return newPast.slice(-50);
    });
    setFuture([]);
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const current = { nodes, edges };
    const previous = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [current, ...f]);
    setNodes(sanitizeWorkflowNodes(previous.nodes));
    setEdges(previous.edges);
  }, [past, nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const current = { nodes, edges };
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, current]);
    setNodes(sanitizeWorkflowNodes(next.nodes));
    setEdges(next.edges);
  }, [future, nodes, edges, setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const onLayout = useCallback(() => {
    const nodeWidth = 320;
    const nodeHeight = 150;
    const verticalGap = 72;
    const currentNodes = sanitizeWorkflowNodes(nodes);
    const currentEdges = edges.filter((edge) =>
      currentNodes.some((node) => node.id === edge.source) &&
      currentNodes.some((node) => node.id === edge.target)
    );

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 96, ranksep: 112 });

    currentNodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    currentEdges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // Dagre places disconnected components side-by-side in a wide horizontal row.
    // To ensure a vertical, readable flow ("sidha lamba format"), we isolate 
    // components and layout each independently, stacking them vertically.
    const components = dagre.graphlib.alg.components(dagreGraph);

    // Sort components by their average original Y position so layout order remains stable
    components.sort((compA, compB) => {
      const avgYA = compA.reduce((sum, id) => sum + (currentNodes.find(n => n.id === id)?.position?.y || 0), 0) / compA.length;
      const avgYB = compB.reduce((sum, id) => sum + (currentNodes.find(n => n.id === id)?.position?.y || 0), 0) / compB.length;
      return avgYA - avgYB;
    });

    const layoutedNodes = [];
    let currentYOffset = 0;

    components.forEach((compIds) => {
      const compGraph = new dagre.graphlib.Graph();
      compGraph.setDefaultEdgeLabel(() => ({}));
      compGraph.setGraph({ rankdir: 'TB', nodesep: 96, ranksep: 112 });

      compIds.forEach((id) => compGraph.setNode(id, { width: nodeWidth, height: nodeHeight }));
      
      currentEdges.forEach((edge) => {
        if (compIds.includes(edge.source) && compIds.includes(edge.target)) {
          compGraph.setEdge(edge.source, edge.target);
        }
      });

      dagre.layout(compGraph);

      let maxCompHeight = 0;
      compIds.forEach((id) => {
        const node = currentNodes.find((n) => n.id === id);
        const nodeWithPosition = compGraph.node(id);
        const finalX = nodeWithPosition.x - nodeWidth / 2;
        const finalY = Math.max(0, nodeWithPosition.y - nodeHeight / 2);

        layoutedNodes.push({
          ...node,
          position: {
            x: finalX,
            y: currentYOffset + finalY,
          },
        });

        const nodeBottom = finalY + nodeHeight;
        if (nodeBottom > maxCompHeight) {
          maxCompHeight = nodeBottom;
        }
      });

      currentYOffset += maxCompHeight + verticalGap;
    });

    takeSnapshot();
    setNodes(layoutedNodes);
    requestAnimationFrame(() => {
      reactFlowInstance?.fitView({ padding: 0.25, duration: 250 });
    });
  }, [nodes, edges, reactFlowInstance, setNodes, takeSnapshot]);

  const customOnNodesChange = useCallback((changes) => {
    const isSignificant = changes.some(c => c.type === 'remove');
    if (isSignificant) takeSnapshot();
    onNodesChange(changes);
  }, [onNodesChange, takeSnapshot]);

  const customOnEdgesChange = useCallback((changes) => {
    const isSignificant = changes.some(c => c.type === 'remove');
    if (isSignificant) takeSnapshot();
    onEdgesChange(changes);
  }, [onEdgesChange, takeSnapshot]);

  const onNodeDragStart = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);


  // --- Inline Node Addition State ---
  const [inlineMenuOpen, setInlineMenuOpen] = useState(false);
  const [inlineMenuPosition, setInlineMenuPosition] = useState({ x: 0, y: 0 });
  const [inlineEdgeData, setInlineEdgeData] = useState(null);

  useEffect(() => {
    const handleOpenInlineMenu = (e) => {
      const { edgeId, source, target, sourceHandleId, targetHandleId, clientX, clientY } = e.detail;
      setInlineEdgeData({ edgeId, source, target, sourceHandleId, targetHandleId });
      setInlineMenuPosition({ x: clientX, y: clientY });
      setInlineMenuOpen(true);
    };

    window.addEventListener('open-inline-menu', handleOpenInlineMenu);
    return () => window.removeEventListener('open-inline-menu', handleOpenInlineMenu);
  }, []);

  useEffect(() => {
    const closeInlineMenu = (e) => {
      if (e.target.closest('.inline-node-menu')) return;
      setInlineMenuOpen(false);
    };
    if (inlineMenuOpen) {
      window.addEventListener('click', closeInlineMenu);
    }
    return () => window.removeEventListener('click', closeInlineMenu);
  }, [inlineMenuOpen]);

  // Test/Run State
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [runPhoneNumber, setRunPhoneNumber] = useState('');
  const [isWebhookTestModalOpen, setIsWebhookTestModalOpen] = useState(false);
  const [webhookTestFields, setWebhookTestFields] = useState([{ key: 'phone', value: '' }]);
  const [isWebhookSending, setIsWebhookSending] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceContext, setVoiceContext] = useState(null);
  const [voiceGraph, setVoiceGraph] = useState(null);
  const [voicePreview, setVoicePreview] = useState([]);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  // Tracks which XOLOX payload variable input is focused (for chip-click-to-insert)
  const [focusedVarIdx, setFocusedVarIdx] = useState(null);
  // Template media gallery state
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [galleryTarget, setGalleryTarget] = useState(null); // 'header' | null
  const [templateFocusedVarKey, setTemplateFocusedVarKey] = useState(null);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [isCSVGuideOpen, setIsCSVGuideOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [csvBuilderRows, setCsvBuilderRows] = useState([
    { step_id: 'START_0', category: 'trigger', type: 'trigger', content: 'hello, hi', next_step_id: '' }
  ]);
  const [pabblyJSON, setPabblyJSON] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [precedingVariables, setPrecedingVariables] = useState([]);
  const [isTestingZoom, setIsTestingZoom] = useState(false);
  const [zoomTestResult, setZoomTestResult] = useState(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [nodeSearch, setNodeSearch] = useState('');
  const [nodeCategory, setNodeCategory] = useState('All');

  useEffect(() => {
    const library = document.querySelector('.greeto-node-library');
    if (!library) return;
    
    let currentCategory = 'Triggers';
    
    Array.from(library.children).forEach(child => {
      // If it's a category header
      const header = child.querySelector('h2');
      if (header) {
        currentCategory = header.innerText.trim();
        if (nodeCategory !== 'All' && currentCategory.toLowerCase() !== nodeCategory.toLowerCase()) {
          child.style.display = 'none';
        } else {
          child.style.display = 'block';
        }
        return;
      }
      
      // Filter by category
      if (nodeCategory !== 'All' && currentCategory.toLowerCase() !== nodeCategory.toLowerCase()) {
         child.style.display = 'none';
         return;
      }
      
      // Filter by search text
      const text = child.innerText.toLowerCase();
      if (nodeSearch && !text.includes(nodeSearch.toLowerCase())) {
        child.style.display = 'none';
      } else {
        child.style.display = 'flex'; // Restore Tailwind flex display
      }
    });
  }, [nodeSearch, nodeCategory, viewMode]);

  const reloadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    setCampaignLoadError('');

    try {
      const response = await getCampaigns();
      if (response?.success === false) {
        throw new Error(response.message || response.error || 'Unable to load campaigns');
      }
      setAvailableCampaigns(normalizeCampaignList(response));
    } catch (error) {
      setAvailableCampaigns([]);
      setCampaignLoadError(error?.message || 'Unable to load campaigns');
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  useEffect(() => {
    const loadResources = async () => {
      setLoadingTemplates(true);
      setLoadingEmailTemplates(true);
      setLoadingWorkflows(true);
      setLoadingCampaigns(true);
      setLoadingLabels(true);

      try {
        const [tplRes, etplRes, wfRes, campRes, lbRes, stgRes, memberRes] = await Promise.all([
          getTemplates().catch(() => ({ data: [] })),
          getEmailTemplates().catch(() => []),
          getWorkflows().catch(() => []),
          getCampaigns().catch(() => []),
          getLabels().catch(() => []),
          getLeadStages().catch(() => []),
          getWorkspaceMembers({ status: 'active', limit: 200 }).catch(() => [])
        ]);

        if (tplRes) {
          const rawList = Array.isArray(tplRes) ? tplRes : (tplRes.data || tplRes.templates || []);
          // Workflow sends only approved Meta templates or explicitly local ones.
          const filtered = rawList.filter(isWorkflowSelectableTemplate);
          // Map raw Meta components into flat fields (bodyText, headerFormat, parameterFormat, etc.)
          const mapped = filtered.map(t => {
            // If already mapped (has bodyText), skip
            if (t.bodyText !== undefined) return t;
            const comps = Array.isArray(t.components) ? t.components : [];
            const bodyComp = comps.find(c => c.type === 'BODY');
            const headerComp = comps.find(c => c.type === 'HEADER');
            const footerComp = comps.find(c => c.type === 'FOOTER');
            const buttonsComp = comps.find(c => c.type === 'BUTTONS');

            let examples = {};
            if (bodyComp && bodyComp.example) {
              if (t.parameter_format === 'NAMED' && bodyComp.example.body_text_named_params) {
                bodyComp.example.body_text_named_params.forEach(p => examples[p.param_name] = p.example);
              } else if (bodyComp.example.body_text && Array.isArray(bodyComp.example.body_text[0])) {
                bodyComp.example.body_text[0].forEach((ex, i) => examples[(i + 1).toString()] = ex);
              }
            }

            let headerHandle = '';
            if (headerComp && headerComp.example && Array.isArray(headerComp.example.header_handle) && headerComp.example.header_handle.length > 0) {
              headerHandle = headerComp.example.header_handle[0];
            }

            return {
              ...t,
              bodyText: bodyComp ? bodyComp.text : '',
              headerType: headerComp ? headerComp.format : 'NONE',
              headerFormat: headerComp ? headerComp.format : 'NONE',
              headerText: headerComp && headerComp.format === 'TEXT' ? headerComp.text : '',
              headerHandle,
              footerText: footerComp ? footerComp.text : '',
              buttons: buttonsComp ? buttonsComp.buttons : [],
              parameterFormat: t.parameter_format || 'POSITIONAL',
              examples,
            };
          });
          setTemplates(mapped);
        }

        const emailTplList = normalizeEmailTemplateList(etplRes);
        setEmailTemplates(emailTplList);
        
        const wfList = Array.isArray(wfRes) ? wfRes : (wfRes.data || wfRes.workflows || []);
        setAvailableWorkflows(wfList);

        if (campRes?.success === false) {
          setCampaignLoadError(campRes.message || campRes.error || 'Unable to load campaigns');
          setAvailableCampaigns([]);
        } else {
          setCampaignLoadError('');
          setAvailableCampaigns(normalizeCampaignList(campRes));
        }
        
        const lbList = Array.isArray(lbRes) ? lbRes : (lbRes.data || lbRes.labels || []);
        setAvailableLabels(lbList);
        setPipelineStages(Array.isArray(stgRes) ? stgRes : (stgRes?.data || stgRes?.stages || []));
        setAvailableCallAgents(Array.isArray(memberRes) ? memberRes : (memberRes?.data || memberRes?.members || []));
        // Process stages if needed
      } catch (err) {
        console.error('Error loading workflow resources:', err);
      } finally {
        setLoadingTemplates(false);
        setLoadingEmailTemplates(false);
        setLoadingWorkflows(false);
        setLoadingCampaigns(false);
        setLoadingLabels(false);
        
        // Fetch preceding workflow variables for the current lead-stage workflow.
        if (initialWorkflow && initialWorkflow.id) {
          getWorkflowStageContext(initialWorkflow.id).then(res => {
            if (res && Array.isArray(res.preceding)) {
              const vars = [];
              res.preceding.forEach(pw => {
                const nodes = pw.nodes || pw.steps?.nodes || [];
                const prefix = pw.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
                
                // Get all variables from this preceding workflow
                const pwVars = getAllDefinedVariables(nodes);
                pwVars.forEach(v => {
                  const cleaned = v.replace('{{', '').replace('}}', '');
                  if (!vars.includes(`{{${prefix}.${cleaned}}}`)) {
                    vars.push(`{{${prefix}.${cleaned}}}`);
                  }
                });
              });
              setPrecedingVariables(vars);
            }
            if (res && res.stageName) {
              setWorkflowStage(res.stageName);
            }
          }).catch(console.error);
        }
      }
    };
    loadResources();
  }, [refreshKey]);

  useEffect(() => {
    if (selectedNode?.type === 'campaign_trigger') {
      reloadCampaigns();
    }
  }, [selectedNode?.type, reloadCampaigns]);

  const CATEGORY_MAP = {
    trigger: [
      { value: 'trigger', label: 'WhatsApp Keyword', icon: MessageSquare, placeholder: 'e.g. hello, hi, help' },
      { value: 'campaign_trigger', label: 'Campaign Sent', icon: Megaphone, placeholder: 'Triggered when campaign starts' },
      { value: 'incoming_webhook', label: 'Incoming Webhook', icon: Globe, placeholder: 'Generates a POST URL' },
      { value: 'zoom_fetch', label: 'Zoom Fetch', icon: Video, placeholder: 'Fetch upcoming webinars' },
      { value: 'zoom_match', label: 'Zoom Smart Match', icon: Search, placeholder: 'Find best future webinar' },
      { value: 'zoom_register', label: 'Zoom Auto-Register', icon: UserPlus, placeholder: 'Register user to Zoom' },
      { value: 'new_contact', label: 'Person Added', icon: UserCheck, placeholder: 'Triggered for new leads' },
      { value: 'start_workflow', label: 'Manual/API Start', icon: Zap, placeholder: 'Triggered via API call' },
    ],
    action: [
      { value: 'send_template', label: 'Send WA Template', icon: MessageSquare, placeholder: 'Template name' },
      { value: 'send_message', label: 'Send WA Message', icon: MessageCircle, placeholder: 'Your message text' },
      { value: 'send_email', label: 'Send Email', icon: Mail, placeholder: 'Email template name' },
      { value: 'send_sms_otp', label: 'Send SMS OTP', icon: Phone, placeholder: 'SMS text with %s' },
      { value: 'razorpay_link', label: 'Generate Payment', icon: CreditCard, placeholder: 'Amount in INR' },
      { value: 'update_lead_stage', label: 'Move CRM Stage', icon: Tag, placeholder: 'New stage name' },
      { value: 'assign_agent', label: 'Assign Agent', icon: UserCheck, placeholder: 'Agent email or ID' },
      { value: 'add_to_label', label: 'Add CRM Label', icon: Tag, placeholder: 'Label ID' },
      { value: 'feedback', label: 'Collect Review', icon: Star, placeholder: 'Survey question' },
      { value: 'xolox_event', label: 'Custom Xolox Event', icon: Zap, placeholder: 'Event key' },
      { value: 'zoom_fetch', label: 'Zoom Webinar Fetch', icon: Video, placeholder: 'Fetch Zoom webinars' },
    ],
    system: [
      { value: 'delay', label: 'Wait / Delay', icon: Clock, placeholder: 'e.g. 15 minutes or 1 day' },
      { value: 'condition', label: 'Logic Split', icon: GitBranch, placeholder: 'Condition (Simple branch)' },
      { value: 'loop', label: 'Loop Logic', icon: Repeat, placeholder: 'Iterate over array' },
      { value: 'relative_delay', label: 'Relative Delay', icon: CalendarClock, placeholder: 'Delay relative to date' },
      { value: 'end', label: 'Terminate Flow', icon: StopCircle, placeholder: 'Cleanup actions' },
    ]
  };
  const recognitionRef = useRef(null);
  const hasIncomingWebhookTrigger = nodes.some((n) => n && n.type === 'incoming_webhook');

  React.useEffect(() => {
    let styleEl = document.getElementById('workflow-builder-reactflow-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'workflow-builder-reactflow-style';
      styleEl.textContent = `
        .react-flow__handle {
          width: 14px;
          height: 14px;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.25);
        }
        .react-flow__handle-source { background: #3b82f6; }
        .react-flow__handle-target { background: #64748b; }
        .react-flow__handle-connecting { background: #22c55e; }
        .react-flow__handle-valid { background: #22c55e; }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);
  
  const syncGraphFromList = useCallback(() => {
    setNodes((nds) => {
      const sorted = [...nds].sort((a, b) => {
         const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
         const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
         return ay - by;
      });
      return sorted.map((node, index) => {
        const x = node.position && typeof node.position.x === 'number' ? node.position.x : 0;
        return {
          ...node,
          position: {
            x,
            y: index * 140,
          },
        };
      });
    });
  }, [setNodes]);

  React.useEffect(() => {
    const s = connectSocket({ userId: null, teamIds: [] });
    setSocket(s);
    const wfId = initialWorkflow?.id;

    const onStart = (ev) => {
      if (ev.workflowId !== wfId) return;
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, nodeStatus: undefined, nodeError: undefined } })));
      setIsRunning(true);
    };

    const onStepStart = (ev) => {
      if (ev.workflowId !== wfId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === ev.nodeId
            ? { ...n, data: { ...n.data, nodeStatus: 'running', nodeError: undefined } }
            : n
        )
      );
    };

    const onStepComplete = (ev) => {
      if (ev.workflowId !== wfId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === ev.nodeId
            ? { ...n, data: { ...n.data, nodeStatus: 'completed', nodeError: undefined } }
            : n
        )
      );
    };

    const onStepError = (ev) => {
      if (ev.workflowId !== wfId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === ev.nodeId
            ? { ...n, data: { ...n.data, nodeStatus: 'error', nodeError: ev.message || 'Step failed' } }
            : n
        )
      );
    };

    const onComplete = (ev) => {
      if (ev.workflowId === wfId) setIsRunning(false);
    };

    s.on('workflow:run:start', onStart);
    s.on('workflow:step:start', onStepStart);
    s.on('workflow:step:complete', onStepComplete);
    s.on('workflow:step:error', onStepError);
    s.on('workflow:run:complete', onComplete);
    return () => {
      s.off('workflow:run:start', onStart);
      s.off('workflow:step:start', onStepStart);
      s.off('workflow:step:complete', onStepComplete);
      s.off('workflow:step:error', onStepError);
      s.off('workflow:run:complete', onComplete);
      s.disconnect();
    };
  }, [initialWorkflow, setNodes]);

  const handleInlineNodeAdd = useCallback(
    (nodeType, actionType = null) => {
      if (!inlineEdgeData || !reactFlowInstance) return;
      takeSnapshot();

      const { edgeId, source, target, sourceHandleId, targetHandleId } = inlineEdgeData;
      
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      
      let x = 0;
      let y = 0;
      
      if (sourceNode && targetNode) {
        x = (sourceNode.position.x + targetNode.position.x) / 2;
        y = (sourceNode.position.y + targetNode.position.y) / 2;
      } else if (sourceNode) {
        x = sourceNode.position.x;
        y = sourceNode.position.y + 150;
      }

      const newNodeId = getId();
      const newNode = {
        id: newNodeId,
        type: nodeType,
        position: { x, y },
        data: {
          label: `New ${nodeType.replace('_', ' ')}`,
          ...(actionType ? { actionType } : {}),
        },
      };

      setNodes((nds) => {
        const updatedNodes = nds.map((node) => {
          if (node.id === target || node.position.y >= y) {
            return { ...node, position: { x: node.position.x, y: node.position.y + 150 } };
          }
          return node;
        });
        return [...updatedNodes, newNode];
      });

      setEdges((eds) => {
        const filteredEdges = eds.filter((e) => e.id !== edgeId);
        const newEdges = [
          {
            id: `e${source}-${newNodeId}`,
            source,
            target: newNodeId,
            sourceHandle: sourceHandleId,
            type: 'plus',
            animated: true,
          },
          {
            id: `e${newNodeId}-${target}`,
            source: newNodeId,
            target,
            targetHandle: targetHandleId,
            type: 'plus',
            animated: true,
          }
        ];
        return [...filteredEdges, ...newEdges];
      });
      
      setInlineMenuOpen(false);
      setSelectedNode(newNode);
    },
    [inlineEdgeData, reactFlowInstance, nodes, setNodes, setEdges]
  );

  const onConnect = useCallback(
    (params) => {
      takeSnapshot();
      setEdges((eds) => addEdge({ ...params, animated: true, type: 'plus' }, eds));
    },
    [setEdges, takeSnapshot]
  );

  const isValidConnection = useCallback((connection) => {
    // Prevent self-connection
    if (connection.source === connection.target) return false;

    // Prevent cycles (DAG enforcement)
    const hasCycle = (sourceId, targetId, visited = new Set()) => {
      if (visited.has(sourceId)) return false;
      visited.add(sourceId);
      if (sourceId === targetId) return true;
      const outgoingEdges = edges.filter((e) => e.source === sourceId);
      return outgoingEdges.some((edge) => hasCycle(edge.target, targetId, visited));
    };

    if (hasCycle(connection.target, connection.source)) {
      // Adding this would create a cycle
      return false; 
    }

    return true;
  }, [edges]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const actionType = event.dataTransfer.getData('application/actiontype');

      if (!type || !reactFlowInstance) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      let data = { label: `${type} node`, triggerType: 'incoming_whatsapp' };
      if (type === 'action' && actionType) {
        data.actionType = actionType;
      }
      
      if (type === 'trigger') {
        data.label = 'WhatsApp Incoming';
        data.triggerType = 'incoming_whatsapp';
      }

      if (type === 'customer_message_trigger') {
        data = {
          label: 'Customer Message (Stage)',
          triggerType: 'customer_message',
        };
      }

      if (type === 'set_variable') {
        data = { label: 'Set Variable', sourcePath: '', targetPath: '', fallbackValue: '', alwaysOverride: false };
      }

      if (type === 'lead_stage_updated_webhook') {
        data = { label: 'Lead Stage Updated (Webhook)', triggerType: 'lead_stage_updated_webhook' };
      }

      if (type === 'delay') {
        data = { label: 'Time Delay', delayMode: 'relative', days: 0, hours: 0, minutes: 1, targetAt: null };
      }

      if (type === 'list_message') {
        data = { label: 'List Menu', header: '', body: '', footer: '', buttonText: 'View Options', items: [] };
      }

      if (type === 'user_replied') {
        data = { label: 'User Replied?', timeoutMins: 60 };
      }

      if (type === 'wait_for_stage') {
        data = { label: 'Wait for Stage', targetStageId: '', targetStageName: '' };
      }

      if (type === 'agent_call_dispatch') {
        data = { label: 'Agent Call Dispatch', toNumber: '{{contact.phone}}', agentMode: 'assigned_agent', agentId: '', callerId: '', record: false };
      }
      
      if (type === 'send_template') {
          data = { label: 'Send Template', template: '', languageCode: 'en_US', variables: {}, components: [], buttons: [], headerType: 'none', headerUrl: '', headerFileName: '' };
      }
      
      if (type === 'response_message') {
          data = { label: 'Response Message', message: '', buttons: [], skipReply: false, saveVariable: '', headerType: 'none', headerUrl: '', headerFileName: '' };
      }

      if (type === 'xolox_lookup_agent') {
          data = { label: 'Look Up Assigned Agent' };
      }

      const newNode = {
        id: getId(),
        type,
        position,
        data,
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNode(newNode);
    },
    [reactFlowInstance, setNodes]
  );

  const downloadCSV = (rows, filename) => {
    if (!rows || rows.length === 0) {
      alert("No data to download.");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => headers.map(h => {
        let val = row[h] === undefined ? '' : row[h];
        if (typeof val === 'object') val = JSON.stringify(val);
        // Escape quotes
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    return lines.slice(1).filter(l => l.trim()).map(line => {
      // Simple regex for CSV parsing that handles quotes
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const row = {};
      headers.forEach((h, i) => {
        let val = values[i] || '';
        val = val.replace(/^"|"$/g, '').replace(/""/g, '"');
        row[h] = val;
      });
      return row;
    });
  };

  const handleDownloadFull = () => {
    const rows = [];

    // Add Nodes
    nodes.forEach(n => {
      rows.push({
        entry_type: 'node',
        id: n.id,
        type: n.type,
        label: n.data?.label || '',
        x: n.position?.x || 0,
        y: n.position?.y || 0,
        source: '',
        target: '',
        sourceHandle: '',
        targetHandle: '',
        data: JSON.stringify(n.data || {})
      });
    });

    // Add Edges
    edges.forEach(e => {
      rows.push({
        entry_type: 'edge',
        id: e.id,
        type: '',
        label: '',
        x: '',
        y: '',
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || '',
        targetHandle: e.targetHandle || '',
        data: ''
      });
    });

    if (rows.length === 0) {
      alert("Workflow is empty. Add some nodes first.");
      return;
    }

    downloadCSV(rows, 'workflow_full.csv');
  };

  const handleDownloadSample = () => {
    const sampleRows = [
      { step_id: 'trigger_1', type: 'trigger', content: 'hello, hi, start', next_step_id: 'msg_1' },
      { step_id: 'msg_1', type: 'send_template', content: 'welcome_template', next_step_id: 'delay_1' },
      { step_id: 'delay_1', type: 'delay', content: '1 day', next_step_id: 'msg_2' },
      { step_id: 'msg_2', type: 'send_message', content: 'How are you finding the course?', next_step_id: '' }
    ];
    downloadCSV(sampleRows, 'workflow_sample.csv');
  };

  const handleDownloadSimplified = () => {
    const rows = nodes.map((n, index) => {
      let content = '';
      if (n.type === 'trigger') content = n.data?.keywords || '';
      else if (n.type === 'send_template') content = n.data?.template || '';
      else if (n.type === 'send_message') content = n.data?.message || '';
      else if (n.type === 'delay') content = `${n.data?.duration || 1} ${n.data?.unit || 'minutes'}`;

      const edge = edges.find(e => e.source === n.id);
      return {
        step_id: n.id,
        type: n.type,
        content,
        next_step_id: edge ? edge.target : ''
      };
    });
    if (rows.length === 0) {
      alert("Workflow is empty.");
      return;
    }
    downloadCSV(rows, 'workflow_execution.csv');
  };

  const handleUploadSimplified = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rows = parseCSV(event.target.result);
        const nextNodes = [];
        const nextEdges = [];

        let currentY = 0;

        rows.forEach((row, index) => {
          const id = row.step_id || `step_${index}`;
          const type = (row.type || 'send_message').toLowerCase();
          const content = row.content || '';

          let nodeData = { label: id };
          let nodeType = type;

          if (type === 'trigger') {
            nodeType = 'trigger';
            nodeData = { ...nodeData, keywords: content, label: 'WhatsApp Incoming' };
          } else if (type === 'send_template') {
            nodeType = 'send_template';
            nodeData = { ...nodeData, template: content, label: 'Send Template' };
          } else if (type === 'send_message' || type === 'message') {
            nodeType = 'send_message';
            nodeData = { ...nodeData, message: content, label: 'Response Message' };
          } else if (type === 'delay') {
            nodeType = 'delay';
            const parts = content.split(' ');
            const duration = parseInt(parts[0], 10) || 1;
            const unit = (parts[1] || 'minutes').toLowerCase();
            nodeData = { ...nodeData, duration, unit, label: 'Time Delay' };
          }

          nextNodes.push({
            id,
            type: nodeType,
            position: { x: 250, y: currentY },
            data: nodeData
          });

          if (row.next_step_id) {
            nextEdges.push({
              id: `e_${id}_${row.next_step_id}`,
              source: id,
              target: row.next_step_id
            });
          }

          currentY += 160;
        });

        if (nextNodes.length === 0) {
          alert("No steps found in the CSV.");
          return;
        }

        setNodes(nextNodes);
        setEdges(nextEdges);
        alert(`Auto-built workflow with ${nextNodes.length} steps!`);
        setIsCSVModalOpen(false);
      } catch (err) {
        console.error(err);
        alert('Failed to auto-build workflow. Ensure column names are correct: step_id, type, content, next_step_id');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddBuilderRow = () => {
    const newId = `STEP_${csvBuilderRows.length}`;
    setCsvBuilderRows([...csvBuilderRows, {
      step_id: newId,
      category: 'action',
      type: 'send_message',
      content: '',
      next_step_id: ''
    }]);
  };

  const handleUpdateBuilderRow = (index, field, value) => {
    const nextArr = [...csvBuilderRows];
    nextArr[index][field] = value;
    
    // Auto-update type if category changes
    if (field === 'category') {
      const types = CATEGORY_MAP[value] || [];
      if (types.length > 0) {
        nextArr[index].type = types[0].value;
      }
    }
    setCsvBuilderRows(nextArr);
  };

  const handleDeleteBuilderRow = (index) => {
    setCsvBuilderRows(csvBuilderRows.filter((_, i) => i !== index));
  };

  const downloadBuilderCSV = () => {
    if (csvBuilderRows.length === 0) {
      alert("Add some rows first.");
      return;
    }
    downloadCSV(csvBuilderRows, 'my_custom_workflow.csv');
  };

  const handleTableKeyDown = (e, rowIndex, colIndex) => {
    const totalRows = csvBuilderRows.length;
    const totalCols = 5; // step_id, category, type, content, next_step_id

    const focusCell = (r, c) => {
      if (r >= 0 && r < totalRows && c >= 0 && c < totalCols) {
        const el = cellRefs.current[r * totalCols + c];
        if (el) el.focus();
      }
    };

    if (e.key === 'ArrowDown' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      if (rowIndex < totalRows - 1) {
        focusCell(rowIndex + 1, colIndex);
      } else if (e.key === 'Enter') {
        handleAddBuilderRow();
        setTimeout(() => focusCell(rowIndex + 1, colIndex), 50);
      }
    } else if (e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey)) {
      e.preventDefault();
      focusCell(rowIndex - 1, colIndex);
    } else if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) {
      if (e.key === 'Tab') {
        if (colIndex < totalCols - 1) {
          // Normal tab within row
        } else if (rowIndex < totalRows - 1) {
          e.preventDefault();
          focusCell(rowIndex + 1, 0);
        } else {
          e.preventDefault();
          handleAddBuilderRow();
          setTimeout(() => focusCell(rowIndex + 1, 0), 50);
        }
      }
    } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) {
      if (e.key === 'Tab' && e.shiftKey) {
        if (colIndex > 0) {
          // Normal shift+tab
        } else if (rowIndex > 0) {
          e.preventDefault();
          focusCell(rowIndex - 1, totalCols - 1);
        }
      }
    }
  };

  const handleMigratePabbly = () => {
    if (!pabblyJSON.trim()) {
      alert("Please paste the Pabbly JSON first.");
      return;
    }
    try {
      const data = JSON.parse(pabblyJSON);
      const pabblySteps = data.steps || data.workflow?.steps || [];
      if (!pabblySteps.length) {
        alert("No steps found in the Pabbly JSON. Ensure you've pasted the full workflow export.");
        return;
      }

      const nextNodes = [];
      const nextEdges = [];
      let currentY = 0;

      pabblySteps.forEach((step, index) => {
        const id = `pabbly_${step.id || index}`;
        let type = 'send_message';
        let nodeData = { label: step.name || step.label || 'Pabbly Step' };

        // Simple Mapping Logic
        const stepType = (step.type || '').toLowerCase();
        const appName = (step.app_name || step.app || '').toLowerCase();

        if (stepType === 'trigger') {
          type = 'trigger';
          nodeData.label = 'Pabbly Trigger';
          nodeData.keywords = 'START'; // Default
        } else if (appName.includes('whatsapp') || appName.includes('meta')) {
          if (step.action_name?.toLowerCase().includes('template')) {
            type = 'send_template';
            nodeData.template = step.fields?.template_name || '';
          } else {
            type = 'send_message';
            nodeData.message = step.fields?.message || '';
          }
        } else if (appName.includes('delay') || step.action_name?.toLowerCase().includes('delay')) {
          type = 'delay';
          nodeData.duration = parseInt(step.fields?.delay_value || '1', 10);
          nodeData.unit = (step.fields?.delay_unit || 'minutes').toLowerCase();
        } else if (appName.includes('email')) {
          type = 'action';
          nodeData.actionType = 'send_email';
        }

        nextNodes.push({
          id,
          type,
          position: { x: 250, y: currentY },
          data: nodeData
        });

        if (index > 0) {
          nextEdges.push({
            id: `e_${nextNodes[index - 1].id}_${id}`,
            source: nextNodes[index - 1].id,
            target: id
          });
        }

        currentY += 160;
      });

      setNodes(nextNodes);
      setEdges(nextEdges);
      alert(`Migrated ${nextNodes.length} steps from Pabbly successfully!`);
      setIsCSVModalOpen(false);
      setPabblyJSON('');
    } catch (err) {
      console.error(err);
      alert("Invalid JSON format. Please paste a valid Pabbly Connect workflow export.");
    }
  };

  const handleUploadFull = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rows = parseCSV(event.target.result);
        const nextNodes = [];
        const nextEdges = [];

        rows.forEach(row => {
          if (row.entry_type === 'node') {
            nextNodes.push({
              id: row.id || getId(),
              type: row.type || 'send_message',
              position: { x: parseFloat(row.x || 0), y: parseFloat(row.y || 0) },
              data: row.data ? JSON.parse(row.data) : { label: row.label }
            });
          } else if (row.entry_type === 'edge') {
            nextEdges.push({
              id: row.id || `e_${row.source}_${row.target}`,
              source: row.source,
              target: row.target,
              sourceHandle: row.sourceHandle || undefined,
              targetHandle: row.targetHandle || undefined
            });
          }
        });

        if (nextNodes.length === 0) {
          alert("No nodes found in the CSV. Please check the 'entry_type' column.");
          return;
        }

        setNodes(nextNodes);
        setEdges(nextEdges);
        alert(`Successfully imported ${nextNodes.length} nodes and ${nextEdges.length} edges.`);
      } catch (err) {
        console.error(err);
        alert('Failed to parse Full Workflow CSV. Ensure JSON in the "data" column is valid.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  const handleListItemDragStart = (event, nodeId) => {
    setDraggingNodeId(nodeId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleListItemDragOver = (event) => {
    event.preventDefault();
  };

  const handleListItemDrop = (event, targetNodeId) => {
    event.preventDefault();
    if (!draggingNodeId || draggingNodeId === targetNodeId) return;
    setNodes((nds) => {
      const ordered = [...nds].sort((a, b) => {
        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
        return ay - by;
      });
      const fromIndex = ordered.findIndex((n) => n.id === draggingNodeId);
      const toIndex = ordered.findIndex((n) => n.id === targetNodeId);
      if (fromIndex === -1 || toIndex === -1) return nds;
      const updated = [...ordered];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      const reordered = updated.map((node, index) => {
        const x = node.position && typeof node.position.x === 'number' ? node.position.x : 0;
        return {
          ...node,
          position: {
            x,
            y: index * 120,
          },
        };
      });
      return reordered;
    });
    syncGraphFromList();
    setDraggingNodeId(null);
  };

  const handleListItemDragEnd = () => {
    setDraggingNodeId(null);
  };

  const handleAddNodeFromPalette = useCallback(
    (type, actionType) => {
      let createdNode = null;
      setNodes((nds) => {
        const yValues = nds.map((n) =>
          n.position && typeof n.position.y === 'number' ? n.position.y : 0
        );
        const maxY = yValues.length > 0 ? Math.max(...yValues) : 0;
        let position = {
          x: 0,
          y: yValues.length > 0 ? maxY + 120 : 0,
        };

        let data = { label: `${type} node` };

        if (type === 'action' && actionType) {
          data.actionType = actionType;
          if (actionType === 'update_chat_status') {
            data.actionValue = 'open';
          }
          if (actionType === 'add_to_label') {
            data.actionValue = '';
          }
          if (actionType === 'update_lead_stage') {
            data.actionValue = '';
            data.leadStageName = '';
          }
          if (actionType === 'send_email') {
            data.actionValue = '';
            data.emailTemplateId = '';
            data.variableMapping = {};
            data.toVarKey = 'email';
          }
          if (actionType === 'send_sms_otp') {
            data.actionValue = '';
            data.otpDigits = 6;
            data.saveVariable = 'otp';
          }
          if (actionType === 'assign_agent' || actionType === 'assign_agent_xolox') {
            data.actionType = 'assign_agent';
            data.assignMode = actionType === 'assign_agent_xolox' ? 'xolox_dynamic' : 'direct';
            data.actionValue = actionType === 'assign_agent_xolox' ? '{{xolox_response.assignedTo}}' : '';
          }
        }
        if (type === 'delay') {
          data = {
            label: 'Time Delay',
            delayMode: 'relative',
            days: 0,
            hours: 0,
            minutes: 0,
            targetAt: null,
          };
        }

        if (type === 'customer_message_trigger') {
          data = {
            label: 'Customer Message (Stage)',
            triggerType: 'customer_message',
          };
        }

        if (type === 'set_variable') {
          data = {
            label: 'Set Variable',
            sourcePath: '',
            targetPath: '',
            fallbackValue: '',
            alwaysOverride: false,
          };
        }

        if (type === 'lead_stage_updated_webhook') {
          data = {
            label: 'Lead Stage Updated (Webhook)',
            triggerType: 'lead_stage_updated_webhook',
          };
        }

        if (type === 'list_message') {
          data = {
            label: 'List Menu',
            header: '',
            body: '',
            footer: '',
            buttonText: 'Select Option',
            items: [],
          };
        }

        if (type === 'condition') {
          data = {
            label: 'Condition',
            conditionType: 'variable_match',
            groupOperator: 'AND',
            rules: [],
          };
        }

        if (type === 'user_replied') {
          data = {
            label: 'User Replied?',
            timeoutMins: 60,
          };
        }

        if (type === 'wait_for_stage') {
          data = {
            label: 'Wait for Stage',
            targetStageId: '',
            targetStageName: '',
          };
        }

        if (
          viewMode === 'list' &&
          branchTarget &&
          (type === 'send_template' || type === 'send_message')
        ) {
          const condNode = nds.find((n) => n.id === branchTarget.conditionId);
          if (condNode && condNode.position) {
            position = {
              x: condNode.position.x,
              y: condNode.position.y + 140,
            };
          }
          data = {
            ...data,
            branchConditionId: branchTarget.conditionId,
            branchSide: branchTarget.side,
          };
        }

        createdNode = {
          id: getId(),
          type,
          position,
          data,
        };
        const newNodes = [...nds, createdNode];
        return newNodes;
      });
      if (createdNode) {
        setSelectedNode(createdNode);
      }
      if (viewMode === 'list') {
        syncGraphFromList();
      }
    },
    [setNodes, syncGraphFromList, viewMode, branchTarget]
  );

  // Drop BOTH campaign_trigger + campaign_condition pre-wired
  const handleAddCampaignTrigger = useCallback(() => {
    const triggerId = getId();
    const conditionId = getId();
    const triggerNode = {
      id: triggerId,
      type: 'campaign_trigger',
      position: { x: 0, y: 0 },
      data: { label: 'Campaign Sent', triggerType: 'campaign_sent', campaignId: '', campaignName: '' },
    };
    const conditionNode = {
      id: conditionId,
      type: 'campaign_condition',
      position: { x: 0, y: 160 },
      data: {
        label: 'Campaign Condition',
        timingMode: 'after',  // 'after' | 'specific'
        checkDays: 0,
        checkHours: 24,
        checkMinutes: 0,
        specificTime: '',
        conditions: [
          { variable: 'WA message', operator: 'eq', value: 'delivered' },
        ],
      },
    };
    const edge = {
      id: `e_${triggerId}_${conditionId}`,
      source: triggerId,
      target: conditionId,
    };
    setNodes(nds => [...nds, triggerNode, conditionNode]);
    setEdges(eds => [...eds, edge]);
    setSelectedNode(triggerNode);
  }, [setNodes, setEdges]);

  // Drop a single incoming_webhook trigger node
  const handleAddWebhookTrigger = useCallback(() => {
    const nodeId = getId();
    const webhookNode = {
      id: nodeId,
      type: 'incoming_webhook',
      position: { x: 0, y: 0 },
      data: {
        label: 'Incoming Webhook',
        triggerType: 'incoming_webhook',
        paramMapping: {},   // { payloadKey: 'variableName' }
        lastPayload: null,
      },
    };
    setNodes(nds => [...nds, webhookNode]);
    setSelectedNode(webhookNode);
  }, [setNodes]);

  // Drop a new_contact trigger node with default field mapping pre-filled
  const handleAddNewContactTrigger = useCallback(() => {
    const nodeId = getId();
    const defaultMapping = {};
    NEW_CONTACT_FIELDS.forEach(f => { defaultMapping[f.key] = f.defaultVar; });
    const newContactNode = {
      id: nodeId,
      type: 'new_contact',
      position: { x: 0, y: 0 },
      data: {
        label: 'New Contact Created',
        triggerType: 'new_contact_created',
        fieldMapping: defaultMapping,
      },
    };
    setNodes(nds => [...nds, newContactNode]);
    setSelectedNode(newContactNode);
  }, [setNodes]);

  // Add a XOLOX Event node — action with YES/NO output branches
  const handleAddXoloxEvent = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'xolox_event',
      position: { x: 0, y: 160 },
      data: {
        label: 'XOLOX Event',
        eventName: 'Lead Create',
        webhookUrl: '',
        method: 'POST',
        // Array of { field: string, variable: string } — field = key XOLOX expects, variable = {{var}} to inject
        payloadFields: [
          { field: 'name', variable: '{{name}}' },
          { field: 'phone', variable: '{{phone}}' },
          { field: 'email', variable: '{{email}}' },
          { field: 'source', variable: '{{source}}' },
        ],
        // How to judge success: 'status_2xx' | 'field_true'
        successCondition: 'status_2xx',
        successField: '',      // e.g. 'success' when condition is field_true
        successValue: 'true',  // value to compare against
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddXoloxLookupAgent = useCallback(() => {
    const node = {
      id: getId(),
      type: 'xolox_lookup_agent',
      position: { x: 0, y: 160 },
      data: { label: 'Look Up Assigned Agent' },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  // Create a clean send_template action node (with header/variable slots)
  const handleAddSendTemplateAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'send_template',
      position: { x: 0, y: 200 },
      data: {
        label: 'Send Template',
        template: '',
        languageCode: 'en_US',
        variables: {},
        components: [],
        buttons: [],
        headerType: 'none',  // 'none' | 'image' | 'video' | 'document'
        headerUrl: '',
        headerFileName: '',
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddResponseMessageAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'response_message',
      position: { x: 0, y: 200 },
      data: {
        label: 'Response Message',
        message: '',
        buttons: [],
        skipReply: false,
        saveVariable: '',
        headerType: 'none',
        headerUrl: '',
        headerFileName: '',
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddListMenuAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'list_message',
      position: { x: 0, y: 300 },
      data: {
        label: 'List Menu',
        header: '',
        body: '',
        footer: '',
        buttonText: 'Select Option',
        items: [],
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddFeedbackAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'feedback',
      position: { x: 0, y: 200 },
      data: {
        label: 'Feedback Collection',
        question: 'Your feedback matters! Please rate this chat on scale of 1-5',
        buttonStyle: 'numbers', // 'numbers', 'emojis', 'stars'
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddPaymentRequestAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'payment_request',
      position: { x: 0, y: 300 },
      data: {
        label: 'Payment Request',
        requestType: 'course',
        provider: '',
        amount: '15000',
        course: 'CPA US',
        papers: ['FAR'],
        packageName: 'Full Course',
        validityTerms: '12 Months',
        paymentSummary: 'Standard course enrollment fee',
        headerText: '💳 Secure Payment Request',
        buttonText: 'Pay Now',
        footerText: 'Official Razorpay link'
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddNotificationAction = useCallback(() => {
    const newNode = {
      id: `notification_${Math.random().toString(36).substr(2, 9)}`,
      type: 'notification',
      position: { x: 500, y: 300 },
      data: { message: 'Alert team!' },
    };
    setNodes((nds) => nds.concat(newNode));
    setSelectedNode(newNode);
  }, [setNodes]);

  const handleAddExotelCallAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'exotel_call',
      position: { x: 0, y: 400 },
      data: {
        label: 'Initiate Call',
        toNumber: '{{contact.phone}}',
        callerId: '',
        record: false,
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddAgentCallDispatchAction = useCallback(() => {
    const node = {
      id: getId(),
      type: 'agent_call_dispatch',
      position: { x: 0, y: 400 },
      data: { label: 'Agent Call Dispatch', toNumber: '{{contact.phone}}', agentMode: 'assigned_agent', agentId: '', callerId: '', record: false },
    };
    setNodes((nds) => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddTwilioSmsAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'twilio_sms',
      position: { x: 0, y: 400 },
      data: { label: 'Send SMS', toNumber: '{{contact.phone}}', message: '' },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddTwilioCallAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'twilio_call',
      position: { x: 0, y: 400 },
      data: { label: 'Voice Call', toNumber: '{{contact.phone}}', fromNumber: '', record: false },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddZoomFetchAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'zoom_fetch',
      position: { x: 0, y: 400 },
      data: { label: 'Fetch Zoom Webinars' },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddZoomMatchAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'zoom_match',
      position: { x: 0, y: 450 },
      data: { label: 'Zoom Smart Match', itemsVariable: 'zoom_webinars', topicVariable: '{{course_name}}' },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddZoomRegisterAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'zoom_register',
      position: { x: 0, y: 500 },
      data: { label: 'Zoom Auto-Register', webinarIdVariable: '{{matched_webinar.id}}', emailVariable: '{{email}}', nameVariable: '{{contact_first_name}}' },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddLoopAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'loop',
      position: { x: 0, y: 400 },
      data: { label: 'Loop / For Each', itemsVariable: 'zoom_webinars' },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddRelativeDelayAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'relative_delay',
      position: { x: 0, y: 400 },
      data: { 
        label: 'Delay Relative To Time', 
        referenceVariable: 'loopItem.start_time',
        offsetAmount: 60,
        offsetUnit: 'minutes',
        offsetDirection: 'before'
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddPaymentReminderAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'payment_reminder',
      position: { x: 0, y: 400 },
      data: {
        label: 'Payment Reminder',
        duration: '24',
        unit: 'hours'
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  // Load gallery and open the picker modal
  const openGallery = useCallback(async () => {
    setShowGalleryModal(true);
  }, []);

  const updateNodeData = (key, value) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          const newData = { ...node.data, [key]: value };
          // Optimistic update for selected node
          setSelectedNode({ ...node, data: newData });
          return { ...node, data: newData };
        }
        return node;
      })
    );
  };

  const updateNodeFields = (nodeId, changes) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...changes,
            },
          };
        }
        return node;
      })
    );
    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode((node) =>
        node
          ? {
            ...node,
            data: {
              ...node.data,
              ...changes,
            },
          }
          : node
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(changes, 'scheduleType') ||
      Object.prototype.hasOwnProperty.call(changes, 'delayValue') ||
      Object.prototype.hasOwnProperty.call(changes, 'delayUnit')
    ) {
      if (viewMode === 'list') {
        syncGraphFromList();
      }
    }
  };

  const handleSave = () => {
    // Convert Graph to JSON format required
    // { workflow_id, trigger, nodes: [...] }

    // Find trigger node — support both old 'trigger' type and new typed triggers
    const triggerNode = nodes.find(n =>
      n.type === 'trigger' || n.type === 'incoming_webhook' ||
      n.type === 'new_contact' || n.type === 'campaign_trigger'
    );
    let triggerType = triggerNode?.data?.triggerType || triggerNode?.data?.triggerId || (triggerNode ? 'incoming_whatsapp' : null);
    // Map canvas node types to execution trigger keys
    if (triggerNode?.type === 'incoming_webhook') triggerType = 'incoming_webhook';
    if (triggerNode?.type === 'new_contact') triggerType = 'new_contact';
    if (triggerType === 'new_contact_created') triggerType = 'new_contact';

    const formattedNodes = nodes.map(node => {
      const nodeDef = {
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data
      };

      // Find connections for each node type
      if (node.type === 'condition' || node.type === 'campaign_condition' || node.type === 'user_replied' || node.type === 'wait_for_reply') {
        const yesEdge = edges.find(e => e.source === node.id && (
          e.sourceHandle === 'yes' || e.sourceHandle === 'true' || (node.type === 'campaign_condition' && e.sourceHandle === 'cond-0')
        ));
        const noEdge = edges.find(e => e.source === node.id && (
          e.sourceHandle === 'no' || e.sourceHandle === 'false' || (node.type === 'campaign_condition' && e.sourceHandle === 'cond-1')
        ));
        if (yesEdge) {
          if (node.type === 'user_replied' || node.type === 'wait_for_reply') {
            if (!nodeDef.routes) nodeDef.routes = {};
            nodeDef.routes['true'] = yesEdge.target;
          } else {
            nodeDef.yes = yesEdge.target;
          }
        }
        if (noEdge) {
          if (node.type === 'user_replied' || node.type === 'wait_for_reply') {
            if (!nodeDef.routes) nodeDef.routes = {};
            nodeDef.routes['false'] = noEdge.target;
          } else {
            nodeDef.no = noEdge.target;
          }
        }
      } else if (node.type === 'send_template') {
        const nextEdge = edges.find(e => e.source === node.id && (e.sourceHandle === 'default' || !e.sourceHandle));
        if (nextEdge) nodeDef.next = nextEdge.target;
        
        if (node.data.buttons && node.data.buttons.length > 0) {
          nodeDef.routes = {};
          node.data.buttons.forEach((btn, idx) => {
            const edge = edges.find(e => e.source === node.id && e.sourceHandle === `button-${idx}`);
            if (edge) nodeDef.routes[btn] = edge.target;
          });
        }
      } else if (node.type === 'response_message') {
        const nextEdge = edges.find(e => e.source === node.id && (e.sourceHandle === 'default' || !e.sourceHandle));
        if (nextEdge) nodeDef.next = nextEdge.target;
        
        if (node.data.buttons && node.data.buttons.length > 0) {
          nodeDef.routes = {};
          node.data.buttons.forEach((btn, idx) => {
            const edge = edges.find(e => e.source === node.id && (e.sourceHandle === `button-${idx}` || e.sourceHandle === `btn-${idx}`));
            if (edge) nodeDef.routes[btn] = edge.target;
          });
        }
      } else if (node.type === 'list_message') {
        const nextEdge = edges.find(e => e.source === node.id && (e.sourceHandle === 'default' || !e.sourceHandle));
        if (nextEdge) nodeDef.next = nextEdge.target;
        
        if (node.data.items && node.data.items.length > 0) {
          nodeDef.routes = {};
          node.data.items.forEach((it, idx) => {
            const itemLabel = typeof it === 'object' ? it.title : it;
            const edge = edges.find(e => e.source === node.id && e.sourceHandle === `item-${idx}`);
            if (edge) nodeDef.routes[itemLabel] = edge.target;
          });
        }
      } else if (node.type === 'xolox_event') {
        // XOLOX event node has two named handles: success and fail
        const successEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'success');
        const failEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'fail');
        if (successEdge) nodeDef.onSuccess = successEdge.target;
        if (failEdge) nodeDef.onFail = failEdge.target;
      } else if (node.type === 'twilio_sms') {
        const sentEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'sent');
        const failedEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'failed');
        nodeDef.routes = {};
        if (sentEdge) nodeDef.routes.sent = sentEdge.target;
        if (failedEdge) nodeDef.routes.failed = failedEdge.target;
      } else if (node.type === 'twilio_call') {
        const answeredEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'answered');
        const failedEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'failed');
        nodeDef.routes = {};
        if (answeredEdge) nodeDef.routes.answered = answeredEdge.target;
        if (failedEdge) nodeDef.routes.failed = failedEdge.target;
      } else if (node.type === 'exotel_call') {
        const answeredEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'answered');
        const failedEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'failed');
        nodeDef.routes = {};
        if (answeredEdge) nodeDef.routes.answered = answeredEdge.target;
        if (failedEdge) nodeDef.routes.failed = failedEdge.target;
      } else if (node.type === 'agent_call_dispatch') {
        const dispatchedEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'dispatched');
        const failedEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'failed');
        nodeDef.routes = {};
        if (dispatchedEdge) nodeDef.routes.dispatched = dispatchedEdge.target;
        if (failedEdge) nodeDef.routes.failed = failedEdge.target;
      } else if (node.type === 'payment_reminder') {
        const paidEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'paid');
        const unpaidEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'unpaid');
        nodeDef.routes = {};
        if (paidEdge) nodeDef.routes.paid = paidEdge.target;
        if (unpaidEdge) nodeDef.routes.unpaid = unpaidEdge.target;
      } else if (node.type === 'loop') {
        const eachEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'each');
        const doneEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'done');
        nodeDef.routes = {};
        if (eachEdge) nodeDef.routes.each = eachEdge.target;
        if (doneEdge) nodeDef.routes.done = doneEdge.target;
      } else if (node.type === 'relative_delay') {
        const executeEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'execute');
        const skipEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'skip');
        nodeDef.routes = {};
        if (executeEdge) nodeDef.routes.execute = executeEdge.target;
        if (skipEdge) nodeDef.routes.skip = skipEdge.target;
      } else {
        const edge = edges.find(e => e.source === node.id);
        if (edge) nodeDef.next = edge.target;
      }

      return nodeDef;
    });

    const workflowJson = {
      workflow_id: initialWorkflow?.id || `wf_${Date.now()}`,
      trigger: triggerType,
      nodes: formattedNodes,
      edges: edges
    };

    console.log('Saved Workflow JSON:', workflowJson);
    return workflowJson; // Return for immediate use if needed
  };

  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved'

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!onSave || !initialWorkflow?.id) return;
    const interval = setInterval(async () => {
      setAutoSaveStatus('saving');
      try {
        const json = handleSave();
        await onSave(json);
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(null), 2000);
      } catch {
        setAutoSaveStatus(null);
      }
    }, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave, initialWorkflow?.id, nodes, edges]);

  const [publishStatus, setPublishStatus] = useState(null);

  const handleManualSave = async () => {
    setSaveStatus('saving');
    try {
      const json = handleSave();
      if (onSave) await onSave(json);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

    const [showPreflightModal, setShowPreflightModal] = useState(false);
  const [preflightErrors, setPreflightErrors] = useState([]);

  const validateWorkflow = () => {
    const errors = [];
    
    if (nodes.length === 0) {
      errors.push({ type: 'error', message: 'Workflow is completely empty. Add some nodes.' });
      return errors;
    }

    const hasTrigger = nodes.some(n => n.type && n.type.includes('trigger'));
    if (!hasTrigger) {
      errors.push({ type: 'warning', message: 'No trigger node found. Workflow might never start automatically.' });
    }

    nodes.forEach(node => {
      if (node.type && !node.type.includes('trigger') && !node.type.includes('start')) {
        const hasIncoming = edges.some(e => e.target === node.id);
        if (!hasIncoming) {
          errors.push({ type: 'error', message: `Node "${node.data?.label || node.type}" is disconnected. It has no incoming connections.` });
        }
      }

      if (node.type === 'send_message' || node.type === 'customer_message') {
        if (!node.data?.message || node.data.message.trim() === '') {
          errors.push({ type: 'error', message: `Send Message node "${node.data?.label || 'unnamed'}" has empty content.` });
        }
      }

      if (node.type === 'template' || node.type === 'email_template') {
        if (!node.data?.templateName) {
          errors.push({ type: 'error', message: `Template node "${node.data?.label || 'unnamed'}" has no template selected.` });
        }
      }
      
      if (node.type === 'condition') {
        if (!node.data?.conditions || node.data.conditions.length === 0) {
          errors.push({ type: 'warning', message: `Condition node "${node.data?.label || 'unnamed'}" has no logical rules defined.` });
        }
      }
    });

    return errors;
  };

  const forcePublish = async () => {
    setShowPreflightModal(false);
    setPublishStatus('saving');
    try {
      const json = handleSave();
      if (onSave) await onSave(json);
      if (initialWorkflow?.id) {
        await publishWorkflow(initialWorkflow.id);
      }
      setPublishStatus('saved');
      setTimeout(() => setPublishStatus(null), 2500);
    } catch (err) {
      console.error(err);
      setPublishStatus('error');
      setTimeout(() => setPublishStatus(null), 3000);
    }
  };

  const handlePublish = async () => {
    const errors = validateWorkflow();
    if (errors.length > 0) {
      setPreflightErrors(errors);
      setShowPreflightModal(true);
      return;
    }
    forcePublish();
  };

  const handleRun = async () => {
    if (!runPhoneNumber) {
      alert('Please enter a phone number');
      return;
    }

    setIsRunning(true);
    try {
      // Auto-save before running to ensure backend has latest version
      if (onSave) {
        // We need to wait for save to complete if it was async, but onSave is likely just passing data up.
        // Ideally we should call API to save here if not already saved.
        // But `onSave` in App.jsx calls updateWorkflow.
        // Let's assume user should save first or we trigger save.
        // To be safe, we'll just proceed assuming the user saved or we are running the *persisted* version.
        // Actually, if we just edited, the backend is stale.
        // We should force a save.
        const json = handleSave();
        // Wait a bit for propagation if needed, or better, change onSave to be async and await it.
        // But onSave in App.jsx is async.
        // Let's await it if it returns a promise.
        await onSave(json);
      }

      // Now run
      const res = await runWorkflow(initialWorkflow.id, runPhoneNumber);
      if (res.error) throw new Error(res.error);

      alert('Workflow execution started! Check console for details.');
      console.log('Run logs:', res.log);
      setIsRunModalOpen(false);
    } catch (err) {
      console.error('Failed to run workflow:', err);
      alert('Failed to run workflow: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const openWebhookTestModal = () => {
    const triggerNode = nodes.find((n) => n && n.type === 'incoming_webhook');
    const mapping = (triggerNode && triggerNode.data && triggerNode.data.paramMapping) ? triggerNode.data.paramMapping : {};
    const mappedKeys = Object.keys(mapping || {}).filter(Boolean);

    const base = [
      { key: 'phone', value: runPhoneNumber || '' },
      { key: 'name', value: '' },
      { key: 'email', value: '' },
    ];

    const extras = mappedKeys
      .filter((k) => !base.some((b) => b.key === k))
      .map((k) => ({ key: k, value: '' }));

    setWebhookTestFields([...base, ...extras]);
    setIsWebhookTestModalOpen(true);
  };

  const handleWebhookTestRun = async () => {
    const workflowId = initialWorkflow?.id || null;
    const isRealId = workflowId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workflowId);
    if (!isRealId) {
      alert('Please save the workflow first to generate a webhook URL.');
      return;
    }

    const payload = {};
    for (const row of webhookTestFields) {
      const k = (row.key || '').trim();
      if (!k) continue;
      payload[k] = row.value;
    }

    const phone = payload.phone || payload.mobile || payload.whatsapp || payload.contact || '';
    if (!String(phone).trim()) {
      alert('Phone is required for webhook test (use key "phone").');
      return;
    }

    setIsWebhookSending(true);
    try {
      if (onSave) {
        const json = handleSave();
        await onSave(json);
      }

      const webhookUrl = getWorkflowWebhookUrl(workflowId);
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data && (data.error || data.message)) || 'Webhook request failed');
      }

      setIsWebhookTestModalOpen(false);
    } catch (err) {
      console.error('Webhook test failed:', err);
      alert('Webhook test failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsWebhookSending(false);
    }
  };

  const handleStartRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser. You can type your request instead.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognition.onerror = (event) => {
        setVoiceError(event.error || 'Voice capture error');
        setIsRecording(false);
      };
      recognition.onend = () => {
        setIsRecording(false);
      };
      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
      setVoiceError('');
    } catch (err) {
      setVoiceError('Unable to start voice capture. You can type your request instead.');
    }
  };

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleGenerateFromVoice = async () => {
    if (!voiceText.trim()) {
      setVoiceError('Please speak or type what you want the workflow to do.');
      return;
    }
    if (voiceGraph && voicePreview.length > 0) {
      const graph = voiceGraph;
      const ctx = voiceContext;
      const steps = (graph.nodes || []).filter(
        (n) => n.type === 'send_template' || n.type === 'send_message' || n.type === 'delay'
      );
      if (!steps.length) {
        setVoiceError('Could not understand any steps from your description.');
        return;
      }

      if (ctx && ctx.mode === 'branch' && ctx.conditionId && ctx.side) {
        const conditionId = ctx.conditionId;
        const side = ctx.side;
        const condNode = nodes.find((node) => node.id === conditionId);
        const baseX =
          condNode && condNode.position && typeof condNode.position.x === 'number'
            ? condNode.position.x
            : 0;
        const baseY =
          condNode && condNode.position && typeof condNode.position.y === 'number'
            ? condNode.position.y
            : 0;
        const created = steps.map((step, index) => ({
          id: getId(),
          type: step.type,
          position: { x: baseX, y: baseY + (index + 1) * 140 },
          data: {
            ...(step.data || {}),
            branchConditionId: conditionId,
            branchSide: side,
          },
        }));
        const createdEdges = created.map((node, index) => ({
          id: `e_${index === 0 ? conditionId : created[index - 1].id}_${node.id}`,
          source: index === 0 ? conditionId : created[index - 1].id,
          sourceHandle: index === 0 ? side : undefined,
          target: node.id,
          animated: true,
        }));
        setNodes((current) => [...current, ...created]);
        setEdges((current) => [...current, ...createdEdges]);
      } else {
        const yValues = nodes.map((node) =>
          node.position && typeof node.position.y === 'number' ? node.position.y : 0
        );
        const maxY = yValues.length > 0 ? Math.max(...yValues) : 0;
        const firstMessage = nodes.find(
          (node) => node.type === 'send_template' || node.type === 'send_message'
        );
        const baseX =
          firstMessage && firstMessage.position && typeof firstMessage.position.x === 'number'
            ? firstMessage.position.x
            : 0;
        const existingTrigger = nodes.find((node) => node.type === 'trigger');
        const generatedTrigger = existingTrigger
          ? null
          : {
              id: getId(),
              type: 'trigger',
              position: { x: baseX, y: maxY + 140 },
              data: { label: 'Start Workflow', triggerType: 'incoming_whatsapp' },
            };
        const startY = generatedTrigger ? maxY + 280 : maxY + 140;
        const created = steps.map((step, index) => ({
          id: getId(),
          type: step.type,
          position: { x: baseX, y: startY + index * 140 },
          data: { ...(step.data || {}) },
        }));
        const currentEdges = edges;
        const terminalNodes = nodes.filter(
          (node) => !currentEdges.some((edge) => edge.source === node.id)
        );
        const terminal = terminalNodes.sort((a, b) =>
          (b.position?.y || 0) - (a.position?.y || 0)
        )[0];
        const anchorId = generatedTrigger?.id
          || (currentEdges.length === 0 ? existingTrigger?.id : terminal?.id)
          || existingTrigger?.id
          || null;
        const createdEdges = created.map((node, index) => ({
          id: `e_${index === 0 ? anchorId : created[index - 1].id}_${node.id}`,
          source: index === 0 ? anchorId : created[index - 1].id,
          target: node.id,
          animated: true,
        })).filter((edge) => edge.source);

        setNodes((current) => [...current, ...(generatedTrigger ? [generatedTrigger] : []), ...created]);
        setEdges((current) => [...current, ...createdEdges]);
      }
      setIsVoiceModalOpen(false);
      setVoiceText('');
      setVoiceContext(null);
      setVoiceGraph(null);
      setVoicePreview([]);
      return;
    }
    setIsVoiceProcessing(true);
    setVoiceError('');
    try {
      const graph = await aiGenerateWorkflow(voiceText.trim());
      if (graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges)) {
        const lines = summarizeVoiceSteps(graph, voiceContext);
        if (!lines.length) {
          setVoiceError('Could not understand any steps from your description.');
          setVoiceGraph(null);
          setVoicePreview([]);
        } else {
          setVoiceGraph(graph);
          setVoicePreview(lines);
        }
      } else {
        setVoiceError('Could not understand AI response. Please try again.');
      }
    } catch (err) {
      console.error('Failed to generate workflow from voice:', err);
      setVoiceError('Failed to generate workflow. Please try again.');
      setVoiceGraph(null);
      setVoicePreview([]);
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  const sortedNodes = [...nodes].sort((a, b) => {
    const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
    const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
    return ay - by;
  });

  const summarizeVoiceSteps = (graph, context) => {
    if (!graph || !Array.isArray(graph.nodes)) return [];
    let nodesToUse = Array.isArray(graph.nodes) ? [...graph.nodes] : [];
    if (context && context.mode === 'branch') {
      nodesToUse = nodesToUse.filter(
        (n) => n.type === 'send_template' || n.type === 'send_message'
      );
    }
    nodesToUse = nodesToUse.filter(
      (n) => n.type === 'send_template' || n.type === 'send_message' || n.type === 'delay'
    );
    nodesToUse.sort((a, b) => {
      const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
      const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
      return ay - by;
    });
    const lines = [];
    nodesToUse.forEach((node) => {
      const data = node.data || {};
      if (node.type === 'send_template' || node.type === 'send_message') {
        const type = data.scheduleType || 'immediate';
        if (type === 'delay') {
          const rawVal =
            typeof data.delayValue === 'number'
              ? data.delayValue
              : parseInt(String(data.delayValue || '0'), 10);
          const v = Number.isNaN(rawVal) ? 0 : rawVal;
          const u = data.delayUnit || 'minutes';
          if (v > 0) {
            lines.push(`Wait ${v} ${u}`);
          }
        }
        if (node.type === 'send_template') {
          const name = data.template || data.label || 'template';
          lines.push(`Send template "${name}"`);
        } else {
          const msg = (data.message || '').trim();
          const short =
            msg.length > 60 ? `${msg.slice(0, 57)}...` : msg || 'message';
          lines.push(`Send message "${short}"`);
        }
      } else if (node.type === 'delay') {
        const v =
          typeof data.duration === 'number'
            ? data.duration
            : parseInt(String(data.duration || '0'), 10);
        const u = data.unit || 'minutes';
        if (!Number.isNaN(v) && v > 0) {
          lines.push(`Wait ${v} ${u}`);
        }
      }
    });
    return lines;
  };

  const getScheduleSummary = (data) => {
    const type = data.scheduleType || 'immediate';
    if (type === 'immediate') {
      return 'Message sent immediately after previous step';
    }
    if (type === 'delay') {
      const value = data.delayValue || data.duration || 0;
      const unit = data.delayUnit || data.unit || 'minutes';
      return `Message sent ${value} ${unit} after previous step`;
    }
    if (type === 'specific_time') {
      return 'Message sent at the scheduled time';
    }
    return '';
  };

  return (
    <div className="greeto-workflow-builder flex flex-col h-screen w-full bg-[#f6f4fb] relative overflow-hidden">
      <style>{`
        .greeto-workflow-builder {
          color: #0f172a;
        }
        .greeto-workflow-builder .workflow-shell-header {
          background: #ffffff;
          border-bottom: 1px solid rgba(226, 232, 240, 0.92);
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
        }
        .greeto-workflow-builder .workflow-toolbar-button {
          border-radius: 14px !important;
          border: 1px solid rgba(226, 232, 240, 0.95) !important;
          background: #ffffff !important;
          color: #334155 !important;
          font-weight: 800 !important;
          min-height: 44px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
        }
        .greeto-workflow-builder .workflow-toolbar-button:hover {
          background: #f8fafc !important;
          color: #6d28d9 !important;
          border-color: rgba(196, 181, 253, 0.88) !important;
          box-shadow: 0 10px 24px rgba(88, 28, 135, 0.08);
        }
        .greeto-workflow-builder .workflow-save-button {
          border-radius: 14px !important;
          min-height: 44px;
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%) !important;
          box-shadow: 0 14px 30px rgba(109, 40, 217, 0.22) !important;
        }
        .greeto-workflow-builder .react-flow,
        .greeto-workflow-builder .react-flow__renderer {
          background:
            radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.48) 1px, transparent 0) 0 0 / 18px 18px,
            #ffffff !important;
        }
        .greeto-workflow-builder input:not([type="radio"]):not([type="checkbox"]):not([type="file"]),
        .greeto-workflow-builder select,
        .greeto-workflow-builder textarea {
          border-radius: 14px !important;
          border-color: rgba(203, 213, 225, 0.95) !important;
          background: rgba(255, 255, 255, 0.96) !important;
          box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
          transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
        }
        .greeto-workflow-builder input:not([type="radio"]):not([type="checkbox"]):not([type="file"]):focus,
        .greeto-workflow-builder select:focus,
        .greeto-workflow-builder textarea:focus {
          outline: none !important;
          border-color: rgba(147, 51, 234, 0.65) !important;
          box-shadow: 0 0 0 4px rgba(168, 85, 247, 0.12) !important;
        }
        .greeto-workflow-builder textarea {
          line-height: 1.55;
        }
        .greeto-workflow-builder label {
          color: #475569;
          font-weight: 700;
        }
        .greeto-workflow-builder button {
          transition: transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease, border-color 160ms ease, color 160ms ease;
        }
        .greeto-workflow-builder button:not(:disabled):hover {
          transform: translateY(-1px);
        }
        .greeto-workflow-builder button:disabled {
          cursor: not-allowed;
          opacity: 0.62;
        }
        .greeto-workflow-builder .fixed .bg-white,
        .greeto-workflow-builder .fixed.bg-white {
          border-radius: 26px;
          border: 1px solid rgba(168, 85, 247, 0.12);
          box-shadow: 0 30px 80px rgba(45, 16, 82, 0.22);
        }
        .greeto-workflow-builder .fixed .border-b {
          border-color: rgba(168, 85, 247, 0.12);
        }
        .greeto-workflow-builder .fixed .bg-slate-50,
        .greeto-workflow-builder .fixed .bg-slate-50\\/30,
        .greeto-workflow-builder .fixed .bg-slate-50\\/50 {
          background: linear-gradient(135deg, #faf5ff 0%, #ffffff 100%);
        }
        .greeto-workflow-builder .custom-scrollbar::-webkit-scrollbar,
        .greeto-workflow-builder ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .greeto-workflow-builder .custom-scrollbar::-webkit-scrollbar-thumb,
        .greeto-workflow-builder ::-webkit-scrollbar-thumb {
          background: rgba(126, 34, 206, 0.22);
          border-radius: 999px;
        }
        .greeto-workflow-builder .custom-scrollbar::-webkit-scrollbar-track,
        .greeto-workflow-builder ::-webkit-scrollbar-track {
          background: rgba(241, 245, 249, 0.8);
        }
        .greeto-workflow-builder .react-flow__controls {
          border: 1px solid rgba(126, 34, 206, 0.12);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 18px 45px rgba(88, 28, 135, 0.12);
        }
        .greeto-workflow-builder .react-flow__controls-button {
          border-bottom: 1px solid rgba(126, 34, 206, 0.08);
          color: #4c1d95;
        }
        .greeto-workflow-builder .react-flow__minimap {
          border-radius: 16px;
          border: 1px solid rgba(126, 34, 206, 0.12);
          box-shadow: 0 18px 45px rgba(88, 28, 135, 0.12);
          overflow: hidden;
        }
        .greeto-node-library > div[draggable="true"] {
          position: relative;
          overflow: hidden;
          border-radius: 16px !important;
          background: #ffffff !important;
          border: 1px solid rgba(226, 232, 240, 0.96) !important;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          padding: 12px !important;
          min-height: 76px;
          isolation: isolate;
        }
        .greeto-node-library > div[draggable="true"]:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 28px rgba(88, 28, 135, 0.1);
          border-color: rgba(196, 181, 253, 0.86) !important;
          background: #faf5ff !important;
        }
        .greeto-node-library > div[draggable="true"]::before {
          content: "";
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: linear-gradient(180deg, #7c3aed 0%, #a855f7 100%);
          opacity: 0;
          z-index: -1;
        }
        .greeto-node-library > div[draggable="true"]:hover::before {
          opacity: 1;
        }
        .greeto-node-library > div[draggable="true"]::after {
          content: none;
        }
        .greeto-node-library > div[draggable="true"] > div:first-child {
          width: 42px !important;
          height: 42px !important;
          border-radius: 14px !important;
          background: #f3e8ff !important;
          color: #7c3aed !important;
          box-shadow: none;
        }
        .greeto-node-library > div[draggable="true"] > div:first-child svg {
          color: #7c3aed !important;
        }
        .greeto-node-library > div[draggable="true"] > div:nth-child(2) {
          min-width: 0;
        }
        .greeto-node-library > div[draggable="true"] > div:nth-child(2) > div:first-child {
          color: #0f172a !important;
          font-weight: 900 !important;
          letter-spacing: -0.01em;
        }
        .greeto-node-library > div[draggable="true"] > div:nth-child(2) > div:nth-child(2) {
          color: #64748b !important;
          font-weight: 700 !important;
          line-height: 1.25;
        }
        .greeto-node-library h2,
        .greeto-node-library h3 {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 999px;
          background: transparent;
          border: 0;
          color: #94a3b8 !important;
          letter-spacing: 0.16em !important;
          padding: 0 2px;
          box-shadow: none;
        }
        .greeto-node-library h2::before,
        .greeto-node-library h3::before {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #7c3aed;
          box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.1);
        }
        .greeto-workflow-builder ol > li {
          border-radius: 18px;
        }
      `}</style>
      {/* CSV Modal */}
      {isCSVModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-[95vw] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <FileIcon size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">CSV Bulk Interface</h3>
                  <p className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Import or Export workflow structure via Google Sheets / Excel.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCSVModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex gap-3 shadow-sm">
                <div className="p-1.5 bg-white text-indigo-600 rounded-lg shadow-sm h-fit">
                  <WorkflowIcon size={16} />
                </div>
                <div>
                  <p className="text-[11px] text-indigo-800 font-bold">Auto-Build Workflow Interface</p>
                  <p className="text-[10px] text-indigo-700 leading-relaxed mt-0.5">
                    Admins can define a sequence of triggers, delays, and messages in a simple CSV.
                    The system will automatically generate all nodes and connections.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Auto-Build Guide</h4>
                  <button
                    onClick={() => setIsCSVGuideOpen(!isCSVGuideOpen)}
                    className="text-[10px] font-bold text-indigo-600 flex items-center gap-1 hover:underline"
                  >
                    {isCSVGuideOpen ? 'Hide Guide' : 'Show Supported Types'}
                    {isCSVGuideOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>

                {isCSVGuideOpen && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-y-auto max-h-[300px] text-[11px] space-y-4 shadow-inner">
                    <div className="space-y-2">
                      <p className="font-bold text-slate-800 border-l-2 border-green-500 pl-2 uppercase tracking-tighter text-[10px]">Triggers</p>
                      <ul className="space-y-1 text-slate-600 pl-4 list-disc">
                        <li><strong>trigger</strong>: Wait for keywords. <br className="mb-0.5" /><span className="text-slate-400 font-mono">Content: "hello, hi, help"</span></li>
                        <li><strong>campaign_trigger</strong>: When a campaign is sent.</li>
                        <li><strong>incoming_webhook</strong>: POST to a unique URL.</li>
                        <li><strong>new_contact</strong>: When person is added.</li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <p className="font-bold text-slate-800 border-l-2 border-indigo-500 pl-2 uppercase tracking-tighter text-[10px]">Core Actions</p>
                      <ul className="space-y-1 text-slate-600 pl-4 list-disc">
                        <li><strong>send_template</strong>: Send WhatsApp template. <br className="mb-0.5" /><span className="text-slate-400 font-mono">Content: "template_name"</span></li>
                        <li><strong>send_message</strong>: Direct WhatsApp message. <br className="mb-0.5" /><span className="text-slate-400 font-mono">Content: "Your message text"</span></li>
                        <li><strong>delay</strong>: Wait before next step. <br className="mb-0.5" /><span className="text-slate-400 font-mono">Content: "1 day" or "15 minutes"</span></li>
                        <li><strong>send_email</strong>: Template-based email action.</li>
                        <li><strong>send_sms_otp</strong>: Fast2SMS OTP action.</li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <p className="font-bold text-slate-800 border-l-2 border-orange-500 pl-2 uppercase tracking-tighter text-[10px]">Operations & Payments</p>
                      <ul className="space-y-1 text-slate-600 pl-4 list-disc">
                        <li><strong>update_lead_stage</strong>: Move CRM stage.</li>
                        <li><strong>assign_agent</strong>: Route to specific agent.</li>
                        <li><strong>razorpay_link</strong>: Generate payment link.</li>
                        <li><strong>payment_request</strong>: Collect fees.</li>
                        <li><strong>add_to_label</strong>: Segment contacts.</li>
                        <li><strong>end</strong>: Terminate the sequence.</li>
                      </ul>
                    </div>

                    <p className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-200">
                      * Refer to the Sample CSV for the exact column headers: <span className="font-mono bg-slate-100 px-1 rounded">step_id, type, content, next_step_id</span>.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <TableIcon size={14} className="text-indigo-600" />
                        Interactive Planning Table
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsShortcutsOpen(!isShortcutsOpen)}
                          className="p-1 px-1.5 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 rounded text-[10px] flex items-center gap-1 transition-all"
                          title="Keyboard Shortcuts"
                        >
                          <Keyboard size={12} />
                          {isShortcutsOpen ? 'Hide Tips' : 'Show Keys'}
                        </button>
                        <button
                          onClick={handleAddBuilderRow}
                          className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded font-bold shadow-sm transition-all"
                        >
                          + Add Step
                        </button>
                      </div>
                    </div>

                    {isShortcutsOpen && (
                      <div className="grid grid-cols-2 gap-2 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 mb-2">
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-indigo-800 flex items-center gap-1"><Info size={10} /> Navigation</p>
                          <ul className="text-[9px] text-indigo-700 space-y-0.5 list-none">
                            <li><span className="bg-white px-1 border rounded shadow-xs font-mono">↑ / ↓</span> : Move Up / Down</li>
                            <li><span className="bg-white px-1 border rounded shadow-xs font-mono">Tab</span> : Move Right</li>
                            <li><span className="bg-white px-1 border rounded shadow-xs font-mono">Shift+Tab</span> : Move Left</li>
                          </ul>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-bold text-indigo-800 flex items-center gap-1"><Zap size={10} /> Shortcuts</p>
                          <ul className="text-[9px] text-indigo-700 space-y-0.5 list-none">
                            <li><span className="bg-white px-1 border rounded shadow-xs font-mono">Enter</span> : Move Down</li>
                            <li><span className="bg-white px-1 border rounded shadow-xs font-mono">Enter</span> (at end) : New Step</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 overflow-x-auto">
                      <table className="w-full text-[10px] text-slate-600">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left pb-1 font-bold">Step Name</th>
                            <th className="text-left pb-1 font-bold">Type</th>
                            <th className="text-left pb-1 font-bold">Content/Data</th>
                            <th className="text-left pb-1 font-bold">Next Step</th>
                            <th className="pb-1"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {csvBuilderRows.map((row, idx) => (
                            <tr key={idx} className="group">
                              <td className="py-2 pr-1">
                                <input
                                  ref={el => cellRefs.current[idx * 4 + 0] = el}
                                  className="w-[80px] border border-slate-200 rounded p-1 bg-white outline-indigo-500"
                                  value={row.step_id}
                                  onKeyDown={(e) => handleTableKeyDown(e, idx, 0)}
                                  onChange={(e) => handleUpdateBuilderRow(idx, 'step_id', e.target.value)}
                                />
                              </td>
                              <td className="py-2 pr-1">
                                <select
                                  ref={el => cellRefs.current[idx * 4 + 1] = el}
                                  className="w-[90px] border border-slate-200 rounded p-1 bg-white outline-indigo-500"
                                  value={row.type}
                                  onKeyDown={(e) => handleTableKeyDown(e, idx, 1)}
                                  onChange={(e) => handleUpdateBuilderRow(idx, 'type', e.target.value)}
                                >
                                  <option value="trigger">Trigger</option>
                                  <option value="send_template">Template</option>
                                  <option value="send_message">Message</option>
                                  <option value="delay">Delay</option>
                                </select>
                              </td>
                              <td className="py-2 pr-1">
                                <input
                                  ref={el => cellRefs.current[idx * 4 + 2] = el}
                                  className="w-[120px] border border-slate-200 rounded p-1 bg-white outline-indigo-500"
                                  placeholder={row.type === 'delay' ? '1 day' : 'Keywords/Text'}
                                  value={row.content}
                                  onKeyDown={(e) => handleTableKeyDown(e, idx, 2)}
                                  onChange={(e) => handleUpdateBuilderRow(idx, 'content', e.target.value)}
                                />
                              </td>
                              <td className="py-2 pr-1">
                                <select
                                  ref={el => cellRefs.current[idx * 4 + 3] = el}
                                  className="w-[80px] border border-slate-200 rounded p-1 bg-white outline-indigo-500"
                                  value={row.next_step_id}
                                  onKeyDown={(e) => handleTableKeyDown(e, idx, 3)}
                                  onChange={(e) => handleUpdateBuilderRow(idx, 'next_step_id', e.target.value)}
                                >
                                  <option value="">-None-</option>
                                  {csvBuilderRows.filter((_, i) => i !== idx).map(r => (
                                    <option key={r.step_id} value={r.step_id}>{r.step_id}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 text-right">
                                <button
                                  onClick={() => handleDeleteBuilderRow(idx)}
                                  className="text-slate-300 hover:text-red-500 transition-colors"
                                >
                                  <XCircle size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      onClick={downloadBuilderCSV}
                      className="w-full flex items-center justify-between p-3 bg-white border border-indigo-200 rounded-lg hover:border-indigo-400 transition-all text-[11px] font-bold text-indigo-700 shadow-sm"
                    >
                      Export Table to CSV
                      <FileDown size={14} />
                    </button>
                    <p className="text-[9px] text-slate-400 italic">
                      Step 1: Build your sequence here. Step 2: Download the CSV. Step 3: Upload it below to build!
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ready to Auto-Build?</h4>
                    <label className="relative flex items-center justify-between p-4 border border-indigo-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-slate-50 transition-all group bg-white shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                          <Zap size={20} />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold text-slate-800">Final Upload & Build</div>
                          <div className="text-[10px] text-slate-500">Creates your visual flow from the CSV above.</div>
                        </div>
                      </div>
                      <input type="file" className="hidden" accept=".csv" onChange={handleUploadSimplified} />
                      <div className="text-[10px] font-bold text-white bg-indigo-600 px-3 py-1 rounded-full shadow-lg">IMPORT FILE</div>
                    </label>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex gap-4">
                    <button
                      onClick={handleDownloadFull}
                      className="flex-1 flex items-center justify-center gap-1.5 p-2 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-50"
                    >
                      <Download size={12} /> Backup Logic
                    </button>
                    <label className="flex-1 flex items-center justify-center gap-1.5 p-2 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-50 cursor-pointer">
                      <Upload size={12} /> Restore Logic
                      <input type="file" className="hidden" accept=".csv" onChange={handleUploadFull} />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-pink-100 text-pink-600 rounded">
                    <Zap size={14} />
                  </div>
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Migrate from Pabbly Connect</h4>
                </div>
                <textarea
                  className="w-full h-24 p-3 text-[11px] font-mono border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all"
                  placeholder='Paste Pabbly workflow JSON here...'
                  value={pabblyJSON}
                  onChange={(e) => setPabblyJSON(e.target.value)}
                />
                <Button
                  onClick={handleMigratePabbly}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-xs py-2 shadow-sm"
                >
                  Confirm Pabbly Migration
                </Button>
              </div>
              <div className="flex justify-end pt-2 border-t border-slate-200">
                <Button variant="ghost" className="text-xs" onClick={() => setIsCSVModalOpen(false)}>Close Interface</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[480px] max-w-[95vw] p-6 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Mic size={18} className="text-slate-700" />
              Add using voice
            </h3>
            <p className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">
              Example: I want to send a WhatsApp template named "course_selection" and after 1 day send a message saying hi.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isRecording ? 'destructive' : 'outline'}
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className="flex items-center gap-2"
                >
                  <Mic size={16} />
                  {isRecording ? 'Stop recording' : 'Start recording'}
                </Button>
                <span className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">
                  {isRecording ? 'Listening...' : 'You can also type below'}
                </span>
              </div>
              <textarea
                className="w-full border border-slate-300 rounded-md p-2 text-sm min-h-[80px]"
                placeholder='Describe the flow you want, for example: "Send template course_selection, then after 1 day send a message saying hi."'
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
              />
              {voicePreview.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-md p-2 bg-slate-50">
                  <div className="text-[11px] font-semibold text-slate-600 mb-1">
                    Detected steps
                  </div>
                  <ol className="text-[11px] text-slate-700 space-y-1 list-decimal list-inside">
                    {voicePreview.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ol>
                </div>
              )}
              {voiceError && (
                <p className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">
                  {voiceError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setIsVoiceModalOpen(false);
                  setVoiceText('');
                  setVoiceError('');
                  setVoiceGraph(null);
                  setVoicePreview([]);
                  if (isRecording) {
                    handleStopRecording();
                  }
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleGenerateFromVoice} disabled={isVoiceProcessing}>
                {isVoiceProcessing && <Loader2 size={16} className="animate-spin mr-2" />}
                {isVoiceProcessing
                  ? 'Generating...'
                  : voiceGraph && voicePreview.length > 0
                    ? 'Apply to workflow'
                    : 'Generate steps'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Webhook Test Modal */}
      {isWebhookTestModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[520px] overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Test Incoming Webhook</h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setIsWebhookTestModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">
              This sends your payload to the workflow webhook URL and runs the remaining steps.
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1.4fr_32px] gap-2 text-xs font-medium text-slate-600">
                <div>Key</div>
                <div>Value</div>
                <div></div>
              </div>
              <div className="space-y-2">
                {webhookTestFields.map((row, idx) => (
                  <div key={`${row.key}-${idx}`} className="grid grid-cols-[1fr_1.4fr_32px] gap-2 items-center">
                    <input
                      className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                      placeholder="phone / name / course ..."
                      value={row.key}
                      onChange={(e) => {
                        const next = [...webhookTestFields];
                        next[idx] = { ...next[idx], key: e.target.value };
                        setWebhookTestFields(next);
                      }}
                    />
                    <input
                      className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                      placeholder="value"
                      value={row.value}
                      onChange={(e) => {
                        const next = [...webhookTestFields];
                        next[idx] = { ...next[idx], value: e.target.value };
                        setWebhookTestFields(next);
                      }}
                    />
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => setWebhookTestFields((prev) => prev.filter((_, i) => i !== idx))}
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWebhookTestFields((prev) => [...prev, { key: '', value: '' }])}
                >
                  <Plus size={14} className="mr-2" />
                  Add field
                </Button>
                <div className="text-[11px] text-slate-500">
                  Required: <span className="font-mono bg-slate-100 px-1 rounded">phone</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsWebhookTestModalOpen(false)}>Cancel</Button>
              <Button onClick={handleWebhookTestRun} disabled={isWebhookSending}>
                {isWebhookSending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
                {isWebhookSending ? 'Sending...' : 'Run Test'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Run Modal */}
      {/* --- PRE-FLIGHT CHECKLIST MODAL --- */}
      {showPreflightModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Pre-Publish Checklist</h3>
                <p className="text-xs text-slate-500 mt-0.5">We found a few things you might want to check.</p>
              </div>
              <button onClick={() => setShowPreflightModal(false)} className="text-slate-400 hover:bg-slate-200 hover:text-slate-600 p-1.5 rounded-lg transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {preflightErrors.map((err, idx) => (
                <div key={idx} className={`p-3 rounded-lg border flex gap-3 ${err.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                  <div className="mt-0.5">
                    {err.type === 'error' ? <AlertCircle size={16} className="text-red-500" /> : <AlertTriangle size={16} className="text-amber-500" />}
                  </div>
                  <div className="text-xs font-semibold leading-relaxed">
                    {err.message}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">
                {preflightErrors.some(e => e.type === 'error') ? 'Please fix errors before publishing.' : 'You can ignore warnings and force publish.'}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowPreflightModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={forcePublish}
                  disabled={preflightErrors.some(e => e.type === 'error')}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Force Publish
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRunModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[400px] overflow-hidden p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Run Workflow</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Test Phone Number</label>
              <input
                className="w-full border border-slate-300 rounded-md p-2 text-sm"
                placeholder="e.g. 15551234567"
                value={runPhoneNumber}
                onChange={(e) => setRunPhoneNumber(e.target.value)}
              />
              <p className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Enter number with country code (no +)</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsRunModalOpen(false)}>Cancel</Button>
              <Button onClick={handleRun} disabled={isRunning}>
                {isRunning ? <Loader2 size={16} className="animate-spin mr-2" /> : <Play size={16} className="mr-2" />}
                {isRunning ? 'Running...' : 'Run Now'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="workflow-shell-header min-h-[88px] bg-white flex items-center justify-between gap-5 px-6 py-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-xl text-slate-500 hover:bg-slate-50 hover:text-purple-700">
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="max-w-[520px] truncate text-[24px] font-bold leading-tight text-slate-950 tracking-tight">Workflow Builder</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 border border-emerald-100">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-400">Event triggers, signed webhooks, delays, conditions, and no-send simulation are enabled.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 mr-2 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${viewMode === 'canvas' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:bg-white hover:text-purple-700'}`}
            >
              Builder
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:bg-white hover:text-purple-700'}`}
            >
              List
            </button>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setVoiceContext({ mode: 'global' });
              setIsVoiceModalOpen(true);
            }}
            className="workflow-toolbar-button flex items-center gap-2 px-4"
          >
            <Mic size={16} />
            Add using voice
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsCSVModalOpen(true)}
            className="workflow-toolbar-button flex items-center gap-2 px-4"
          >
            <FileIcon size={16} />
            CSV Interface
          </Button>
          {/* Magic Actions */}
          <div className="flex items-center gap-1 mr-4 border-r border-slate-200 pr-4">
            <button
              onClick={undo}
              disabled={past.length === 0}
              title="Undo (Ctrl+Z)"
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              title="Redo (Ctrl+Y)"
              className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Redo2 size={18} />
            </button>
            <div className="w-px h-5 bg-slate-200 mx-1"></div>
            <button
              onClick={onLayout}
              title="Auto-layout Nodes"
              className="p-2 text-indigo-600 hover:bg-indigo-50 bg-indigo-50/50 border border-indigo-100 rounded-lg transition-all flex items-center gap-2"
            >
              <Wand2 size={16} />
              <span className="text-xs font-bold">Auto Layout</span>
            </button>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              if (hasIncomingWebhookTrigger) {
                openWebhookTestModal();
              } else {
                setIsRunModalOpen(true);
              }
            }}
            className="workflow-toolbar-button flex items-center gap-2 px-4"
          >
            {hasIncomingWebhookTrigger ? <Link size={16} /> : <Play size={16} />}
            Run Test
          </Button>
          {autoSaveStatus && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              {autoSaveStatus === 'saving' ? (
                <><Loader2 size={13} className="animate-spin text-slate-400" /> Auto-saving…</>
              ) : (
                <><Check size={13} className="text-green-500" /> Auto-saved</>
              )}
            </span>
          )}
          <Button
            onClick={handleManualSave}
            disabled={saveStatus === 'saving' || publishStatus === 'saving'}
            variant="outline"
            className={`flex items-center gap-2 px-4 transition-all ${saveStatus === 'saved' ? '!bg-green-100 !text-green-700 !border-green-300' :
              saveStatus === 'error' ? '!bg-red-100 !text-red-700 !border-red-300' : ''
              }`}
          >
            {saveStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> :
              saveStatus === 'saved' ? <Check size={16} /> :
                saveStatus === 'error' ? <XCircle size={16} /> :
                  <Save size={16} />}
            {saveStatus === 'saving' ? 'Saving…' :
              saveStatus === 'saved' ? 'Draft Saved' :
                saveStatus === 'error' ? 'Save Failed' :
                  'Save Draft'}
          </Button>

          <Button
            onClick={handlePublish}
            disabled={saveStatus === 'saving' || publishStatus === 'saving'}
            className={`workflow-save-button flex items-center gap-2 border-0 px-5 font-semibold text-white transition-all ${publishStatus === 'saved' ? '!bg-green-600 hover:!bg-green-700' :
              publishStatus === 'error' ? '!bg-red-600 hover:!bg-red-700' : '!bg-blue-600 hover:!bg-blue-700'
              }`}
          >
            {publishStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> :
              publishStatus === 'saved' ? <Check size={16} /> :
                publishStatus === 'error' ? <span className="text-xs">✗</span> :
                  <Globe size={16} />}
            {publishStatus === 'saving' ? 'Publishing…' :
              publishStatus === 'saved' ? 'Published!' :
                publishStatus === 'error' ? 'Publish Failed' :
                  'Publish'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden bg-white">
        {/* Left Sidebar - Palette */}
        <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
          <div className="p-6 border-b border-slate-200/60 bg-white relative overflow-hidden shrink-0">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400"></div>
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl"></div>
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 text-white flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Zap size={22} className="drop-shadow-sm" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Components</h2>
                <p className="text-[13px] font-medium text-slate-500 mt-0.5">Drag nodes to build.</p>
              </div>
            </div>
          </div>
          
          {/* Node Search and Categories */}
          {viewMode === 'canvas' && (
            <div className="px-5 py-4 border-b border-slate-200/60 bg-white shrink-0">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search components..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-[13px] font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 focus:bg-white transition-all shadow-sm"
                  value={nodeSearch}
                  onChange={(e) => setNodeSearch(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="greeto-node-library p-5 space-y-3 overflow-y-auto bg-slate-50/50">

            {viewMode === 'canvas' && (
              <div className="pt-2 pb-1">
                <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Triggers</h2>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-green-300 hover:shadow-md hover:shadow-green-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'trigger');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('trigger')}
                title="Triggers when a specific keyword is received"
              >
                <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100/50 group-hover:bg-green-500 group-hover:border-green-500 flex items-center justify-center shrink-0 transition-colors">
                  <MessageSquare size={18} className="text-green-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-green-700 transition-colors">Whatsapp Incoming</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Keyword match trigger</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-purple-300 hover:shadow-md hover:shadow-purple-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'campaign_trigger');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddCampaignTrigger}
                title="Adds Campaign Sent trigger + Condition node pre-wired"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100/50 group-hover:bg-purple-500 group-hover:border-purple-500 flex items-center justify-center shrink-0 transition-colors">
                  <Megaphone size={18} className="text-purple-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-purple-700 transition-colors">Campaign Sent</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Adds trigger + condition</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'customer_message_trigger');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('customer_message_trigger')}
                title="Runs when a customer sends a WhatsApp message and this workflow is assigned to that lead stage"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100/50 group-hover:bg-emerald-500 group-hover:border-emerald-500 flex items-center justify-center shrink-0 transition-colors">
                  <MessageSquare size={18} className="text-emerald-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">Customer Message</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Stage-aware inbound trigger</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-cyan-300 hover:shadow-md hover:shadow-cyan-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'incoming_webhook');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddWebhookTrigger}
                title="HTTP POST webhook that triggers this workflow"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100/50 group-hover:bg-cyan-500 group-hover:border-cyan-500 flex items-center justify-center shrink-0 transition-colors">
                  <Link size={18} className="text-cyan-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-cyan-700 transition-colors">Incoming Webhook</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">HTTP POST → workflow</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'new_contact');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddNewContactTrigger}
                title="Triggers when a new contact is created"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100/50 group-hover:bg-emerald-500 group-hover:border-emerald-500 flex items-center justify-center shrink-0 transition-colors">
                  <UserCheck size={18} className="text-emerald-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">New Contact Created</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Contact added → workflow</div>
                </div>
              </div>
            )}

            {/* ── Actions heading ─────────────────────────── */}
            {viewMode === 'canvas' && (
              <div className="pt-3 pb-1">
                <h2 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest pl-1">Actions</h2>
              </div>
            )}

            {/* XOLOX CRM integration */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'action');
                  e.dataTransfer.setData('application/actiontype', 'start_workflow');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'start_workflow')}
                title="Trigger another workflow"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/50 group-hover:bg-indigo-500 group-hover:border-indigo-500 flex items-center justify-center shrink-0 transition-colors">
                  <WorkflowIcon size={18} className="text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Start Workflow</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Chain another flow</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-orange-300 hover:shadow-md hover:shadow-orange-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'xolox_event');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddXoloxEvent}
                title="Send data to XOLOX CRM webhook; branches on success/fail"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100/50 group-hover:bg-orange-500 group-hover:border-orange-500 flex items-center justify-center shrink-0 transition-colors">
                  <Globe size={18} className="text-orange-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-orange-700 transition-colors">XOLOX Event</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">CRM webhook → YES / NO</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-teal-300 hover:shadow-md hover:shadow-teal-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'set_variable');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('set_variable')}
                title="Fill or overwrite a workflow variable before the next step"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100/50 group-hover:bg-teal-500 group-hover:border-teal-500 flex items-center justify-center shrink-0 transition-colors">
                  <GitBranch size={18} className="text-teal-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-teal-700 transition-colors">Set Variable</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Fill a missing value or override it</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'xolox_lookup_agent');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddXoloxLookupAgent}
                title="Look up the lead's assigned agent in Xolox for downstream template variables"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/50 group-hover:bg-indigo-500 group-hover:border-indigo-500 flex items-center justify-center shrink-0 transition-colors">
                  <Search size={18} className="text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Look Up Assigned Agent</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Xolox to {'{{assigned_to}}'}</div>
                </div>
              </div>
            )}

            {/* Send Template action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-green-300 hover:shadow-md hover:shadow-green-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'send_template');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddSendTemplateAction}
                title="Send a WhatsApp template with variables and optional media header"
              >
                <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100/50 group-hover:bg-green-500 group-hover:border-green-500 flex items-center justify-center shrink-0 transition-colors">
                  <MessageSquare size={18} className="text-green-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-green-700 transition-colors">Send Template</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">WhatsApp template + media</div>
                </div>
              </div>
            )}

            {/* Response Message action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-teal-300 hover:shadow-md hover:shadow-teal-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'response_message');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddResponseMessageAction}
                title="Send a direct message with optional media and quick reply options"
              >
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100/50 group-hover:bg-teal-500 group-hover:border-teal-500 flex items-center justify-center shrink-0 transition-colors">
                  <MessageCircle size={18} className="text-teal-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-teal-700 transition-colors">Response Message</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Direct message + Quick replies</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-teal-300 hover:shadow-md hover:shadow-teal-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'list_message');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddListMenuAction}
                title="Sends a popup menu with up to 10 options"
              >
                <div className="w-9 h-9 rounded-md bg-teal-800 flex items-center justify-center shrink-0">
                  <List size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-teal-700 transition-colors">List Menu</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Pop-up menu (up to 10 opt)</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'action');
                  e.dataTransfer.setData('application/actiontype', 'send_email');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'send_email')}
                title="Send an email using a selected template"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/50 group-hover:bg-blue-500 group-hover:border-blue-500 flex items-center justify-center shrink-0 transition-colors">
                  <Mail size={18} className="text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-blue-700 transition-colors">Send Email</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">ZeptoMail template</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-fuchsia-300 hover:shadow-md hover:shadow-fuchsia-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'action');
                  e.dataTransfer.setData('application/actiontype', 'send_sms_otp');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'send_sms_otp')}
                title="Send OTP SMS with configurable digit count"
              >
                <div className="w-10 h-10 rounded-xl bg-fuchsia-50 border border-fuchsia-100/50 group-hover:bg-fuchsia-500 group-hover:border-fuchsia-500 flex items-center justify-center shrink-0 transition-colors">
                  <MessageSquare size={18} className="text-fuchsia-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-fuchsia-700 transition-colors">Send SMS OTP</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Fast2SMS OTP route</div>
                </div>
              </div>
            )}

            {/* Feedback Collection action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-yellow-300 hover:shadow-md hover:shadow-yellow-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'feedback');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddFeedbackAction}
                title="Collect CSAT feedback from customers at the end of a flow"
              >
                <div className="w-10 h-10 rounded-xl bg-yellow-50 border border-yellow-100/50 group-hover:bg-yellow-500 group-hover:border-yellow-500 flex items-center justify-center shrink-0 transition-colors">
                  <Star size={18} className="text-yellow-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-yellow-700 transition-colors">Feedback Collection</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Track customer CSAT</div>
                </div>
              </div>
            )}

            {/* Razorpay Payments */}
            {viewMode === 'canvas' && (
              <div className="pt-4 pb-1">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] px-1">Razorpay Integrations</h3>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'wait_for_stage');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('wait_for_stage')}
                title="Pause until the lead reaches a selected pipeline stage"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/50 group-hover:bg-indigo-500 group-hover:border-indigo-500 flex items-center justify-center shrink-0 transition-colors">
                  <ListChecks size={18} className="text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Wait for Stage</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Resume when lead enters a stage</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'razorpay_link');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('razorpay_link')}
                title="Create and send a Razorpay payment link"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/50 group-hover:bg-indigo-500 group-hover:border-indigo-500 flex items-center justify-center shrink-0 transition-colors">
                  <CreditCard size={18} className="text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Create Payment Link</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Razorpay auto-generation</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'razorpay_status');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('razorpay_status')}
                title="Check payment status and branch the flow"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/50 group-hover:bg-indigo-500 group-hover:border-indigo-500 flex items-center justify-center shrink-0 transition-colors">
                  <RefreshCw size={18} className="text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Check Payment Status</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Branch on Paid/Unpaid</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div className="pt-3 pb-1">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">System Actions</h3>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-slate-300 hover:shadow-md hover:shadow-slate-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'action');
                  e.dataTransfer.setData('application/actiontype', 'update_lead_stage');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'update_lead_stage')}
                title="Update the conversation's lead stage"
              >
                <div className="w-9 h-9 rounded-md bg-slate-700 flex items-center justify-center shrink-0">
                  <ListChecks size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-slate-700 transition-colors">Update Lead Stage</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Set to New/Contacted/Enrolled...</div>
                </div>
              </div>
            )}

            {/* Payment Request action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'payment_request');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddPaymentRequestAction}
                title="Send a payment request for courses or webinars"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/50 group-hover:bg-indigo-500 group-hover:border-indigo-500 flex items-center justify-center shrink-0 transition-colors">
                  <CreditCard size={18} className="text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Payment Request</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Course & webinar fees</div>
                </div>
              </div>
            )}

            {/* Payment Reminder action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-orange-300 hover:shadow-md hover:shadow-orange-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'payment_reminder');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddPaymentReminderAction}
                title="Follow up on pending payments with specific conditions"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100/50 group-hover:bg-orange-500 group-hover:border-orange-500 flex items-center justify-center shrink-0 transition-colors">
                  <BellRing size={18} className="text-orange-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-orange-700 transition-colors">Payment Reminder</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Follow up on unpaid</div>
                </div>
              </div>
            )}

            {/* Exotel Call action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-orange-300 hover:shadow-md hover:shadow-orange-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'agent_call_dispatch');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddAgentCallDispatchAction}
                title="Ring the assigned or selected agent, then bridge the customer through Exotel"
              >
                <div className="w-9 h-9 rounded-md bg-orange-600 flex items-center justify-center shrink-0">
                  <Phone size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-orange-700 transition-colors">Agent Call Dispatch</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Ring agent, then customer</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-orange-300 hover:shadow-md hover:shadow-orange-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'exotel_call');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddExotelCallAction}
                title="Initiate an outbound VoIP call via Exotel"
              >
                <div className="w-9 h-9 rounded-md bg-orange-500 flex items-center justify-center shrink-0">
                  <Phone size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-orange-700 transition-colors">Exotel Call</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Initiate VoIP call</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-red-300 hover:shadow-md hover:shadow-red-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'twilio_sms');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddTwilioSmsAction}
                title="Send an SMS via Twilio"
              >
                <div className="w-9 h-9 rounded-md bg-red-500 flex items-center justify-center shrink-0">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-red-700 transition-colors">Twilio SMS</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Send SMS message</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-red-300 hover:shadow-md hover:shadow-red-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'twilio_call');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddTwilioCallAction}
                title="Make an outbound voice call via Twilio"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100/50 group-hover:bg-red-500 group-hover:border-red-500 flex items-center justify-center shrink-0 transition-colors">
                  <Phone size={18} className="text-red-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-red-700 transition-colors">Twilio Call</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Outbound voice call</div>
                </div>
              </div>
            )}

            {/* Internal Alert action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-orange-300 hover:shadow-md hover:shadow-orange-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'notification');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddNotificationAction}
                title="Send an internal alert to agents when this point is reached"
              >
                <div className="w-9 h-9 rounded-md bg-orange-500 flex items-center justify-center shrink-0">
                  <Bell size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-orange-700 transition-colors">Internal Alert</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Notify your team</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-orange-300 hover:shadow-md hover:shadow-orange-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'action');
                  e.dataTransfer.setData('application/actiontype', 'assign_agent');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'assign_agent')}
                title="Assign conversation to an agent (Round Robin or Direct)"
              >
                <div className="w-9 h-9 rounded-md bg-orange-500 flex items-center justify-center shrink-0">
                  <UserCheck size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-orange-700 transition-colors">Assign Agent</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Route to team member</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-orange-300 hover:shadow-md hover:shadow-orange-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'action');
                  e.dataTransfer.setData('application/actiontype', 'assign_agent_xolox');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'assign_agent_xolox')}
                title="Assign agent using the response from a previous XOLOX event"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100/50 group-hover:bg-orange-500 group-hover:border-orange-500 flex items-center justify-center shrink-0 transition-colors">
                  <Globe size={18} className="text-orange-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-orange-700 transition-colors">Assign from XOLOX</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Dynamic assignment</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-orange-300 hover:shadow-md hover:shadow-orange-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'delay');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('delay')}
                title="Wait before executing the next node"
              >
                <div className="w-9 h-9 rounded-md bg-orange-500 flex items-center justify-center shrink-0">
                  <Clock size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-orange-700 transition-colors">Time Delay</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Run next step later</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow-md hover:shadow-blue-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'user_replied');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('user_replied')}
                title="Wait for contact to reply before continuing; branches on reply/timeout"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/50 group-hover:bg-blue-500 group-hover:border-blue-500 flex items-center justify-center shrink-0 transition-colors">
                  <UserCheck size={18} className="text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-blue-700 transition-colors">User Replied?</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Wait for engagement</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-slate-300 hover:shadow-md hover:shadow-slate-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'end');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('end')}
                title="Terminate the workflow here"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100/50 group-hover:bg-slate-500 group-hover:border-slate-500 flex items-center justify-center shrink-0 transition-colors">
                  <StopCircle size={18} className="text-slate-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-slate-700 transition-colors">End Flow</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Stop execution</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-cyan-300 hover:shadow-md hover:shadow-cyan-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'action');
                  e.dataTransfer.setData('application/actiontype', 'update_chat_status');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'update_chat_status')}
                title="Change conversation status (open / snoozed / closed)"
              >
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-100/50 group-hover:bg-cyan-500 group-hover:border-cyan-500 flex items-center justify-center shrink-0 transition-colors">
                  <MessageCircle size={18} className="text-cyan-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-cyan-700 transition-colors">Update Chat Status</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Open / Snooze / Close</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'action');
                  e.dataTransfer.setData('application/actiontype', 'add_to_label');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'add_to_label')}
                title="Add contact to a label (group)"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100/50 group-hover:bg-emerald-500 group-hover:border-emerald-500 flex items-center justify-center shrink-0 transition-colors">
                  <Tag size={18} className="text-emerald-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">Add To Label</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Select group</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-violet-300 hover:shadow-md hover:shadow-violet-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'attribute_condition');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('attribute_condition')}
                title="Route based on contact attributes with AND/OR groups"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100/50 group-hover:bg-violet-500 group-hover:border-violet-500 flex items-center justify-center shrink-0 transition-colors">
                  <GitBranch size={18} className="text-violet-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-violet-700 transition-colors">Custom Attributes</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Multi-branch with default</div>
                </div>
              </div>
            )}

            {/* Zoom Integration */}
            {viewMode === 'canvas' && (
              <div className="pt-4 pb-1">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] px-1">Zoom Integration</h3>
              </div>
            )}
             {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-all shadow-sm"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'zoom_fetch');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddZoomFetchAction}
                title="Fetch webinar list from Zoom"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100/50 group-hover:bg-blue-500 group-hover:border-blue-500 flex items-center justify-center shrink-0 transition-colors">
                  <Video size={18} className="text-blue-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-blue-700 transition-colors">Fetch Zoom Webinars</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Get webinar details</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-indigo-50 border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-all shadow-sm mt-3"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'zoom_match');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddZoomMatchAction}
                title="Pick the best future webinar"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100/50 group-hover:bg-indigo-500 group-hover:border-indigo-500 flex items-center justify-center shrink-0 transition-colors">
                  <Search size={18} className="text-indigo-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Zoom Smart Match</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Find by name & time</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-rose-50 border border-rose-200 cursor-pointer hover:bg-rose-100 transition-all shadow-sm mt-3"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'zoom_register');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddZoomRegisterAction}
                title="Auto-register attendee"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100/50 group-hover:bg-rose-500 group-hover:border-rose-500 flex items-center justify-center shrink-0 transition-colors">
                  <UserPlus size={18} className="text-rose-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-rose-700 transition-colors">Zoom Auto-Register</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Generate personal link</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-amber-50 border border-amber-200 cursor-pointer hover:bg-amber-100 transition-all shadow-sm mt-3"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'relative_delay');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddRelativeDelayAction}
                title="Delay relative to a webinar time"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100/50 group-hover:bg-amber-500 group-hover:border-amber-500 flex items-center justify-center shrink-0 transition-colors">
                  <CalendarClock size={18} className="text-amber-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-amber-700 transition-colors">Relative Delay</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Wait relative to time</div>
                </div>
              </div>
            )}

            {/* Loop node */}
            {viewMode === 'canvas' && (
              <div className="pt-4 pb-1">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] px-1">Advanced logic</h3>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-violet-300 hover:shadow-md hover:shadow-violet-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'condition');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('condition')}
                title="Branch the workflow based on a condition"
              >
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-100/50 group-hover:bg-violet-500 group-hover:border-violet-500 flex items-center justify-center shrink-0 transition-colors">
                  <GitBranch size={18} className="text-violet-600 group-hover:text-white transition-colors" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-violet-700 transition-colors">Logic Split</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Condition branch</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/5 transition-all group"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/reactflow', 'loop');
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddLoopAction}
                title="Iterate over a list of items"
              >
                <div className="w-9 h-9 rounded-md bg-indigo-500 flex items-center justify-center shrink-0">
                  <Repeat size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Loop / Each</div>
                  <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Iterate over array</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 h-full relative bg-white overflow-hidden" ref={reactFlowWrapper}>
          {viewMode === 'canvas' ? (
            <ReactFlowProvider>
              <ReactFlow
                nodes={canvasNodes}
                edges={edges}
                onNodesChange={customOnNodesChange}
                  onNodeDragStart={onNodeDragStart}
                onEdgesChange={customOnEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={{ type: 'plus' }}
                isValidConnection={isValidConnection}
                fitView
                // Enable panning with left-click (standard builder behavior)
                panOnDrag={true}
                // Allow box selection only when holding the Shift key
                selectionOnDrag={false}
                selectionKeyCode="Shift"
                // Massive zoom range for "unlimited" feel
                minZoom={0.05}
                maxZoom={4}
                // Explicitly allow infinite panning in all directions
                translateExtent={[[-Infinity, -Infinity], [Infinity, Infinity]]}
                nodeExtent={[[-Infinity, -Infinity], [Infinity, Infinity]]}
                // Modern UX: pan by scrolling the mouse wheel
                panOnScroll={true}
                selectionMode="partial"
              >
                <Panel position="top-left" className="!m-5">
                  <div className="rounded-xl bg-white/90 backdrop-blur border border-slate-200 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                      <WorkflowIcon size={14} className="text-purple-600" />
                      Canvas Workspace
                    </div>
                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Click a node to configure it on the right.</p>
                  </div>
                </Panel>
                <Background variant={BackgroundVariant.Dots} color="#d8d3e8" gap={18} size={1.05} />
                
                {/* --- INLINE NODE SELECTOR MENU --- */}
                {inlineMenuOpen && (
                  <div
                    className="inline-node-menu absolute z-50 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-2xl w-64 max-h-[300px] overflow-y-auto flex flex-col p-2"
                    style={{
                      left: Math.min(inlineMenuPosition.x, window.innerWidth - 280),
                      top: Math.min(inlineMenuPosition.y, window.innerHeight - 320)
                    }}
                  >
                    <div className="text-[10px] font-black uppercase text-slate-400 mb-2 px-2 pt-1 tracking-wider">Insert Node</div>
                    
                    <div className="grid grid-cols-1 gap-1">
                      <button onClick={() => handleInlineNodeAdd('send_message')} className="flex items-center gap-3 p-2 hover:bg-teal-50 rounded-xl transition-all text-left">
                        <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center shrink-0 shadow-sm"><MessageCircle size={14} className="text-white" /></div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Send Message</div>
                          <div className="text-[9px] text-slate-500">Plain text message</div>
                        </div>
                      </button>
                      <button onClick={() => handleInlineNodeAdd('template')} className="flex items-center gap-3 p-2 hover:bg-green-50 rounded-xl transition-all text-left">
                        <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center shrink-0 shadow-sm"><MessageSquare size={14} className="text-white" /></div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Send Template</div>
                          <div className="text-[9px] text-slate-500">Approved media template</div>
                        </div>
                      </button>
                      <button onClick={() => handleInlineNodeAdd('delay')} className="flex items-center gap-3 p-2 hover:bg-orange-50 rounded-xl transition-all text-left">
                        <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shrink-0 shadow-sm"><Clock size={14} className="text-white" /></div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Time Delay</div>
                          <div className="text-[9px] text-slate-500">Pause workflow execution</div>
                        </div>
                      </button>
                      <button onClick={() => handleInlineNodeAdd('condition')} className="flex items-center gap-3 p-2 hover:bg-blue-50 rounded-xl transition-all text-left">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-sm"><GitBranch size={14} className="text-white" /></div>
                        <div>
                          <div className="text-xs font-bold text-slate-800">Condition</div>
                          <div className="text-[9px] text-slate-500">Yes/No branching logic</div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
                
                <Controls />
                <MiniMap />
              </ReactFlow>
            </ReactFlowProvider>
          ) : (
            <div className="h-full overflow-y-auto p-6 bg-gradient-to-br from-white to-purple-50/40">
              {sortedNodes.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="rounded-[24px] border border-dashed border-purple-200 bg-white p-10 text-center shadow-sm">
                    <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                      <WorkflowIcon size={24} />
                    </div>
                    <div className="text-sm font-bold text-slate-800">No nodes added yet</div>
                    <p className="text-xs text-slate-500 mt-1">Drag blocks from the left to build your workflow.</p>
                  </div>
                </div>
              ) : (
                <ol className="space-y-2">
                  {sortedNodes.map((node) => {
                    const isMessageNode = node.type === 'send_template' || node.type === 'send_message';
                    const isExpanded = expandedNodeId === node.id;
                    if (isMessageNode) {
                      const title =
                        node.type === 'send_template'
                          ? node.data?.template || node.data?.label || 'Untitled Message'
                          : node.data?.label || node.data?.message || 'Untitled Message';
                      const scheduleSummary = getScheduleSummary(node.data || {});
                      return (
                        <li
                          key={node.id}
                          draggable
                          onDragStart={(event) => handleListItemDragStart(event, node.id)}
                          onDragOver={handleListItemDragOver}
                          onDrop={(event) => handleListItemDrop(event, node.id)}
                          onDragEnd={handleListItemDragEnd}
                          onClick={() => {
                            setSelectedNode(node);
                            setExpandedNodeId((prev) => (prev === node.id ? null : node.id));
                          }}
                          className={`rounded-2xl border px-4 py-3 text-sm bg-white shadow-sm transition-all ${selectedNode && selectedNode.id === node.id ? 'border-purple-400 bg-purple-50 shadow-purple-500/10' : 'border-slate-200 hover:border-purple-200 hover:shadow-md'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 cursor-move">⋮⋮</span>
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-800">{title}</span>
                                <span className="text-[11px] text-slate-500">{scheduleSummary}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <button
                                type="button"
                                className="text-slate-500 hover:text-slate-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedNodeId((prev) => (prev === node.id ? null : node.id));
                                  setSelectedNode(node);
                                }}
                              >
                                {isExpanded ? 'Hide' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                className="text-red-500 hover:text-red-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNodes((nds) => nds.filter((n) => n.id !== node.id));
                                  if (selectedNode && selectedNode.id === node.id) {
                                    setSelectedNode(null);
                                  }
                                  if (expandedNodeId === node.id) {
                                    setExpandedNodeId(null);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Message Name</label>
                                <input
                                  className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                  value={node.data?.label || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    updateNodeFields(node.id, { label: value });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Schedule</label>
                                <div
                                  className="flex flex-wrap gap-3 text-xs text-slate-700"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`schedule-${node.id}`}
                                      checked={(node.data?.scheduleType || 'immediate') === 'immediate'}
                                      onChange={() =>
                                        updateNodeFields(node.id, {
                                          scheduleType: 'immediate',
                                        })
                                      }
                                    />
                                    <span>Immediate</span>
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`schedule-${node.id}`}
                                      checked={node.data?.scheduleType === 'specific_time'}
                                      onChange={() =>
                                        updateNodeFields(node.id, {
                                          scheduleType: 'specific_time',
                                        })
                                      }
                                    />
                                    <span>Specific time</span>
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`schedule-${node.id}`}
                                      checked={node.data?.scheduleType === 'delay'}
                                      onChange={() =>
                                        updateNodeFields(node.id, {
                                          scheduleType: 'delay',
                                        })
                                      }
                                    />
                                    <span>After X minutes/hours/days</span>
                                  </label>
                                </div>
                                {node.data?.scheduleType === 'delay' && (
                                  <div
                                    className="flex items-center gap-2 mt-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="number"
                                      className="w-20 border border-slate-300 rounded-md p-2 text-sm"
                                      value={node.data?.delayValue ?? ''}
                                      onChange={(e) =>
                                        updateNodeFields(node.id, {
                                          delayValue: e.target.value ? parseInt(e.target.value, 10) : '',
                                        })
                                      }
                                    />
                                    <select
                                      className="flex-1 border border-slate-300 rounded-md p-2 text-sm"
                                      value={node.data?.delayUnit || 'minutes'}
                                      onChange={(e) =>
                                        updateNodeFields(node.id, {
                                          delayUnit: e.target.value,
                                        })
                                      }
                                    >
                                      <option value="minutes">Minutes</option>
                                      <option value="hours">Hours</option>
                                      <option value="days">Days</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                              {node.type === 'send_message' && (
                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Content</label>
                                  <textarea
                                    className="w-full border border-slate-300 rounded-md p-2 text-sm min-h-[120px]"
                                    placeholder="Enter message content..."
                                    value={node.data?.message || ''}
                                    onChange={(e) =>
                                      updateNodeFields(node.id, {
                                        message: e.target.value,
                                      })
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    }
                    if (node.type === 'condition') {
                      const title = node.data?.label || 'Condition';
                      const desc = node.data?.condition || 'Configure condition';

                      const branchChildren = {};
                      sortedNodes.forEach((n) => {
                        const data = n.data || {};
                        if (data.branchConditionId === node.id && (data.branchSide === 'yes' || data.branchSide === 'no')) {
                          if (!branchChildren[data.branchSide]) branchChildren[data.branchSide] = [];
                          branchChildren[data.branchSide].push(n);
                        }
                      });

                      const yesChildren = (branchChildren.yes || []).sort((a, b) => {
                        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
                        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
                        return ay - by;
                      });

                      const noChildren = (branchChildren.no || []).sort((a, b) => {
                        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
                        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
                        return ay - by;
                      });

                      const isYesActive =
                        branchTarget && branchTarget.conditionId === node.id && branchTarget.side === 'yes';
                      const isNoActive =
                        branchTarget && branchTarget.conditionId === node.id && branchTarget.side === 'no';

                      return (
                        <li
                          key={node.id}
                          draggable
                          onDragStart={(event) => handleListItemDragStart(event, node.id)}
                          onDragOver={handleListItemDragOver}
                          onDrop={(event) => handleListItemDrop(event, node.id)}
                          onDragEnd={handleListItemDragEnd}
                          onClick={() => setSelectedNode(node)}
                          className={`rounded-2xl border px-4 py-3 text-sm bg-white shadow-sm transition-all ${selectedNode && selectedNode.id === node.id ? 'border-purple-400 bg-purple-50 shadow-purple-500/10' : 'border-slate-200 hover:border-purple-200 hover:shadow-md'
                            }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-slate-400 cursor-move">⋮⋮</span>
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-800">{title}</span>
                              <span className="text-[11px] text-slate-500">{desc}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 text-[11px] text-slate-600 border rounded overflow-hidden">
                            <button
                              type="button"
                              className={`py-1 text-center font-semibold ${isYesActive ? 'text-white bg-green-500' : 'text-green-600 bg-green-50'
                                }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'yes' });
                              }}
                            >
                              YES
                            </button>
                            <button
                              type="button"
                              className={`py-1 text-center font-semibold border-l border-slate-200 ${isNoActive ? 'text-white bg-red-500' : 'text-red-600 bg-red-50'
                                }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'no' });
                              }}
                            >
                              NO
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <button
                              type="button"
                              className="py-1 text-center rounded border border-dashed border-green-300 text-green-700 hover:bg-green-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'yes' });
                                setVoiceContext({ mode: 'branch', conditionId: node.id, side: 'yes' });
                                setIsVoiceModalOpen(true);
                              }}
                            >
                              Add YES flow using voice
                            </button>
                            <button
                              type="button"
                              className="py-1 text-center rounded border border-dashed border-red-300 text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'no' });
                                setVoiceContext({ mode: 'branch', conditionId: node.id, side: 'no' });
                                setIsVoiceModalOpen(true);
                              }}
                            >
                              Add NO flow using voice
                            </button>
                          </div>
                          {(yesChildren.length > 0 || noChildren.length > 0) && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                {yesChildren.map((child) => (
                                  <div
                                    key={child.id}
                                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px]"
                                  >
                                    <div className="font-medium text-slate-800 truncate">
                                      {child.data?.label ||
                                        child.data?.template ||
                                        child.data?.message ||
                                        'Step'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="space-y-1 border-l border-dashed border-slate-200 pl-2">
                                {noChildren.map((child) => (
                                  <div
                                    key={child.id}
                                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px]"
                                  >
                                    <div className="font-medium text-slate-800 truncate">
                                      {child.data?.label ||
                                        child.data?.template ||
                                        child.data?.message ||
                                        'Step'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    }
                    return (
                      <li
                        key={node.id}
                        draggable
                        onDragStart={(event) => handleListItemDragStart(event, node.id)}
                        onDragOver={handleListItemDragOver}
                        onDrop={(event) => handleListItemDrop(event, node.id)}
                        onDragEnd={handleListItemDragEnd}
                        onClick={() => setSelectedNode(node)}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm cursor-move bg-white shadow-sm transition-all ${selectedNode && selectedNode.id === node.id ? 'border-purple-400 bg-purple-50 shadow-purple-500/10' : 'border-slate-200 hover:border-purple-200 hover:shadow-md'
                          }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">{node.type}</span>
                          <span className="text-slate-800">
                            {(node.data &&
                              (node.data.label ||
                                node.data.template ||
                                node.data.message ||
                                node.data.condition ||
                                node.data.actionType)) ||
                              'Untitled'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">Drag to reorder</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar - Config */}
        {selectedNode && (
          <div className="w-[400px] bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto shadow-xl shadow-slate-950/5">
            <div className="p-5 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <Settings size={18} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-950 tracking-tight">Configuration</h2>
                  <div className="text-[11px] text-slate-500 mt-1">ID: {selectedNode.id}</div>
                  <div className="text-[11px] text-slate-500">Type: {selectedNode.type}</div>
                </div>
              </div>
            </div>

            {selectedNode?.data?.nodeError && (
              <div className="px-4 pt-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-red-700 mb-1">Node Error</div>
                  <div className="text-xs text-red-700 whitespace-pre-wrap break-words">
                    {selectedNode.data.nodeError}
                  </div>
                </div>
              </div>
            )}

            {selectedNode?.data?.lastContextPreview && (
              <div className="px-4 pt-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1">Data In This Step</div>
                  <pre className="text-[10px] text-slate-600 whitespace-pre-wrap break-words leading-relaxed">
                    {JSON.stringify(selectedNode.data.lastContextPreview, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="p-4 space-y-6">
              {/* Dynamic Config Forms based on Node Type */}
              {selectedNode.type === 'zoom_fetch' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Video size={14} className="text-blue-600" />
                      <span className="text-xs font-semibold text-blue-800">Zoom Webinar Fetch</span>
                    </div>
                    <p className="text-[11px] text-blue-600 leading-relaxed">
                      Fetches your upcoming webinars from Zoom and stores them in the <code className="bg-white border border-blue-200 rounded px-1">{"{{zoom_webinars}}"}</code> variable.
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                          <Video size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">Uses saved Zoom integration</div>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            Connect Zoom from Integrations once. Workflow nodes fetch webinars with that workspace credential set.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                       <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="w-full flex items-center justify-center gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                          disabled={isTestingZoom}
                          onClick={async () => {
                             setIsTestingZoom(true);
                             setZoomTestResult(null);
                             try {
                                const res = await testZoomConnection({});
                                setZoomTestResult(res);
                             } catch (err) {
                                setZoomTestResult({ success: false, error: err.message });
                             } finally {
                                setIsTestingZoom(false);
                             }
                          }}
                       >
                         {isTestingZoom ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                         Test & Preview Webinars
                       </Button>

                       {zoomTestResult && (
                          <div className={`mt-3 p-3 rounded-lg border text-[11px] ${zoomTestResult.success ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                             {zoomTestResult.success ? (
                                <div className="space-y-2">
                                   <div className="flex items-center gap-1.5 text-emerald-700 font-bold uppercase tracking-wider">
                                      <Check size={14} /> Found {zoomTestResult.count} Webinars
                                   </div>
                                   <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                                      {zoomTestResult.webinars.map((w, idx) => (
                                         <div key={idx} className="bg-white/80 border border-emerald-100/50 rounded p-1.5">
                                            <div className="font-bold text-emerald-800 truncate">{w.topic}</div>
                                            <div className="text-[9px] text-emerald-600 font-mono mt-0.5">{w.id} • {new Date(w.start_time).toLocaleString()}</div>
                                         </div>
                                      ))}
                                   </div>
                                </div>
                             ) : (
                                <div className="text-red-700 font-medium">
                                   Error: {zoomTestResult.error || 'Connection failed'}
                                </div>
                             )}
                          </div>
                       )}
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'zoom_match' && (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Search size={14} className="text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-800">Smart Selection</span>
                    </div>
                    <p className="text-[11px] text-indigo-600 leading-relaxed">
                      Finds the closest upcoming webinar matching a topic. It handles time-aware selection automatically. Result: <code className="bg-white border border-indigo-200 rounded px-1">{"{{matched_webinar}}"}</code>.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Webinars Array</label>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                         {getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables).filter(v => v.includes('zoom') || v.includes('webinars')).map(v => (
                            <button key={v} onClick={() => updateNodeData('itemsVariable', v.replace(/{{|}}/g, ''))} className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 rounded px-1.5 py-0.5 hover:bg-blue-100 transition-colors">
                               {v}
                            </button>
                         ))}
                      </div>
                      <input type="text" className="w-full border border-slate-300 rounded-md p-2 text-sm font-mono" placeholder="e.g. zoom_webinars" value={selectedNode.data.itemsVariable || 'zoom_webinars'} onChange={(e) => updateNodeData('itemsVariable', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Target Topic Name</label>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                         {getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables).filter(v => !v.includes('zoom_webinars')).map(v => (
                            <button key={v} onClick={() => updateNodeData('topicVariable', v)} className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100 transition-colors">
                               {v}
                            </button>
                         ))}
                      </div>
                      <input type="text" className="w-full border border-slate-300 rounded-md p-2 text-sm font-mono" placeholder="e.g. {{course_name}}" value={selectedNode.data.topicVariable || ''} onChange={(e) => updateNodeData('topicVariable', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'zoom_register' && (
                <div className="space-y-4">
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <UserPlus size={14} className="text-rose-600" />
                      <span className="text-xs font-semibold text-rose-800">Auto-Registration</span>
                    </div>
                    <p className="text-[11px] text-rose-600 leading-relaxed">
                      Registers the user and retrieves their unique link. Result stored in <code className="bg-white border border-rose-200 rounded px-1">{"{{zoom_registration}}"}</code>.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Webinar ID</label>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                         {getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables).filter(v => v.includes('id') || v.includes('matched')).map(v => (
                            <button key={v} onClick={() => updateNodeData('webinarIdVariable', v)} className="text-[9px] bg-rose-50 text-rose-600 border border-rose-100 rounded px-1.5 py-0.5 hover:bg-rose-100 transition-colors">
                               {v.includes('id') ? v : `${v}.id`}
                            </button>
                         ))}
                      </div>
                      <input type="text" className="w-full border border-slate-300 rounded-md p-2 text-sm font-mono" placeholder="{{matched_webinar.id}}" value={selectedNode.data.webinarIdVariable || ''} onChange={(e) => updateNodeData('webinarIdVariable', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Attendee Name</label>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                         {getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables).filter(v => v.includes('name')).map(v => (
                            <button key={v} onClick={() => updateNodeData('nameVariable', v)} className="text-[9px] bg-slate-50 text-slate-600 border border-slate-100 rounded px-1.5 py-0.5 hover:bg-slate-100 transition-colors">
                               {v}
                            </button>
                         ))}
                      </div>
                      <input type="text" className="w-full border border-slate-300 rounded-md p-2 text-sm font-mono" placeholder="{{contact_first_name}}" value={selectedNode.data.nameVariable || ''} onChange={(e) => updateNodeData('nameVariable', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Attendee Email</label>
                      <div className="flex flex-wrap gap-1 mb-1.5">
                         {getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables).filter(v => v.includes('email')).map(v => (
                            <button key={v} onClick={() => updateNodeData('emailVariable', v)} className="text-[9px] bg-blue-50 text-blue-600 border border-blue-100 rounded px-1.5 py-0.5 hover:bg-blue-100 transition-colors">
                               {v}
                            </button>
                         ))}
                      </div>
                      <input type="text" className="w-full border border-slate-300 rounded-md p-2 text-sm font-mono" placeholder="{{email}}" value={selectedNode.data.emailVariable || ''} onChange={(e) => updateNodeData('emailVariable', e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'loop' && (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Repeat size={14} className="text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-800">Loop Logic</span>
                    </div>
                    <p className="text-[11px] text-indigo-600 leading-relaxed">
                      Iterates over an array. Use the <b>EACH</b> branch for the loop body and <b>DONE</b> when complete. 
                      Current item is in <code className="bg-white border border-indigo-200 rounded px-1">{"{{loopItem}}"}</code>.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Array Variable Name</label>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-md p-2 text-sm font-mono"
                      placeholder="e.g. zoom_webinars"
                      value={selectedNode.data.itemsVariable || ''}
                      onChange={(e) => updateNodeData('itemsVariable', e.target.value)}
                    />
                  </div>

                  {selectedNode.data.itemsVariable === 'zoom_webinars' && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <div className="text-[11px] font-bold text-slate-600 uppercase tracking-tight mb-2 flex items-center gap-1.5">
                        <Info size={12} className="text-blue-500" />
                        Available Fields in {"{{loopItem}}"}
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px] text-slate-500 font-mono">
                         <div className="flex flex-col">
                            <span className="text-slate-700 font-bold">.id</span>
                            <span>Webinar ID</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-slate-700 font-bold">.topic</span>
                            <span>Webinar Name</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-slate-700 font-bold">.start_time</span>
                            <span>ISO Date/Time</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-slate-700 font-bold">.date</span>
                            <span>10 Apr 2026</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-slate-700 font-bold">.time</span>
                            <span>05:30 PM</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-slate-700 font-bold">.join_url</span>
                            <span>Personal Link</span>
                         </div>
                      </div>
                      <p className="mt-3 text-[10px] text-slate-400 italic leading-relaxed">
                        Use them like <code className="bg-white border text-blue-600 px-0.5 rounded">{"{{loopItem.topic}}"}</code> in templates or conditions.
                      </p>

                      <div className="mt-3">
                        <div className="text-[10px] text-slate-400 font-bold uppercase mb-1">Sample Item Object:</div>
                         <pre className="bg-slate-900 text-blue-300 p-2 rounded text-[9px] leading-tight overflow-x-auto">
{`{
  "id": "89211334455",
  "topic": "Live Webinar Title",
  "start_time": "2026-04-10T14:30:00Z",
  "date": "10 Apr 2026",
  "time": "05:30 PM",
  "join_url": "https://zoom.us/j/812..."
}`}
                         </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedNode.type === 'relative_delay' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-100 text-amber-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CalendarClock size={14} className="text-amber-600" />
                      <span className="text-xs font-semibold text-amber-800">Relative Delay</span>
                    </div>
                    <p className="text-[11px] text-amber-600 leading-relaxed">
                      Schedules the next step relative to a timestamp variable. 
                      If the target time is already in the past, it follows the <b>SKIP</b> branch.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference Time Variable</label>
                    <div className="flex flex-wrap gap-1 mb-2">
                       {getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables).filter(v => v.includes('time') || v.includes('loopItem')).map(v => (
                          <button 
                             key={v}
                             type="button"
                             onClick={() => updateNodeData('referenceVariable', v.replace(/{{|}}/g, ''))}
                             className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100 transition-colors"
                          >
                             {v}
                          </button>
                       ))}
                    </div>
                    <input
                      type="text"
                      className="w-full border border-slate-300 rounded-md p-2 text-sm font-mono"
                      placeholder="e.g. loopItem.start_time"
                      value={selectedNode.data.referenceVariable || ''}
                      onChange={(e) => updateNodeData('referenceVariable', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-500 mb-1">Offset Amount</label>
                      <input
                        type="number"
                        className="w-full border border-slate-300 rounded-md p-2 text-sm text-center"
                        value={selectedNode.data.offsetAmount || 0}
                        onChange={(e) => updateNodeData('offsetAmount', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                       <label className="block text-[11px] font-medium text-slate-500 mb-1">Unit</label>
                       <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.offsetUnit || 'minutes'}
                        onChange={(e) => updateNodeData('offsetUnit', e.target.value)}
                       >
                         <option value="minutes">Minutes</option>
                         <option value="hours">Hours</option>
                         <option value="days">Days</option>
                       </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Direction</label>
                    <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
                      <button
                        type="button"
                        onClick={() => updateNodeData('offsetDirection', 'before')}
                        className={`flex-1 py-1.5 font-medium transition-colors ${selectedNode.data.offsetDirection === 'before' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600'}`}
                      >
                        Before
                      </button>
                      <button
                        type="button"
                        onClick={() => updateNodeData('offsetDirection', 'after')}
                        className={`flex-1 py-1.5 font-medium transition-colors ${selectedNode.data.offsetDirection === 'after' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600'}`}
                      >
                        After
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {selectedNode.type === 'trigger' && (
                <div className="space-y-4">
                  <div className="space-y-2 mt-4">
                    <div className="bg-green-50 text-green-700 p-3 rounded-md text-xs border border-green-100 mb-2">
                      This workflow triggers when an incoming WhatsApp message contains any of the specified keywords.
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Target Channel</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.channelId || ''}
                        onChange={(e) => updateNodeData('channelId', e.target.value)}
                      >
                        <option value="">All Connected Channels</option>
                        {linkedPhones && linkedPhones.map((phone) => (
                          <option key={phone.id || phone.phone_number_id} value={phone.phone_number_id}>
                            {phone.display_phone_number || phone.phone_number_id} {phone.name ? `(${phone.name})` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Select a specific number, or leave as 'All Connected Channels' to run as a fallback.
                      </p>
                    </div>

                    <label className="block text-sm font-medium text-slate-700">Keywords (comma separated)</label>
                    <textarea
                      className="w-full border border-slate-300 rounded-md p-2 text-sm min-h-[80px]"
                      placeholder="e.g. cpa us, tax help, support"
                      value={selectedNode.data.keywords || ''}
                      onChange={(e) => {
                        updateNodeData('keywords', e.target.value);
                        updateNodeData('triggerType', 'incoming_whatsapp');
                      }}
                    />
                    <p className="text-[10px] text-slate-500">
                      Leave blank to trigger on *any* incoming WhatsApp message.
                    </p>
                  </div>
                </div>
              )}

              {selectedNode.type === 'campaign_trigger' && (
                <div className="space-y-4">
                  <div className="bg-purple-50 border border-purple-100 text-purple-700 rounded-md p-3 text-xs">
                    This workflow triggers after a campaign message is sent to a contact.
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <label className="block text-sm font-medium text-slate-700">Select Campaign</label>
                      <button
                        type="button"
                        onClick={reloadCampaigns}
                        disabled={loadingCampaigns}
                        className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <RefreshCw size={13} className={loadingCampaigns ? 'animate-spin' : ''} />
                        Refresh
                      </button>
                    </div>
                    <select
                      className="w-full border border-slate-300 rounded-md p-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50"
                      value={selectedNode.data.campaignId || ''}
                      disabled={loadingCampaigns}
                      onChange={e => {
                        const camp = availableCampaigns.find(c => String(c.id) === String(e.target.value));
                        updateNodeFields(selectedNode.id, {
                          campaignId: e.target.value,
                          campaignName: camp?.name || camp?.title || '',
                          triggerType: 'campaign_sent',
                        });
                      }}
                    >
                      <option value="">— Select a campaign —</option>
                      {!!selectedNode.data.campaignId && !availableCampaigns.some(c => String(c.id) === String(selectedNode.data.campaignId)) && (
                        <option value={selectedNode.data.campaignId}>
                          {selectedNode.data.campaignName || 'Previously selected campaign (unavailable)'}
                        </option>
                      )}
                      {availableCampaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name || c.title || `Campaign ${c.id}`}</option>
                      ))}
                    </select>
                    {campaignLoadError && (
                      <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                        <span>{campaignLoadError}</span>
                        <button type="button" onClick={reloadCampaigns} className="shrink-0 font-semibold underline">Retry</button>
                      </div>
                    )}
                    {!loadingCampaigns && !campaignLoadError && availableCampaigns.length === 0 && (
                      <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                        No campaigns found. Create or sync campaigns first, then reopen this node.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedNode.type === 'customer_message_trigger' && (
                <div className="space-y-4">
                  <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700">
                    This workflow runs when a customer sends an inbound WhatsApp message and the lead is in the Kanban stage where this workflow is placed.
                  </div>
                  <p className="text-xs leading-5 text-slate-500">
                    Move the workflow into the required stage in Workflow Kanban, then publish it. The lead stage is resolved securely on the backend from the incoming message.
                  </p>
                  
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Channel</label>
                    <select
                      className="w-full border border-slate-300 rounded-md p-2 text-sm"
                      value={selectedNode.data.channelId || ''}
                      onChange={(e) => updateNodeFields(selectedNode.id, { channelId: e.target.value })}
                    >
                      <option value="">All Connected Channels</option>
                      {linkedPhones && linkedPhones.map((phone) => (
                        <option key={phone.id || phone.phone_number_id} value={phone.phone_number_id}>
                          {phone.display_phone_number || phone.phone_number_id} {phone.name ? `(${phone.name})` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1 mb-4">
                      Select a specific number, or leave as 'All Connected Channels' to run as a fallback.
                    </p>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-4">
                    <label className="flex items-start gap-3 cursor-pointer group p-2 -mx-2 rounded hover:bg-slate-50 transition-colors">
                      <div className="flex h-5 items-center">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.apply24hGreetingLock || false}
                          onChange={(e) => updateNodeFields(selectedNode.id, { apply24hGreetingLock: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 transition-colors cursor-pointer"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-700">Apply 24-hour greeting lock</span>
                        <span className="text-xs text-slate-500 mt-1">
                          If enabled, this generic workflow will NOT run if the contact has already received another generic greeting from your workspace in the last 24 hours. (Prevents spam across different numbers).
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {selectedNode.type === 'incoming_webhook' && (
                <WebhookNodeConfig
                  node={selectedNode}
                  workflowId={initialWorkflow?.id || null}
                  updateNodeFields={updateNodeFields}
                />
              )}

              {selectedNode.type === 'lead_stage_updated_webhook' && (
                <LeadStageUpdatedWebhookConfig workflowId={initialWorkflow?.id || null} />
              )}

              {selectedNode.type === 'set_variable' && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-teal-100 bg-teal-50 p-3 text-xs leading-relaxed text-teal-800">
                    This imported variable step is preserved exactly. Configure a source value and a fallback/target value for later workflow nodes.
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Source path</label>
                    <input className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={selectedNode.data.sourcePath || ''} onChange={(event) => updateNodeFields(selectedNode.id, { sourcePath: event.target.value })} placeholder="lead.course" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Fallback value</label>
                    <input className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={selectedNode.data.fallbackValue || ''} onChange={(event) => updateNodeFields(selectedNode.id, { fallbackValue: event.target.value })} placeholder="Course enquiry" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700">Write to path <span className="font-normal text-slate-400">(optional)</span></label>
                    <input className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={selectedNode.data.targetPath || ''} onChange={(event) => updateNodeFields(selectedNode.id, { targetPath: event.target.value })} placeholder="Defaults to source path" />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input type="checkbox" checked={Boolean(selectedNode.data.alwaysOverride)} onChange={(event) => updateNodeFields(selectedNode.id, { alwaysOverride: event.target.checked })} />
                    Always overwrite the source value
                  </label>
                </div>
              )}

              {selectedNode.type === 'new_contact' && (() => {
                const fieldMapping = selectedNode.data.fieldMapping || {};
                return (
                  <div className="space-y-5">
                    {/* Info banner */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <UserCheck size={14} className="text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-800">New Contact Created Trigger</span>
                      </div>
                      <p className="text-[11px] text-emerald-600 leading-relaxed">
                        This workflow fires automatically whenever a new contact is created.
                        The fields below are pre-mapped and available as <code className="bg-white border border-emerald-200 rounded px-1">{'{{'}<em>variable</em>{'}}'}</code> in all subsequent nodes.
                      </p>
                    </div>

                    {/* Field Mapping */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Field Mapping</label>
                      <p className="text-[10px] text-slate-400 mb-3">
                        Each contact field is mapped to a variable name. Rename any variable — it will be available as <code className="bg-slate-100 px-1 rounded">{'{{'}<em>variable</em>{'}}'}</code> in later steps.
                      </p>
                      <div className="space-y-2">
                        {NEW_CONTACT_FIELDS.map(field => (
                          <div key={field.key} className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-mono text-slate-600 truncate">
                              {field.label}
                            </div>
                            <span className="text-slate-400 text-xs shrink-0">→</span>
                            <input
                              type="text"
                              className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
                              placeholder={field.defaultVar}
                              value={fieldMapping[field.key] || ''}
                              onChange={e => {
                                const next = { ...fieldMapping, [field.key]: e.target.value };
                                updateNodeFields(selectedNode.id, { fieldMapping: next });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Usage guide */}
                    {Object.keys(fieldMapping).length > 0 && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 space-y-1">
                        <div className="text-xs font-semibold text-emerald-800 mb-1.5">How to use in later nodes</div>
                        {NEW_CONTACT_FIELDS.filter(f => fieldMapping[f.key]).map(f => (
                          <div key={f.key} className="flex items-center gap-2 text-[11px]">
                            <code className="bg-white border border-emerald-200 rounded px-1.5 py-0.5 text-emerald-700 font-mono">{`{{${fieldMapping[f.key]}}}`}</code>
                            <span className="text-slate-400">← contact.{f.key.replace('contact_', '')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedNode.type === 'xolox_event' && (() => {
                const d = selectedNode.data;
                const payloadFields = Array.isArray(d.payloadFields) ? d.payloadFields : [];

                const updateField = (idx, key, val) => {
                  const next = payloadFields.map((f, i) => i === idx ? { ...f, [key]: val } : f);
                  updateNodeFields(selectedNode.id, { payloadFields: next });
                };
                const addField = () => {
                  updateNodeFields(selectedNode.id, { payloadFields: [...payloadFields, { field: '', variable: '' }] });
                };
                const removeField = (idx) => {
                  updateNodeFields(selectedNode.id, { payloadFields: payloadFields.filter((_, i) => i !== idx) });
                };

                return (
                  <div className="space-y-5">

                    {/* Banner */}
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Globe size={14} className="text-orange-600" />
                        <span className="text-xs font-semibold text-orange-800">XOLOX CRM Event</span>
                      </div>
                      <p className="text-[11px] text-orange-600 leading-relaxed">
                        Paste the webhook URL from <strong>xolox.io</strong>, define the fields XOLOX expects, map each to a <code className="bg-white border border-orange-200 rounded px-1">{'{{variable}}'}</code> from earlier nodes, then connect <span className="text-green-600 font-semibold">SUCCESS</span> and <span className="text-red-500 font-semibold">FAIL</span> branches.
                      </p>
                    </div>

                    {/* Event name */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Event Name <span className="text-slate-400 text-[10px] font-normal">(label only)</span></label>
                      <input
                        type="text"
                        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        placeholder="e.g. Lead Create, Contact Update"
                        value={d.eventName || ''}
                        onChange={e => updateNodeFields(selectedNode.id, { eventName: e.target.value })}
                      />
                    </div>

                    {/* Webhook URL */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">XOLOX Webhook URL</label>
                      <input
                        type="url"
                        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-300"
                        placeholder="https://xolox.io/webhooks/…"
                        value={d.webhookUrl || ''}
                        onChange={e => updateNodeFields(selectedNode.id, { webhookUrl: e.target.value })}
                      />
                    </div>

                    {/* HTTP Method */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">HTTP Method</label>
                      <select
                        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        value={d.method || 'POST'}
                        onChange={e => updateNodeFields(selectedNode.id, { method: e.target.value })}
                      >
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="GET">GET</option>
                      </select>
                    </div>

                    {/* Payload Fields */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-700">Request Payload Fields</label>
                        <button
                          type="button"
                          onClick={addField}
                          className="flex items-center gap-1 text-[11px] text-orange-600 hover:text-orange-800 border border-orange-200 rounded px-2 py-0.5 hover:bg-orange-50 transition-colors"
                        >
                          <Plus size={11} /> Add Field
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mb-2">
                        Left = field key XOLOX expects &nbsp;·&nbsp; Right = <code className="bg-slate-100 px-0.5 rounded">{'{{variable}}'}</code> from previous nodes
                      </p>
                      {payloadFields.length === 0 && (
                        <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center text-[11px] text-slate-400">
                          No fields yet — click <strong>Add Field</strong> to define the payload
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {payloadFields.map((f, idx) => (
                          <div key={idx} className={`flex items-center gap-1 min-w-0 rounded p-0.5 transition-colors ${focusedVarIdx === idx ? 'bg-orange-50 ring-1 ring-orange-200' : ''}`}>
                            <input
                              type="text"
                              className="w-[90px] min-w-0 shrink-0 border border-slate-300 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-300"
                              placeholder="key"
                              value={f.field}
                              onChange={e => updateField(idx, 'field', e.target.value)}
                            />
                            <span className="text-slate-400 text-[10px] shrink-0">→</span>
                            <input
                              type="text"
                              className={`flex-1 min-w-0 border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-300 transition-colors ${focusedVarIdx === idx ? 'border-orange-400 bg-orange-50' : 'border-slate-300'}`}
                              placeholder="{{variable}}"
                              value={f.variable}
                              onChange={e => updateField(idx, 'variable', e.target.value)}
                              onFocus={() => setFocusedVarIdx(idx)}
                              onBlur={() => { setTimeout(() => setFocusedVarIdx(null), 200); }}
                            />
                            <button
                              type="button"
                              onClick={() => removeField(idx)}
                              className="shrink-0 p-0.5 text-red-400 hover:text-red-600 transition-colors"
                              title="Remove field"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Available variables hint — dynamically computed from upstream nodes */}
                    {(() => {
                      // Walk backward through edges to find all variables exposed by upstream nodes
                      const upstreamVars = getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables);

                      return (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="text-[11px] font-semibold text-slate-600">Variables from upstream nodes</div>
                              <span className="text-[10px] font-normal text-slate-400">({upstreamVars.length} found)</span>
                              <button 
                                type="button" 
                                onClick={() => {
                                  // This forces a re-render which re-calculates getUpstreamVariables
                                  setRefreshKey(prev => prev + 1);
                                }}
                                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors group"
                                title="Refresh variables from top"
                              >
                                <RefreshCw size={10} className="group-hover:rotate-180 transition-transform duration-500" />
                              </button>
                            </div>
                            {focusedVarIdx !== null && (
                              <span className="text-[10px] text-orange-500 font-medium">
                                → clicking inserts into field #{focusedVarIdx + 1}
                              </span>
                            )}
                          </div>
                          {upstreamVars.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic">
                              No upstream nodes with mapped variables found. Connect a <strong>New Contact Created</strong> or <strong>Incoming Webhook</strong> trigger above this node.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {upstreamVars.map(v => (
                                <code
                                  key={v}
                                  className={`text-[10px] rounded px-1.5 py-0.5 cursor-pointer transition-colors font-mono select-none
                                    ${focusedVarIdx !== null
                                      ? 'bg-orange-50 border border-orange-300 text-orange-700 hover:bg-orange-100'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-700'
                                    }`}
                                  title={focusedVarIdx !== null ? `Insert ${v} into field #${focusedVarIdx + 1}` : 'Focus a variable field first, then click to insert'}
                                  onClick={() => {
                                    if (focusedVarIdx !== null) {
                                      // Insert into the focused right-side variable input
                                      updateField(focusedVarIdx, 'variable', v);
                                    } else {
                                      // No field focused — copy to clipboard as fallback
                                      navigator.clipboard?.writeText(v);
                                    }
                                  }}
                                >{v}</code>
                              ))}
                            </div>
                          )}
                          <p className="text-[9px] text-slate-400 mt-1.5">
                            {focusedVarIdx !== null
                              ? `Click a variable to insert it into the field #${focusedVarIdx + 1} variable input`
                              : 'Click any variable field on the right → then click a chip to insert it there'}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Divider */}
                    <div className="border-t border-slate-100" />

                    {/* Success condition */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Success Condition</label>
                      <p className="text-[10px] text-slate-400 mb-2">Determines which branch (SUCCESS / FAIL) to take after the call</p>
                      <select
                        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        value={d.successCondition || 'status_2xx'}
                        onChange={e => updateNodeFields(selectedNode.id, { successCondition: e.target.value })}
                      >
                        <option value="status_2xx">HTTP 2xx status = SUCCESS</option>
                        <option value="field_true">Response JSON field equals value</option>
                      </select>

                      {d.successCondition === 'field_true' && (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-300"
                              placeholder="response field e.g. success"
                              value={d.successField || ''}
                              onChange={e => updateNodeFields(selectedNode.id, { successField: e.target.value })}
                            />
                            <span className="text-slate-400 text-xs self-center">=</span>
                            <input
                              type="text"
                              className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-300"
                              placeholder="true"
                              value={d.successValue || ''}
                              onChange={e => updateNodeFields(selectedNode.id, { successValue: e.target.value })}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400">e.g. field <code className="bg-slate-100 px-0.5 rounded">success</code> = <code className="bg-slate-100 px-0.5 rounded">true</code></p>
                        </div>
                      )}
                    </div>

                    {/* Branch legend */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-50 border border-green-100 rounded-lg p-2.5 text-center">
                        <div className="text-[11px] font-bold text-green-700 mb-0.5">✓ SUCCESS branch</div>
                        <div className="text-[10px] text-green-500">XOLOX responded OK</div>
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-center">
                        <div className="text-[11px] font-bold text-red-600 mb-0.5">✗ FAIL branch</div>
                        <div className="text-[10px] text-red-400">Error or condition not met</div>
                      </div>
                    </div>

                  </div>
                );
              })()}

              {selectedNode.type === 'campaign_condition' && (() => {
                const conditions = selectedNode.data.conditions || [
                  { variable: 'WA message', operator: 'eq', value: 'delivered' }
                ];
                const MAX = 5;

                const updateConditions = (newConds) => {
                  updateNodeFields(selectedNode.id, { conditions: newConds });
                };

                const updateCond = (idx, field, val) => {
                  const next = conditions.map((c, i) => i === idx ? { ...c, [field]: val } : c);
                  updateConditions(next);
                };

                const addCond = () => {
                  if (conditions.length >= MAX) return;
                  updateConditions([...conditions, { variable: 'WA message', operator: 'eq', value: 'delivered' }]);
                };

                const removeCond = (idx) => {
                  if (conditions.length <= 1) return;
                  updateConditions(conditions.filter((_, i) => i !== idx));
                };

                return (
                  <div className="space-y-4">
                    {/* Timing mode toggle */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">When to Check</label>
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => updateNodeData('timingMode', 'after')}
                          className={`flex-1 py-1.5 font-medium transition-colors ${(selectedNode.data.timingMode || 'after') === 'after'
                            ? 'bg-violet-600 text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                          After Duration
                        </button>
                        <button
                          type="button"
                          onClick={() => updateNodeData('timingMode', 'specific')}
                          className={`flex-1 py-1.5 font-medium transition-colors ${selectedNode.data.timingMode === 'specific'
                            ? 'bg-violet-600 text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                          Specific Date &amp; Time
                        </button>
                      </div>
                    </div>

                    {/* After Duration */}
                    {(selectedNode.data.timingMode || 'after') === 'after' && (() => {
                      const d = parseInt(selectedNode.data.checkDays) || 0;
                      const h = parseInt(selectedNode.data.checkHours) || 0;
                      const m = parseInt(selectedNode.data.checkMinutes) || 0;
                      const totalMs = (d * 86400 + h * 3600 + m * 60) * 1000;
                      const recheckAt = totalMs > 0 ? new Date(Date.now() + totalMs) : null;
                      return (
                        <div className="space-y-2">
                          <label className="block text-xs text-slate-500">Duration from now</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[['checkDays', 'Days'], ['checkHours', 'Hours'], ['checkMinutes', 'Mins']].map(([key, lbl]) => (
                              <div key={key}>
                                <label className="block text-[10px] text-slate-400 mb-0.5 text-center">{lbl}</label>
                                <input
                                  type="number" min="0"
                                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm text-center"
                                  value={selectedNode.data[key] ?? 0}
                                  onChange={e => updateNodeData(key, Math.max(0, parseInt(e.target.value) || 0))}
                                />
                              </div>
                            ))}
                          </div>
                          {recheckAt ? (
                            <div className="bg-violet-50 border border-violet-100 rounded-md px-3 py-2 text-xs text-violet-700">
                              🔁 Will recheck at: <b>{recheckAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</b>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 text-center py-1">Enter a duration above to see recheck time</div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Specific date/time */}
                    {selectedNode.data.timingMode === 'specific' && (
                      <div className="space-y-2">
                        <label className="block text-xs text-slate-500">Recheck at this exact date &amp; time</label>
                        <input
                          type="datetime-local"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.specificTime || ''}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={e => updateNodeData('specificTime', e.target.value)}
                        />
                        {selectedNode.data.specificTime && (
                          <div className="bg-violet-50 border border-violet-100 rounded-md px-3 py-2 text-xs text-violet-700">
                            🔁 Will recheck at: <b>{new Date(selectedNode.data.specificTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</b>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Condition Groups */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-700">Conditions</label>
                        <span className="text-xs text-slate-400">{conditions.length}/{MAX}</span>
                      </div>

                      <div className="space-y-3">
                        {conditions.map((cond, idx) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group {idx + 1}</span>
                              {conditions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeCond(idx)}
                                  className="text-red-400 hover:text-red-600 text-xs"
                                >
                                  ✕ Remove
                                </button>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Variable</label>
                              <select
                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs"
                                value={cond.variable || 'WA message'}
                                onChange={e => updateCond(idx, 'variable', e.target.value)}
                              >
                                <option value="WA message">WA Message</option>
                                <option value="link">Link</option>
                                <option value="Email">Email</option>
                                <option value="SMS">SMS</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Condition</label>
                              <select
                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs"
                                value={cond.operator || 'eq'}
                                onChange={e => updateCond(idx, 'operator', e.target.value)}
                              >
                                <option value="eq">Equal to</option>
                                <option value="neq">Not equal to</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Value</label>
                              <select
                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs"
                                value={cond.value || 'delivered'}
                                onChange={e => updateCond(idx, 'value', e.target.value)}
                              >
                                <option value="sent">Sent</option>
                                <option value="delivered">Delivered</option>
                                <option value="opened">Opened</option>
                                <option value="clicked">Clicked</option>
                                <option value="replied">Replied</option>
                              </select>
                            </div>

                            <div className="text-[10px] text-violet-600 bg-violet-50 border border-violet-100 rounded px-2 py-1 font-mono">
                              {cond.variable} {cond.operator === 'eq' ? '==' : '!='} "{cond.value}"
                            </div>
                          </div>
                        ))}
                      </div>

                      {conditions.length < MAX && (
                        <button
                          type="button"
                          onClick={addCond}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded-lg py-2 text-xs text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-colors"
                        >
                          <Plus size={12} /> Add Condition Group
                        </button>
                      )}

                      {conditions.length >= MAX && (
                        <p className="text-[10px] text-slate-400 text-center mt-2">Maximum of {MAX} condition groups reached.</p>
                      )}
                    </div>
                  </div>
                );
              })()}


              {selectedNode.type === 'user_replied' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <UserCheck size={14} className="text-blue-600" />
                      <span className="text-xs font-semibold text-blue-800">User Replied? Check</span>
                    </div>
                    <p className="text-[11px] text-blue-600 leading-relaxed">
                      Waits for an incoming message from the contact. Branch your workflow based on whether they reply or not.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Timeout (Minutes)</label>
                    <div className="flex items-center gap-2">
                       <input
                        type="number"
                        min="1"
                        max="1440"
                        className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-300 outline-none"
                        value={selectedNode.data.timeoutMins || selectedNode.data.timeout || '60'}
                        onChange={(e) => updateNodeData('timeoutMins', e.target.value)}
                      />
                      <span className="text-xs text-slate-400 shrink-0">mins</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                       Wait for up to this many minutes before following the <b>TIMEOUT</b> branch.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">✓</div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">REPLIED Branch (true)</div>
                        <p className="text-[10px] text-slate-500">Contact sent a message. Use this for conversions or manual handling.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">✗</div>
                      <div>
                        <div className="text-xs font-bold text-slate-800">TIMEOUT Branch (false)</div>
                        <p className="text-[10px] text-slate-500">No reply received. Use this for automated follow-up templates.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'wait_for_stage' && (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ListChecks size={14} className="text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-800">Wait for Lead Stage</span>
                    </div>
                    <p className="text-[11px] text-indigo-600 leading-relaxed">
                      The workflow pauses safely in the database and resumes only when this contact reaches the selected stage.
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Target Stage</label>
                    <select
                      className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-indigo-300 outline-none"
                      value={selectedNode.data.targetStageId || ''}
                      onChange={(event) => {
                        const stage = pipelineStages.find((item) => item.id === event.target.value);
                        updateNodeFields(selectedNode.id, {
                          targetStageId: event.target.value,
                          targetStageName: stage?.name || stage?.label || '',
                        });
                      }}
                    >
                      <option value="">Select lead stage</option>
                      {pipelineStages.map((stage) => (
                        <option key={stage.id} value={stage.id}>{stage.name || stage.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {selectedNode.type === 'send_template' && (() => {
                const d = selectedNode.data;
                const tmpl = templates.find(t => t.name === d.template);
                const headerVarKeys = tmpl && tmpl.headerFormat === 'TEXT' ? extractTemplatePlaceholders(tmpl.headerText || '').map(v => `header_${v}`) : [];
                const bodyVarKeys = tmpl ? extractTemplatePlaceholders(tmpl.bodyText || '') : [];
                const varKeys = [...headerVarKeys, ...bodyVarKeys].sort((a, b) => {
                  // Sort numeric keys, put non-numeric at end
                  const na = parseInt(a, 10), nb = parseInt(b, 10);
                  if (!isNaN(na) && !isNaN(nb)) return na - nb;
                  if (!isNaN(na)) return -1;
                  if (!isNaN(nb)) return 1;
                  return a.localeCompare(b);
                });
                const vars = d.variables || {};
                const headerType = d.headerType || 'none';

                // ── Helpers ────────────────────────────────────────
                const setHeader = (fields) => {
                  const hdr = {
                    headerType: fields.headerType ?? (d.headerType || 'none'),
                    headerUrl: fields.headerUrl ?? (d.headerUrl || ''),
                    headerFileName: fields.headerFileName ?? (d.headerFileName || ''),
                  };
                  const nextComps = tmpl ? buildTemplateComponentsPayload(tmpl, d.variables || {}, hdr) : (d.components || []);
                  updateNodeFields(selectedNode.id, { ...fields, components: nextComps });
                };

                // Compute upstream variables (same BFS as XOLOX panel)
                const upstreamVars = getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables);

                return (
                  <div className="space-y-4">
                    
                    {/* Dynamic Channel Indicator */}
                    <div className="bg-blue-50 border border-blue-100 text-blue-700 rounded-md p-3 text-xs mb-4">
                      <strong>Dynamic Channel:</strong> This template will automatically be sent from the same WhatsApp number that triggered the workflow (the channel the customer messaged).
                    </div>

                    {/* ① Template picker */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-medium text-slate-700">Select Template</label>
                        {loadingTemplates && <Loader2 size={12} className="animate-spin text-slate-400" />}
                      </div>
                      <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-violet-100 bg-violet-50 px-3 py-2">
                        <p className="text-[11px] leading-relaxed text-violet-800">Need a new template? Submit it to Meta here, then select it after approval.</p>
                        <button type="button" onClick={() => setIsInlineTemplateModalOpen(true)} className="shrink-0 rounded-md border border-violet-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-100">Create template</button>
                      </div>
                      {inlineTemplateNotice && <div className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-medium text-emerald-800">{inlineTemplateNotice}</div>}
                      
                      {/* Search Bar */}
                      <div className="relative mb-2">
                        <input 
                          type="text"
                          placeholder="Search templates..."
                          className="w-full border border-slate-300 rounded-md pl-8 pr-2.5 py-1.5 text-xs focus:ring-1 focus:ring-green-400 outline-none"
                          value={templateSearch}
                          onChange={(e) => setTemplateSearch(e.target.value)}
                        />
                        <Filter size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                      </div>

                      <select
                        className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                        value={d.template || ''}
                        onChange={(e) => {
                          const tName = e.target.value;
                          const found = templates.find(t => t.name === tName);
                          let btns = [], content = '', nextVars = {}, components = [];
                          if (found) {
                            content = found.bodyText || '';
                            btns = (found.buttons || []).map(b => b.text).filter(Boolean);
                            const hKeys = found.headerFormat === 'TEXT' ? extractTemplatePlaceholders(found.headerText || '') : [];
                            const bKeys = extractTemplatePlaceholders(found.bodyText || '');
                            
                            hKeys.forEach(k => {
                               nextVars[`header_${k}`] = (found.examples && found.examples[k]) || '';
                            });
                            bKeys.forEach(k => {
                               nextVars[k] = (found.examples && found.examples[k]) || '';
                            });
                            const hdr = {
                              headerType: d.headerType || 'none',
                              headerUrl: d.headerUrl || '',
                              headerFileName: d.headerFileName || '',
                            };
                            components = buildTemplateComponentsPayload(found, nextVars, hdr);
                          }
                          if (!selectedNode) return;
                          setNodes(nds => nds.map(node => {
                            if (node.id !== selectedNode.id) return node;
                            const newData = { 
                              ...node.data, 
                              template: tName, 
                              buttons: btns, 
                              content, 
                              variables: nextVars, 
                              components, 
                              languageCode: found ? (found.language || 'en_US') : 'en_US',
                              templatePhoneNumberId: found?.phoneNumberId || '',
                              headerType: (found && found.headerFormat === 'TEXT') ? 'none' : node.data.headerType
                            };
                            setSelectedNode({ ...node, data: newData });
                            return { ...node, data: newData };
                          }));
                        }}
                      >
                        <option value="">-- Select Template --</option>
                        {templates
                          .filter(t => {
                            if (!isWorkflowSelectableTemplate(t)) return false;
                            if (templateSearch && !String(t.name || '').toLowerCase().includes(templateSearch.toLowerCase())) return false;
                            return true;
                          })
                          .map(t => <option key={t.id} value={t.name}>{t.name} ({t.language})</option>)
                        }
                        {templates.filter(t => {
                           if (!isWorkflowSelectableTemplate(t)) return false;
                           if (templateSearch && !String(t.name || '').toLowerCase().includes(templateSearch.toLowerCase())) return false;
                           return true;
                        }).length === 0 && (
                           <option disabled>No approved or local templates found</option>
                        )}
                      </select>
                      {tmpl && (
                        <div className="mt-1.5 bg-green-50 border border-green-100 rounded overflow-hidden">
                          {tmpl.headerText && (
                             <div className="px-2 py-1.5 bg-green-100/50 border-b border-green-100 text-[11px] font-bold text-green-900 leading-relaxed whitespace-pre-wrap">
                               {tmpl.headerText}
                             </div>
                          )}
                          <div className="px-2 py-1.5 text-[11px] text-green-800 leading-relaxed whitespace-pre-wrap">
                            {tmpl.bodyText}
                          </div>
                        </div>
                      )}
                      {tmpl && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                            <span className="text-slate-500">Parameter Format:</span>{' '}
                            <span className="font-semibold text-slate-700">{tmpl.parameterFormat}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                            <span className="text-slate-500">Header Format:</span>{' '}
                            <span className="font-semibold text-slate-700">{tmpl.headerFormat}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                            <span className="text-slate-500">Language:</span>{' '}
                            <span className="font-semibold text-slate-700">{tmpl.language}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                            <span className="text-slate-500">Category:</span>{' '}
                            <span className="font-semibold text-slate-700">{tmpl.category || '—'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ② Media Header (only when template has a header component) */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center gap-2">
                        <Image size={13} className="text-slate-500" />
                        <span className="text-xs font-semibold text-slate-600">Media Header</span>
                        <span className="ml-auto text-[10px] text-slate-400">optional</span>
                      </div>
                      <div className="p-3 space-y-2">
                        {/* Type selector */}
                        <div className="flex gap-1.5">
                          {[
                            { key: 'none', label: 'None', icon: null },
                            { key: 'image', label: 'Image', icon: Image },
                            { key: 'video', label: 'Video', icon: Video },
                            { key: 'document', label: 'Document', icon: FileIcon },
                          ].map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setHeader({ headerType: key, headerUrl: '', headerFileName: '' })}
                              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded border text-[10px] font-medium transition-colors ${headerType === key
                                ? 'bg-green-50 border-green-400 text-green-700'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                            >
                              {Icon && <Icon size={13} />}
                              {label}
                            </button>
                          ))}
                        </div>

                        {headerType !== 'none' && (
                          <div className="space-y-2 pt-1">
                            {/* Current preview */}
                            {d.headerUrl && (
                              <div className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1.5 border border-slate-200">
                                {headerType === 'image' && (
                                  <img src={d.headerUrl} alt="header" className="w-10 h-10 object-cover rounded" onError={e => { e.target.style.display = 'none'; }} />
                                )}
                                {headerType === 'video' && <Video size={20} className="text-slate-400 shrink-0" />}
                                {headerType === 'document' && <FileIcon size={20} className="text-slate-400 shrink-0" />}
                                <span className="text-[11px] text-slate-600 truncate flex-1 min-w-0">{d.headerFileName || d.headerUrl}</span>
                                <button type="button" onClick={() => setHeader({ headerUrl: '', headerFileName: '' })} className="text-red-400 hover:text-red-600 shrink-0">
                                  <X size={13} />
                                </button>
                              </div>
                            )}

                            {/* Actions: Upload or Gallery */}
                            <div className="flex gap-1.5">
                              <label className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded px-2 py-2 text-[11px] text-slate-500 hover:border-green-400 hover:text-green-600 cursor-pointer transition-colors">
                                <Upload size={12} />
                                Upload file
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept={
                                    headerType === 'image' ? 'image/*' :
                                      headerType === 'video' ? 'video/*' :
                                        'application/pdf,.doc,.docx,.xlsx,.pptx'
                                  }
                                  onChange={async (e) => {
                                    const file = e.target.files && e.target.files[0];
                                    if (!file) return;
                                    try {
                                      const res = await uploadFlowMedia(file);
                                      const url = res.url || res.link || res.data?.url || '';
                                      setHeader({ headerUrl: url, headerFileName: file.name });
                                    } catch (err) {
                                      console.error('Upload failed', err);
                                      alert('Upload failed: ' + err.message);
                                    }
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={openGallery}
                                className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded px-2 py-2 text-[11px] text-slate-500 hover:border-green-400 hover:text-green-600 transition-colors"
                              >
                                <Image size={12} />
                                From gallery
                              </button>
                            </div>

                            {/* Manual URL input */}
                            <input
                              type="url"
                              className="w-full border border-slate-300 rounded px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-green-300"
                              placeholder="or paste a direct URL…"
                              value={d.headerUrl || ''}
                              onChange={e => setHeader({ headerUrl: e.target.value, headerFileName: '' })}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ③ Template variables with upstream chips */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-700">
                          Variables{tmpl ? (tmpl.parameterFormat === 'POSITIONAL' ? ' (POSITIONAL — order matters)' : ' (NAMED)') : ''}
                        </label>
                        {templateFocusedVarKey && (
                          <span className="text-[10px] text-green-600 font-medium">→ inserting into {`{{${templateFocusedVarKey}}}`}</span>
                        )}
                      </div>

                      {!tmpl || varKeys.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          {d.template ? 'This template has no variables.' : 'Select a template above.'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {varKeys.map(k => (
                            <div key={k} className={`rounded p-1 transition-colors ${templateFocusedVarKey === k ? 'bg-green-50 ring-1 ring-green-200' : ''}`}>
                              <div className="text-[11px] text-slate-500 font-mono mb-0.5">
                                {k.startsWith('header_') 
                                  ? `{{${k.replace('header_', '')}}} (Header)` 
                                  : `{{${k}}} (Body)`}
                              </div>
                              <input
                                className={`w-full border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-green-300 transition-colors ${templateFocusedVarKey === k ? 'border-green-400 bg-green-50' : 'border-slate-300'
                                  }`}
                                placeholder={`Value or {{variable}}`}
                                value={vars[k] || ''}
                                onChange={(e) => {
                                  const nextVars = { ...vars, [k]: e.target.value };
                                  const hdr = {
                                    headerType: d.headerType || 'none',
                                    headerUrl: d.headerUrl || '',
                                    headerFileName: d.headerFileName || '',
                                  };
                                  const nextComps = buildTemplateComponentsPayload(tmpl, nextVars, hdr);
                                  updateNodeFields(selectedNode.id, { variables: nextVars, components: nextComps });
                                }}
                                onFocus={() => setTemplateFocusedVarKey(k)}
                                onBlur={() => setTimeout(() => setTemplateFocusedVarKey(null), 200)}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upstream variable chips */}
                      <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                        <div className="text-[11px] font-semibold text-slate-600 mb-1">
                          Variables from upstream nodes
                          {templateFocusedVarKey && (
                            <span className="ml-1 text-[10px] font-normal text-green-500">click chip to insert into focused field</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {upstreamVars.map(v => (
                            <code
                              key={v}
                              className={`text-[10px] rounded px-1.5 py-0.5 cursor-pointer font-mono select-none transition-colors ${templateFocusedVarKey
                                ? 'bg-green-50 border border-green-300 text-green-700 hover:bg-green-100'
                                : 'bg-white border border-slate-200 text-slate-500 hover:border-green-300 hover:text-green-700'
                                }`}
                              title={templateFocusedVarKey ? `Insert ${v} into {{${templateFocusedVarKey}}}` : 'Focus a variable input first'}
                              onClick={() => {
                                if (templateFocusedVarKey) {
                                  const nextVars = { ...vars, [templateFocusedVarKey]: v };
                                  const hdr = {
                                    headerType: d.headerType || 'none',
                                    headerUrl: d.headerUrl || '',
                                    headerFileName: d.headerFileName || '',
                                  };
                                  const nextComps = buildTemplateComponentsPayload(tmpl, nextVars, hdr);
                                  updateNodeFields(selectedNode.id, { variables: nextVars, components: nextComps });
                                } else {
                                  navigator.clipboard?.writeText(v);
                                }
                              }}
                            >{v}</code>
                          ))}
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1">
                          {templateFocusedVarKey
                            ? `Click a chip to fill in {{${templateFocusedVarKey}}}`
                            : 'Click a variable input above, then click a chip to fill it'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}



              {selectedNode.type === 'response_message' && (() => {
                const d = selectedNode.data;
                const headerType = d.headerType || 'none';
                const buttons = d.buttons || [];
                const msg = d.message || '';

                // Compute upstream variables (reuse same logic)
                const upstreamVars = getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables);

                const setField = (key, val) => updateNodeFields(selectedNode.id, { [key]: val });

                return (
                  <div className="space-y-4">
                    {/* ① Media Header */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-teal-50 px-3 py-2 border-b border-teal-100 flex items-center gap-2">
                        <Image size={13} className="text-teal-600" />
                        <span className="text-xs font-semibold text-teal-800">Media Option (Optional)</span>
                      </div>
                      <div className="p-3 space-y-3">
                        {/* Type selector */}
                        <div className="flex gap-1.5">
                          {[
                            { key: 'none', label: 'None', icon: null },
                            { key: 'image', label: 'Image', icon: Image },
                            { key: 'video', label: 'Video', icon: Video },
                            { key: 'document', label: 'Document', icon: FileIcon },
                          ].map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => updateNodeFields(selectedNode.id, { headerType: key, headerUrl: '', headerFileName: '' })}
                              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded border text-[10px] font-medium transition-colors ${headerType === key
                                ? 'bg-teal-50 border-teal-400 text-teal-700'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-teal-300'
                                }`}
                            >
                              {Icon && <Icon size={12} />}
                              {label}
                            </button>
                          ))}
                        </div>

                        {headerType !== 'none' && (
                          <div className="space-y-2">
                            {d.headerUrl && (
                              <div className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1.5 border border-slate-200">
                                <span className="text-[11px] text-slate-600 truncate flex-1 min-w-0">{d.headerFileName || d.headerUrl}</span>
                                <button type="button" onClick={() => updateNodeFields(selectedNode.id, { headerUrl: '', headerFileName: '' })} className="text-red-400 hover:text-red-600">
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <label className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded px-2 py-1.5 text-[10px] text-slate-500 hover:border-teal-400 hover:text-teal-600 cursor-pointer transition-colors text-center">
                                <Upload size={12} /> Upload
                                <input type="file" className="sr-only" onChange={async (e) => {
                                  const file = e.target.files?.[0]; if (!file) return;
                                  const res = await uploadFlowMedia(file);
                                  updateNodeFields(selectedNode.id, { headerUrl: res.url || res.data?.url || '', headerFileName: file.name });
                                }} />
                              </label>
                              <button onClick={openGallery} className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded px-2 py-1.5 text-[10px] text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-colors text-center">
                                <Image size={12} /> Gallery
                              </button>
                            </div>
                            <input
                              className="w-full border border-slate-300 rounded px-2 py-1.5 text-[10px] font-mono focus:ring-1 focus:ring-teal-400 focus:outline-none"
                              placeholder="Paste public URL or {{variable}}..."
                              value={d.headerUrl || ''}
                              onChange={e => setField('headerUrl', e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ② Message Text */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Message to send</label>
                      <textarea
                        className="w-full border border-slate-300 rounded-md p-2.5 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-300 focus:outline-none"
                        placeholder="Type your message here... Use {{variable}} to map data."
                        value={msg}
                        onChange={(e) => setField('message', e.target.value)}
                        onFocus={() => setFocusedVarIdx('msg_text')}
                        onBlur={() => setTimeout(() => setFocusedVarIdx(null), 200)}
                      />

                      {/* Variable chips for message text */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {upstreamVars.map(v => (
                          <span
                            key={v}
                            onClick={() => {
                              if (focusedVarIdx === 'msg_text') {
                                setField('message', msg + v);
                              } else {
                                navigator.clipboard.writeText(v);
                              }
                            }}
                            className="bg-white border border-slate-200 text-slate-500 text-[9px] px-1.5 py-0.5 rounded cursor-pointer hover:border-teal-400 hover:text-teal-600 transition-colors font-mono"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* ③ Quick Replies (Buttons) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-700">Quick Replies</label>
                        <span className="text-[10px] text-slate-400">{buttons.length} options</span>
                      </div>
                      <div className="space-y-2">
                        {buttons.map((btn, idx) => (
                          <div key={idx} className="flex gap-1.5 items-center">
                            <input
                              className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 outline-none"
                              value={btn}
                              placeholder={`Option ${idx + 1}`}
                              onChange={(e) => {
                                const next = [...buttons];
                                next[idx] = e.target.value;
                                setField('buttons', next);
                              }}
                            />
                            <button onClick={() => {
                              const next = buttons.filter((_, i) => i !== idx);
                              setField('buttons', next);
                            }} className="text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setField('buttons', [...buttons, ''])}
                          className="w-full border border-dashed border-slate-300 rounded py-1.5 text-[11px] text-slate-400 hover:border-teal-400 hover:text-teal-600 transition-all flex items-center justify-center gap-1"
                        >
                          <Plus size={12} /> Add Option
                        </button>
                      </div>
                    </div>

                    {/* ④ Response Settings */}
                    <div className="pt-3 border-t border-slate-100 space-y-4">
                      {/* Save reply variable */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Save reply in variable</label>
                        <div className="relative">
                          <input
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-teal-400 outline-none pl-7"
                            placeholder="e.g. user_choice"
                            value={d.saveVariable || ''}
                            onChange={(e) => setField('saveVariable', e.target.value)}
                          />
                          <Code size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                        </div>
                        <p className="text-[10px] text-slate-400 italic">This will store the text of the button user clicks.</p>
                      </div>

                      {/* Skip Toggle */}
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold text-slate-700">Skip User Reply</div>
                          <div className="text-[10px] text-slate-500 leading-tight">If ON, workflow continues immediately without waiting for user interaction.</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!d.skipReply}
                            onChange={(e) => setField('skipReply', e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {selectedNode.type === 'list_message' && (() => {
                const d = selectedNode.data;
                const items = d.items || [];
                const setField = (key, val) => updateNodeFields(selectedNode.id, { [key]: val });
                const upstreamVars = getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables);

                return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                       <label className="text-sm font-medium text-slate-700">Menu Button Text</label>
                       <input
                         className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-teal-300 focus:outline-none"
                         placeholder="e.g. View Options"
                         maxLength={20}
                         value={d.buttonText || ''}
                         onChange={e => setField('buttonText', e.target.value)}
                       />
                       <p className="text-[10px] text-slate-400">This is what the user clicks to open the menu. (Max 20 chars)</p>
                    </div>

                    <div className="space-y-2">
                       <label className="text-sm font-medium text-slate-700">Body Text</label>
                       <textarea
                         className="w-full border border-slate-300 rounded-md p-2.5 text-sm min-h-[80px] focus:ring-2 focus:ring-teal-300 focus:outline-none"
                         placeholder="Select an option from the menu below..."
                         value={d.body || ''}
                         onChange={e => setField('body', e.target.value)}
                       />
                        <div className="flex flex-wrap gap-1 mt-1">
                            {upstreamVars.map(v => (
                                <span key={v} onClick={() => setField('body', (d.body || '') + v)} className="text-[10px] bg-white text-slate-600 px-1.5 py-0.5 rounded cursor-pointer hover:bg-teal-50 hover:text-teal-700 border border-slate-200">{v}</span>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-medium text-slate-700">Menu Options ({items.length}/10)</label>
                            <button
                                onClick={() => {
                                    if (items.length < 10) {
                                        const newItems = [...items, { title: `Option ${items.length + 1}`, description: '' }];
                                        setField('items', newItems);
                                    }
                                }}
                                className="text-[10px] bg-teal-600 text-white px-2 py-1 rounded font-bold hover:bg-teal-700"
                            >
                                + Add Option
                            </button>
                        </div>
                        <div className="space-y-2 mt-2">
                            {items.map((it, idx) => (
                                <div key={idx} className="bg-slate-50 border border-slate-100 rounded-md p-2 space-y-1">
                                    <div className="flex gap-2 items-center">
                                        <input
                                            className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-teal-300 outline-none"
                                            placeholder="Option title (Max 24)"
                                            maxLength={24}
                                            value={typeof it === 'object' ? it.title : it}
                                            onChange={(e) => {
                                                const newItems = [...items];
                                                if (typeof it === 'object') newItems[idx] = { ...newItems[idx], title: e.target.value };
                                                else newItems[idx] = e.target.value;
                                                setField('items', newItems);
                                            }}
                                        />
                                        <button
                                            onClick={() => {
                                                const newItems = items.filter((_, i) => i !== idx);
                                                setField('items', newItems);
                                            }}
                                            className="text-slate-400 hover:text-red-500"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                    <input
                                        className="w-full border border-slate-200 rounded px-2 py-1 text-[10px] focus:ring-1 focus:ring-teal-300 outline-none"
                                        placeholder="Option description (Max 72, Optional)"
                                        maxLength={72}
                                        value={typeof it === 'object' ? it.description : ''}
                                        onChange={(e) => {
                                            const newItems = [...items];
                                            if (typeof it === 'object') newItems[idx] = { ...newItems[idx], description: e.target.value };
                                            else newItems[idx] = { title: it, description: e.target.value };
                                            setField('items', newItems);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-3">
                         <div className="space-y-1">
                             <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Footer Text (Optional)</label>
                             <input
                               className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-teal-300"
                               placeholder="e.g. Choose one to continue"
                               value={d.footer || ''}
                               onChange={e => setField('footer', e.target.value)}
                             />
                         </div>
                    </div>
                  </div>
                );
              })()}


              {selectedNode.type === 'feedback' && (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-600 flex items-center justify-center text-white shadow-sm">
                      <Star size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-yellow-800 uppercase tracking-tight">Feedback Collection</span>
                      <h3 className="text-sm font-bold text-slate-800">Customer CSAT Tracking</h3>
                    </div>
                  </div>

                  <div className="space-y-4 px-1">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Feedback Question</label>
                      <textarea
                        className="w-full text-sm p-3 border border-slate-300 rounded-lg h-24 focus:ring-2 focus:ring-yellow-500/20 focus:outline-none"
                        value={selectedNode.data.question || ''}
                        onChange={(e) => updateNodeData('question', e.target.value)}
                        placeholder="e.g. Your feedback matters! Please rate this chat on scale of 1-5"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Button Display Style</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: 'numbers', label: 'Numbers', icon: '🔢' },
                          { key: 'emojis', label: 'Emojis', icon: '😄' },
                          { key: 'stars', label: 'Stars', icon: '⭐' },
                        ].map((style) => (
                          <button
                            key={style.key}
                            type="button"
                            onClick={() => updateNodeData('buttonStyle', style.key)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${(selectedNode.data.buttonStyle || 'numbers') === style.key
                              ? 'border-yellow-500 bg-yellow-50 shadow-sm'
                              : 'bg-white border-slate-100 text-slate-600 hover:border-yellow-200'
                              }`}
                          >
                            <span className="text-xl mb-1">{style.icon}</span>
                            <span className="text-[10px] font-bold">{style.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mt-6 group">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white rounded-lg border border-slate-200 text-indigo-500 transition-colors group-hover:border-indigo-200">
                          <RefreshCw size={14} className="animate-spin-slow" />
                        </div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Analytics Integration</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed italic">
                        Responses are automatically captured and calculated as <b>CSAT = (Promoters / Total) × 100</b>. View live metrics in your dashboard.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {(selectedNode.type === 'payment_request' || selectedNode.type === 'razorpay_link') && (
                <div className="space-y-6">
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-indigo-800 uppercase tracking-tight">
                        {selectedNode.type === 'razorpay_link' ? 'Razorpay Link' : 'Payment Request'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800">Generate & Send</h3>
                    </div>
                  </div>

                  <div className="space-y-4 px-1 pb-10">
                    {selectedNode.type === 'payment_request' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Provider</label>
                        <select
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                          value={selectedNode.data.provider || ''}
                          onChange={(e) => updateNodeData('provider', e.target.value)}
                        >
                          <option value="">Default connected gateway</option>
                          <option value="razorpay">Razorpay</option>
                          <option value="cashfree">Cashfree</option>
                          <option value="stripe">Stripe</option>
                        </select>
                        <p className="text-[10px] text-slate-400">The selected provider must be connected in Integrations for this workspace.</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Request Type</label>
                        <select
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none bg-white"
                          value={selectedNode.data.requestType || 'course'}
                          onChange={(e) => updateNodeData('requestType', e.target.value)}
                        >
                          <option value="course">Course Payment</option>
                          <option value="webinar">Webinar Enrollment</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Amount (₹)</label>
                        <input
                          type="number"
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                          value={selectedNode.data.amount || ''}
                          onChange={(e) => updateNodeData('amount', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {selectedNode.data.requestType === 'webinar' ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Webinar Name</label>
                        <input
                          type="text"
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                          value={selectedNode.data.webinarName || ''}
                          onChange={(e) => updateNodeData('webinarName', e.target.value)}
                          placeholder="Enter webinar title..."
                        />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Selected Course</label>
                          <select
                            className="w-full text-sm p-2 border border-slate-300 rounded-lg bg-white"
                            value={selectedNode.data.course || 'CPA US'}
                            onChange={(e) => {
                              updateNodeData('course', e.target.value);
                              updateNodeData('papers', []);
                            }}
                          >
                            <option value="CPA US">CPA US (Certified Public Accountant)</option>
                            <option value="CMA US">CMA US (Certified Management Accountant)</option>
                            <option value="ACCA">ACCA (Global Accountancy)</option>
                            <option value="EA">EA (Enrolled Agent)</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Select Papers Included</label>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-[300px] overflow-y-auto no-scrollbar">
                            {(() => {
                              const course = selectedNode.data.course || 'CPA US';
                              const papers = COURSE_PAPERS[course] || [];

                              if (course === 'ACCA') {
                                return papers.map(lvl => (
                                  <div key={lvl.level} className="mb-4 last:mb-0">
                                    <div className="text-[9px] font-bold text-indigo-500 uppercase mb-2 tracking-tighter border-b border-indigo-100 pb-1">
                                      {lvl.level}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {lvl.papers.map(p => (
                                        <label key={p.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100 hover:border-indigo-200 cursor-pointer transition-all shadow-sm">
                                          <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                                            checked={(selectedNode.data.papers || []).includes(p.id)}
                                            onChange={(e) => {
                                              const current = selectedNode.data.papers || [];
                                              const next = e.target.checked
                                                ? [...current, p.id]
                                                : current.filter(item => item !== p.id);
                                              updateNodeData('papers', next);
                                            }}
                                          />
                                          <div className="min-w-0">
                                            <div className="text-[10px] font-bold text-slate-800 leading-none mb-0.5">{p.id}</div>
                                            <div className="text-[8px] text-slate-500 truncate">{p.name}</div>
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ));
                              }

                              // Default for CPA, CMA, EA
                              return (
                                <div className="grid grid-cols-2 gap-2">
                                  {papers.map(p => (
                                    <label key={p.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100 hover:border-indigo-200 cursor-pointer transition-all shadow-sm">
                                      <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                                        checked={(selectedNode.data.papers || []).includes(p.id)}
                                        onChange={(e) => {
                                          const current = selectedNode.data.papers || [];
                                          const next = e.target.checked
                                            ? [...current, p.id]
                                            : current.filter(item => item !== p.id);
                                          updateNodeData('papers', next);
                                        }}
                                      />
                                      <div className="min-w-0">
                                        <div className="text-[10px] font-bold text-slate-800 leading-none mb-0.5">{p.id}</div>
                                        <div className="text-[8px] text-slate-500 truncate">{p.name}</div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Package Name</label>
                            <input
                              type="text"
                              className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                              value={selectedNode.data.packageName || ''}
                              onChange={(e) => updateNodeData('packageName', e.target.value)}
                              placeholder="e.g. Platinum Plus"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Validity Terms</label>
                            <input
                              type="text"
                              className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                              value={selectedNode.data.validityTerms || ''}
                              onChange={(e) => updateNodeData('validityTerms', e.target.value)}
                              placeholder="e.g. 18 Months"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Summary / Remarks</label>
                      <textarea
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg h-16 resize-none"
                        value={selectedNode.data.paymentSummary || ''}
                        onChange={(e) => updateNodeData('paymentSummary', e.target.value)}
                        placeholder="e.g. Advance payment for full course enrollment..."
                      />
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded w-fit">Message Customization</h4>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Interactive Header</label>
                        <input
                          type="text"
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                          value={selectedNode.data.headerText || '💳 Secure Payment Request'}
                          onChange={(e) => updateNodeData('headerText', e.target.value)}
                          placeholder="Checkout Now..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Button Label</label>
                          <input
                            type="text"
                            className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                            value={selectedNode.data.buttonText || 'Pay Now'}
                            onChange={(e) => updateNodeData('buttonText', e.target.value)}
                            placeholder="e.g. Pay Now"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Footer Note</label>
                          <input
                            type="text"
                            className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                            value={selectedNode.data.footerText || 'Official Razorpay link'}
                            onChange={(e) => updateNodeData('footerText', e.target.value)}
                            placeholder="e.g. Valid for 24h"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-2xl mt-4 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp Preview</span>
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                        </div>
                      </div>

                      <div className="bg-[#e5ddd5] rounded-lg p-3 shadow-inner relative max-w-[240px] ml-1">
                        <div className="text-[11px] font-bold text-slate-800 border-b border-white/50 pb-1.5 mb-2">
                          {selectedNode.data.headerText || '💳 Secure Payment Request'}
                        </div>
                        <div className="text-[10px] text-slate-600 whitespace-pre-line leading-relaxed pb-2">
                          {(selectedNode.data.requestType === 'course')
                            ? `💳 *Payment Request*\n*Course:* ${selectedNode.data.course || 'Select...'}\n*Amount:* ₹${selectedNode.data.amount || '0'}`
                            : `💳 *Payment Request*\n*Webinar:* ${selectedNode.data.webinarName || 'Enter...'}\n*Amount:* ₹${selectedNode.data.amount || '0'}`
                          }
                          {selectedNode.data.paymentSummary && `\n\n*Note:* ${selectedNode.data.paymentSummary}`}
                        </div>
                        <div className="text-[8px] text-slate-400 mt-1 uppercase italic tracking-tighter">
                          {selectedNode.data.footerText || 'Official Razorpay link'}
                        </div>

                        <div className="mt-3 bg-white hover:bg-slate-50 rounded-md py-2 flex items-center justify-center gap-2 text-[#00a884] font-bold text-[11px] shadow-sm transition-colors cursor-pointer border border-slate-100">
                          <Link size={12} />
                          {selectedNode.data.buttonText || 'Pay Now'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 space-y-3">
                      <Button
                        variant="secondary"
                        className="w-full bg-slate-800 text-white border border-slate-700 hover:bg-slate-900 flex items-center justify-center gap-2 group transition-all shadow-lg py-2.5"
                        onClick={async () => {
                          const amt = selectedNode.data.amount;
                          if (!amt || isNaN(amt)) return alert('Please enter a valid amount');

                          try {
                            const result = await createPaymentLink({
                              amount: parseFloat(amt),
                              description: (selectedNode.data.requestType === 'course') ? `Course: ${selectedNode.data.course}` : `Webinar: ${selectedNode.data.webinarName}`,
                              contact: '9123456789',
                              email: 'test@example.com',
                              notes: { source: 'preview', node_id: selectedNode.id }
                            });

                            if (result && result.short_url) {
                              updateNodeData('generatedLink', result.short_url);
                              navigator.clipboard.writeText(result.short_url);
                            }
                          } catch (err) {
                            alert(`Error: ${err.message}`);
                          }
                        }}
                      >
                        <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                        Generate Live Test Link
                      </Button>

                      {selectedNode.data.generatedLink && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1">
                            <Check size={10} /> Live Checkout URL
                          </label>
                          <div className="flex gap-1">
                            <input
                              readOnly
                              type="text"
                              className="flex-1 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 p-2 rounded-lg font-mono focus:outline-none"
                              value={selectedNode.data.generatedLink}
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(selectedNode.data.generatedLink);
                                alert('URL Copied!');
                              }}
                              className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 border border-emerald-200"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                          <p className="text-[9px] text-slate-400">Generated successfully. Copied to clipboard.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(selectedNode.type === 'payment_reminder' || selectedNode.type === 'razorpay_status') && (
                <div className="space-y-6">
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-sm">
                      <BellRing size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-orange-800 uppercase tracking-tight">
                        {selectedNode.type === 'razorpay_status' ? 'Razorpay Status' : 'Payment Reminder'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800">Smart Follow-up</h3>
                    </div>
                  </div>

                  <div className="space-y-4 px-1 pb-10">
                    {selectedNode.type === 'payment_reminder' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Provider</label>
                        <select
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg bg-white"
                          value={selectedNode.data.provider || ''}
                          onChange={(e) => updateNodeData('provider', e.target.value)}
                        >
                          <option value="">Use previous payment request</option>
                          <option value="razorpay">Razorpay</option>
                          <option value="cashfree">Cashfree</option>
                          <option value="stripe">Stripe</option>
                        </select>
                      </div>
                    )}
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mb-2">
                      <div className="flex items-start gap-2">
                        <Clock size={14} className="text-blue-600 mt-0.5" />
                        <p className="text-[10px] text-blue-700 leading-normal font-medium">
                          Wait for the selected time, then branch based on payment completion.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Wait Duration</label>
                        <input
                          type="number"
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                          value={selectedNode.data.duration || '24'}
                          onChange={(e) => updateNodeData('duration', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Unit</label>
                        <select
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg bg-white"
                          value={selectedNode.data.unit || 'hours'}
                          onChange={(e) => updateNodeData('unit', e.target.value)}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-widest">Automation Branches</h4>
                      <div className="space-y-2">
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                            <span className="text-xs font-bold text-emerald-800">PAID</span>
                          </div>
                          <span className="text-[9px] text-emerald-600 font-medium">Exit ID: paid</span>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-sm" />
                            <span className="text-xs font-bold text-red-800">UNPAID</span>
                          </div>
                          <span className="text-[9px] text-red-600 font-medium">Exit ID: unpaid</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'exotel_call' && (
                <div className="space-y-6">
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-sm">
                      <Phone size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-orange-800 uppercase tracking-tight">Exotel VoIP</span>
                      <h3 className="text-sm font-bold text-slate-800">Initiate Outbound Call</h3>
                    </div>
                  </div>

                  <div className="space-y-4 px-1 pb-10">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-700 font-medium leading-normal">
                        This node places an outbound call via Exotel. Use <code className="bg-blue-100 px-1 rounded">{'{{contact.phone}}'}</code> to call the current contact. Exotel must be connected in Settings → Integrations.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">To Number (Customer)</label>
                      <input
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                        value={selectedNode.data.toNumber || '{{contact.phone}}'}
                        onChange={e => updateNodeData('toNumber', e.target.value)}
                        placeholder="{{contact.phone}} or +91XXXXXXXXXX"
                      />
                      <p className="text-[10px] text-slate-400">Supports variables like {'{{contact.phone}}'}.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Caller ID (ExoPhone)</label>
                      <input
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                        value={selectedNode.data.callerId || ''}
                        onChange={e => updateNodeData('callerId', e.target.value)}
                        placeholder="Leave blank to use default from Settings"
                      />
                      <p className="text-[10px] text-slate-400">The ExoPhone virtual number shown to the customer. Leave blank to use the default configured in Integrations.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="exotel_record"
                        checked={!!selectedNode.data.record}
                        onChange={e => updateNodeData('record', e.target.checked)}
                        className="w-4 h-4 accent-orange-500"
                      />
                      <label htmlFor="exotel_record" className="text-sm text-slate-700 font-medium">Record this call</label>
                    </div>

                    {/* Branch info */}
                    <div className="space-y-2 mt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Branches</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-xs font-bold text-green-800">ANSWERED</span>
                          </div>
                          <span className="text-[9px] text-green-600 font-medium">Handle: answered</span>
                        </div>
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-xs font-bold text-red-800">FAILED / BUSY</span>
                          </div>
                          <span className="text-[9px] text-red-600 font-medium">Handle: failed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'agent_call_dispatch' && (
                <div className="space-y-6">
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-white shadow-sm"><Phone size={20} /></div>
                    <div>
                      <span className="text-xs font-semibold text-orange-800 uppercase tracking-tight">Exotel Bridge</span>
                      <h3 className="text-sm font-bold text-slate-800">Dispatch Call to Agent</h3>
                    </div>
                  </div>
                  <div className="space-y-4 px-1 pb-10">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] leading-relaxed text-blue-700">
                      Exotel first rings the selected agent's saved Profile phone number. After the agent answers, Exotel bridges the customer into the call. The agent device number is never stored in the workflow.
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Customer number</label>
                      <input className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:outline-none" value={selectedNode.data.toNumber || '{{contact.phone}}'} onChange={e => updateNodeData('toNumber', e.target.value)} placeholder="{{contact.phone}}" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Agent selection</label>
                      <select className="w-full text-sm p-2 border border-slate-300 rounded-lg" value={selectedNode.data.agentMode || 'assigned_agent'} onChange={e => updateNodeData('agentMode', e.target.value)}>
                        <option value="assigned_agent">Conversation's assigned agent</option>
                        <option value="round_robin">Available agent by round robin</option>
                        <option value="specific_agent">Specific workspace agent</option>
                      </select>
                    </div>
                    {(selectedNode.data.agentMode || 'assigned_agent') === 'specific_agent' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Specific agent</label>
                        <select className="w-full text-sm p-2 border border-slate-300 rounded-lg" value={selectedNode.data.agentId || ''} onChange={e => updateNodeData('agentId', e.target.value)}>
                          <option value="">Select agent</option>
                          {availableCallAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name || agent.email}</option>)}
                        </select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">ExoPhone caller ID (optional)</label>
                      <input className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:outline-none" value={selectedNode.data.callerId || ''} onChange={e => updateNodeData('callerId', e.target.value)} placeholder="Use default from Integrations" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700 font-medium"><input type="checkbox" checked={!!selectedNode.data.record} onChange={e => updateNodeData('record', e.target.checked)} className="w-4 h-4 accent-orange-500" /> Record this call</label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-green-50 border border-green-100 rounded-xl"><div className="text-xs font-bold text-green-800">DISPATCHED</div><div className="text-[9px] text-green-700 mt-1">Agent device is ringing</div></div>
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl"><div className="text-xs font-bold text-rose-800">FAILED</div><div className="text-[9px] text-rose-700 mt-1">Use a failure path</div></div>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'twilio_sms' && (
                <div className="space-y-6">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white shadow-sm">
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-red-800 uppercase tracking-tight">Twilio</span>
                      <h3 className="text-sm font-bold text-slate-800">Send SMS</h3>
                    </div>
                  </div>
                  <div className="space-y-4 px-1 pb-10">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-700 font-medium leading-normal">
                        Sends an SMS via Twilio to the specified number. Use <code className="bg-blue-100 px-1 rounded">{'{{contact.phone}}'}</code> for the current contact. Twilio must be connected in Settings → Integrations.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">To Number</label>
                      <input
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                        value={selectedNode.data.toNumber || '{{contact.phone}}'}
                        onChange={e => updateNodeData('toNumber', e.target.value)}
                        placeholder="{{contact.phone}} or +91XXXXXXXXXX"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">SMS Message</label>
                      <textarea
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:outline-none resize-none"
                        rows={4}
                        value={selectedNode.data.message || ''}
                        onChange={e => updateNodeData('message', e.target.value)}
                        placeholder="Hello {{contact.name}}, your order is confirmed!"
                      />
                      <p className="text-[10px] text-slate-400">Supports variables like {'{{contact.name}}'}.</p>
                    </div>
                    <div className="space-y-2 mt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Branches</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs font-bold text-green-800">SENT</span></div>
                          <span className="text-[9px] text-green-600 font-medium">Handle: sent</span>
                        </div>
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-xs font-bold text-red-800">FAILED</span></div>
                          <span className="text-[9px] text-red-600 font-medium">Handle: failed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'twilio_call' && (
                <div className="space-y-6">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shadow-sm">
                      <Phone size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-red-800 uppercase tracking-tight">Twilio</span>
                      <h3 className="text-sm font-bold text-slate-800">Outbound Voice Call</h3>
                    </div>
                  </div>
                  <div className="space-y-4 px-1 pb-10">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-700 font-medium leading-normal">
                        Places an outbound call via Twilio. Use <code className="bg-blue-100 px-1 rounded">{'{{contact.phone}}'}</code> to call the current contact. Twilio must be connected in Settings → Integrations.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">To Number</label>
                      <input
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                        value={selectedNode.data.toNumber || '{{contact.phone}}'}
                        onChange={e => updateNodeData('toNumber', e.target.value)}
                        placeholder="{{contact.phone}} or +91XXXXXXXXXX"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">From Number (optional)</label>
                      <input
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                        value={selectedNode.data.fromNumber || ''}
                        onChange={e => updateNodeData('fromNumber', e.target.value)}
                        placeholder="Leave blank to use default from Settings"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="twilio_record"
                        checked={!!selectedNode.data.record}
                        onChange={e => updateNodeData('record', e.target.checked)}
                        className="w-4 h-4 accent-red-500"
                      />
                      <label htmlFor="twilio_record" className="text-sm text-slate-700 font-medium">Record this call</label>
                    </div>
                    <div className="space-y-2 mt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Branches</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs font-bold text-green-800">ANSWERED</span></div>
                          <span className="text-[9px] text-green-600 font-medium">Handle: answered</span>
                        </div>
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-xs font-bold text-red-800">FAILED / BUSY</span></div>
                          <span className="text-[9px] text-red-600 font-medium">Handle: failed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'notification' && (
                <div className="space-y-6">
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-sm">
                      <Bell size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-orange-800 uppercase tracking-tight">Internal Alert</span>
                      <h3 className="text-sm font-bold text-slate-800">Team Notification</h3>
                    </div>
                  </div>

                  <div className="space-y-4 px-1 pb-10">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mb-2">
                      <div className="flex items-start gap-2">
                        <Megaphone size={14} className="text-blue-600 mt-0.5" />
                        <p className="text-[10px] text-blue-700 leading-normal font-medium">
                          This sends an instant alert to all active agents via the dashboard.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Alert Message</label>
                      <textarea
                        className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:outline-none min-h-[120px]"
                        value={selectedNode.data.message || 'Alert team!'}
                        onChange={(e) => updateNodeData('message', e.target.value)}
                        placeholder="e.g. User reached payment step"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'delay' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Time Delay</label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`flex-1 border rounded-md p-2 text-sm font-medium ${((selectedNode.data.delayMode || (selectedNode.data.targetAt ? 'specific' : 'relative')) === 'relative') ? 'border-orange-500 bg-orange-100 text-orange-950' : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'}`}
                        onClick={() => updateNodeFields(selectedNode.id, { delayMode: 'relative', targetAt: null })}
                      >
                        After duration
                      </button>
                      <button
                        type="button"
                        className={`flex-1 border rounded-md p-2 text-sm font-medium ${((selectedNode.data.delayMode || (selectedNode.data.targetAt ? 'specific' : 'relative')) === 'specific') ? 'border-orange-500 bg-orange-100 text-orange-950' : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50'}`}
                        onClick={() => updateNodeFields(selectedNode.id, { delayMode: 'specific' })}
                      >
                        Specific date/time
                      </button>
                    </div>

                    {((selectedNode.data.delayMode || (selectedNode.data.targetAt ? 'specific' : 'relative')) === 'relative') ? (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Days</label>
                          <input
                            type="number"
                            min="0"
                            className="w-full border border-slate-300 rounded-md p-2 text-sm"
                            value={Number.isFinite(Number(selectedNode.data.days)) ? Number(selectedNode.data.days) : 0}
                            onChange={(e) => updateNodeFields(selectedNode.id, { days: parseInt(e.target.value || '0', 10) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Hours</label>
                          <input
                            type="number"
                            min="0"
                            className="w-full border border-slate-300 rounded-md p-2 text-sm"
                            value={Number.isFinite(Number(selectedNode.data.hours)) ? Number(selectedNode.data.hours) : 0}
                            onChange={(e) => updateNodeFields(selectedNode.id, { hours: parseInt(e.target.value || '0', 10) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Minutes</label>
                          <input
                            type="number"
                            min="0"
                            className="w-full border border-slate-300 rounded-md p-2 text-sm"
                            value={Number.isFinite(Number(selectedNode.data.minutes)) ? Number(selectedNode.data.minutes) : 0}
                            onChange={(e) => updateNodeFields(selectedNode.id, { minutes: parseInt(e.target.value || '0', 10) })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Run at</label>
                        <input
                          type="datetime-local"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={(() => {
                            const iso = selectedNode.data.targetAt;
                            if (!iso) return '';
                            const d = new Date(iso);
                            if (isNaN(d.getTime())) return '';
                            const pad = (n) => String(n).padStart(2, '0');
                            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                          })()}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              updateNodeFields(selectedNode.id, { targetAt: null });
                              return;
                            }
                            const iso = new Date(v).toISOString();
                            updateNodeFields(selectedNode.id, { targetAt: iso });
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedNode.type === 'condition' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Condition Type</label>
                  <select
                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                    value={selectedNode.data.conditionType || 'user_replied'}
                    onChange={(e) => updateNodeData('conditionType', e.target.value)}
                  >
                    <option value="user_replied">User Replied</option>
                    <option value="has_tag">User Has Tag</option>
                    <option value="variable_match">Variable Match</option>
                  </select>

                  {selectedNode.data.conditionType === 'has_tag' && (
                    <input
                      placeholder="Tag Name"
                      className="w-full border border-slate-300 rounded-md p-2 text-sm"
                      value={selectedNode.data.tagName || ''}
                      onChange={(e) => updateNodeData('tagName', e.target.value)}
                    />
                  )}

                  {selectedNode.data.conditionType === 'variable_match' && (
                    <div className="space-y-2">
                       <div className="flex flex-wrap gap-1 mb-1">
                          {getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables).map(v => (
                             <button 
                                key={v}
                                type="button"
                                onClick={() => updateNodeData('variableName', v.replace(/{{|}}/g, ''))}
                                className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 hover:bg-slate-200 transition-colors"
                             >
                                {v}
                             </button>
                          ))}
                       </div>
                      <input
                        placeholder="Variable Name"
                        className="w-full border border-slate-300 rounded-md p-2 text-sm font-mono"
                        value={selectedNode.data.variableName || ''}
                        onChange={(e) => updateNodeData('variableName', e.target.value)}
                      />
                      
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.operator || '=='}
                        onChange={(e) => updateNodeData('operator', e.target.value)}
                      >
                        <option value="==">Equals (==)</option>
                        <option value="!=">Does Not Equal (!=)</option>
                        <option value="contains">Contains</option>
                        <option value="startsWith">Starts With</option>
                        <option value="endsWith">Ends With</option>
                        <option value="gt">Greater Than (&gt;)</option>
                        <option value="lt">Less Than (&lt;)</option>
                      </select>

                      <div className="space-y-1">
                        <div className="flex flex-wrap gap-1 mb-1">
                            {getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables).map(v => (
                               <button 
                                  key={v}
                                  type="button"
                                  onClick={() => updateNodeData('variableValue', v)}
                                  className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100 transition-colors"
                               >
                                  {v}
                               </button>
                            ))}
                        </div>
                        <input
                          placeholder="Value to Match (or {{variable}})"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.variableValue || ''}
                          onChange={(e) => updateNodeData('variableValue', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

                            {selectedNode.type === 'send_message' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Message Text</label>
                  <textarea
                    className="w-full border border-slate-300 rounded-md p-2 text-sm min-h-[100px]"
                    placeholder="Enter message text..."
                    value={selectedNode.data.message || ''}
                    onChange={(e) => updateNodeData('message', e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mb-2">
                    Note: Can only be sent within 24 hours of the user's last message.
                  </p>
                  
                  {/* PREVIEW SIMULATOR */}
                  {selectedNode.data.message && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-[10px] font-black uppercase text-blue-500 mb-1 flex items-center gap-1">
                        <Eye size={12} /> Live Preview Simulation
                      </div>
                      <div dangerouslySetInnerHTML={{ 
                        __html: selectedNode.data.message.replace(/{{([^}]+)}}/g, (match, p1) => `<span class="bg-blue-200 text-blue-900 px-1.5 py-0.5 mx-0.5 rounded font-mono text-xs shadow-sm border border-blue-300" title="Will be dynamically replaced">[ ${p1.trim()} ]</span>`).replace(/\n/g, '<br/>')
                      }} className="text-sm text-slate-700 font-medium leading-relaxed" />
                    </div>
                  )}
                </div>
              )}

              {selectedNode.type === 'custom_code' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">JavaScript Code</label>
                  <textarea
                    className="w-full border border-slate-900 bg-slate-900 text-slate-50 rounded-md p-2 text-sm font-mono min-h-[200px]"
                    placeholder="// e.g. console.log('Processing request...')"
                    value={selectedNode.data.code || ''}
                    onChange={(e) => updateNodeData('code', e.target.value)}
                  />
                  <p className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">
                    Code runs in a restricted environment. Use `console.log` for debugging.
                  </p>
                </div>
              )}

              {selectedNode.type === 'attribute_condition' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                    <div className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Default route executes when none of the below match.</div>
                  </div>
                  {(() => {
                    const upstreamVars = getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables);
                    const allVars = getAllDefinedVariables(nodes);
                    const upstreamKeys = Array.from(
                      new Set(
                        upstreamVars
                          .map((v) => String(v).replace(/[{}]/g, '').trim())
                          .filter(Boolean)
                      )
                    );
                    const allKeys = Array.from(
                      new Set(
                        allVars
                          .map((v) => String(v).replace(/[{}]/g, '').trim())
                          .filter(Boolean)
                      )
                    );
                    const availableKeys = Array.from(new Set([...upstreamKeys, ...allKeys]));

                    return (
                      <div className="space-y-6">
                        {(Array.isArray(selectedNode.data.groups) ? selectedNode.data.groups : []).map((group, gi) => {
                          const clauses = Array.isArray(group.clauses) ? group.clauses : [];
                          return (
                            <div key={group.id || gi} className="border border-slate-200 rounded-md p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-semibold text-slate-700">Condition Node {gi + 1}</div>
                                <button
                                  type="button"
                                  className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5"
                                  onClick={() => {
                                    const next = (selectedNode.data.groups || []).filter((_, idx) => idx !== gi);
                                    updateNodeFields(selectedNode.id, { groups: next });
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                              <div className="space-y-3">
                                {clauses.map((cl, ci) => (
                                  <div key={`${gi}-${ci}`} className="space-y-2">
                                    <div className="grid grid-cols-3 gap-2">
                                      <select
                                        className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
                                        value={cl.key || ''}
                                        onChange={(e) => {
                                          const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                          groups[gi].clauses[ci].key = e.target.value;
                                          updateNodeFields(selectedNode.id, { groups });
                                        }}
                                      >
                                        {availableKeys.length === 0 ? (
                                          <option value="">No variables available</option>
                                        ) : (
                                          <option value="">Select attribute</option>
                                        )}
                                        {availableKeys.map((k) => (
                                          <option key={k} value={k}>
                                            {k}
                                          </option>
                                        ))}
                                        {cl.key && !availableKeys.includes(cl.key) && (
                                          <option value={cl.key}>{cl.key}</option>
                                        )}
                                      </select>
                                      <select
                                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                        value={cl.op || 'eq'}
                                        onChange={(e) => {
                                          const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                          groups[gi].clauses[ci].op = e.target.value;
                                          updateNodeFields(selectedNode.id, { groups });
                                        }}
                                      >
                                        <option value="eq">equal to (==)</option>
                                        <option value="neq">not equal to (!=)</option>
                                        <option value="gt">greater than (&gt;)</option>
                                        <option value="lt">less than (&lt;)</option>
                                        <option value="contains">contains</option>
                                        <option value="not_contains">not contains</option>
                                        <option value="starts_with">starts with</option>
                                        <option value="ends_with">ends with</option>
                                      </select>
                                      <input
                                        placeholder="Value"
                                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                        value={cl.value || ''}
                                        onChange={(e) => {
                                          const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                          groups[gi].clauses[ci].value = e.target.value;
                                          updateNodeFields(selectedNode.id, { groups });
                                        }}
                                      />
                                    </div>
                                    {ci < clauses.length - 1 && (
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          className={`px-3 py-1 text-xs rounded ${cl.join === 'AND' ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                                          onClick={() => {
                                            const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                            groups[gi].clauses[ci].join = 'AND';
                                            updateNodeFields(selectedNode.id, { groups });
                                          }}
                                        >
                                          AND
                                        </button>
                                        <span className="text-[10px] text-slate-500">OR</span>
                                        <button
                                          type="button"
                                          className={`px-3 py-1 text-xs rounded ${cl.join === 'OR' ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                                          onClick={() => {
                                            const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                            groups[gi].clauses[ci].join = 'OR';
                                            updateNodeFields(selectedNode.id, { groups });
                                          }}
                                        >
                                          OR
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="px-3 py-1 text-xs border border-slate-300 rounded"
                                    onClick={() => {
                                      const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                      groups[gi].clauses.push({ key: '', op: 'eq', value: '', join: 'AND' });
                                      updateNodeFields(selectedNode.id, { groups });
                                    }}
                                  >
                                    Add Condition
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div>
                          <button
                            type="button"
                            className="px-3 py-2 text-xs border border-slate-300 rounded"
                            onClick={() => {
                              const groups = Array.isArray(selectedNode.data.groups) ? [...selectedNode.data.groups] : [];
                              groups.push({ id: `g${groups.length + 1}`, clauses: [{ key: '', op: 'eq', value: '', join: 'AND' }] });
                              updateNodeFields(selectedNode.id, { groups });
                            }}
                          >
                            Add Condition Node
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-500">Create edges from this node: one for each Condition Node output and one Default.</div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {selectedNode.type === 'action' && (
                <div className="space-y-3">
                  {/* Hide redundant dropdown if actionType is already specific */}
                  {['assign_agent', 'update_chat_status', 'add_to_label', 'send_email', 'send_sms_otp', 'start_workflow', 'update_lead_stage'].includes(selectedNode.data.actionType) ? (
                    <div className="space-y-1 pb-2 border-b border-slate-100">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Action Type</label>
                      <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        {selectedNode.data.actionType === 'assign_agent' && <UserCheck size={16} className="text-orange-500" />}
                        {selectedNode.data.actionType === 'update_chat_status' && <MessageCircle size={16} className="text-cyan-500" />}
                        {selectedNode.data.actionType === 'add_to_label' && <Tag size={16} className="text-emerald-600" />}
                        {selectedNode.data.actionType === 'send_email' && <Mail size={16} className="text-blue-600" />}
                        {selectedNode.data.actionType === 'send_sms_otp' && <MessageSquare size={16} className="text-fuchsia-600" />}
                        {selectedNode.data.actionType === 'start_workflow' && <WorkflowIcon size={16} className="text-indigo-600" />}
                        {selectedNode.data.actionType === 'update_lead_stage' && <ListChecks size={16} className="text-slate-700" />}
                        {selectedNode.data.actionType === 'assign_agent'
                          ? (getAssignMode(selectedNode.data) === 'xolox_dynamic' ? 'Assign from Xolox' : 'Assign Agent')
                          : selectedNode.data.actionType === 'update_chat_status'
                            ? 'Update Chat Status'
                            : selectedNode.data.actionType === 'add_to_label'
                              ? 'Add To Label'
                              : selectedNode.data.actionType === 'send_email'
                                ? 'Send Email'
                                : selectedNode.data.actionType === 'send_sms_otp'
                                  ? 'Send SMS OTP'
                                  : selectedNode.data.actionType === 'update_lead_stage'
                                    ? 'Update Lead Stage'
                                    : 'Start Workflow'}
                      </div>
                    </div>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-slate-700">Action</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionType || 'add_tag'}
                        onChange={(e) => {
                          const type = e.target.value;
                          const base = {
                            actionType: type,
                            actionValue: '',
                            variableName: '',
                            variableValue: '',
                            targetWorkflowName: '',
                            emailTemplateId: '',
                            emailTemplateName: '',
                            variableMapping: {},
                            toVarKey: 'email',
                          };
                          if (type === 'update_chat_status') base.actionValue = 'open';
                          if (type === 'assign_agent') base.assignMode = 'direct';
                          updateNodeFields(selectedNode.id, base);
                        }}
                      >
                        <option value="add_tag">Add Contact Tag</option>
                        <option value="remove_tag">Remove Contact Tag</option>
                        <option value="assign_agent">Assign Agent</option>
                        <option value="set_variable">Update Attribute</option>
                        <option value="start_workflow">Start Workflow</option>
                        <option value="add_to_label">Add CRM Label</option>
                        <option value="send_email">Send Email</option>
                        <option value="send_sms_otp">Send SMS OTP</option>
                        <option value="update_chat_status">Update Chat Status</option>
                        <option value="update_lead_stage">Update Lead Stage</option>
                      </select>
                    </>
                  )}

                  {selectedNode.data.actionType === 'assign_agent' ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Assignment Mode</label>
                        <select
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={getAssignMode(selectedNode.data)}
                          onChange={(e) => {
                            const mode = e.target.value;
                            // Update local state for UI toggle
                            const newData = { ...selectedNode.data, assignMode: mode };

                            if (mode === 'direct') {
                              newData.actionValue = '';
                            } else if (mode === 'xolox_dynamic') {
                              newData.actionValue = '{{xolox_response.assignedTo}}';
                            } else {
                              newData.actionValue = JSON.stringify({ course: '', language: '' });
                            }

                            // We need to update the node in the parent state
                            // Since updateNodeData only updates one field, we might need a helper or just rely on react flow state
                            // But here updateNodeData is a local helper in this component.
                            // Let's check updateNodeData implementation.
                            // It calls setNodes...
                            // We can call it for assignMode first.
                            updateNodeFields(selectedNode.id, newData);
                          }}
                        >
                          <option value="direct">Direct Email</option>
                          <option value="round_robin">Round Robin (Conditions)</option>
                          <option value="xolox_dynamic">From XOLOX Response</option>
                        </select>
                      </div>

                      {getAssignMode(selectedNode.data) === 'xolox_dynamic' ? (
                        <div className="space-y-2 bg-orange-50 border border-orange-100 rounded-lg p-3">
                           <div className="flex items-center gap-2 mb-1">
                               <Globe size={14} className="text-orange-600" />
                              <span className="text-[11px] font-bold text-orange-800 uppercase tracking-tight">Dynamic Assignment</span>
                           </div>
                           <label className="text-[10px] text-slate-500 font-bold uppercase">Response Path</label>
                           <input
                             className="w-full border border-orange-300 rounded px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-orange-400 outline-none"
                             value={selectedNode.data.actionValue || '{{xolox_response.assignedTo}}'}
                             onChange={e => updateNodeData('actionValue', e.target.value)}
                             placeholder="{{xolox_response.some_field}}"
                           />
                           <p className="text-[10px] text-orange-600 leading-tight">
                              This will take the value from the successful XOLOX event response and use it to look up the agent (by ID or Email).
                           </p>
                        </div>
                      ) : getAssignMode(selectedNode.data) === 'round_robin' ? (
                        <div className="space-y-2 border-l-2 border-slate-200 pl-2">
                          {(() => {
                            let cond = {};
                            try { cond = JSON.parse(selectedNode.data.actionValue || '{}'); } catch (e) { }

                            const updateCond = (key, val) => {
                              const newCond = { ...cond, [key]: val };
                              updateNodeData('actionValue', JSON.stringify(newCond));
                            };

                            return (
                              <>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Course</label>
                                  <input
                                    placeholder="e.g. CPA"
                                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                    value={cond.course || ''}
                                    onChange={(e) => updateCond('course', e.target.value)}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Language</label>
                                  <input
                                    placeholder="e.g. English"
                                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                    value={cond.language || ''}
                                    onChange={(e) => updateCond('language', e.target.value)}
                                  />
                                </div>
                                <p className="text-[10px] text-slate-500">
                                  Assigns to available agent via Round Robin logic (Least Recently Assigned).
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Agent Email</label>
                          <input
                            placeholder="agent@example.com"
                            className="w-full border border-slate-300 rounded-md p-2 text-sm"
                            value={selectedNode.data.actionValue || ''}
                            onChange={(e) => updateNodeData('actionValue', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ) : selectedNode.data.actionType === 'set_variable' ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Variable Name</label>
                        <input
                          placeholder="e.g. user_type"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.variableName || ''}
                          onChange={(e) => updateNodeData('variableName', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Value</label>
                        <input
                          placeholder="e.g. premium"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.variableValue || ''}
                          onChange={(e) => updateNodeData('variableValue', e.target.value)}
                        />
                      </div>
                    </div>
                  ) : selectedNode.data.actionType === 'start_workflow' ? (
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Workflow to start</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionValue || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const wf = availableWorkflows.find(
                            (w) => String(w.id) === String(value)
                          );
                          updateNodeFields(selectedNode.id, {
                            actionValue: value,
                            targetWorkflowName: wf ? wf.name : '',
                          });
                        }}
                      >
                        <option value="">Select workflow...</option>
                        {availableWorkflows.map((wf) => (
                          <option key={wf.id} value={wf.id}>
                            {wf.name}
                          </option>
                        ))}
                      </select>
                      {loadingWorkflows && (
                        <p className="text-[10px] text-slate-400">Loading workflows...</p>
                      )}
                    </div>
                  ) : selectedNode.data.actionType === 'add_to_label' ? (
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Select Label</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionValue || ''}
                        onChange={(e) => updateNodeData('actionValue', e.target.value)}
                      >
                        <option value="">Select label...</option>
                        {availableLabels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      {loadingLabels && (
                        <p className="text-[10px] text-slate-400">Loading labels...</p>
                      )}
                    </div>
                  ) : selectedNode.data.actionType === 'send_email' ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Email Template</label>
                        <select
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.emailTemplateId || selectedNode.data.actionValue || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const tmpl = emailTemplates.find((t) => String(t.id) === String(value) || String(t.name) === String(value));
                            updateNodeFields(selectedNode.id, {
                              emailTemplateId: value,
                              actionValue: value,
                              emailTemplateName: tmpl ? tmpl.name : '',
                              variableMapping: {},
                            });
                          }}
                        >
                          <option value="">Select template...</option>
                          {emailTemplates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name || t.subject || t.id}
                            </option>
                          ))}
                        </select>
                        {loadingEmailTemplates && (
                          <p className="text-[10px] text-slate-400">Loading email templates...</p>
                        )}
                        {!loadingEmailTemplates && emailTemplates.length === 0 && (
                          <p className="text-[10px] text-amber-600">No email templates found. Create an email template first.</p>
                        )}
                      </div>

                      {(() => {
                        const upstreamVars = getUpstreamVariables(selectedNode.id, nodes, edges, precedingVariables);
                        const allVars = getAllDefinedVariables(nodes);
                        const toKeys = Array.from(
                          new Set(
                            [...upstreamVars, ...allVars]
                              .map((v) => String(v).replace(/[{}]/g, '').trim())
                              .filter(Boolean)
                          )
                        );
                        const selectedTemplateId = selectedNode.data.emailTemplateId || selectedNode.data.actionValue || '';
                        const tmpl = emailTemplates.find((t) => String(t.id) === String(selectedTemplateId) || String(t.name) === String(selectedTemplateId));
                        const vars = Array.isArray(tmpl?.variables) ? tmpl.variables : [];
                        const mapping = selectedNode.data.variableMapping || {};

                        return (
                          <>
                            <div className="space-y-1">
                              <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">To Email Variable</label>
                              <select
                                className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
                                value={selectedNode.data.toVarKey || 'email'}
                                onChange={(e) => updateNodeData('toVarKey', e.target.value)}
                              >
                                {toKeys.map((k) => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ))}
                                {!toKeys.includes(selectedNode.data.toVarKey || 'email') && (
                                  <option value={selectedNode.data.toVarKey || 'email'}>
                                    {selectedNode.data.toVarKey || 'email'}
                                  </option>
                                )}
                              </select>
                              {toKeys.length === 0 && (
                                <p className="text-[10px] text-slate-400">No variables found in this workflow.</p>
                              )}
                            </div>

                            {vars.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-700">Template Variables</div>
                                <div className="space-y-2">
                                  {vars.map((v) => (
                                    <div key={v} className="grid grid-cols-2 gap-2 items-center">
                                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-2 font-mono truncate">
                                        {v}
                                      </div>
                                      <select
                                        className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
                                        value={mapping[v] || ''}
                                        onChange={(e) => {
                                          const next = { ...(mapping || {}) };
                                          const val = e.target.value;
                                          if (!val) delete next[v];
                                          else next[v] = val;
                                          updateNodeData('variableMapping', next);
                                        }}
                                      >
                                        <option value="">Select value...</option>
                                        {toKeys.map((k) => (
                                          <option key={k} value={k}>
                                            {k}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedTemplateId && vars.length === 0 && (
                              <p className="text-[10px] text-slate-400">This template has no variables.</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : selectedNode.data.actionType === 'send_sms_otp' ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">OTP Digits</label>
                        <select
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.otpDigits || 6}
                          onChange={(e) => updateNodeData('otpDigits', parseInt(e.target.value, 10))}
                        >
                          <option value={4}>4</option>
                          <option value={5}>5</option>
                          <option value={6}>6</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Save OTP as Variable</label>
                        <input
                          placeholder="e.g. otp"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.saveVariable || 'otp'}
                          onChange={(e) => updateNodeData('saveVariable', e.target.value)}
                        />
                      </div>
                    </div>
                  ) : selectedNode.data.actionType === 'update_lead_stage' ? (
                    <div className="space-y-2">
                      <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Lead Stage</label>
                      <input
                        placeholder="N2 Fresh Leads"
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.variableValue || ''}
                        onChange={(e) => updateNodeData('variableValue', e.target.value)}
                      />
                      
                      <div className="bg-slate-50 border border-slate-100 rounded p-2 space-y-2">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Valid Stages</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['N2 Fresh Leads', 'N2 Minus', 'N2 Plus', 'N3 intrested', 'N3 Plus', 'N3 Minus', 'Lost', 'Converted'].map(s => (
                            <button 
                              key={s} 
                              type="button"
                              onClick={() => updateNodeData('variableValue', s)}
                              className="text-[10px] bg-white border border-slate-200 rounded px-2 py-0.5 hover:border-indigo-300 hover:text-indigo-600 transition-all font-medium"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-slate-400 leading-tight italic">
                          Click a stage above to set it as the match value. Ensure it matches your webhook payload exactly.
                        </p>
                      </div>
                    </div>
                  ) : selectedNode.data.actionType === 'update_chat_status' ? (
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">New Status</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionValue || 'open'}
                        onChange={(e) => updateNodeData('actionValue', e.target.value)}
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="snoozed">Snoozed</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-500 line-clamp-1 mt-0.5">Label Name</label>
                      <input
                        placeholder="e.g. VIP"
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionValue || ''}
                        onChange={(e) => updateNodeData('actionValue', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-auto p-5 border-t border-purple-50 bg-white">
              <Button variant="outline" className="w-full rounded-2xl border-red-100 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {
                setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                setSelectedNode(null);
              }}>
                Delete Node
              </Button>
            </div>
          </div>
        )}

        {/* ── Gallery Picker Modal ────────────────────────────────────── */}
        {/* ── FULL-SCREEN INTERACTIVE CSV BUILDER ────────────────────────── */}
        {isCSVModalOpen && (
          <div className="fixed inset-0 z-[100] bg-white flex flex-col overflow-hidden animate-in fade-in duration-300">
            {/* High-Contrast Header */}
            <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 text-slate-900 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                  <TableIcon size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight uppercase text-slate-900">Interactive Planning Workspace</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">DRAFTING MODE • {csvBuilderRows.length} STEPS DEFINED</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsShortcutsOpen(!isShortcutsOpen)}
                  className={`p-2 rounded-lg transition-all ${isShortcutsOpen ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100 hover:text-slate-600'}`}
                  title="Keyboard Shortcuts"
                >
                  <Keyboard size={18} />
                </button>
                <div className="h-6 w-px bg-slate-200 mx-2" />
                <button
                  onClick={() => setIsCSVModalOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-bold transition-all text-slate-600"
                >
                  <X size={16} /> EXIT BUILDER
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Left Main Workspace */}
              <div className="flex-1 overflow-auto bg-slate-50/30 relative custom-scrollbar">
                {/* Visual grid background */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                  style={{ backgroundImage: 'radial-gradient(#4f46e5 1px, transparent 1px)', backgroundSize: '30px 30px' }} 
                />

                <div className="p-12 relative z-10">
                  <div className="max-w-[1200px] mx-auto space-y-8">
                    {/* Workspace Controls */}
                    <div className="flex items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50">
                      <div className="space-y-1">
                        <h4 className="text-slate-900 font-bold text-lg tracking-tight">Step Sequence Editor</h4>
                        <p className="text-slate-500 text-[11px] font-medium">Define your flow logic using the spreadsheet interface below. Download the CSV when ready to sync.</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={downloadBuilderCSV}
                          variant="outline"
                          className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold h-10 px-6 gap-2"
                        >
                          <Download size={14} /> EXPORT CSV
                        </Button>
                        <Button
                          onClick={handleAddBuilderRow}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold h-10 px-6 shadow-lg shadow-indigo-600/30 gap-2 border-0"
                        >
                          <Plus size={16} /> ADD NEW STEP
                        </Button>
                      </div>
                    </div>

                    {/* Table Container */}
                    <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/60 overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-5 text-slate-400 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap w-20">#</th>
                            <th className="p-5 text-slate-400 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Step Identity</th>
                            <th className="p-5 text-slate-400 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Category</th>
                            <th className="p-5 text-slate-400 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Module Type</th>
                            <th className="p-5 text-slate-400 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Configuration Data</th>
                            <th className="p-5 text-slate-400 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">Routing</th>
                            <th className="p-5 w-16"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {csvBuilderRows.map((row, idx) => {
                            const currentTypeConfig = (CATEGORY_MAP[row.category] || []).find(t => t.value === row.type);
                            
                            return (
                              <tr key={idx} className="group hover:bg-slate-50/80 transition-all duration-200">
                                <td className="p-5 text-slate-300 font-mono text-xs">{idx + 1}</td>
                                <td className="p-4 w-48">
                                  <input
                                    ref={el => cellRefs.current[idx * 5 + 0] = el}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 text-xs font-bold outline-none ring-1 ring-transparent focus:ring-indigo-500/50 focus:border-indigo-500 transition-all shadow-sm"
                                    value={row.step_id}
                                    onKeyDown={(e) => handleTableKeyDown(e, idx, 0)}
                                    onChange={(e) => handleUpdateBuilderRow(idx, 'step_id', e.target.value)}
                                  />
                                </td>
                                <td className="p-4 w-40">
                                  <select
                                    ref={el => cellRefs.current[idx * 5 + 1] = el}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={row.category}
                                    onKeyDown={(e) => handleTableKeyDown(e, idx, 1)}
                                    onChange={(e) => handleUpdateBuilderRow(idx, 'category', e.target.value)}
                                  >
                                    <option value="trigger">Trigger Node</option>
                                    <option value="action">Action Node</option>
                                    <option value="system">System Logic</option>
                                  </select>
                                </td>
                                <td className="p-4 w-56">
                                  <select
                                    ref={el => cellRefs.current[idx * 5 + 2] = el}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={row.type}
                                    onKeyDown={(e) => handleTableKeyDown(e, idx, 2)}
                                    onChange={(e) => handleUpdateBuilderRow(idx, 'type', e.target.value)}
                                  >
                                    {(CATEGORY_MAP[row.category] || []).map(t => (
                                      <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-4">
                                  <input
                                    ref={el => cellRefs.current[idx * 5 + 3] = el}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-600 text-xs outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-300 font-medium"
                                    placeholder={currentTypeConfig?.placeholder || 'Config data...'}
                                    value={row.content}
                                    onKeyDown={(e) => handleTableKeyDown(e, idx, 3)}
                                    onChange={(e) => handleUpdateBuilderRow(idx, 'content', e.target.value)}
                                  />
                                </td>
                                <td className="p-4 w-48">
                                  <select
                                    ref={el => cellRefs.current[idx * 5 + 4] = el}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-400 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-500 transition-all appearance-none cursor-pointer"
                                    value={row.next_step_id}
                                    onKeyDown={(e) => handleTableKeyDown(e, idx, 4)}
                                    onChange={(e) => handleUpdateBuilderRow(idx, 'next_step_id', e.target.value)}
                                  >
                                    <option value="">(STOP FLOW)</option>
                                    {csvBuilderRows.filter((_, i) => i !== idx).map(r => (
                                      <option key={r.step_id} value={r.step_id}>{r.step_id}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="p-4 text-center">
                                  <button
                                    onClick={() => handleDeleteBuilderRow(idx)}
                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Remove Step"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sidebar Guide */}
              <div className="w-[360px] border-l border-slate-200 bg-white p-8 flex flex-col gap-8 custom-scrollbar overflow-y-auto">
                <div className="space-y-4">
                  <h4 className="text-slate-400 text-[10px] font-bold flex items-center gap-2 tracking-widest uppercase">
                      <Zap size={14} className="text-indigo-600" /> KEYBOARD ACCELERATORS
                  </h4>
                  <div className="space-y-3">
                    {[
                      { keys: ['↑', '↓'], desc: 'Navigate vertically' },
                      { keys: ['Tab'], desc: 'Next cell / Next Row' },
                      { keys: ['Enter'], desc: 'Commit & Jump Down' },
                      { keys: ['Shift', 'Tab'], desc: 'Previous Cell' },
                    ].map(s => (
                      <div key={s.desc} className="flex items-center justify-between group">
                        <span className="text-[10px] text-slate-500 font-bold group-hover:text-slate-900 transition-colors uppercase tracking-tight">{s.desc}</span>
                        <div className="flex gap-1.5">
                          {s.keys.map(k => (
                            <kbd key={k} className="px-1.5 py-0.5 bg-slate-50 border-b-2 border-slate-300 rounded text-[9px] font-bold text-slate-600 shadow-sm">{k}</kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-600 rounded-lg text-white">
                        <Zap size={14} />
                      </div>
                      <h4 className="text-indigo-900 text-xs font-bold uppercase tracking-wider">Sync Logic</h4>
                    </div>
                    <p className="text-[11px] text-indigo-700/80 leading-relaxed font-medium">
                      Blueprint your workflow in real-time. Export the CSV and upload it to the visual canvas to materialize the nodes and connections instantly.
                    </p>
                    <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[11px] font-bold text-white cursor-pointer transition-all shadow-lg shadow-indigo-600/20">
                      <Upload size={14} /> IMPORT AS FLOW
                      <input type="file" className="hidden" accept=".csv" onChange={handleUploadSimplified} />
                    </label>
                  </div>

                  <div className="space-y-4 border-t border-slate-100 pt-6">
                    <h4 className="text-slate-400 text-[10px] font-bold flex items-center gap-2 tracking-widest uppercase">
                      <Code size={14} className="text-pink-600" /> Pabbly Migration
                    </h4>
                    <p className="text-[10px] text-slate-500 font-medium italic leading-relaxed">Paste Pabbly workflow JSON to auto-convert external logic into this builder format.</p>
                    <textarea
                      className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-mono text-slate-600 focus:border-indigo-500 outline-none transition-all resize-none shadow-inner"
                      placeholder="Paste JSON..."
                      value={pabblyJSON}
                      onChange={(e) => setPabblyJSON(e.target.value)}
                    />
                    <Button
                      onClick={handleMigratePabbly}
                      className="w-full bg-pink-50 border border-pink-100 text-pink-600 hover:bg-pink-600 hover:text-white text-xs font-bold h-11 transition-all rounded-xl shadow-sm"
                    >
                      MIGRATE STEPS
                    </Button>
                  </div>

                  <div className="space-y-4 border-t border-slate-100 pt-6">
                    <h4 className="text-slate-400 text-[10px] font-bold flex items-center gap-2 tracking-widest uppercase">
                      <Info size={14} className="text-emerald-600" /> Module Guide
                    </h4>
                    <div className="space-y-4">
                      {Object.keys(CATEGORY_MAP).map(cat => (
                        <div key={cat} className="space-y-2">
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cat} Layer</p>
                           <ul className="space-y-1.5">
                              {CATEGORY_MAP[cat].slice(0, 3).map(m => (
                                <li key={m.value} className="text-[10px] text-slate-500 flex items-center gap-2 font-medium">
                                   <m.icon size={12} className="text-slate-400" /> {m.label}
                                </li>
                              ))}
                              <li className="text-[9px] text-indigo-600 font-bold pl-5 cursor-pointer hover:underline" onClick={() => setIsCSVGuideOpen(true)}>+ View all modules</li>
                           </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isCSVGuideOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-slate-900/40 backdrop-blur-md animate-in zoom-in-95 duration-300">
            <div className="bg-white w-full max-w-4xl border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
               <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm">
                        <Info size={24} />
                     </div>
                     <div>
                        <h3 className="text-slate-900 text-xl font-bold tracking-tight">Technical Reference</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Automation node dictionary & configuration rules</p>
                     </div>
                  </div>
                  <button onClick={() => setIsCSVGuideOpen(false)} className="p-3 text-slate-400 hover:text-slate-900 transition-colors bg-slate-50 rounded-full hover:bg-slate-100">
                     <X size={24} />
                  </button>
               </div>
               <div className="p-10 overflow-y-auto grid grid-cols-3 gap-10 bg-white">
                  {Object.keys(CATEGORY_MAP).map(cat => (
                    <div key={cat} className="space-y-6">
                       <h4 className="text-indigo-600 text-xs font-bold uppercase tracking-widest border-b border-indigo-50 pb-2">{cat} modules</h4>
                       <div className="space-y-8">
                          {CATEGORY_MAP[cat].map(m => (
                             <div key={m.value} className="space-y-2 group">
                                <div className="flex items-center gap-3 group-hover:translate-x-1 transition-transform">
                                   <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors border border-slate-100">
                                      <m.icon size={14} />
                                   </div>
                                   <span className="text-xs font-bold text-slate-900">{m.label}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 pl-9 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 font-medium italic">Example: {m.placeholder}</p>
                             </div>
                          ))}
                       </div>
                    </div>
                  ))}
               </div>
               <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center italic text-[10px] text-slate-400 font-bold tracking-wide uppercase">
                  Select these types in the Step Type column to ensure valid automation builds.
               </div>
            </div>
          </div>
        )}
        <GallerySelectModal
          isOpen={showGalleryModal}
          onClose={() => setShowGalleryModal(false)}
          onSelect={(url) => {
            const isVideo = /\.(mp4|mov|webm)$/i.test(url);
            const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(url);
            updateNodeFields(selectedNode?.id, {
              headerUrl: url,
              headerFileName: url.split('/').pop(),
              headerType: isVideo ? 'video' : isImage ? 'image' : 'document'
            });
            setShowGalleryModal(false);
          }}
          resourceType={selectedNode?.data?.headerType === 'video' ? 'video' : selectedNode?.data?.headerType === 'document' ? 'raw' : 'image'}
        />
        <InlineMetaTemplateModal
          isOpen={isInlineTemplateModalOpen}
          onClose={() => setIsInlineTemplateModalOpen(false)}
          onSubmitted={(template) => {
            setInlineTemplateNotice(`"${template.name}" was submitted to Meta for approval. Refresh or reopen this workflow after Meta approves it.`);
          }}
        />
      </div>
    </div>
  );
}

const DraggableBlock = ({ type, actionType, label, icon: Icon, color, onAdd, disabledDrag }) => {
  const onDragStart = (event, nodeType, actType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (actType) {
      event.dataTransfer.setData('application/actiontype', actType);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg ${disabledDrag ? 'cursor-pointer' : 'cursor-grab'
        } hover:border-blue-400 hover:shadow-sm transition-all`}
      onDragStart={disabledDrag ? undefined : (event) => onDragStart(event, type, actionType)}
      draggable={!disabledDrag}
      onClick={() => {
        if (onAdd) onAdd(type, actionType);
      }}
    >
      <div className={`p-2 rounded-md ${color} text-white`}>
        <Icon size={16} />
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
  );
};



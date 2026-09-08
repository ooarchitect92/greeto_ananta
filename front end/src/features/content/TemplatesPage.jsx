'use strict';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Plus, Search, Smartphone, Image as ImageIcon, CheckCircle, Clock, AlertCircle, ChevronRight, FileText, MoreVertical, RefreshCw, Send, Upload, Megaphone, Ticket, Timer, ShoppingBag, Bell, ShieldCheck, ArrowLeft, Video, Trash2, Star, LayoutGrid, List, Folder, FolderOpen, Pencil, X, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { getTemplates, createTemplate, sendTestTemplate, uploadTemplateExampleMedia, uploadTemplateTestMedia, deleteTemplate, getTemplateFolders, createTemplateFolder, updateTemplateFolder, deleteTemplateFolder, assignTemplateToFolder, getWhatsAppSettings } from './api.js';
import { GallerySelectModal } from '../media/GallerySelectModal.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import WorkspaceEmptyState from '../../components/ui/WorkspaceEmptyState.jsx';
export default function TemplatesPage({ onNavigate }) {
  const [selectedId, setSelectedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showTypeSelection, setShowTypeSelection] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Test Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testSelectedTemplate, setTestSelectedTemplate] = useState('');
  const [testVariables, setTestVariables] = useState({});
  const [sendingTest, setSendingTest] = useState(false);
  const [showGallerySelect, setShowGallerySelect] = useState(false);
  const [galleryResourceType, setGalleryResourceType] = useState('auto');
  const [testHeaderMedia, setTestHeaderMedia] = useState('');
  const testHeaderFileInputRef = React.useRef(null);
  const [isUploadingTestHeader, setIsUploadingTestHeader] = useState(false);

  // Templates Data
  const [templates, setTemplates] = useState([]);
  const [linkedPhones, setLinkedPhones] = useState([]);
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState('ALL');
  const [creationStep, setCreationStep] = useState('MAIN_CATEGORY'); // MAIN_CATEGORY, SUB_CATEGORY, FORM
  const isGroupView = false;
  const [viewMode, setViewMode] = useState('folders'); // 'folders' | 'list' | 'course_dashboard'
  const [selectedCourseGroup, setSelectedCourseGroup] = useState(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkStatus, setBulkStatus] = useState(null);
  const [bulkProgress, setBulkProgress] = useState([]);
  const [movingId, setMovingId] = useState(null);

  // Folder state
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null); // folder object when drilling in
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderEmoji, setNewFolderEmoji] = useState('📁');
  const [newFolderColor, setNewFolderColor] = useState('#6366f1');
  const [editingFolder, setEditingFolder] = useState(null); // folder being renamed
  const [editFolderName, setEditFolderName] = useState('');
  const [folderSearch, setFolderSearch] = useState('');
  const [assigningTemplate, setAssigningTemplate] = useState(null); // template name being assigned
  const [pendingFolderAssignment, setPendingFolderAssignment] = useState(null); // folder to auto-assign after template creation
  const [headerVarExample, setHeaderVarExample] = useState(''); // example for {{1}} in text header
  const activeLinkedPhones = linkedPhones.filter((phone) => phone?.is_active !== false && phone?.phone_number_id);
  const hasActiveWhatsApp = activeLinkedPhones.length > 0;

  React.useEffect(() => {
    const fetchPhones = async () => {
      try {
        // Use the authenticated settings client so this view reads the same
        // workspace-scoped WhatsApp connection state as Integrations.
        const data = await getWhatsAppSettings();
        setLinkedPhones(Array.isArray(data?.allSettings) ? data.allSettings : []);
      } catch (e) {
        console.error("Failed to fetch phones", e);
        setLinkedPhones([]);
      }
    };
    fetchPhones();
  }, []);

  // Folder fetch + handlers
  const fetchFolders = React.useCallback(async () => {
    setFoldersLoading(true);
    try {
      const res = await getTemplateFolders();
      setFolders(res.folders || []);
    } catch (e) {
      console.error('Failed to fetch folders', e);
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createTemplateFolder(newFolderName.trim(), newFolderColor, newFolderEmoji);
      setNewFolderName('');
      setNewFolderEmoji('📁');
      setNewFolderColor('#6366f1');
      setShowCreateFolder(false);
      fetchFolders();
    } catch (e) {
      console.error('Failed to create folder', e);
    }
  };

  const handleRenameFolder = async (folder) => {
    if (!editFolderName.trim() || editFolderName.trim() === folder.name) {
      setEditingFolder(null);
      return;
    }
    try {
      await updateTemplateFolder(folder.id, { name: editFolderName.trim() });
      if (selectedFolder?.id === folder.id) {
        setSelectedFolder(f => ({ ...f, name: editFolderName.trim() }));
      }
      setEditingFolder(null);
      fetchFolders();
    } catch (e) {
      console.error('Failed to rename folder', e);
    }
  };

  const handleDeleteFolder = async (folder) => {
    if (!(await confirmAction({
      title: 'Delete template folder?',
      message: `Delete folder "${folder.name}"? Templates inside will become unassigned.`,
      confirmLabel: 'Delete folder',
      tone: 'danger',
    }))) return;
    try {
      await deleteTemplateFolder(folder.id);
      if (selectedFolder?.id === folder.id) setSelectedFolder(null);
      fetchFolders();
    } catch (e) {
      console.error('Failed to delete folder', e);
    }
  };

  const handleAssignToFolder = async (templateName, folderName) => {
    setAssigningTemplate(templateName);
    try {
      await assignTemplateToFolder(templateName, folderName);
      await fetchTemplatesData();
      fetchFolders();
    } catch (e) {
      console.error('Failed to assign template to folder', e);
    } finally {
      setAssigningTemplate(null);
    }
  };

  const FOLDER_COLORS = [
    '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4',
  ];

  const FOLDER_EMOJIS = ['📁', '📂', '✉️', '🎯', '🚀', '💼', '📊', '🌟', '🔥', '💡', '📝', '🎓'];

  const [selectedMainCategory, setSelectedMainCategory] = useState(null);

  // Variable Editor State
  const [newVarName, setNewVarName] = useState('');
  const [newVarExample, setNewVarExample] = useState('');

  const MAIN_CATEGORIES = [
    {
      id: 'MARKETING',
      label: 'Marketing',
      description: 'Promote products, services, and offers to your customers.',
      icon: Megaphone,
      color: 'bg-blue-50 text-blue-600'
    },
    {
      id: 'UTILITY',
      label: 'Utility',
      description: 'Confirm transactions, update orders, and deliver alerts.',
      icon: Bell,
      color: 'bg-emerald-50 text-emerald-600'
    },
    {
      id: 'AUTHENTICATION',
      label: 'Authentication',
      description: 'Send one-time passwords for account verification.',
      icon: ShieldCheck,
      color: 'bg-slate-50 text-slate-600'
    }
  ];

  const MARKETING_SUB_TYPES = [
    { value: 'CUSTOM', label: 'Custom Marketing', description: 'Flexible message for any promotion.', icon: Megaphone },
    { value: 'COUPON', label: 'Coupon Code', description: 'Send exclusive discount codes.', icon: Ticket },
    { value: 'LIMITED_TIME', label: 'Limited-time Offer', description: 'Create urgency with expiration.', icon: Timer },
    { value: 'CATALOG', label: 'Catalog Message', description: 'Showcase your product catalog.', icon: ShoppingBag },
    { value: 'CAROUSEL', label: 'Product Carousel', description: 'Scrollable cards for multiple products.', icon: ImageIcon },
    { value: 'MULTI_PRODUCT', label: 'Multi-product', description: 'Highlight a selection of items.', icon: ShoppingBag },
    { value: 'SINGLE_PRODUCT', label: 'Single-product', description: 'Feature one specific product.', icon: ShoppingBag },
    { value: 'CALL_PERMISSION', label: 'Call Permission', description: 'Request permission to call.', icon: Smartphone },
  ];

  const fetchTemplatesData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!hasActiveWhatsApp) {
        setTemplates([]);
        return;
      }
      const pid = selectedPhoneNumberId === 'ALL' ? null : selectedPhoneNumberId;
      const res = await getTemplates(pid);
      if (res && Array.isArray(res.data)) {
        const mapped = res.data.map(t => {
          if (!t.components || !Array.isArray(t.components)) return { ...t, components: [], status: t.status || 'PENDING' };

          const bodyComp = t.components.find(c => c.type === 'BODY');
          const headerComp = t.components.find(c => c.type === 'HEADER');
          const footerComp = t.components.find(c => c.type === 'FOOTER');
          const buttonsComp = t.components.find(c => c.type === 'BUTTONS');

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
            id: t.id,
            name: t.name,
            language: t.language,
            status: t.status, // Meta returns APPROVED, PENDING, REJECTED (uppercase)
            category: t.category,
            headerType: headerComp ? headerComp.format : 'NONE',
            headerText: headerComp && headerComp.format === 'TEXT' ? headerComp.text : '',
            headerHandle,
            bodyText: bodyComp ? bodyComp.text : '',
            footerText: footerComp ? footerComp.text : '',
            buttons: buttonsComp ? buttonsComp.buttons : [],
            parameterFormat: t.parameter_format || 'POSITIONAL',
            examples,
            phoneNumberId: t.phoneNumberId,
            displayPhoneNumber: t.displayPhoneNumber,
            isLocal: t.isLocal,
            isStarred: t.is_starred,
            courseGroup: t.course_group || null
          };
        });
        setTemplates(mapped);
      } else if (res && res.error) {
        throw new Error(res.error);
      } else {
        // Handle empty or unexpected response
        setTemplates([]);
      }
    } catch (err) {
      console.error('Failed to fetch templates', err);
      setError('Failed to load templates. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchTemplatesData();
  }, [selectedPhoneNumberId, hasActiveWhatsApp]);

  const [formData, setFormData] = useState(null);
  const bodyTextareaRef = React.useRef(null);

  function getGroup(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('cpa')) return 'CPA';
    if (n.includes('cma')) return 'CMA US';
    if (n.includes('acca')) return 'ACCA';
    if (n.includes('ea')) return 'EA';
    return 'General';
  }

    const fetchCourseList = () => {
        const groups = ['CPA', 'CMA US', 'ACCA', 'EA'];
        const counts = templates.reduce((acc, t) => {
            const g = t.courseGroup || getGroup(t.name);
            acc[g] = (acc[g] || 0) + 1;
            return acc;
        }, {});
        return [...groups, 'General'].map(g => ({
            name: g,
            count: counts[g] || 0
        }));
    };

    const handleMoveGroup = async (templateName, newGroup) => {
        setMovingId(templateName);
        try {
            const res = await fetch(`/api/templates/${templateName}/group`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ group: newGroup })
            });
            if (res.ok) {
                await fetchTemplatesData();
            }
        } catch (e) {
            console.error("Failed to move group", e);
        } finally {
            setMovingId(null);
        }
    };

  React.useEffect(() => {
    // If we are creating but haven't selected a type yet, don't set formData
    if (isCreating && showTypeSelection) {
      setFormData(null);
      return;
    }

    if (isCreating && !formData) {
      // This case is handled by handleTypeSelect now
    } else if (selectedId) {
      const t = templates.find(t => t.id === selectedId);
      if (t) setFormData({ ...t, variables: [], subCategory: 'CUSTOM', parameterFormat: 'POSITIONAL' }); // Default legacy to positional
    }
  }, [selectedId, isCreating, templates, showTypeSelection]);

    // ── FOLDERS VIEW ──────────────────────────────────────────────────────────
    if (viewMode === 'folders') {
      const folderTemplates = selectedFolder
        ? templates.filter(t => t.courseGroup === selectedFolder.name)
        : [];
      const unassigned = templates.filter(t => !t.courseGroup);
      const filteredFolderTemplates = folderTemplates.filter(t =>
        t.name.toLowerCase().includes(folderSearch.toLowerCase())
      );
      const statusCounts = templates.reduce((acc, template) => {
        const status = String(template.status || 'PENDING').toUpperCase();
        if (status === 'APPROVED') acc.approved += 1;
        else if (status === 'REJECTED') acc.rejected += 1;
        else if (status === 'DRAFT') acc.draft += 1;
        else acc.pending += 1;
        return acc;
      }, { approved: 0, pending: 0, draft: 0, rejected: 0 });
      const starredCount = templates.filter(t => t.isStarred || t.is_starred).length;

      // ── Inside a folder ──
      if (selectedFolder) {
        return (
          <div className="flex-1 flex flex-col h-full bg-[#f3f1f8] overflow-hidden">
            {/* Header */}
            <div className="border-b border-purple-100 bg-[#f3f1f8] px-6 py-4 shrink-0">
              <div className="rounded-[26px] border border-white bg-white/95 p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
              <button onClick={() => { setSelectedFolder(null); setFolderSearch(''); }}
                className="h-10 w-10 shrink-0 rounded-2xl border border-purple-100 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors flex items-center justify-center shadow-sm">
                <ArrowLeft size={18} />
              </button>
              <span className="relative text-2xl h-12 w-12 rounded-[20px] shadow-sm shadow-purple-100 border border-white flex items-center justify-center" style={{ backgroundColor: `${selectedFolder.color || '#7c3aed'}20` }}>{selectedFolder.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-purple-500">Template Folder</p>
                <h1 className="font-bold text-slate-950 text-2xl leading-tight truncate">{selectedFolder.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-2xl border border-purple-100 bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700"><span className="text-sm">{folderTemplates.length}</span> assigned</span>
                  <span className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><span className="text-sm">{folderTemplates.filter(t => t.status === 'APPROVED').length}</span> approved</span>
                  <span className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600"><span className="text-sm">{unassigned.length}</span> loose</span>
                </div>
              </div>
                  </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={folderSearch} onChange={e => setFolderSearch(e.target.value)}
                    placeholder="Search templates in folder..."
                    className="h-11 pl-11 pr-4 rounded-2xl border border-purple-100 text-sm font-semibold bg-[#f8f5ff] w-full sm:w-72 focus:outline-none focus:ring-4 focus:ring-purple-100 focus:bg-white shadow-inner" />
                </div>
                <Button onClick={() => { setPendingFolderAssignment(selectedFolder); setViewMode('list'); setIsCreating(true); setShowTypeSelection(true); }}
                  className="h-11 px-5 text-sm rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 hover:from-purple-800 hover:to-fuchsia-700 text-white font-bold shadow-lg shadow-purple-200">
                  <Plus size={15} className="mr-2" /> New Template
                </Button>
              </div>
                </div>
              </div>
            </div>

            {/* Template list */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredFolderTemplates.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-[32px] border border-dashed border-purple-200 bg-white text-center shadow-sm">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] bg-purple-50 text-5xl">{selectedFolder.emoji}</div>
                  <p className="text-lg font-bold text-slate-800">No templates in this folder</p>
                  <p className="mt-1 text-sm font-semibold text-slate-400">Create a template or assign one from the unassigned pool below.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {filteredFolderTemplates.map(t => (
                    <div key={t.id} className="group overflow-hidden rounded-[24px] border border-white bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-100">
                      <div className="h-1.5 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-emerald-400" />
                      <div className="p-4">
                      <div className="flex items-start justify-between mb-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                            <Badge variant="outline" className="rounded-full border-purple-100 bg-purple-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-purple-700">{t.category || 'Template'}</Badge>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{t.language || 'en'}</span>
                          </div>
                          <p className="font-bold text-slate-950 text-base truncate">{t.name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-400">WhatsApp template asset</p>
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          {t.status === 'APPROVED' && <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle size={15} /></span>}
                          {t.status === 'PENDING' && <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><Clock size={15} /></span>}
                          {t.status === 'REJECTED' && <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-red-50 text-red-600"><AlertCircle size={15} /></span>}
                          <button onClick={() => handleAssignToFolder(t.name, null)}
                            title="Remove from folder"
                            className="opacity-0 group-hover:opacity-100 flex h-8 w-8 items-center justify-center rounded-2xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all">
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="min-h-24 rounded-[20px] border border-purple-50 bg-[#faf7ff] p-3">
                        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-400">
                          <Smartphone size={12} />
                          Message Preview
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-4 leading-relaxed font-medium">{t.bodyText || 'No message body available for preview.'}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button onClick={() => { setSelectedId(t.id); setViewMode('list'); }}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-purple-800">View <ChevronRight size={14} /></button>
                        <span className="text-slate-200">·</span>
                        <button onClick={() => { setIsTestModalOpen(true); setTestSelectedTemplate(t.name); }}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-2xl border border-purple-100 bg-white px-3 text-xs font-bold text-purple-700 transition hover:bg-purple-50"><Send size={13} /> Test</button>
                      </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Unassigned templates at bottom for easy drag-assign */}
              {unassigned.length > 0 && (
                <div className="mt-8 rounded-[32px] border border-white bg-white p-6 shadow-sm">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-purple-500">Add from unassigned</p>
                      <h2 className="mt-1 text-xl font-bold text-slate-950">{unassigned.length} loose templates</h2>
                    </div>
                    <p className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">Click any chip to assign</p>
                  </div>
                  <div className="flex max-h-52 flex-wrap gap-2 overflow-y-auto pr-1">
                    {unassigned.filter(t => t.name.toLowerCase().includes(folderSearch.toLowerCase())).map(t => (
                      <button key={t.id} onClick={() => handleAssignToFolder(t.name, selectedFolder.name)}
                        disabled={assigningTemplate === t.name}
                        className="flex items-center gap-1.5 rounded-full border border-purple-100 bg-[#faf7ff] px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 disabled:opacity-50">
                        {assigningTemplate === t.name ? <RefreshCw size={11} className="animate-spin" /> : <Plus size={11} />}
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }

      // ── Folders grid ──
      return (
        <div className="flex-1 flex flex-col h-full bg-[#f7f7fb] overflow-hidden">
          {/* Header */}
          <div className="border-b border-slate-200/80 bg-white px-8 py-6 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                <FileText size={21} />
              </div>
              <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-purple-600">Content library</p>
              <h1 className="mt-0.5 text-2xl font-semibold text-slate-950">Message Templates</h1>
              <p className="text-sm text-slate-500">{folders.length} folders · {templates.length} templates total</p>
            </div>
              </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={fetchTemplatesData}
                disabled={!hasActiveWhatsApp}
                title={hasActiveWhatsApp ? 'Sync templates from Meta' : 'Connect WhatsApp to sync Meta templates'}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Sync Meta
              </button>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(true)}
                disabled={!hasActiveWhatsApp}
                title={hasActiveWhatsApp ? 'Bulk import templates' : 'Connect WhatsApp before importing Meta templates'}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-purple-100 bg-purple-50 px-4 text-sm font-semibold text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload size={16} /> Bulk Import
              </button>
              <button
                type="button"
                onClick={() => setShowCreateFolder(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <FolderOpen size={16} /> New Folder
              </button>
              <button
                type="button"
                onClick={() => { setViewMode('list'); setIsCreating(true); setShowTypeSelection(true); setSelectedId(null); setFormData(null); setCreationStep('MAIN_CATEGORY'); }}
                disabled={!hasActiveWhatsApp}
                title={hasActiveWhatsApp ? 'Create a WhatsApp template' : 'Connect WhatsApp before creating Meta templates'}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-purple-700 px-4 text-sm font-semibold text-white shadow-md shadow-purple-500/20 transition hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={16} /> Create Template
              </button>
            </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 pb-10 pt-6">
            {!hasActiveWhatsApp && (
              <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-violet-200 bg-violet-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">WhatsApp is not connected</p>
                  <p className="mt-1 text-sm text-slate-600">Folders stay available for planning. Meta template sync, creation, import, and test sends unlock after you connect a WhatsApp number.</p>
                </div>
                <button type="button" onClick={() => onNavigate?.('integrations')} className="inline-flex shrink-0 items-center justify-center rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-800">
                  Open integrations
                </button>
              </div>
            )}
            <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { icon: FolderOpen, label: 'Total Groups', value: folders.length, action: null },
                { icon: FileText, label: 'Templates', value: templates.length, action: () => setViewMode('list') },
                { icon: Folder, label: 'Loose Templates', value: unassigned.length, action: () => setViewMode('list') },
                { icon: Star, label: 'Starred', value: starredCount, action: () => setViewMode('list') },
              ].map(item => {
                const Icon = item.icon;
                const content = (
                  <div className="flex min-h-[102px] items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-purple-200 hover:shadow-md">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                      <Icon size={19} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">{item.label}</p>
                      <p className="mt-1 text-2xl font-semibold leading-tight text-slate-950">{item.value}</p>
                      {/* {item.action && <p className="mt-1 text-xs font-bold text-purple-600">Click to view list</p>} */}
                    </div>
                  </div>
                );
                return item.action ? (
                  <button key={item.label} type="button" onClick={item.action} className="text-left">
                    {content}
                  </button>
                ) : (
                  <div key={item.label}>{content}</div>
                );
              })}
            </div>

            <div className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { label: 'Approved', value: statusCounts.approved, helper: 'Ready for campaigns and workflows', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
                { label: 'Pending Approval', value: statusCounts.pending, helper: 'Not approved yet', className: 'border-amber-200 bg-amber-50 text-amber-700' },
                { label: 'Draft', value: statusCounts.draft, helper: 'Saved but not submitted', className: 'border-slate-200 bg-slate-50 text-slate-600' },
                { label: 'Rejected', value: statusCounts.rejected, helper: 'Needs changes before use', className: 'border-red-200 bg-red-50 text-red-700' },
              ].map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="min-h-[116px] rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-purple-200 hover:shadow-md"
                >
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${item.className}`}>
                    {item.label}
                  </span>
                   <p className="mt-3 text-2xl font-semibold text-slate-950">{item.value}</p>
                   <p className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</p>
                </button>
              ))}
            </div>

            <div className="mb-6 inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {['All Groups', 'Course Dashboard', 'Recently Updated', 'Most Used', 'Shared with Me'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => tab === 'Course Dashboard' ? setViewMode('course_dashboard') : setViewMode('folders')}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    (tab === 'Course Dashboard' && viewMode === 'course_dashboard') || (tab === 'All Groups' && viewMode !== 'course_dashboard')
                      ? 'bg-white text-purple-700 shadow-sm'
                      : 'text-slate-500 hover:bg-white/70 hover:text-purple-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            {foldersLoading ? (
              <div className="flex items-center justify-center h-40">
                <GreetoLoader label="Loading templates..." sublabel="Fetching template groups" />
              </div>
            ) : (
              <>
                {/* Folder cards grid */}
                {folders.length === 0 && !showCreateFolder ? (
                  <div className="rounded-3xl border border-dashed border-violet-200 bg-white">
                    <div className="text-5xl mb-4">📁</div>
                    <WorkspaceEmptyState
                      title="Organize your first message template"
                      description="Create a folder for reusable messages. Templates can be created now and synced to Meta after a channel is connected."
                      primaryLabel="Create folder"
                      onPrimary={() => setShowCreateFolder(true)}
                      secondaryLabel="Open integrations"
                      onSecondary={() => onNavigate?.('integrations')}
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="flex min-h-[280px] flex-col justify-between self-start rounded-2xl bg-[#25114c] p-6 text-white shadow-lg shadow-purple-950/10 xl:sticky xl:top-5">
                      <div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-purple-100"><FolderOpen size={21} /></div>
                        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-purple-200">Template library</p>
                        <p className="mt-2 text-3xl font-semibold">{folders.length} folders</p>
                        <p className="mt-2 text-sm leading-6 text-purple-100/80">Organise approved content by program, audience, or campaign purpose.</p>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-white/10 px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-purple-200">Templates</p><p className="mt-1 text-lg font-semibold text-white">{templates.length}</p></div>
                          <div className="rounded-xl bg-white/10 px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-purple-200">Approved</p><p className="mt-1 text-lg font-semibold text-white">{statusCounts.approved}</p></div>
                        </div>
                      </div>
                      <button type="button" onClick={() => setViewMode('list')} className="flex items-center justify-between border-t border-white/10 pt-5 text-left text-sm text-purple-100 hover:text-white">
                        <span>Unassigned templates</span><span className="font-semibold text-white">{unassigned.length}</span>
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                        <div><h2 className="text-sm font-semibold text-slate-950">Template folders</h2><p className="mt-1 text-xs text-slate-500">Open, rename, or organise your saved template groups.</p></div>
                        <button type="button" onClick={() => setShowCreateFolder(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-700 hover:text-purple-900"><Plus size={15} /> New folder</button>
                      </div>
                      <div className="divide-y divide-slate-100">
                    {folders.map(folder => (
                      <div key={folder.id}
                        className="group relative flex min-h-[82px] cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-purple-50/40"
                        onClick={() => { setSelectedFolder(folder); setFolderSearch(''); }}>
                        {/* Folder icon */}
                        <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-xl"
                          style={{ backgroundColor: folder.color + '20' }}>
                          {folder.emoji}
                        </div>

                        {/* Rename inline */}
                        <div className="min-w-0 flex-1">
                        {editingFolder?.id === folder.id ? (
                          <input autoFocus
                            value={editFolderName}
                            onChange={e => setEditFolderName(e.target.value)}
                            onBlur={() => handleRenameFolder(folder)}
                            onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(folder); if (e.key === 'Escape') setEditingFolder(null); }}
                            onClick={e => e.stopPropagation()}
                            className="w-full text-sm font-semibold border-b-2 border-purple-400 bg-transparent outline-none text-slate-900 pb-0.5"
                          />
                        ) : (
                          <p className="font-semibold text-slate-950 text-sm leading-tight truncate">{folder.name}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{folder.count} template{folder.count !== 1 ? 's' : ''}</p>
                        </div>

                        {/* Action buttons — show on hover */}
                        <div className="ml-auto flex gap-1 opacity-70 transition-opacity group-hover:opacity-100"
                          onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditingFolder(folder); setEditFolderName(folder.name); }}
                            className="p-1.5 rounded-xl bg-white border border-purple-100 hover:border-purple-300 text-slate-400 hover:text-purple-700 transition-colors shadow-sm">
                            <Pencil size={11} />
                          </button>
                          <button onClick={() => handleDeleteFolder(folder)}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 hover:border-red-300 text-slate-400 hover:text-red-500 transition-colors shadow-sm">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Unassigned card */}
                    <div className="flex min-h-[82px] cursor-pointer items-center gap-4 bg-slate-50/70 px-5 py-4 transition-colors hover:bg-purple-50/60"
                      onClick={() => setViewMode('list')}>
                      <div className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-xl bg-white">
                        📋
                      </div>
                      <div><p className="font-semibold text-slate-950 text-sm leading-tight">Unassigned templates</p><p className="text-xs text-slate-500 mt-1">{unassigned.length} template{unassigned.length !== 1 ? 's' : ''} waiting for a folder</p></div>
                    </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Create Folder inline form */}
            {showCreateFolder && (
              <div className="mt-6 bg-white/95 border border-purple-200 rounded-3xl p-6 max-w-md shadow-sm">
                <p className="font-bold text-slate-900 mb-4">New Folder</p>

                {/* Emoji picker */}
                <div className="mb-3">
                  <p className="text-xs text-slate-500 font-medium mb-1.5">Icon</p>
                  <div className="flex flex-wrap gap-2">
                    {FOLDER_EMOJIS.map(em => (
                      <button key={em} onClick={() => setNewFolderEmoji(em)}
                        className={cn('w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all',
                          newFolderEmoji === em ? 'bg-purple-100 ring-2 ring-purple-400' : 'bg-slate-50 hover:bg-purple-50')}>
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color picker */}
                <div className="mb-3">
                  <p className="text-xs text-slate-500 font-medium mb-1.5">Color</p>
                  <div className="flex gap-2">
                    {FOLDER_COLORS.map(c => (
                      <button key={c} onClick={() => setNewFolderColor(c)}
                        className={cn('w-7 h-7 rounded-full transition-all', newFolderColor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'opacity-70 hover:opacity-100')}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>

                {/* Name input */}
                <div className="mb-4">
                  <p className="text-xs text-slate-500 font-medium mb-1.5">Folder Name</p>
                  <input autoFocus
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowCreateFolder(false); }}
                    placeholder="e.g. N2 Fresh Leads"
                    className="w-full h-11 px-4 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200" />
                </div>

                {/* Preview */}
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 mb-4 border border-slate-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: newFolderColor + '20' }}>
                    {newFolderEmoji}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{newFolderName || 'Folder name'}</p>
                    <p className="text-xs text-slate-400">0 templates</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}
                    className="flex-1 h-10 bg-purple-700 hover:bg-purple-800 text-white text-sm font-bold rounded-2xl">
                    Create Folder
                  </Button>
                  <Button variant="outline" onClick={() => { setShowCreateFolder(false); setNewFolderName(''); }}
                    className="h-10 px-4 rounded-2xl text-sm">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (viewMode === 'course_dashboard') {
        const courses = fetchCourseList();
        const filteredByCourse = selectedCourseGroup
            ? templates.filter(t => (t.courseGroup || getGroup(t.name)) === selectedCourseGroup)
            : [];

        return (
            <div className="flex-1 flex flex-col h-full bg-[#f3f1f8] relative overflow-hidden">
                {/* Header */}
                <div className="border-b border-white/70 bg-[#f3f1f8] px-8 py-6 flex items-center justify-between flex-shrink-0 z-20">
                    <div className="flex items-center gap-4">
                        {selectedCourseGroup && (
                            <Button variant="ghost" size="icon" aria-label="Back to Course Management" className="rounded-2xl bg-white text-purple-700 shadow-sm hover:bg-purple-50" onClick={() => setSelectedCourseGroup(null)}>
                                <ArrowLeft size={18} />
                            </Button>
                        )}
                        <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-purple-100 flex items-center justify-center text-purple-700">
                            <LayoutGrid size={22} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-950">
                                {selectedCourseGroup ? `${selectedCourseGroup} Curriculum` : 'Course Management'}
                            </h1>
                            <p className="text-sm text-slate-500">
                                {selectedCourseGroup ? `Managing ${filteredByCourse.length} templates in this program` : 'Organize your WhatsApp templates by academic program'}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {!selectedCourseGroup && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewMode('folders')}
                                className="gap-2 rounded-2xl border-purple-100 bg-white px-5 py-3 text-slate-700 shadow-sm hover:bg-purple-50 hover:text-purple-700"
                            >
                                <ArrowLeft size={16} /> Back to Templates
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setViewMode('list')} className="gap-2 rounded-2xl border-purple-100 bg-white px-5 py-3 text-slate-700 shadow-sm">
                            <List size={16} /> Standard View
                        </Button>
                        <Button size="sm" onClick={() => { setViewMode('list'); setIsCreating(true); setShowTypeSelection(true); }} className="gap-2 rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 py-3 text-white shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700">
                            <Plus size={16} /> New Template
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    {!selectedCourseGroup ? (
                        <div className="max-w-7xl mx-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
                                    <div className="text-sm text-slate-500">Course Groups</div>
                                    <div className="mt-2 text-2xl font-bold text-slate-950">{courses.length}</div>
                                </div>
                                <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
                                    <div className="text-sm text-slate-500">Mapped Templates</div>
                                    <div className="mt-2 text-2xl font-bold text-purple-700">{courses.reduce((sum, course) => sum + course.count, 0)}</div>
                                </div>
                                <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
                                    <div className="text-sm text-slate-500">Programs Ready</div>
                                    <div className="mt-2 text-2xl font-bold text-emerald-600">{courses.filter((course) => course.count > 0).length}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {courses.map(course => (
                                    <Card
                                        key={course.name}
                                        className="cursor-pointer group border-white bg-white rounded-3xl shadow-sm hover:shadow-xl hover:shadow-purple-100 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 overflow-hidden"
                                        onClick={() => setSelectedCourseGroup(course.name)}
                                    >
                                        <CardContent className="p-0">
                                            <div className="p-6">
                                                <div className="flex justify-between items-start mb-5">
                                                    <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-700 group-hover:bg-purple-700 group-hover:text-white transition-colors">
                                                        <LayoutGrid size={25} />
                                                    </div>
                                                    <Badge variant="secondary" className="rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                                                        {course.count} Templates
                                                    </Badge>
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-950 mb-2">{course.name}</h3>
                                                <p className="text-sm text-slate-500 line-clamp-2">
                                                    Manage WhatsApp templates and course-specific drip content for {course.name}.
                                                </p>
                                            </div>
                                            <div className="px-6 py-4 bg-purple-50/70 border-t border-purple-100 flex items-center justify-between group-hover:bg-purple-100 transition-colors">
                                                <span className="text-xs font-bold text-purple-700">View program content</span>
                                                <ChevronRight size={16} className="text-purple-500" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
                                    <div className="text-sm text-slate-500">Templates</div>
                                    <div className="mt-2 text-2xl font-bold text-slate-950">{filteredByCourse.length}</div>
                                </div>
                                <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
                                    <div className="text-sm text-slate-500">Approved</div>
                                    <div className="mt-2 text-2xl font-bold text-emerald-600">{filteredByCourse.filter((tmpl) => tmpl.status === 'APPROVED').length}</div>
                                </div>
                                <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
                                    <div className="text-sm text-slate-500">Needs Review</div>
                                    <div className="mt-2 text-2xl font-bold text-amber-600">{filteredByCourse.filter((tmpl) => tmpl.status !== 'APPROVED').length}</div>
                                </div>
                            </div>
                            <div className="bg-white rounded-3xl border border-white overflow-hidden shadow-sm">
                                <div className="p-5 border-b border-purple-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-950">{selectedCourseGroup} Templates</h3>
                                        <p className="text-xs text-slate-500">Review, move and open course templates from one place.</p>
                                    </div>
                                </div>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-purple-50/70 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Template Name</th>
                                            <th className="px-6 py-4">Category</th>
                                            <th className="px-6 py-4">Language</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-purple-50">
                                        {filteredByCourse.map(tmpl => (
                                            <tr key={tmpl.id} className="hover:bg-purple-50/60 transition-colors group">
                                                <td className="px-6 py-4">
                                                    {tmpl.status === 'APPROVED' ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Approved</Badge> :
                                                     tmpl.status === 'REJECTED' ? <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Rejected</Badge> :
                                                     <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">Pending</Badge>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-slate-900">{tmpl.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{tmpl.bodyText}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">{tmpl.category}</td>
                                                <td className="px-6 py-4 text-slate-600">{tmpl.language}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <select
                                                            className="text-[10px] bg-purple-50 border border-purple-100 rounded-xl px-2 py-1 outline-none focus:ring-1 focus:ring-purple-500"
                                                            value={tmpl.courseGroup || getGroup(tmpl.name)}
                                                            onChange={(e) => handleMoveGroup(tmpl.name, e.target.value)}
                                                            disabled={movingId === tmpl.name}
                                                        >
                                                            {['CPA', 'CMA US', 'ACCA', 'EA', 'General'].map(g => (
                                                                <option key={g} value={g}>Move to {g}</option>
                                                            ))}
                                                        </select>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="opacity-0 group-hover:opacity-100 rounded-xl text-purple-700 hover:bg-purple-50"
                                                            onClick={() => { setViewMode('list'); setSelectedId(tmpl.id); }}
                                                        >
                                                            <ChevronRight size={16} />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredByCourse.length === 0 && (
                                    <div className="p-12 text-center">
                                        <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <FileText className="text-purple-300" size={32} />
                                        </div>
                                        <p className="text-slate-500 font-medium">No templates assigned to this program yet.</p>
                                        <Button variant="link" className="text-purple-700 mt-2" onClick={() => setViewMode('list')}>Go to standard view</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

  const resolvedHeaderPreviewUrl = formData?.headerPreviewUrl || (formData?.headerHandle ? `/api/media/preview?handle=${formData.headerHandle}&phoneNumberId=${formData.phoneNumberId || linkedPhones[0]?.phone_number_id}` : null);

  const handleMainCategorySelect = (category) => {
    setSelectedMainCategory(category);
    if (category.id === 'MARKETING') {
      setCreationStep('SUB_CATEGORY');
    } else {
      // Initialize for Utility/Authentication
      const defaultBody = category.id === 'UTILITY'
        ? 'Hello {{name}}, your order {{order_id}} has been updated.'
        : category.id === 'AUTHENTICATION'
          ? '*{{1}}* is your verification code. For your security, do not share this code.'
          : '';

      const defaultVariables = category.id === 'UTILITY'
        ? [{ name: 'name', example: 'John' }, { name: 'order_id', example: '#12345' }]
        : category.id === 'AUTHENTICATION'
          ? [{ name: '1', example: '123456' }]
          : []; // Authentication templates use preset variables

      const defaultButtons = category.id === 'AUTHENTICATION'
        ? [{ type: 'COPY_CODE', text: 'Copy Code', otp_type: 'COPY_CODE' }]
        : [];

      setFormData({
        id: 'new',
        name: '',
        language: 'en_US',
        status: 'draft',
        category: category.id,
        subCategory: 'CUSTOM',
        parameterFormat: category.id === 'AUTHENTICATION' ? 'POSITIONAL' : 'NAMED',
        headerType: 'NONE',
        headerText: '',
        bodyText: defaultBody,
        variables: defaultVariables,
        footerText: '',
        buttons: defaultButtons
      });
      setShowTypeSelection(false);
    }
  };

  const handleSubCategorySelect = (subType) => {
    // Initialize form based on sub-type
    let defaultBody = 'Hello {{name}}, check out our latest offers!';
    let defaultButtons = [];
    let defaultVariables = [{ name: 'name', example: 'John' }];

    if (subType.value === 'COUPON') {
      defaultBody = 'Here is your exclusive code {{code}} for {{discount}} off!';
      defaultButtons = [{ type: 'COPY_CODE', example: 'SAVE20' }];
      defaultVariables = [{ name: 'code', example: 'SAVE20' }, { name: 'discount', example: '20%' }];
    } else if (subType.value === 'LIMITED_TIME') {
      defaultBody = 'Hurry! Offer expires in {{hours}} hours.';
      defaultButtons = [{ type: 'URL', text: 'Shop Now', url: 'https://example.com' }];
      defaultVariables = [{ name: 'hours', example: '24' }];
    } else if (subType.value === 'CATALOG') {
      defaultBody = 'Hello! Check out our new catalog.';
    } else if (subType.value === 'CAROUSEL') {
      defaultBody = 'Check out these items specially picked for you!';
    } else if (subType.value === 'CALL_PERMISSION') {
      defaultBody = 'We would like to call you to help support your order.';
      defaultButtons = [];
      defaultVariables = [];
    }

    setFormData({
      id: 'new',
      name: '',
      language: 'en_US',
      status: 'draft',
      category: 'MARKETING',
      subCategory: subType.value,
      parameterFormat: 'NAMED',
      headerType: 'NONE',
      headerText: '',
      bodyText: defaultBody,
      variables: defaultVariables,
      footerText: '',
      buttons: defaultButtons
    });
    setShowTypeSelection(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !formData) return;

    const type = formData.headerType;
    const size = file.size;
    const mime = file.type || '';

    if (type === 'IMAGE') {
      const max = 5 * 1024 * 1024;
      const isValidMime = mime === 'image/jpeg' || mime === 'image/png';
      if (!isValidMime || size > max) {
        alert('Image must be JPEG or PNG and up to 5 MB.');
        e.target.value = '';
        return;
      }
    } else if (type === 'VIDEO') {
      const max = 16 * 1024 * 1024;
      const isValidMime = mime === 'video/mp4' || mime === 'video/3gpp';
      if (!isValidMime || size > max) {
        alert('Video must be MP4 or 3GPP and up to 16 MB.');
        e.target.value = '';
        return;
      }
    } else if (type === 'DOCUMENT') {
      const max = 100 * 1024 * 1024;
      if (size > max) {
        alert('Document must be up to 100 MB.');
        e.target.value = '';
        return;
      }
    }

    const previewUrl = URL.createObjectURL(file);

    setFormData(prev => ({
      ...prev,
      headerFile: file,
      headerFileName: file.name,
      headerPreviewUrl: previewUrl,
      headerHandle: null
    }));
  };

  const handleClearHeaderFile = () => {
    setFormData(prev => ({
      ...prev,
      headerFile: null,
      headerFileName: null,
      headerPreviewUrl: null,
      headerHandle: null
    }));
  };

  const handleSave = async () => {
    if (isCreating) {
      // Validation
      if (!formData.name) { alert('Please enter a template name'); return; }
      if (!formData.bodyText) { alert('Please enter body text'); return; }

      // Validate Variable Position
      const trimmedBody = formData.bodyText.trim();
      // Check for variable at start: {{...}} at index 0
      if (/^\{\{[^}]+\}\}/.test(trimmedBody)) {
        alert('Variables cannot be at the very start of the body text. Please add some text before the variable.');
        return;
      }
      // Check for variable at end: {{...}} at the end
      if (/\{\{[^}]+\}\}$/.test(trimmedBody)) {
        alert('Variables cannot be at the very end of the body text. Please add some text or punctuation after the variable.');
        return;
      }

      // Validate Buttons
      if (formData.buttons && formData.buttons.length > 0) {
        if (formData.subCategory === 'CALL_PERMISSION') {
          alert('Call Permission templates cannot have additional buttons.');
          return;
        }

        const hasQuickReply = formData.buttons.some(b => b.type === 'QUICK_REPLY');
        const hasCTA = formData.buttons.some(b => ['URL', 'PHONE_NUMBER'].includes(b.type));
        const hasCopyCode = formData.buttons.some(b => b.type === 'COPY_CODE');

        if (hasQuickReply && (hasCTA || hasCopyCode)) {
          alert('You cannot mix Quick Reply buttons with Call to Action / Copy Code buttons.');
          return;
        }

        if (formData.subCategory === 'COUPON' && !hasCopyCode) {
          alert('Coupon templates must have a Copy Code button.');
          return;
        }

        if (hasCopyCode) {
          const copyBtn = formData.buttons.find(b => b.type === 'COPY_CODE');
          if (!copyBtn.example) {
            alert('Please provide an example code for the Copy Code button.');
            return;
          }
        }

        if (hasCTA && formData.buttons.length > 2) {
          alert('You can only have up to 2 Call to Action buttons.');
          return;
        }
      } else if (formData.subCategory === 'COUPON') {
        alert('Coupon templates must have a Copy Code button.');
        return;
      }

      const components = [];

      try {
        setLoading(true);

        if (formData.category === 'AUTHENTICATION') {
          // Authentication Preset Logic
          const bodyComp = {
            type: 'BODY',
            add_security_recommendation: true
          };

          // Add examples if variables exist
          if (formData.variables && formData.variables.length > 0) {
            if (formData.parameterFormat === 'NAMED') {
              bodyComp.example = {
                body_text_named_params: formData.variables.map(v => ({
                  param_name: v.name,
                  example: v.example
                }))
              };
            } else {
              // POSITIONAL
              bodyComp.example = {
                body_text: [formData.variables.map(v => v.example)]
              };
            }
          }
          components.push(bodyComp);

          // Buttons - strictly OTP type
          if (formData.buttons && formData.buttons.length > 0) {
            const btn = formData.buttons[0]; // Take first button
            components.push({
              type: 'BUTTONS',
              buttons: [{
                type: 'OTP',
                otp_type: 'COPY_CODE',
                text: btn.text || 'Copy Code'
              }]
            });
          }
        } else {
          // Header
          if (formData.headerType !== 'NONE') {
            const header = { type: 'HEADER', format: formData.headerType };
            if (formData.headerType === 'TEXT') {
              header.text = formData.headerText;
              if (/\{\{1\}\}/.test(formData.headerText || '') && headerVarExample) {
                header.example = { header_text: [headerVarExample] };
              }
            } else if (['IMAGE', 'DOCUMENT', 'VIDEO'].includes(formData.headerType)) {
              let handle = formData.headerHandle;

              if (formData.headerFile) {
                try {
                  const uploadRes = await uploadTemplateExampleMedia(formData.headerFile);
                  if (uploadRes && uploadRes.h) {
                    handle = uploadRes.h;
                  } else if (uploadRes && (uploadRes.error || uploadRes.message)) {
                    const msg = uploadRes.error?.message || uploadRes.error || uploadRes.message;
                    throw new Error(msg);
                  } else {
                    throw new Error(`${formData.headerType} upload failed: No handle returned`);
                  }
                } catch (uploadErr) {
                  throw new Error(`Failed to upload ${formData.headerType.toLowerCase()} header: ${uploadErr.message}`);
                }
              }

              if (!handle) {
                alert(`Please upload an example ${formData.headerType.toLowerCase()} for the header.`);
                setLoading(false);
                return;
              }
              header.example = { header_handle: [handle] };
            }
            components.push(header);
          }

          // Body
          const bodyComponent = { type: 'BODY', text: formData.bodyText };
          if (formData.variables && formData.variables.length > 0) {
            if (formData.parameterFormat === 'NAMED') {
              bodyComponent.example = {
                body_text_named_params: formData.variables.map(v => ({
                  param_name: v.name,
                  example: v.example
                }))
              };
            } else {
              // POSITIONAL
              bodyComponent.example = {
                body_text: [formData.variables.map(v => v.example)]
              };
            }
          }
          components.push(bodyComponent);

          // Footer
          if (formData.footerText) {
            components.push({ type: 'FOOTER', text: formData.footerText });
          }

          // Buttons
          if (formData.buttons && formData.buttons.length > 0) {
            const cleanedButtons = formData.buttons.map(btn => {
              const cleanBtn = { type: btn.type };
              if (btn.type !== 'COPY_CODE') {
                cleanBtn.text = btn.text;
              }

              if (btn.type === 'URL') {
                // Remove backticks, quotes, and whitespace
                cleanBtn.url = btn.url ? btn.url.replace(/[`'"]/g, '').trim() : '';

                // Only include example if the URL is dynamic (has variables)
                if (cleanBtn.url.includes('{{')) {
                  // Meta expects an array of URLs for dynamic URL examples
                  // Since we don't have an explicit input for URL example in UI, we construct one or use existing
                  cleanBtn.example = [btn.example || 'https://example.com/page'];
                }
              } else if (btn.type === 'PHONE_NUMBER') {
                cleanBtn.phone_number = btn.phone_number;
              } else if (btn.type === 'COPY_CODE') {
                cleanBtn.example = btn.example;
              }

              return cleanBtn;
            });
            components.push({ type: 'BUTTONS', buttons: cleanedButtons });
          }

          // Add Call Permission Component
          if (formData.subCategory === 'CALL_PERMISSION') {
            components.push({ type: 'call_permission_request' });
          }
        }

        const payload = {
          name: formData.name,
          category: formData.category,
          language: formData.language,
          components,
          phoneNumberId: formData.phoneNumberId || (linkedPhones.length > 0 ? linkedPhones[0].phone_number_id : null)
        };

        if (formData.variables && formData.variables.length > 0) {
          if (formData.parameterFormat === 'NAMED') {
            payload.parameter_format = "NAMED";
          } else {
            payload.parameter_format = "POSITIONAL";
          }
        }

        const res = await createTemplate(payload);
        if (res.error) {
          throw new Error(res.error.message || JSON.stringify(res.error));
        }
        if (pendingFolderAssignment) {
          try {
            await assignTemplateToFolder(payload.name, pendingFolderAssignment.name);
          } catch (e) {
            console.error('Failed to auto-assign template to folder', e);
          }
          setPendingFolderAssignment(null);
        }
        setIsCreating(false);
        setSelectedId(null);
        alert('Template submitted for approval!');
        await fetchTemplatesData();
        await fetchFolders();
      } catch (err) {
        console.error('Error creating template:', err);
        alert(`Failed to create template: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    } else {
      // setTemplates(templates.map(t => t.id === formData.id ? formData : t));
      alert('Editing existing templates is not fully supported in this demo yet.');
    }
  };

  const handleDelete = async (template) => {
    if (template.status === 'DISABLED') {
      alert('Disabled templates cannot be deleted.');
      return;
    }

    const confirmMsg = `Warning: Deleting a template cannot be undone.

- If you delete by name, ALL languages for this template will be deleted.
- You cannot create a template with the same name for 30 days after deletion.
- If a message using this template is undelivered, it will enter PENDING_DELETION status for 30 days.

Are you sure you want to delete '${template.name}'?`;

    if (!(await confirmAction({
      title: 'Delete template?',
      message: confirmMsg,
      confirmLabel: 'Delete template',
      tone: 'danger',
    }))) return;

    setLoading(true);
    try {
      // We try to delete by ID (hsm_id) + name for specificity if possible.
      // The mapped template object has `id` which is the hsm_id.
      await deleteTemplate(template.name, template.id, template.phoneNumberId);
      alert('Template deleted successfully.');
      // Clear selection if we deleted the selected one
      if (selectedId === template.id) {
        setSelectedId(null);
        setFormData(null);
      }
      await fetchTemplatesData();
    } catch (err) {
      console.error('Delete failed:', err);
      alert(`Failed to delete template: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (t.status === 'PENDING_DELETION') return false;
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const groupOrder = ['CPA', 'CMA US', 'ACCA', 'EA', 'General'];
  const groupedTemplates = filteredTemplates.reduce((acc, t) => {
    const group = getGroup(t.name);
    if (!acc[group]) acc[group] = [];
    acc[group].push(t);
    return acc;
  }, {});

  const handleBulkFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setBulkFile(e.target.files[0]);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) return;
    setBulkStatus('uploading');
    setBulkProgress([]);

    const fd = new FormData();
    fd.append('file', bulkFile);
    if (selectedPhoneNumberId !== 'ALL') {
        fd.append('phoneNumberId', selectedPhoneNumberId);
    }

    try {
      const response = await fetch('/api/templates/bulk-create', {
        method: 'POST',
        body: fd,
      });
      const data = await response.json();
      if (data.success) {
        setBulkStatus('success');
        setBulkProgress(data.results || []);
        await fetchTemplatesData();
      } else {
        setBulkStatus('error');
        setError(data.message || 'Bulk creation failed');
      }
    } catch (err) {
      setBulkStatus('error');
      setError(err.message);
    }
  };

  const TemplateItem = ({ t }) => (
    <div
      onClick={() => { setSelectedId(t.id); setIsCreating(false); }}
      className={cn(
        "mx-3 my-2 rounded-3xl border bg-white/95 p-4 cursor-pointer transition-all group relative shadow-sm hover:-translate-y-0.5 hover:border-purple-200 hover:shadow-md",
        selectedId === t.id && !isCreating ? "border-purple-300 bg-purple-50/80 shadow-md ring-2 ring-purple-100" : "border-purple-100"
      )}
    >
      <div className="flex justify-between items-start mb-1">
        <span className="font-bold text-sm text-slate-950 truncate pr-2">{t.name}</span>
        <div className="flex items-center gap-2">
          {t.status === 'APPROVED' && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
          {t.status === 'PENDING' && <Clock size={14} className="text-amber-500 flex-shrink-0" />}
          {t.status === 'REJECTED' && <AlertCircle size={14} className="text-red-500 flex-shrink-0" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(t);
            }}
            className="text-slate-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 p-0.5"
            title="Delete Template"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2">
        <Badge variant="outline" className="text-[10px] h-5 px-2 rounded-full border-purple-100 bg-white text-purple-700">{t.category}</Badge>
        <span>{t.language}</span>
        {t.isLocal && <Badge variant="secondary" className="text-[10px] h-5 px-1 bg-amber-50 text-amber-700 border-amber-100">Local</Badge>}
      </div>
      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
        {t.bodyText}
      </p>
    </div>
  );
  const handleTestSend = async () => {
    if (!testPhoneNumber || !testSelectedTemplate) {
      alert('Please enter a phone number and select a template.');
      return;
    }

    setSendingTest(true);
    try {
      // Find language code for selected template
      const tmpl = templates.find(t => t.name === testSelectedTemplate);
      const lang = tmpl ? tmpl.language : 'en_US';

      const components = [];

      // 0. Handle Header Media (IMAGE / VIDEO / DOCUMENT)
      if (tmpl && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(tmpl.headerType)) {
        const mediaVal = (testHeaderMedia || '').trim();
        if (!mediaVal) {
          throw new Error('Header media is required for this template. Upload a file or paste a URL/media ID.');
        }
        const isUrl = /^https?:\/\//i.test(mediaVal);
        const mediaObj = isUrl ? { link: mediaVal } : { id: mediaVal };
        let paramType = 'image';
        let mediaKey = 'image';
        if (tmpl.headerType === 'VIDEO') {
          paramType = 'video';
          mediaKey = 'video';
        } else if (tmpl.headerType === 'DOCUMENT') {
          paramType = 'document';
          mediaKey = 'document';
        }
        components.push({
          type: 'header',
          parameters: [
            {
              type: paramType,
              [mediaKey]: mediaObj
            }
          ]
        });
      } else if (tmpl && tmpl.headerType === 'TEXT') {
        const regex = /{{([a-zA-Z0-9_]+)}}/g;
        const matches = [...String(tmpl.headerText || '').matchAll(regex)];
        if (matches.length > 0) {
          const headerParams = matches.map((m) => ({
            type: 'text',
            text: testVariables[m[1]] || `[${m[1]}]`
          }));
          components.push({
            type: 'header',
            parameters: headerParams
          });
        }
      }

      // 1. Handle Body Variables
      if (tmpl && tmpl.bodyText) {
        // Match {{var}} or {{1}}
        const regex = /{{([a-zA-Z0-9_]+)}}/g;
        const matches = [...tmpl.bodyText.matchAll(regex)];
        if (matches.length > 0) {
          const bodyParams = matches.map(m => {
            const param = {
              type: 'text',
              text: testVariables[m[1]] || `[${m[1]}]`
            };
            return param;
          });

          components.push({
            type: 'body',
            parameters: bodyParams
          });
        }
      }

      // 2. Handle Buttons
      if (tmpl && tmpl.buttons) {
        tmpl.buttons.forEach((btn, idx) => {
          if (btn.type === 'COPY_CODE') {
            // Try to find a variable that looks like 'code' or 'coupon'
            let codeValue = 'TESTCODE';

            // 1. First check if we have a variable named 'code' or similar
            const codeVarName = Object.keys(testVariables).find(k =>
              k.toLowerCase().includes('code') ||
              k.toLowerCase().includes('coupon') ||
              k.toLowerCase() === 'promocode'
            );

            if (codeVarName && testVariables[codeVarName]) {
              codeValue = testVariables[codeVarName];
            } else if (tmpl.examples) {
              // 2. Fallback to example if available
              const exampleKey = Object.keys(tmpl.examples).find(k =>
                k.toLowerCase().includes('code') ||
                k.toLowerCase().includes('coupon')
              );
              if (exampleKey) codeValue = tmpl.examples[exampleKey];
            }

            components.push({
              type: 'button',
              sub_type: 'copy_code',
              index: idx,
              parameters: [
                {
                  type: 'coupon_code',
                  coupon_code: codeValue
                }
              ]
            });
          } else if (btn.type === 'URL') {
            const url = String(btn.url || '');
            const regex = /{{([a-zA-Z0-9_]+)}}/g;
            const matches = [...url.matchAll(regex)];
            if (matches.length > 0) {
              const params = matches.map((m) => ({
                type: 'text',
                text: testVariables[m[1]] || 'track'
              }));
              components.push({
                type: 'button',
                sub_type: 'url',
                index: idx,
                parameters: params
              });
            }
          }
        });
      }

      await sendTestTemplate(testPhoneNumber, testSelectedTemplate, lang, components, tmpl ? tmpl.phoneNumberId : null);
      alert('Test message sent successfully!');
      setIsTestModalOpen(false);
      setTestPhoneNumber('');
      setTestSelectedTemplate('');
      setTestVariables({});
      setTestHeaderMedia('');
    } catch (err) {
      console.error('Failed to send test message:', err);
      alert('Failed to send test message. Check console.');
    } finally {
      setSendingTest(false);
    }
  };

  const getPreviewBodyText = () => {
    if (!formData || !formData.bodyText) return '';
    let text = formData.bodyText;
    if (formData.variables) {
      formData.variables.forEach(v => {
        if (v.name && v.example) {
          text = text.split(`{{${v.name}}}`).join(v.example);
        }
      });
    }
    return text;
  };

  return (
    <div className="flex-1 flex h-full bg-gradient-to-br from-[#fbf7ff] via-[#f7f3fb] to-[#eef2ff] relative">
      {/* Test Modal Overlay */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-xl w-[420px] overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{ color: '#111827' }}>
            <div className="px-6 py-4 border-b border-purple-100 flex justify-between items-center bg-purple-50/70">
              <h3 className="font-semibold text-slate-900">Send Test Message</h3>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Template</label>
                <select
                  className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                  value={testSelectedTemplate}
                  onChange={e => {
                    const val = e.target.value;
                    setTestSelectedTemplate(val);
                    const t = templates.find(temp => temp.name === val);
                    if (t) {
                      const regex = /{{([a-zA-Z0-9_]+)}}/g;
                      const vars = {};
                      if (t.headerText) {
                        const hMatches = [...t.headerText.matchAll(regex)];
                        hMatches.forEach((m) => {
                          if (!Object.prototype.hasOwnProperty.call(vars, m[1])) vars[m[1]] = '';
                        });
                      }
                      if (t.bodyText) {
                        const bMatches = [...t.bodyText.matchAll(regex)];
                        bMatches.forEach((m) => {
                          vars[m[1]] = (t.examples && Object.prototype.hasOwnProperty.call(t.examples, m[1]))
                            ? t.examples[m[1]]
                            : (vars[m[1]] || '');
                        });
                      }
                      setTestVariables(vars);
                    } else {
                      setTestVariables({});
                    }
                    setTestHeaderMedia('');
                  }}
                >
                  <option value="">Select a template...</option>
                  {templates.filter(t => t.status === 'APPROVED').map(t => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Phone Number</label>
                <Input
                  placeholder="e.g. 919876543210"
                  value={testPhoneNumber}
                  onChange={e => setTestPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                />
                <p className="text-xs text-slate-500">Enter number with country code, no + sign.</p>
              </div>

              {/* Header media for IMAGE / VIDEO / DOCUMENT templates */}
              {testSelectedTemplate && (() => {
                const tmpl = templates.find(t => t.name === testSelectedTemplate);
                if (!tmpl || !['IMAGE', 'VIDEO', 'DOCUMENT'].includes(tmpl.headerType)) return null;
                const label =
                  tmpl.headerType === 'IMAGE'
                    ? 'Image header (URL or media ID)'
                    : tmpl.headerType === 'VIDEO'
                      ? 'Video header (URL or media ID)'
                      : 'Document header (URL or media ID)';
                const effectiveMedia = (testHeaderMedia || '').trim();
                const isUrl = /^https?:\/\//i.test(effectiveMedia);
                const accept =
                  tmpl.headerType === 'IMAGE'
                    ? 'image/*'
                    : tmpl.headerType === 'VIDEO'
                      ? 'video/*'
                      : '*/*';

                return (
                  <div className="space-y-2 border-t pt-2 mt-2">
                    <label className="text-sm font-medium text-slate-700">{label}</label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => testHeaderFileInputRef.current?.click()}
                        disabled={isUploadingTestHeader}
                      >
                        {isUploadingTestHeader ? 'Uploading...' : 'Upload file'}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setGalleryResourceType(tmpl.headerType === 'DOCUMENT' ? 'raw' : tmpl.headerType.toLowerCase());
                          setShowGallerySelect(true);
                        }}
                        disabled={isUploadingTestHeader}
                      >
                        Gallery
                      </Button>
                      <Input
                        placeholder="Paste URL or media ID, or use Upload."
                        value={testHeaderMedia}
                        onChange={e => setTestHeaderMedia(e.target.value)}
                        disabled={isUploadingTestHeader}
                      />
                    </div>
                    <input
                      type="file"
                      ref={testHeaderFileInputRef}
                      className="hidden"
                      accept={accept}
                      onChange={async (e) => {
                        const file = e.target.files && e.target.files[0];
                        if (!file) return;
                        setIsUploadingTestHeader(true);
                        try {
                          const uploadResp = await uploadTemplateTestMedia(file);
                          if (!uploadResp || (!uploadResp.id && !uploadResp.url)) {
                            throw new Error('Upload successful but no media ID/URL returned');
                          }
                          const mediaIdOrUrl = uploadResp.id || uploadResp.url;
                          setTestHeaderMedia(mediaIdOrUrl);
                        } catch (err) {
                          alert(err?.message || 'Failed to upload header media');
                        } finally {
                          setIsUploadingTestHeader(false);
                          if (e.target) {
                            e.target.value = '';
                          }
                        }
                      }}
                    />
                    <p className="text-xs text-slate-500">
                      Required for media header templates.
                    </p>
                    {effectiveMedia && (
                      <div className="mt-1">
                        {isUrl ? (
                          tmpl.headerType === 'IMAGE' ? (
                            <img
                              src={effectiveMedia}
                              alt="Header preview"
                              className="max-h-32 max-w-full rounded border border-slate-200"
                            />
                          ) : tmpl.headerType === 'VIDEO' ? (
                            <video
                              src={effectiveMedia}
                              className="max-h-32 max-w-full rounded border border-slate-200"
                              controls
                              muted
                            />
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-slate-600">
                              <FileText className="w-4 h-4 text-blue-500" />
                              <span className="truncate">{effectiveMedia}</span>
                            </div>
                          )
                        ) : (
                          <div className="text-[11px] text-slate-600">
                            Using media ID: <span className="font-mono break-all">{effectiveMedia}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {Object.keys(testVariables).length > 0 && (
                <div className="space-y-2 border-t pt-2 mt-2">
                  <label className="text-sm font-medium text-slate-700">Template Variables</label>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.keys(testVariables).map(key => (
                      <div key={key} className="flex flex-col gap-1">
                        <label className="text-xs text-slate-500 font-mono">{"{{" + key + "}}"}</label>
                        <Input
                          placeholder={`Value for ${key}`}
                          value={testVariables[key]}
                          onChange={e => setTestVariables(prev => ({ ...prev, [key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsTestModalOpen(false)}>Cancel</Button>
                <Button onClick={handleTestSend} disabled={sendingTest}>
                  {sendingTest ? 'Sending...' : 'Send Test'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR: LIST */}
      <div className="w-80 border-r border-purple-100 bg-white flex flex-col z-0 flex-shrink-0 shadow-sm">
        <div className="p-4 border-b border-purple-100 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setViewMode('folders')}
                className="p-2 rounded-2xl border border-purple-100 bg-white hover:bg-purple-50 text-purple-600 transition-colors"
                title="Back to Folders">
                <ArrowLeft size={16} />
              </button>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-500">WhatsApp</p>
                <h2 className="font-bold text-slate-950">Templates</h2>
              </div>
            </div>
            <div className="flex gap-1 items-center">
              <Button size="icon" variant="ghost" onClick={() => setIsBulkModalOpen(true)} title="Bulk Create from .md">
                <Upload size={16} className="text-slate-500" />
              </Button>
              <Button size="icon" variant="ghost" onClick={fetchTemplatesData} title="Refresh Status">
                <RefreshCw size={16} className={cn("text-slate-500", loading && "animate-spin")} />
              </Button>
              <Button size="sm" className="rounded-2xl bg-purple-700 hover:bg-purple-800 text-white" onClick={() => { setIsCreating(true); setShowTypeSelection(true); setSelectedId(null); setFormData(null); setCreationStep('MAIN_CATEGORY'); }}>
                <Plus size={16} className="mr-0.5" /> New
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Search templates..."
              className="pl-9 bg-white border-purple-100 rounded-2xl focus-visible:ring-purple-200"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Channel Filter */}
          {linkedPhones.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Business Account</label>
              <select
                className="w-full text-xs bg-white border border-purple-100 rounded-2xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-200"
                value={selectedPhoneNumberId}
                onChange={(e) => setSelectedPhoneNumberId(e.target.value)}
              >
                <option value="ALL">All Accounts</option>
                {linkedPhones.map(phone => (
                  <option key={phone.phone_number_id} value={phone.phone_number_id}>
                    {phone.display_phone_number || phone.phone_number_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {['ALL', 'AUTHENTICATION', 'UTILITY', 'MARKETING'].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-medium transition-colors whitespace-nowrap border",
                  filterCategory === cat
                    ? "bg-purple-700 text-white border-purple-700"
                    : "bg-white text-slate-600 border-purple-100 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700"
                )}
              >
                {cat.charAt(0) + cat.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          {error && (
            <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100">
              {error}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {isGroupView ? (
            <div className="space-y-4 py-2">
              {groupOrder.map(group => {
                const items = groupedTemplates[group] || [];
                if (items.length === 0) return null;
                return (
                  <div key={group} className="space-y-1">
                    <div className="px-4 py-2 bg-purple-50/80 border-y border-purple-100/50 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest">{group}</span>
                      <span className="text-[10px] bg-white text-purple-700 px-2 py-0.5 rounded-full font-bold border border-purple-100">{items.length}</span>
                    </div>
                    {items.map(t => (
                      <TemplateItem key={t.id} t={t} />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            filteredTemplates.map(t => (
              <TemplateItem key={t.id} t={t} />
            ))
          )}
          {filteredTemplates.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              No templates found
            </div>
          )}
        </div>
      </div>

      {/* RIGHT MAIN AREA: EDITOR */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f3f1f8]">
        {isCreating && showTypeSelection ? (
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-[#fbf7ff] via-[#f7f3fb] to-[#eef2ff] p-8">
            <div className="max-w-5xl mx-auto">
              <div className="mb-8 rounded-[32px] border border-purple-100 bg-white/90 p-6 shadow-sm">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-purple-500">Create Template</p>
                    <h1 className="text-2xl font-bold text-slate-950 mb-2">Choose a Template Type</h1>
                    <p className="text-slate-500">Select the right WhatsApp template path. The API flow stays the same; this only guides the setup.</p>
                  </div>
                  <div className="grid min-w-[320px] grid-cols-3 gap-2">
                    {[
                      { key: 'MAIN_CATEGORY', label: 'Type', step: '1' },
                      { key: 'SUB_CATEGORY', label: 'Sub type', step: '2' },
                      { key: 'FORM', label: 'Configure', step: '3' },
                    ].map(item => {
                      const active = item.key === creationStep || (item.key === 'FORM' && !showTypeSelection);
                      const complete =
                        item.key === 'MAIN_CATEGORY' ? Boolean(selectedMainCategory) :
                          item.key === 'SUB_CATEGORY' ? creationStep === 'FORM' :
                            false;
                      return (
                        <div
                          key={item.key}
                          className={cn(
                            "rounded-2xl border px-3 py-3 text-center transition-all",
                            active
                              ? "border-purple-300 bg-purple-700 text-white shadow-lg shadow-purple-200/70"
                              : complete
                                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                : "border-purple-100 bg-purple-50/60 text-slate-500"
                          )}
                        >
                          <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-xs font-bold text-purple-700">
                            {complete ? <CheckCircle size={15} /> : item.step}
                          </div>
                          <p className="text-xs font-bold">{item.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {creationStep === 'MAIN_CATEGORY' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {MAIN_CATEGORIES.map(cat => (
                    <div
                      key={cat.id}
                      onClick={() => handleMainCategorySelect(cat)}
                      className="bg-white/95 p-7 rounded-[32px] border border-purple-100 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-100 hover:border-purple-200 cursor-pointer transition-all group"
                    >
                      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-colors shadow-sm", cat.color)}>
                        <cat.icon size={24} />
                      </div>
                      <h3 className="font-bold text-slate-900 mb-2 group-hover:text-purple-700 transition-colors">{cat.label}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed break-words">{cat.description}</p>
                      <div className="mt-6 flex items-center justify-between rounded-2xl bg-purple-50 px-4 py-3 text-xs font-bold text-purple-700">
                        <span>Start with {cat.label}</span>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {creationStep === 'SUB_CATEGORY' && (
                <>
                  <div className="mb-6 flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setCreationStep('MAIN_CATEGORY')} className="rounded-2xl">
                      <ArrowLeft size={16} className="mr-1" /> Back
                    </Button>
                    <h2 className="text-xl font-bold text-slate-900">Select Marketing Type</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {MARKETING_SUB_TYPES.map(type => (
                      <div
                        key={type.value}
                        onClick={() => handleSubCategorySelect(type)}
                        className="bg-white/95 p-6 rounded-[28px] border border-purple-100 shadow-sm hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-100 hover:border-purple-200 cursor-pointer transition-all group"
                      >
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-colors bg-purple-50 text-purple-700">
                          {type.icon ? <type.icon size={24} /> : <Megaphone size={24} />}
                        </div>
                        <h3 className="font-semibold text-slate-900 mb-2 group-hover:text-purple-700 transition-colors">{type.label}</h3>
                        <p className="text-sm text-slate-500 leading-relaxed break-words">{type.description}</p>
                        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white">
                          Configure <ChevronRight size={14} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="mt-8 flex justify-center">
                <Button variant="ghost" onClick={() => { setIsCreating(false); setShowTypeSelection(false); setCreationStep('MAIN_CATEGORY'); setPendingFolderAssignment(null); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : !formData ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 bg-gradient-to-br from-[#fbf7ff] via-[#f7f3fb] to-[#eef2ff]">
            <div className="rounded-3xl border border-purple-100 bg-white/90 px-10 py-8 text-center shadow-sm">
              <FileText className="mx-auto mb-3 h-9 w-9 text-purple-400" />
              <p className="font-semibold text-slate-500">Select a template or create a new one</p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="border-b border-purple-100 bg-[#f3f1f8] px-6 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                {isCreating && (
                  <Button variant="ghost" size="icon" onClick={() => setShowTypeSelection(true)} className="mr-2 rounded-2xl hover:bg-purple-50">
                    <ArrowLeft size={18} />
                  </Button>
                )}
                <div className="flex h-12 w-12 items-center justify-center rounded-[20px] border border-white bg-white text-purple-700 shadow-sm">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-purple-500">WhatsApp Template</p>
                  <h1 className="font-bold text-xl text-slate-950 leading-tight">
                    {isCreating ? 'New Template' : formData.name}
                  </h1>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{isCreating ? 'Draft' : formData.status}</span>
                    {formData.status === 'APPROVED' && <span className="text-green-600">• Live</span>}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="h-11 rounded-2xl border-purple-100 bg-white px-5 font-bold" onClick={() => { setIsCreating(false); setSelectedId(null); setPendingFolderAssignment(null); }}>Discard</Button>
                <Button className="h-11 rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 font-bold text-white shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700" onClick={handleSave} disabled={loading}>
                  {loading ? 'Creating...' : (isCreating ? 'Create Template' : 'Save Changes')}
                </Button>
              </div>
            </div>

            {/* Content Area (Split View) */}
            <div className="flex-1 overflow-hidden flex">

              {/* Form / Editor */}
              <div className="flex-1 overflow-y-auto border-r border-purple-100 bg-[#f3f1f8] p-6 min-w-[500px]">
                <div className="max-w-5xl space-y-5 mx-auto">
                  {/* Metadata */}
                  <Card className="overflow-hidden rounded-[28px] border-white bg-white/95 shadow-sm">
                    <CardHeader className="border-b border-purple-50 bg-gradient-to-r from-white via-purple-50/60 to-white px-5 py-4">
                      <CardTitle className="flex items-center justify-between text-sm font-bold text-slate-950">
                        <span className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                            <Pencil size={15} />
                          </span>
                          Configuration
                        </span>
                        <span className="rounded-full bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Meta ready</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Template Name</label>
                        <Input
                          value={formData.name}
                          onChange={e => {
                            const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                            setFormData({ ...formData, name: val });
                          }}
                          placeholder="e.g. shipping_update"
                          className="h-11 rounded-2xl border-slate-200 bg-slate-50 focus-visible:ring-purple-200"
                        />
                        <p className="text-[11px] text-slate-500">Lowercase, underscores only.</p>
                      </div>
                      {linkedPhones.length > 1 && (
                        <div className="space-y-2 lg:col-span-3">
                          <label className="text-sm font-medium text-slate-700">Business Account</label>
                          <select
                            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                            value={formData.phoneNumberId || (linkedPhones[0]?.phone_number_id)}
                            onChange={e => setFormData({ ...formData, phoneNumberId: e.target.value })}
                          >
                            {linkedPhones.map(phone => (
                              <option key={phone.phone_number_id} value={phone.phone_number_id}>
                                {phone.display_phone_number || phone.phone_number_id}
                              </option>
                            ))}
                          </select>
                          <p className="text-[11px] text-slate-500">Select which Meta WABA to submit this template to.</p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Category</label>
                        {isCreating ? (
                          <div className="text-sm font-medium text-slate-900 bg-purple-50 px-3 py-2 rounded-2xl border border-purple-100">
                            {formData.category} {formData.subCategory && formData.subCategory !== 'CUSTOM' ? `• ${formData.subCategory}` : ''}
                          </div>
                        ) : (
                          <select
                            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                          >
                            <option value="MARKETING">Marketing</option>
                            <option value="UTILITY">Utility</option>
                            <option value="AUTHENTICATION">Authentication</option>
                          </select>
                        )}
                      </div>

                      {formData.category === 'MARKETING' && !isCreating && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">Marketing Type</label>
                          <select
                            className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                            value={formData.subCategory || 'CUSTOM'}
                            onChange={e => setFormData({ ...formData, subCategory: e.target.value })}
                          >
                            {MARKETING_SUB_TYPES.map(type => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-2 lg:col-span-3">
                        <label className="text-sm font-medium text-slate-700">Parameter Format</label>
                        <div className="flex flex-wrap gap-4 pt-2">
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="paramFormat"
                              value="NAMED"
                              checked={formData.parameterFormat === 'NAMED'}
                              onChange={() => setFormData({ ...formData, parameterFormat: 'NAMED' })}
                              className="text-purple-600"
                            />
                            Named <span className="text-xs text-slate-500 font-mono">{'{{name}}'}</span>
                          </label>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="paramFormat"
                              value="POSITIONAL"
                              checked={formData.parameterFormat === 'POSITIONAL'}
                              onChange={() => setFormData({ ...formData, parameterFormat: 'POSITIONAL' })}
                              className="text-purple-600"
                            />
                            Positional <span className="text-xs text-slate-500 font-mono">{'{{1}}'}</span>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Language</label>
                        <select
                          className="flex h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                          value={formData.language}
                          onChange={e => setFormData({ ...formData, language: e.target.value })}
                        >
                          <option value="en_US">English (US)</option>
                          <option value="es_ES">Spanish</option>
                        </select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Message Content */}
                  <Card className="h-full overflow-hidden rounded-[28px] border-white bg-white/95 shadow-sm">
                    <CardHeader className="border-b border-purple-50 bg-gradient-to-r from-white via-fuchsia-50/50 to-white px-5 py-4">
                      <CardTitle className="flex items-center justify-between text-sm font-bold text-slate-950">
                        <span className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-fuchsia-50 text-fuchsia-700">
                            <Smartphone size={15} />
                          </span>
                          Message Content
                        </span>
                        <span className="rounded-full bg-purple-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-purple-500">Live compose</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-7 p-5">

                      {/* Header */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                          <label className="text-sm font-medium text-slate-700 block mb-1">Header</label>
                          <span className="text-xs text-slate-500">Optional media or text header</span>
                        </div>
                        <div className="md:col-span-3 space-y-4">
                          <div className="flex gap-2 flex-wrap">
                            {['NONE', 'TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO'].map(type => (
                              <button
                                key={type}
                                onClick={() => { setFormData({ ...formData, headerType: type, headerHandle: null, headerPreviewUrl: null, headerFile: null, headerFileName: null }); setHeaderVarExample(''); }}
                                className={cn(
                                  "px-4 py-2 rounded-2xl text-sm font-semibold border transition-all shadow-sm",
                                  formData.headerType === type
                                    ? "bg-purple-700 text-white border-purple-700 ring-2 ring-purple-100"
                                    : "bg-white text-slate-600 border-purple-100 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700"
                                )}
                              >
                                {type.charAt(0) + type.slice(1).toLowerCase()}
                              </button>
                            ))}
                          </div>
                          {formData.headerType === 'TEXT' && (
                            <div className="space-y-2 max-w-md">
                              <div className="flex gap-2">
                                <Input
                                  value={formData.headerText}
                                  onChange={e => setFormData({ ...formData, headerText: e.target.value })}
                                  placeholder="Enter header text..."
                                  className="flex-1 rounded-2xl border-slate-200 bg-slate-50 focus-visible:ring-purple-200"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!/\{\{1\}\}/.test(formData.headerText)) {
                                      setFormData({ ...formData, headerText: (formData.headerText || '') + '{{1}}' });
                                    }
                                  }}
                                  disabled={/\{\{1\}\}/.test(formData.headerText || '')}
                                  className="px-3 py-1.5 text-xs rounded-2xl border border-purple-100 bg-purple-50 hover:bg-purple-100 text-purple-700 font-mono disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                                  title="Meta allows only one variable in text headers"
                                >
                                  + {'{{1}}'}
                                </button>
                              </div>
                              {/\{\{1\}\}/.test(formData.headerText || '') && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 shrink-0">Example for <code className="bg-slate-100 px-1 rounded">{'{{1}}'}</code>:</span>
                                  <Input
                                    value={headerVarExample}
                                    onChange={e => setHeaderVarExample(e.target.value)}
                                    placeholder="e.g. Weekly Report"
                                    className="h-8 text-xs rounded-2xl focus-visible:ring-purple-200"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                          {['IMAGE', 'DOCUMENT', 'VIDEO'].includes(formData.headerType) && (
                            <div className="relative space-y-2">
                              <input
                                type="file"
                                accept={
                                  formData.headerType === 'IMAGE' ? "image/*" :
                                    formData.headerType === 'DOCUMENT' ? "application/pdf" :
                                      "video/mp4,video/3gpp"
                                }
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                onChange={handleImageUpload}
                              />
                              <div className={cn(
                                "h-36 w-full max-w-md bg-purple-50 rounded-3xl border-2 border-dashed border-purple-200 flex flex-col items-center justify-center text-slate-500 gap-2 transition-colors relative overflow-hidden",
                                (formData.headerHandle || formData.headerPreviewUrl) ? "bg-purple-50 border-purple-300 text-purple-700" : "hover:bg-white"
                              )}>
                                {resolvedHeaderPreviewUrl && formData.headerType === 'IMAGE' ? (
                                  <div className="relative w-full h-full flex items-center justify-center group">
                                    <img src={resolvedHeaderPreviewUrl} alt="Preview" className="max-h-full max-w-full object-contain p-2" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Click to replace</span>
                                    </div>
                                  </div>
                                ) : resolvedHeaderPreviewUrl && formData.headerType === 'VIDEO' ? (
                                  <div className="relative w-full h-full flex items-center justify-center group">
                                    <video src={resolvedHeaderPreviewUrl} className="max-h-full max-w-full object-contain p-2" controls />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Click to replace</span>
                                    </div>
                                  </div>
                                ) : resolvedHeaderPreviewUrl && formData.headerType === 'DOCUMENT' ? (
                                  <div className="relative w-full h-full flex items-center justify-center group">
                                    <iframe src={resolvedHeaderPreviewUrl} className="w-full h-full" title="Document preview" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Click to replace</span>
                                    </div>
                                  </div>
                                ) : formData.headerHandle || formData.headerFileName ? (
                                  <>
                                    {formData.headerType === 'DOCUMENT' ? <FileText className="w-8 h-8 text-blue-500" /> :
                                      formData.headerType === 'VIDEO' ? <Video className="w-8 h-8 text-blue-500" /> :
                                        <CheckCircle className="w-8 h-8 text-blue-500" />}
                                    <span className="text-xs font-medium">{formData.headerFileName || `${formData.headerType} Uploaded`}</span>
                                    <span className="text-[10px] text-blue-400">Click to replace</span>
                                  </>
                                ) : (
                                  <>
                                    {loading ? <RefreshCw className="w-8 h-8 animate-spin opacity-50" /> : <Upload className="w-8 h-8 opacity-50" />}
                                    <span className="text-xs font-medium">{loading ? 'Uploading...' : `Click to upload ${formData.headerType.toLowerCase()} example`}</span>
                                  </>
                                )}
                              </div>
                              {(formData.headerFile || formData.headerHandle || formData.headerPreviewUrl) && (
                                <button
                                  type="button"
                                  onClick={handleClearHeaderFile}
                                  className="text-xs text-red-500 hover:text-red-700 self-start"
                                >
                                  Remove file
                                </button>
                              )}
                            </div>
                          )}
                          {formData.headerType === 'IMAGE' && (
                            <p className="text-[11px] text-slate-500 max-w-md">
                              WhatsApp image templates: JPEG or PNG only, maximum size 5 MB. For best preview without cropping, use a wide aspect ratio around 1.9:1 (for example 955×500).
                            </p>
                          )}
                          {formData.headerType === 'VIDEO' && (
                            <p className="text-[11px] text-slate-500 max-w-md">
                              WhatsApp video templates: MP4 or 3GPP (H.264 video and AAC audio), maximum size 16 MB. Use short horizontal videos for more reliable delivery and preview.
                            </p>
                          )}
                          {formData.headerType === 'DOCUMENT' && (
                            <p className="text-[11px] text-slate-500 max-w-md">
                              WhatsApp document templates: common Office or PDF documents, maximum size 100 MB. Larger files or unsupported formats can cause template upload or delivery errors.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Body */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                          <label className="text-sm font-medium text-slate-700 block mb-1">Body</label>
                          <span className="text-xs text-slate-500">Main message text. Use {formData.parameterFormat === 'NAMED' ? "named variables like {{name}}" : "positional variables like {{1}}"}</span>
                        </div>
                        <div className="md:col-span-3 space-y-4">
                          <div className="relative">
                            <textarea
                              ref={bodyTextareaRef}
                              className="w-full min-h-[140px] rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 resize-y font-mono"
                              value={formData.bodyText}
                              onChange={e => setFormData({ ...formData, bodyText: e.target.value })}
                              placeholder={formData.parameterFormat === 'NAMED' ? "Hello {{name}}, your order {{order_id}} is ready." : "Hello {{1}}, your order {{2}} is ready."}
                            />
                          </div>

                          {/* Variable Manager */}
                          <div className="bg-purple-50/60 p-4 rounded-3xl border border-purple-100 space-y-3">
                            <div className="flex gap-2 items-end">
                              <div className="flex-1">
                                <label className="text-xs text-slate-500 font-medium mb-1 block">
                                  {formData.parameterFormat === 'NAMED' ? "Variable Name" : "Variable Index"}
                                </label>
                                <Input
                                  placeholder={formData.parameterFormat === 'NAMED' ? "e.g. name" : "e.g. 1"}
                                  value={newVarName}
                                  onChange={e => setNewVarName(e.target.value)}
                                  className="h-9 bg-white rounded-2xl focus-visible:ring-purple-200"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-xs text-slate-500 font-medium mb-1 block">Example Value</label>
                                <Input
                                  placeholder="e.g. John Doe"
                                  value={newVarExample}
                                  onChange={e => setNewVarExample(e.target.value)}
                                  className="h-9 bg-white rounded-2xl focus-visible:ring-purple-200"
                                />
                              </div>
                              <Button
                                size="sm"
                                className="h-9 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white"
                                disabled={!newVarName || !newVarExample}
                                onClick={() => {
                                  if (!newVarName || !newVarExample) return;
                                  const newVar = { name: newVarName, example: newVarExample };
                                  setFormData(prev => ({
                                    ...prev,
                                    variables: [...(prev.variables || []), newVar]
                                  }));
                                  setNewVarName('');
                                  setNewVarExample('');
                                }}
                              >
                                Add
                              </Button>
                            </div>

                            {formData.variables && formData.variables.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-slate-200">
                                <label className="text-xs text-slate-500 font-medium">Defined Variables</label>
                                <div className="flex flex-wrap gap-2">
                                  {formData.variables.map((v, idx) => (
                                    <div key={idx} className="flex items-center gap-1 bg-white border border-purple-100 rounded-2xl px-3 py-2 shadow-sm">
                                      <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-xs font-mono text-purple-700 font-bold">{`{{${v.name}}}`}</span>
                                        <input
                                          type="text"
                                          value={v.example}
                                          onChange={(e) => {
                                            const newVars = [...formData.variables];
                                            newVars[idx].example = e.target.value;
                                            setFormData({ ...formData, variables: newVars });
                                          }}
                                          className="text-[10px] text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-purple-500 focus:bg-white outline-none w-full transition-all"
                                          placeholder="Example value"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-0.5 ml-1 border-l border-slate-100 pl-1">
                                        <button
                                          type="button"
                                          className="text-[10px] text-slate-400 hover:text-purple-700"
                                          title="Insert into text"
                                          onClick={() => {
                                            const token = `{{${v.name}}}`;
                                            const el = bodyTextareaRef.current;
                                            if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
                                              const start = el.selectionStart;
                                              const end = el.selectionEnd;
                                              const value = el.value || '';
                                              const newValue = value.slice(0, start) + token + value.slice(end);
                                              setFormData(prev => ({
                                                ...prev,
                                                bodyText: newValue
                                              }));
                                              const pos = start + token.length;
                                              window.requestAnimationFrame(() => {
                                                if (bodyTextareaRef.current) {
                                                  bodyTextareaRef.current.selectionStart = pos;
                                                  bodyTextareaRef.current.selectionEnd = pos;
                                                  bodyTextareaRef.current.focus();
                                                }
                                              });
                                            } else {
                                              setFormData(prev => ({
                                                ...prev,
                                                bodyText: prev.bodyText + token
                                              }));
                                            }
                                          }}
                                        >
                                          <Plus size={10} />
                                        </button>
                                        <button
                                          type="button"
                                          className="text-[10px] text-slate-400 hover:text-red-600"
                                          title="Remove"
                                          onClick={() => {
                                            const newVars = formData.variables.filter((_, i) => i !== idx);
                                            setFormData(prev => ({ ...prev, variables: newVars }));
                                          }}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                          <label className="text-sm font-medium text-slate-700 block mb-1">Footer</label>
                          <span className="text-xs text-slate-500">Optional small text at bottom</span>
                        </div>
                        <div className="md:col-span-3">
                          {formData.subCategory === 'CALL_PERMISSION' ? (
                            <div className="bg-purple-50 text-slate-500 p-3 rounded-2xl text-sm border border-purple-100">
                              Call Permission templates use a standard system footer.
                            </div>
                          ) : (
                            <Input
                              value={formData.footerText}
                              onChange={e => setFormData({ ...formData, footerText: e.target.value })}
                              placeholder="e.g. Reply STOP to unsubscribe"
                              className="rounded-2xl border-slate-200 bg-slate-50 focus-visible:ring-purple-200"
                            />
                          )}
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                          <label className="text-sm font-medium text-slate-700 block mb-1">Buttons</label>
                          <span className="text-xs text-slate-500">Up to 3 buttons (Quick Reply) or 2 (Call to Action)</span>
                        </div>
                        <div className="md:col-span-3 space-y-4">
                          {formData.subCategory === 'CALL_PERMISSION' ? (
                            <div className="bg-purple-50 text-purple-700 p-4 rounded-2xl text-sm border border-purple-100">
                              Call Permission templates use a standard system footer. No custom buttons are allowed.
                            </div>
                          ) : (
                            <>
                              {formData.buttons.map((btn, idx) => (
                                <div key={idx} className="flex gap-2 items-start bg-white p-4 rounded-3xl border border-purple-100 shadow-sm">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex gap-2">
                                      <select
                                        className="h-10 rounded-2xl border border-slate-200 text-sm px-3 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-200"
                                        value={btn.type}
                                        onChange={e => {
                                          const newButtons = [...formData.buttons];
                                          newButtons[idx] = { ...newButtons[idx], type: e.target.value };
                                          // Reset fields based on type
                                          if (e.target.value === 'QUICK_REPLY') {
                                            delete newButtons[idx].url;
                                            delete newButtons[idx].phone_number;
                                          } else if (e.target.value === 'URL') {
                                            newButtons[idx].url = '';
                                            delete newButtons[idx].phone_number;
                                          } else if (e.target.value === 'PHONE_NUMBER') {
                                            newButtons[idx].phone_number = '';
                                            delete newButtons[idx].url;
                                          }
                                          setFormData({ ...formData, buttons: newButtons });
                                        }}
                                      >
                                        <option value="QUICK_REPLY">Quick Reply</option>
                                        <option value="URL">URL</option>
                                        <option value="PHONE_NUMBER">Phone Number</option>
                                        <option value="COPY_CODE">Copy Code</option>
                                      </select>
                                      {btn.type !== 'COPY_CODE' ? (
                                        <Input
                                          className="h-10 flex-1 rounded-2xl bg-slate-50 focus-visible:ring-purple-200"
                                          value={btn.text}
                                          onChange={e => {
                                            const newButtons = [...formData.buttons];
                                            newButtons[idx].text = e.target.value;
                                            setFormData({ ...formData, buttons: newButtons });
                                          }}
                                          placeholder="Button Text"
                                        />
                                      ) : (
                                        <div className="h-10 flex-1 flex items-center px-3 bg-slate-100 text-slate-500 text-sm rounded-2xl border border-slate-200 cursor-not-allowed">
                                          Copy Code
                                        </div>
                                      )}
                                    </div>

                                    {btn.type === 'URL' && (
                                      <Input
                                        className="h-10 rounded-2xl bg-slate-50 focus-visible:ring-purple-200"
                                        value={btn.url || ''}
                                        onChange={e => {
                                          const newButtons = [...formData.buttons];
                                          newButtons[idx].url = e.target.value;
                                          setFormData({ ...formData, buttons: newButtons });
                                        }}
                                        placeholder="https://example.com"
                                      />
                                    )}

                                    {btn.type === 'PHONE_NUMBER' && (
                                      <Input
                                        className="h-10 rounded-2xl bg-slate-50 focus-visible:ring-purple-200"
                                        value={btn.phone_number || ''}
                                        onChange={e => {
                                          const newButtons = [...formData.buttons];
                                          newButtons[idx].phone_number = e.target.value;
                                          setFormData({ ...formData, buttons: newButtons });
                                        }}
                                        placeholder="+15550000000"
                                      />
                                    )}

                                    {btn.type === 'COPY_CODE' && (
                                      <Input
                                        className="h-10 rounded-2xl bg-slate-50 focus-visible:ring-purple-200"
                                        value={btn.example || ''}
                                        onChange={e => {
                                          const newButtons = [...formData.buttons];
                                          newButtons[idx].example = e.target.value;
                                          setFormData({ ...formData, buttons: newButtons });
                                        }}
                                        placeholder="Example Code (e.g. SAVE20)"
                                      />
                                    )}
                                  </div>
                                  <button
                                    onClick={() => {
                                      const newButtons = formData.buttons.filter((_, i) => i !== idx);
                                      setFormData({ ...formData, buttons: newButtons });
                                    }}
                                    className="text-slate-400 hover:text-red-500 p-1"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}

                              {formData.buttons.length < 3 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-dashed border-purple-200 text-purple-700 hover:border-purple-300 hover:bg-purple-50 w-full rounded-2xl"
                                  onClick={() => setFormData({
                                    ...formData,
                                    buttons: [...formData.buttons, { type: 'QUICK_REPLY', text: '' }]
                                  })}
                                >
                                  <Plus size={16} className="mr-1" /> Add Button
                                </Button>
                              )}
                            </>
                          )}

                        </div>
                      </div>



                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Preview */}
              <div className="w-[430px] flex-shrink-0 border-l border-purple-100 bg-[#f3f1f8] p-6 relative overflow-hidden">
                <div className="mb-4 flex items-center justify-between rounded-[24px] border border-white bg-white/95 px-4 py-3 shadow-sm">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-purple-500">Live Preview</p>
                    <p className="text-sm font-bold text-slate-900">WhatsApp message card</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <Smartphone size={18} />
                  </span>
                </div>

                <div className="mx-auto flex h-[620px] w-[300px] flex-col overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-white shadow-2xl">
                  {/* Status Bar */}
                  <div className="h-6 bg-slate-800 w-full flex items-center justify-center">
                    <div className="w-20 h-4 bg-black rounded-b-xl" />
                  </div>

                  {/* Header Bar */}
                  <div className="h-14 bg-[#075E54] flex items-center px-4 gap-3 shadow-md z-10">
                    <div className="w-8 h-8 rounded-full bg-white/20" />
                    <div className="flex-1">
                      <div className="h-2 w-20 bg-white/20 rounded mb-1" />
                      <div className="h-1.5 w-12 bg-white/10 rounded" />
                    </div>
                  </div>

                  {/* Chat Area */}
                  <div className="flex-1 bg-[#E5DDD5] p-4 overflow-y-auto bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">

                    <div className="bg-white rounded-lg shadow-sm max-w-[90%] mb-2 overflow-hidden relative">
                      {/* Header */}
                      {formData.headerType === 'IMAGE' && (
                        <div className="h-36 bg-black flex items-center justify-center">
                          {resolvedHeaderPreviewUrl ? (
                            <img
                              src={resolvedHeaderPreviewUrl}
                              alt="Header"
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <ImageIcon className="text-slate-400 w-8 h-8" />
                          )}
                        </div>
                      )}
                      {formData.headerType === 'VIDEO' && (
                        <div className="h-36 bg-black flex items-center justify-center">
                          {resolvedHeaderPreviewUrl ? (
                            <video
                              src={resolvedHeaderPreviewUrl}
                              className="max-h-full max-w-full object-contain"
                              muted
                              controls
                            />
                          ) : (
                            <Video className="text-slate-400 w-8 h-8" />
                          )}
                        </div>
                      )}
                      {formData.headerType === 'DOCUMENT' && (
                        <div className="h-20 bg-slate-100 flex items-center justify-between px-3 py-2 gap-2 border-b border-slate-200">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-slate-900 truncate">
                                {formData.headerFileName || 'Document'}
                              </span>
                              <span className="text-[10px] text-slate-500 truncate">
                                Tap to view document
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      {formData.headerType === 'TEXT' && formData.headerText && (
                        <div className="px-3 pt-3 font-bold text-slate-900 text-sm">{formData.headerText}</div>
                      )}

                      {/* Body */}
                      <div className="px-3 py-2 text-sm text-slate-900 whitespace-pre-wrap leading-relaxed break-words">
                        {getPreviewBodyText()}
                      </div>

                      {/* Footer */}
                      {formData.footerText && (
                        <div className="px-3 pb-2 text-[10px] text-slate-500">
                          {formData.footerText}
                        </div>
                      )}

                      {/* Timestamp */}
                      <div className="px-2 pb-1 text-[10px] text-slate-400 text-right flex justify-end gap-1">
                        12:00 PM <span className="text-blue-500">✓✓</span>
                      </div>
                    </div>

                    {/* Buttons */}
                    {(formData.buttons.length > 0 || formData.subCategory === 'CALL_PERMISSION') && (
                      <div className="max-w-[90%] space-y-1">
                        {formData.subCategory === 'CALL_PERMISSION' ? (
                          <>
                            <div className="bg-white rounded-lg shadow-sm py-2.5 text-center text-blue-500 font-medium text-sm cursor-pointer hover:bg-slate-50">
                              Yes, allow
                            </div>
                            <div className="bg-white rounded-lg shadow-sm py-2.5 text-center text-blue-500 font-medium text-sm cursor-pointer hover:bg-slate-50">
                              No, thanks
                            </div>
                          </>
                        ) : (
                          formData.buttons.map((btn, i) => (
                            <div key={i} className="bg-white rounded-lg shadow-sm py-2.5 text-center text-blue-500 font-medium text-sm cursor-pointer hover:bg-slate-50">
                              {btn.type === 'COPY_CODE' ? 'Copy Code' : btn.text}
                            </div>
                          ))
                        )}
                      </div>
                    )}

                  </div>
                </div>
              </div>

            </div>
          </>
        )}
      </div>
      <GallerySelectModal
        isOpen={showGallerySelect}
        onClose={() => setShowGallerySelect(false)}
        resourceType={galleryResourceType}
        onSelect={(url) => setTestHeaderMedia(url)}
      />

      {/* Bulk Creation Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Bulk Create Templates</h3>
                  <p className="text-xs text-slate-500">Upload a NorthStar campaign .md file</p>
                </div>
              </div>
              <button onClick={() => { setIsBulkModalOpen(false); setBulkStatus(null); setBulkProgress([]); }} className="text-slate-400 hover:text-slate-600 p-2">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <div className="p-8 flex-1 overflow-y-auto">
              {!bulkStatus ? (
                <div className="space-y-6">
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-all group relative">
                    <input type="file" accept=".md" onChange={handleBulkFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <Upload className="w-12 h-12 text-slate-300 group-hover:text-blue-500 mx-auto mb-4 transition-colors" />
                    <p className="font-semibold text-slate-900">{bulkFile ? bulkFile.name : 'Click or drag .md file here'}</p>
                    <p className="text-xs text-slate-500 mt-2">Maximum file size 5MB</p>
                  </div>
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <h4 className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Instructions</h4>
                    <ul className="text-xs text-blue-600 space-y-2 list-disc pl-4">
                      <li>Use the standard NorthStar drip campaign markdown format.</li>
                      <li>Template names will be auto-generated from titles.</li>
                      <li>Placeholders like <code className="bg-blue-100 px-1 rounded">{"{{Name}}"}</code> will be mapped to <code className="bg-blue-100 px-1 rounded">{"{{1}}"}</code>.</li>
                    </ul>
                  </div>
                </div>
              ) : bulkStatus === 'uploading' || bulkStatus === 'processing' ? (
                <div className="py-12 text-center space-y-4">
                  <RefreshCw className="w-16 h-16 text-blue-500 animate-spin mx-auto opacity-50" />
                  <p className="font-medium text-slate-900">Processing campaign file...</p>
                  <p className="text-xs text-slate-500">This may take a few moments per template.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className={cn(
                    "p-4 rounded-xl flex items-center gap-3",
                    bulkStatus === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  )}>
                    {bulkStatus === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span className="text-sm font-bold">
                      {bulkStatus === 'success' ? `${bulkProgress.length} templates processed successfully!` : 'Creation failed'}
                    </span>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-2 px-3 font-semibold text-slate-500">Name</th>
                            <th className="text-left py-2 px-3 font-semibold text-slate-500">Status</th>
                            <th className="text-left py-2 px-3 font-semibold text-slate-500">Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkProgress.map((p, idx) => (
                            <tr key={idx} className="border-b border-slate-50">
                              <td className="py-2 px-3 font-medium text-slate-900">{p.name}</td>
                              <td className="py-2 px-3">
                                {p.status === 'SUCCESS' ? (
                                  <Badge className="bg-green-100 text-green-700 border-none text-[10px]">Created</Badge>
                                ) : (
                                  <Badge className="bg-red-100 text-red-700 border-none text-[10px]">Failed</Badge>
                                )}
                              </td>
                              <td className="py-2 px-3 text-slate-500">{p.id || p.error || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => { setIsBulkModalOpen(false); setBulkStatus(null); setBulkProgress([]); }}>
                Close
              </Button>
              {(!bulkStatus || bulkStatus === 'error') && (
                <Button onClick={handleBulkUpload} disabled={!bulkFile}>
                  Process File
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Plus, Trash2, Save, Eye, Download, Upload, GripVertical, Image as ImageIcon, Type, Divide, Link, MousePointer, Code } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate, uploadFlowMedia } from './api.js';
import { GallerySelectModal } from '../media/GallerySelectModal.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import { confirmAction } from '../../components/ui/confirmAction.jsx';

const initialBlocks = [];

function extractVariablesFromHtml(html) {
  const vars = new Set();
  const r = /\{\{([^}]+)\}\}/g;
  let m;
  while ((m = r.exec(html)) !== null) {
    const v = m[1].trim();
    if (v) vars.add(v);
  }
  return Array.from(vars);
}

function compileHtml(design) {
  const blocks = Array.isArray(design?.blocks) ? design.blocks : [];
  const head = `
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body{margin:0;padding:0;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif}
    .container{max-width:600px;margin:0 auto;background:#ffffff}
    .spacer{height:16px}
    .p{padding:16px}
    .t{font-size:14px;line-height:1.6;color:#1f2937}
    .h{font-size:20px;font-weight:700;color:#111827}
    .btn{display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px}
    .center{text-align:center}
    img{max-width:100%;height:auto;display:block;border:0}
    hr{border:none;border-top:1px solid #e5e7eb;margin:0}
  </style>`;
  const parts = [`<!doctype html><html><head>${head}</head><body><div class="container">`];
  blocks.forEach((b) => {
    if (b.type === 'spacer') {
      parts.push(`<div class="spacer" style="height:${b.height || 16}px"></div>`);
    } else if (b.type === 'divider') {
      parts.push(`<hr />`);
    } else if (b.type === 'text') {
      const align = b.align || 'left';
      const size = b.size || 14;
      const color = b.color || '#1f2937';
      parts.push(`<div class="p"><div class="t" style="text-align:${align};font-size:${size}px;color:${color}">${b.html || ''}</div></div>`);
    } else if (b.type === 'heading') {
      const align = b.align || 'left';
      const size = b.size || 20;
      const color = b.color || '#111827';
      parts.push(`<div class="p"><div class="h" style="text-align:${align};font-size:${size}px;color:${color}">${b.html || ''}</div></div>`);
    } else if (b.type === 'image') {
      const url = b.url || '';
      const alt = b.alt || '';
      const align = b.align || 'left';
      parts.push(`<div class="p" style="text-align:${align}"><img src="${url}" alt="${alt}"/></div>`);
    } else if (b.type === 'button') {
      const text = b.text || 'Click';
      const href = b.href || '#';
      const align = b.align || 'left';
      const bg = b.bg || '#2563eb';
      const color = b.color || '#ffffff';
      parts.push(`<div class="p" style="text-align:${align}"><a href="${href}" class="btn" style="background:${bg};color:${color}">${text}</a></div>`);
    } else if (b.type === 'html') {
      parts.push(`${b.html || ''}`);
    }
  });
  parts.push(`</div></body></html>`);
  return parts.join('');
}

export default function EmailTemplatesPage({ startCreate = false }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [blocks, setBlocks] = useState(initialBlocks);
  const [dragIndex, setDragIndex] = useState(null);
  const iframeRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadTargetIdx, setUploadTargetIdx] = useState(null);
  const [uploadingIdx, setUploadingIdx] = useState(null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryTargetIdx, setGalleryTargetIdx] = useState(null);

  const design = useMemo(() => ({ blocks }), [blocks]);
  const html = useMemo(() => compileHtml(design), [design]);
  const variables = useMemo(() => extractVariablesFromHtml(html), [html]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getEmailTemplates();
        if (res && res.success !== false) {
          setTemplates(Array.isArray(res.templates) ? res.templates : (res.items || []));
        } else {
          setTemplates([]);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (startCreate) {
      setIsCreating(true);
      setEditing(null);
      setName('');
      setSubject('');
      setBlocks([]);
    }
  }, [startCreate]);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [html]);

  const addBlock = (type, preset) => {
    const b = preset || {};
    b.type = type;
    if (type === 'text' && b.html == null) b.html = 'Paragraph';
    if (type === 'heading' && b.html == null) b.html = 'Heading';
    setBlocks((arr) => [...arr, b]);
  };

  const onDragStartPalette = (e, type) => {
    e.dataTransfer.setData('email/blocktype', type);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOverCanvas = (e) => {
    e.preventDefault();
  };
  const onDropCanvas = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('email/blocktype');
    if (type) addBlock(type);
  };

  const onRowDragStart = (e, idx) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onRowDragOver = (e, overIdx) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === overIdx) return;
    setBlocks((arr) => {
      const a = [...arr];
      const [m] = a.splice(dragIndex, 1);
      a.splice(overIdx, 0, m);
      return a;
    });
    setDragIndex(overIdx);
  };
  const onRowDragEnd = () => setDragIndex(null);

  const handleCreate = () => {
    setIsCreating(true);
    setEditing(null);
    setName('');
    setSubject('');
    setBlocks([]);
  };
  const handleEdit = (tpl) => {
    setIsCreating(true);
    setEditing(tpl);
    setName(tpl.name || '');
    setSubject(tpl.subject || '');
    const d = tpl.design || {};
    setBlocks(Array.isArray(d.blocks) ? d.blocks : []);
  };
  const handleDelete = async (tpl) => {
    if (!(await confirmAction({
      title: 'Delete email template?',
      message: `Delete "${tpl.name || 'this template'}"?`,
      confirmLabel: 'Delete template',
      tone: 'danger',
    }))) return;
    await deleteEmailTemplate(tpl.id);
    const res = await getEmailTemplates();
    setTemplates(Array.isArray(res.templates) ? res.templates : (res.items || []));
    if (editing && editing.id === tpl.id) {
      setIsCreating(false);
      setEditing(null);
    }
  };
  const handleSave = async () => {
    const payload = {
      name,
      subject,
      html_body: html,
      text_body: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      variables,
      design,
    };
    if (editing) {
      await updateEmailTemplate(editing.id, payload);
    } else {
      await createEmailTemplate(payload);
    }
    const res = await getEmailTemplates();
    setTemplates(Array.isArray(res.templates) ? res.templates : (res.items || []));
    setIsCreating(false);
    setEditing(null);
  };

  const updateBlock = (idx, patch) => {
    setBlocks((arr) => {
      const a = [...arr];
      a[idx] = { ...a[idx], ...patch };
      return a;
    });
  };

  const removeBlock = (idx) => {
    setBlocks((arr) => arr.filter((_, i) => i !== idx));
  };

  const handleUploadClick = (idx) => {
    setUploadTargetIdx(idx);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploadTargetIdx == null) return;
    setUploadingIdx(uploadTargetIdx);
    try {
      const res = await uploadFlowMedia(file);
      if (res && res.url) {
        updateBlock(uploadTargetIdx, { url: res.url });
      } else if (res && res.secure_url) {
        updateBlock(uploadTargetIdx, { url: res.secure_url });
      } else {
        alert('Upload failed: No URL in response');
      }
    } catch (err) {
      console.error('Upload failed', err);
      alert('Upload failed');
    } finally {
      setUploadingIdx(null);
      setUploadTargetIdx(null);
    }
  };

  const openGalleryFor = (idx) => {
    setGalleryTargetIdx(idx);
    setShowGallery(true);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f3f1f8]">
      <div className="border-b border-white/70 bg-[#f3f1f8] flex items-center justify-between px-8 py-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-purple-100 flex items-center justify-center text-purple-700">
            <Mail size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Email Templates</h1>
            <p className="text-sm text-slate-500">Build reusable email layouts with drag-and-drop blocks.</p>
          </div>
          {loading && <span className="text-xs text-slate-500">Loading…</span>}
        </div>
        {!isCreating ? (
          <Button className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 py-3 text-white shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700" onClick={handleCreate}>
            <Plus size={16} />
            Create Template
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-2xl border-purple-100 bg-white px-5 py-3 text-slate-700" onClick={() => { setIsCreating(false); setEditing(null); }}>Back</Button>
            <Button className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 py-3 text-white shadow-lg shadow-purple-200 hover:from-purple-800 hover:to-fuchsia-700" onClick={handleSave}>
              <Save size={16} />
              Save
            </Button>
          </div>
        )}
      </div>

      {!isCreating ? (
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
                <div className="text-sm text-slate-500">Total Templates</div>
                <div className="mt-2 text-2xl font-bold text-slate-950">{templates.length}</div>
              </div>
              <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
                <div className="text-sm text-slate-500">Reusable Assets</div>
                <div className="mt-2 text-2xl font-bold text-slate-950">{templates.filter((t) => t.design).length}</div>
              </div>
              <div className="rounded-3xl border border-white bg-white p-6 shadow-sm">
                <div className="text-sm text-slate-500">Editor Mode</div>
                <div className="mt-2 text-2xl font-bold text-slate-950">Visual</div>
              </div>
            </div>

            <div className="bg-white border border-white rounded-3xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-purple-100 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-900">Template Library</div>
                  <div className="text-xs text-slate-500">Open, edit, download or remove reusable email templates.</div>
                </div>
              </div>
              <div className="divide-y divide-purple-50">
                {loading && templates.length === 0 ? (
                  <div className="p-8">
                    <GreetoLoader label="Loading email templates..." sublabel="Fetching reusable email layouts" />
                  </div>
                ) : templates.map(t => (
                  <div key={t.id} className="p-5 flex items-center justify-between hover:bg-purple-50/60 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-950">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.subject}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="rounded-xl border-purple-100 bg-white text-purple-700" onClick={() => handleEdit(t)}>Edit</Button>
                      <Button variant="outline" size="sm" className="rounded-xl border-red-100 bg-red-50 text-red-600" onClick={() => handleDelete(t)}>
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div className="p-12 text-center text-slate-400 text-sm">No templates yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex gap-5 p-6">
          <div className="w-80 overflow-auto rounded-[34px] border border-white bg-white p-5 shadow-sm">
            <div className="rounded-[26px] border border-purple-100 bg-purple-50/50 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-purple-500">Template Details</div>
              <input className="mt-4 w-full rounded-2xl border border-purple-100 bg-white p-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-200" placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
              <input className="mt-3 w-full rounded-2xl border border-purple-100 bg-white p-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-200" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Blocks</div>
            <div className="mt-3 space-y-3">
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'heading')} className="flex cursor-grab items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-50">
              <Type size={16} />
              <span className="text-sm font-bold">Heading</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'text')} className="flex cursor-grab items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-50">
              <MousePointer size={16} />
              <span className="text-sm font-bold">Text</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'image')} className="flex cursor-grab items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-50">
              <ImageIcon size={16} />
              <span className="text-sm font-bold">Image</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'button')} className="flex cursor-grab items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-50">
              <Link size={16} />
              <span className="text-sm font-bold">Button</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'divider')} className="flex cursor-grab items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-50">
              <Divide size={16} />
              <span className="text-sm font-bold">Divider</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'spacer')} className="flex cursor-grab items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-50">
              <Divide size={16} />
              <span className="text-sm font-bold">Spacer</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'html')} className="flex cursor-grab items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-purple-300 hover:bg-purple-50">
              <Code size={16} />
              <span className="text-sm font-bold">HTML</span>
            </div>
            </div>
            <div className="pt-3">
              <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Variables</div>
              <div className="flex flex-wrap gap-1">
                {variables.map(v => (
                  <span key={v} className="text-[10px] bg-purple-50 border border-purple-100 rounded-full px-2 py-1 text-purple-700">{v}</span>
                ))}
                {variables.length === 0 && <span className="text-[11px] text-slate-400">None</span>}
              </div>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-[minmax(0,1fr)_430px] overflow-hidden gap-5">
            <div className="flex flex-col overflow-hidden rounded-[34px] border border-white bg-white shadow-sm">
              <div className="h-16 px-5 border-b border-purple-100 flex items-center justify-between bg-gradient-to-r from-white to-purple-50/60">
                <div>
                  <div className="text-sm font-bold text-slate-950">Canvas</div>
                  <div className="text-xs text-slate-500">Drag blocks here and edit every section inline.</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl border-purple-100" onClick={() => setBlocks([])}>Clear</Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto" onDragOver={onDragOverCanvas} onDrop={onDropCanvas}>
                {blocks.map((b, i) => (
                  <div
                    key={i}
                    className="group relative m-3 rounded-2xl border border-purple-100 bg-white p-4 cursor-move shadow-sm hover:bg-purple-50/40"
                    draggable
                    onDragStart={(e) => onRowDragStart(e, i)}
                    onDragOver={(e) => onRowDragOver(e, i)}
                    onDragEnd={onRowDragEnd}
                  >
                    <div className="absolute left-2 top-3 text-slate-300">
                      <GripVertical size={14} />
                    </div>
                    <div className="pl-6">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-700">{b.type}</div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="text-red-600" onClick={() => removeBlock(i)}>
                            <Trash2 size={12} />
                            Remove
                          </Button>
                        </div>
                      </div>
                      {b.type === 'heading' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input className="border border-purple-100 rounded-xl p-2 text-sm col-span-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.html || ''} onChange={(e) => updateBlock(i, { html: e.target.value })} placeholder="Heading text, supports {{variables}}" />
                          <select className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.align || 'left'} onChange={(e) => updateBlock(i, { align: e.target.value })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                          <input className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.size || 20} onChange={(e) => updateBlock(i, { size: parseInt(e.target.value, 10) || 20 })} placeholder="Size" />
                          <input className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.color || '#111827'} onChange={(e) => updateBlock(i, { color: e.target.value })} placeholder="#111827" />
                        </div>
                      )}
                      {b.type === 'text' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <textarea className="border border-purple-100 rounded-xl p-2 text-sm col-span-2 bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" rows={4} value={b.html || ''} onChange={(e) => updateBlock(i, { html: e.target.value })} placeholder="Text, supports {{variables}}" />
                          <select className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.align || 'left'} onChange={(e) => updateBlock(i, { align: e.target.value })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                          <input className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.size || 14} onChange={(e) => updateBlock(i, { size: parseInt(e.target.value, 10) || 14 })} placeholder="Size" />
                          <input className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.color || '#1f2937'} onChange={(e) => updateBlock(i, { color: e.target.value })} placeholder="#1f2937" />
                        </div>
                      )}
                      {b.type === 'image' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="col-span-2 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUploadClick(i)}
                              disabled={uploadingIdx === i}
                            >
                              {uploadingIdx === i ? 'Uploading…' : 'Upload'}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openGalleryFor(i)}
                              disabled={uploadingIdx === i}
                            >
                              Gallery
                            </Button>
                            <input
                              className="border border-purple-100 rounded-xl p-2 text-sm flex-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-200"
                              value={b.url || ''}
                              onChange={(e) => updateBlock(i, { url: e.target.value })}
                              placeholder="Paste URL or select Upload/Gallery"
                            />
                          </div>
                          <input className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.alt || ''} onChange={(e) => updateBlock(i, { alt: e.target.value })} placeholder="Alt text" />
                          <select className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.align || 'left'} onChange={(e) => updateBlock(i, { align: e.target.value })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      )}
                      {b.type === 'button' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.text || ''} onChange={(e) => updateBlock(i, { text: e.target.value })} placeholder="Button text" />
                          <input className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.href || ''} onChange={(e) => updateBlock(i, { href: e.target.value })} placeholder="https://..." />
                          <input className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.bg || '#2563eb'} onChange={(e) => updateBlock(i, { bg: e.target.value })} placeholder="Background" />
                          <input className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.color || '#ffffff'} onChange={(e) => updateBlock(i, { color: e.target.value })} placeholder="Text color" />
                          <select className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.align || 'left'} onChange={(e) => updateBlock(i, { align: e.target.value })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      )}
                      {b.type === 'spacer' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input className="border border-purple-100 rounded-xl p-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" value={b.height || 16} onChange={(e) => updateBlock(i, { height: parseInt(e.target.value, 10) || 16 })} placeholder="Height px" />
                        </div>
                      )}
                      {b.type === 'html' && (
                        <div className="mt-2">
                          <textarea className="border border-purple-100 rounded-xl p-2 text-sm w-full bg-white focus:outline-none focus:ring-2 focus:ring-purple-200" rows={6} value={b.html || ''} onChange={(e) => updateBlock(i, { html: e.target.value })} placeholder="<p>Raw HTML</p>" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {blocks.length === 0 && (
                  <div className="m-6 flex min-h-64 items-center justify-center rounded-[28px] border border-dashed border-purple-200 bg-purple-50/40 p-8 text-center text-sm font-semibold text-slate-400">Drag blocks here</div>
                )}
              </div>
            </div>
            <div className="flex flex-col overflow-hidden rounded-[34px] border border-white bg-white shadow-sm">
              <div className="h-16 px-5 border-b border-purple-100 flex items-center justify-between bg-gradient-to-r from-white to-fuchsia-50/60">
                <div>
                  <div className="text-sm font-bold text-slate-950">Preview</div>
                  <div className="text-xs text-slate-500">Generated email output</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl border-purple-100" onClick={() => {
                    const blob = new Blob([html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${name || 'template'}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>
                    <Download size={14} />
                    Download HTML
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-purple-50/50 p-6">
                <div className="border border-purple-100 rounded-3xl overflow-hidden shadow-sm bg-white">
                  <iframe ref={iframeRef} title="preview" className="w-full h-[700px] bg-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />
      <GallerySelectModal
        isOpen={showGallery}
        onClose={() => { setShowGallery(false); setGalleryTargetIdx(null); }}
        resourceType="image"
        onSelect={(url) => {
          if (galleryTargetIdx != null) {
            updateBlock(galleryTargetIdx, { url });
          }
          setShowGallery(false);
          setGalleryTargetIdx(null);
        }}
      />
    </div>
  );
}


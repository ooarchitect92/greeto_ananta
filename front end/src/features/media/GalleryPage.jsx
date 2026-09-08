import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Image as ImageIcon,
  FileText,
  Video as VideoIcon,
  UploadCloud,
  Trash2,
  RefreshCw,
  PlayCircle,
  X,
  Search,
  Copy,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import WorkspaceEmptyState from '../../components/ui/WorkspaceEmptyState.jsx';

const tabs = [
  { key: 'image', label: 'Images', icon: ImageIcon, tone: 'from-emerald-500 to-teal-500' },
  { key: 'video', label: 'Videos', icon: VideoIcon, tone: 'from-purple-600 to-fuchsia-500' },
  { key: 'raw', label: 'Documents', icon: FileText, tone: 'from-blue-600 to-cyan-500' },
];

function formatBytes(bytes = 0) {
  if (!bytes) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function isDisplayUrl(value) {
  return isHttpUrl(value) || String(value || '').startsWith('/api/gallery/access/');
}

function HistoricalImage({ file, onOpen }) {
  const [src, setSrc] = useState(isDisplayUrl(file.secure_url) ? file.secure_url : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isDisplayUrl(file.secure_url)) {
      setSrc(file.secure_url);
      setFailed(false);
      return undefined;
    }
    let active = true;
    let objectUrl = null;
    axios.get(`/api/media/${encodeURIComponent(file.secure_url)}`, {
      responseType: 'blob',
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
    }).then((response) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(response.data);
      setSrc(objectUrl);
    }).catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.secure_url]);

  if (failed) {
    return <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs font-semibold text-slate-500">Historical image is no longer available from Meta</div>;
  }
  if (!src) return <GreetoLoader label="Loading image..." />;
  return <img src={src} onClick={() => onOpen(file)} alt={file.filename} loading="lazy" className="h-full w-full cursor-pointer object-cover transition duration-300 group-hover:scale-105" />;
}

export default function GalleryPage({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('image');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePreview, setActivePreview] = useState(null);
  const [openingMedia, setOpeningMedia] = useState(null);
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    fetchMedia();
  }, [activeTab]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('accessToken')}` };
      const [mediaResult, quotaResult] = await Promise.all([
        axios.get(`/api/gallery?resource_type=${activeTab}`, { headers }),
        axios.get('/api/gallery/quota', { headers }),
      ]);
      setFiles(Array.isArray(mediaResult.data) ? mediaResult.data : []);
      setQuota(quotaResult.data);
    } catch (err) {
      console.error('Failed to fetch media:', err);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    let typeToPass = 'auto';
    if (file.type.startsWith('image/')) typeToPass = 'image';
    if (file.type.startsWith('video/')) typeToPass = 'video';
    formData.append('resource_type', typeToPass);

    try {
      const response = await axios.post('/api/gallery/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });
      if (response.data?.quota) setQuota(response.data.quota);
      fetchMedia();
    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.response?.data?.message || err.response?.data?.error || 'Upload failed');
    }
    setUploading(false);
  };

  const handleDelete = async (public_id) => {
    if (!(await confirmAction({
      title: 'Delete media asset?',
      message: 'Delete this asset permanently?',
      confirmLabel: 'Delete asset',
      tone: 'danger',
    }))) return;
    try {
      const response = await axios.delete('/api/gallery', {
        data: { public_id, resource_type: activeTab },
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      setFiles(files.filter(f => f.public_id !== public_id));
      if (response.data?.quota) setQuota(response.data.quota);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const copyToClipboard = (fileOrUrl) => {
    const url = typeof fileOrUrl === 'string' ? fileOrUrl : fileOrUrl?.secure_url;
    if (!isDisplayUrl(url)) {
      alert('This historical Meta media item has no permanent public URL yet. It can still be previewed securely.');
      return;
    }
    let secure = String(url).startsWith('/') ? `${window.location.origin}${url}` : url;
    if (secure.startsWith('http://')) secure = secure.replace('http://', 'https://');
    navigator.clipboard.writeText(secure);
    alert('URL Copied!');
  };

  const openProtectedMedia = async (file, type) => {
    if (isDisplayUrl(file.secure_url)) {
      setActivePreview({ type, url: file.secure_url, objectUrl: false, name: file.filename });
      return;
    }
    setOpeningMedia(String(file.public_id || file.storage_key || file.secure_url || 'media-asset'));
    try {
      const response = await axios.get(`/api/media/${encodeURIComponent(file.secure_url)}`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      });
      const objectUrl = URL.createObjectURL(response.data);
      setActivePreview({ type, url: objectUrl, objectUrl: true, name: file.filename });
    } catch (error) {
      alert(error.response?.data?.message || 'This historical media is no longer available from Meta.');
    } finally {
      setOpeningMedia(null);
    }
  };

  const closePreview = () => {
    if (activePreview?.objectUrl) URL.revokeObjectURL(activePreview.url);
    setActivePreview(null);
  };

  const filteredFiles = files.filter(f => {
    const assetId = String(f.public_id || f.storage_key || '');
    const name = String(f.filename || assetId.split('/').pop() || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const activeTabMeta = tabs.find(tab => tab.key === activeTab) || tabs[0];
  const ActiveIcon = activeTabMeta.icon;
  const totalSize = files.reduce((sum, file) => sum + (file.bytes || 0), 0);
  const storagePercent = Math.min(Math.max(Number(quota?.usage_percent || 0), 0), 100);

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#f3f1f8]">
      <div className="p-6">
        <div className="relative overflow-hidden rounded-[32px] border border-white bg-white p-6 shadow-sm">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-purple-100 blur-3xl" />
          <div className="pointer-events-none absolute right-24 top-8 h-24 w-24 rounded-full bg-fuchsia-100 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-700 to-fuchsia-500 text-white shadow-xl shadow-purple-200">
                <HardDrive className="h-7 w-7" />
              </div>
              <div>
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-500">
                  <Sparkles className="h-3.5 w-3.5" />
                  File Manager
                </p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Media Library</h1>
                <p className="mt-1 text-sm text-slate-500">Manage reusable images, videos, and documents for templates, campaigns, and inbox replies.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={fetchMedia}
                disabled={loading}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-purple-100 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-purple-200 hover:bg-purple-50 disabled:opacity-60"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin text-purple-600' : 'text-purple-600'} />
                Refresh
              </button>

              <label className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition hover:from-purple-800 hover:to-fuchsia-700">
                <UploadCloud size={17} />
                {uploading ? 'Uploading...' : 'Upload Asset'}
                <input
                  id="gallery-upload-input"
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  accept={activeTab === 'image' ? 'image/*' : activeTab === 'video' ? 'video/mp4,video/*,video/x-m4v' : '.pdf,application/pdf'}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
              <ActiveIcon className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Current Folder</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{activeTabMeta.label}</p>
          </div>

          <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <HardDrive className="h-5 w-5" />
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Assets Loaded</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{files.length}</p>
          </div>

          <div className="rounded-3xl border border-white bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-50 text-fuchsia-600">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace Storage</p>
              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[10px] font-semibold text-purple-700">
                {formatBytes(quota?.limit_bytes || 0)} limit
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-950">{formatBytes(quota?.used_bytes || 0)} used</p>
            <p className="mt-1 text-xs font-medium text-slate-500">
              {formatBytes(quota?.available_bytes || 0)} free
              {totalSize > 0 ? ` · ${formatBytes(totalSize)} in ${activeTabMeta.label.toLowerCase()}` : ''}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Workspace storage used" aria-valuemin="0" aria-valuemax="100" aria-valuenow={storagePercent}>
              <div
                className={`h-full rounded-full transition-all ${storagePercent >= 90 ? 'bg-red-500' : storagePercent >= 70 ? 'bg-amber-500' : 'bg-gradient-to-r from-purple-600 to-fuchsia-500'}`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[28px] border border-white bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    className={`inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-semibold transition ${
                      active
                        ? `bg-gradient-to-r ${tab.tone} text-white shadow-lg shadow-purple-100`
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700'
                    }`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full xl:w-80">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search file name..."
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/80 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-4 focus:ring-purple-100"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 pb-12">
          {loading ? (
            <div className="rounded-[28px] border border-white bg-white p-6 shadow-sm">
              <GreetoLoader label="Loading media library..." sublabel={`Fetching ${activeTabMeta.label.toLowerCase()} resources`} />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-violet-200 bg-white shadow-sm">
              <WorkspaceEmptyState title={`No ${activeTabMeta.label.toLowerCase()} found`} description="Upload media to make it available in templates, campaigns, and conversations." primaryLabel="Upload media" onPrimary={() => document.getElementById('gallery-upload-input')?.click()} secondaryLabel="Open integrations" onSecondary={() => onNavigate?.('integrations')} />
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm divide-y divide-slate-100">
              {filteredFiles.map(file => {
                const assetId = String(file.public_id || file.storage_key || file.secure_url || 'media-asset');
                const fileName = file.filename || assetId.split('/').pop() || 'Media asset';
                const isPdf = file.format === 'pdf' || (file.secure_url || '').toLowerCase().endsWith('.pdf');

                return (
                  <div key={assetId} className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-purple-50/40">
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                      {activeTab === 'image' && (
                        <HistoricalImage file={file} onOpen={(selected) => openProtectedMedia(selected, 'image')} />
                      )}

                      {activeTab === 'video' && (
                        <>
                          <video
                            src={isDisplayUrl(file.secure_url) ? file.secure_url : undefined}
                            className="h-full w-full object-cover brightness-90 transition duration-300 group-hover:scale-105 group-hover:brightness-75"
                            onClick={() => openProtectedMedia(file, 'video')}
                          />
                          <button
                            className="absolute inset-0 flex items-center justify-center"
                            onClick={() => openProtectedMedia(file, 'video')}
                            disabled={openingMedia === assetId}
                          >
                            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-purple-700 shadow-lg transition group-hover:scale-110">
                            {openingMedia === assetId ? <RefreshCw size={24} className="animate-spin" /> : <PlayCircle size={28} />}
                            </span>
                          </button>
                        </>
                      )}

                      {activeTab === 'raw' && (
                        <button
                          className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 transition hover:from-blue-100 hover:to-purple-100"
                          onClick={() => openProtectedMedia(file, 'document')}
                          title="Click to view/download document"
                        >
                          <FileText size={32} className="mb-2 text-blue-600" />
                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-blue-700 shadow-sm">
                            {(isPdf ? 'PDF' : file.format || assetId.split('.').pop() || 'DOC').toUpperCase().substring(0, 4)}
                          </span>
                        </button>
                      )}

                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(file); }}
                        title="Copy link"
                        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-slate-700 opacity-0 shadow-lg backdrop-blur transition hover:bg-purple-50 hover:text-purple-700 group-hover:opacity-100"
                      >
                        <Copy size={15} />
                      </button>
                    </div>

                    <div className="flex min-w-0 flex-1 items-center gap-4">
                      <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-950" title={fileName}>{fileName}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1">{formatBytes(file.bytes)}</span>
                            <span className="rounded-full bg-purple-50 px-2.5 py-1 text-purple-600">{file.format || 'BIN'}</span>
                          </div>
                      </div>
                      <span className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${activeTabMeta.tone} text-white shadow-md sm:flex`}>
                        <ActiveIcon size={14} />
                      </span>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => copyToClipboard(file)}
                          className="rounded-lg border border-purple-100 bg-purple-50 px-2.5 py-2 text-[11px] font-semibold text-purple-700 transition hover:bg-purple-100"
                        >
                          Copy URL
                        </button>
                        <button
                          onClick={() => handleDelete(assetId)}
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] font-semibold text-red-600 transition hover:bg-red-100"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {activePreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <button
            onClick={closePreview}
            className="absolute right-6 top-6 rounded-full bg-white/10 p-2.5 text-white/70 transition hover:bg-white/20 hover:text-white"
          >
            <X size={24} />
          </button>
          <div className="relative w-full max-w-5xl">
            <div className="flex aspect-video items-center justify-center overflow-hidden rounded-3xl bg-black shadow-2xl ring-1 ring-white/10">
              {activePreview.type === 'video' && (
                <video src={activePreview.url} className="h-full w-full object-contain" controls autoPlay />
              )}
              {activePreview.type === 'image' && (
                <img src={activePreview.url} alt={activePreview.name || 'Media preview'} className="h-full w-full object-contain" />
              )}
              {activePreview.type === 'document' && (
                <iframe src={activePreview.url} title={activePreview.name || 'Document preview'} className="h-full w-full border-0 bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

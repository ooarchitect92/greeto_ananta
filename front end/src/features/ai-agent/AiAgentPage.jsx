import React, { useState, useEffect } from 'react';
import { 
  Bot, Power, Plus, Trash2, FileText, Globe, Upload, Settings, 
  RefreshCw, CheckCircle, AlertCircle, File 
} from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { useToast } from '../../components/ui/use-toast.jsx';
import { 
  getAiConfig, updateAiConfig, getAiKnowledge, 
  addAiTextKnowledge, deleteAiKnowledge, uploadAiDocument,
  testAiAgent, getGenericIntegrationSettings
} from './api.js';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import { confirmAction } from '../../components/ui/confirmAction.jsx';
import WorkspaceEmptyState from '../../components/ui/WorkspaceEmptyState.jsx';

export default function AiAgentPage({ onNavigate }) {
  const { toast } = useToast();
  const [config, setConfig] = useState({ is_active: false, system_prompt: '', model_name: 'gpt-4-turbo' });
  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingKnow, setLoadingKnow] = useState(false);
  const [openAiConnected, setOpenAiConnected] = useState(null);
  
  // Test Chat State
  const [chatMessages, setChatMessages] = useState([{ role: 'system', content: 'AI Agent Test Console' }]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Modals
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [urlForm, setUrlForm] = useState({ title: '', url: '' });
  const [fileForm, setFileForm] = useState({ title: '', file: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [confRes, knowRes, integrationsRes] = await Promise.all([
        getAiConfig(),
        getAiKnowledge(),
        getGenericIntegrationSettings()
      ]);
      if (confRes) setConfig(confRes);
      if (Array.isArray(knowRes)) setKnowledge(knowRes);
      const openAi = integrationsRes?.integrations?.find((integration) => integration.provider_id === 'openai');
      setOpenAiConnected(Boolean(
        openAi &&
        openAi.is_active !== false &&
        openAi.secret_configured?.api_key
      ));
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', description: 'Failed to load AI settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    const newState = !config.is_active;
    const ok = await confirmAction({
      title: newState ? 'Activate AI Agent?' : 'Deactivate AI Agent?',
      message: newState
        ? 'AI Agent will start handling eligible automated replies.'
        : 'AI Agent will pause automated replies until enabled again.',
      confirmLabel: newState ? 'Activate' : 'Deactivate',
      tone: 'toggle',
    });
    if (!ok) return;
    try {
      const res = await updateAiConfig({ is_active: newState });
      setConfig(res);
      toast({ 
        description: newState ? "AI Agent Activated" : "AI Agent Deactivated",
        className: newState ? "bg-green-50 border-green-200 text-green-800" : ""
      });
    } catch (e) {
      toast({ variant: 'destructive', description: 'Failed to update status' });
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await updateAiConfig({ 
        system_prompt: config.system_prompt,
        model_name: config.model_name
      });
      setConfig(res);
      toast({ description: "Configuration saved" });
    } catch (e) {
      toast({ variant: 'destructive', description: 'Failed to save config' });
    }
  };

  const handleAddUrl = async () => {
    if (!urlForm.title || !urlForm.url) return;
    setLoadingKnow(true);
    try {
      await addAiTextKnowledge({
        title: urlForm.title,
        source_url: urlForm.url,
        source_type: 'website',
        content: '' // Crawler would fetch this
      });
      setUrlForm({ title: '', url: '' });
      setShowAddUrl(false);
      loadData(); // Refresh list
      toast({ description: "Website added to knowledge base" });
    } catch (e) {
      toast({ variant: 'destructive', description: 'Failed to add website' });
    } finally {
      setLoadingKnow(false);
    }
  };

  const handleUploadFile = async () => {
    if (!fileForm.file) return;
    setLoadingKnow(true);
    try {
      await uploadAiDocument(fileForm.file, fileForm.title);
      setFileForm({ title: '', file: null });
      setShowUpload(false);
      loadData();
      toast({ description: "Document uploaded successfully" });
    } catch (e) {
      toast({ variant: 'destructive', description: 'Upload failed' });
    } finally {
      setLoadingKnow(false);
    }
  };

  const handleDeleteSource = async (id) => {
    if (!(await confirmAction({
      title: 'Remove knowledge source?',
      message: 'Remove this knowledge source from the AI agent?',
      confirmLabel: 'Remove source',
      tone: 'danger',
    }))) return;
    try {
      await deleteAiKnowledge(id);
      setKnowledge(prev => prev.filter(k => k.id !== id));
      toast({ description: "Source removed" });
    } catch (e) {
      toast({ variant: 'destructive', description: 'Failed to delete source' });
    }
  };

  const handleTestSend = async () => {
    if (!chatInput.trim()) return;
    
    const userMsg = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      };
      
      const response = await fetch('/api/ai-agent/test', {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: userMsg.content, stream: true })
      });

      if (!response.body) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      
      while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
              if (line.startsWith('data: ')) {
                  const dataStr = line.replace('data: ', '').trim();
                  if (!dataStr) continue;
                  if (dataStr === '[DONE]') break;
                  
                  try {
                      const parsed = JSON.parse(dataStr);
                      if (parsed.content) {
                          setChatMessages(prev => {
                              const newMsgs = [...prev];
                              const lastMsg = newMsgs[newMsgs.length - 1];
                              if (lastMsg.role === 'assistant') {
                                  lastMsg.content += parsed.content;
                              }
                              return newMsgs;
                          });
                      }
                  } catch (e) {
                      // ignore parse error
                  }
              }
          }
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'system', content: 'Error generating response.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([{ role: 'system', content: 'Chat cleared.' }]);
  };

  const websiteCount = knowledge.filter(item => item.source_type === 'website').length;
  const documentCount = knowledge.length - websiteCount;
  const promptLength = (config.system_prompt || '').length;

  if (loading) {
    return (
      <GreetoLoader fullScreen label="Loading AI Agent..." sublabel="Preparing knowledge and model settings" />
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-[#f3f1f8] p-5 gap-5">
      <div className="min-w-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-5">
          {!config.is_active && !config.system_prompt && knowledge.length === 0 && (
            <div className="rounded-[28px] border border-dashed border-violet-200 bg-white">
              <WorkspaceEmptyState
                title="Set up your AI assistant"
                description="Connect an OpenAI provider, add your instructions and knowledge, then activate replies when you are ready."
                primaryLabel="Open integrations"
                onPrimary={() => onNavigate?.('integrations')}
                secondaryLabel="Add knowledge"
                onSecondary={() => document.getElementById('ai-knowledge-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              />
            </div>
          )}
          {openAiConnected === false && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-950">Connect OpenAI to use AI Agent</p>
                  <p className="mt-0.5 text-xs font-medium text-amber-800">Add an API key and default model in Integrations before activating replies or running tests.</p>
                </div>
              </div>
              <Button onClick={() => onNavigate?.('integrations')} className="rounded-2xl bg-amber-700 px-4 font-semibold text-white hover:bg-amber-800">
                Open integrations
              </Button>
            </div>
          )}
          <div className="rounded-[28px] border border-white bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-purple-700 to-fuchsia-500 text-white shadow-lg shadow-purple-100">
                  <Bot size={26} />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-purple-700">
                    <span className={`h-2 w-2 rounded-full ${config.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                    {config.is_active ? 'Live Assistant' : 'Draft Mode'}
                  </div>
                  <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">AI Agent</h1>
                  <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
                    Configure knowledge, prompt behavior, and test responses without changing the existing AI backend flow.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={loadData}
                  className="rounded-2xl border-purple-100 bg-white font-semibold text-purple-700 hover:bg-purple-50"
                >
                  <RefreshCw size={16} className="mr-2" />
                  Refresh
                </Button>
                <Button
                  variant={config.is_active ? 'destructive' : 'default'}
                  onClick={handleToggleActive}
                  className={`rounded-2xl px-5 font-semibold ${config.is_active ? '' : 'bg-gradient-to-b from-[#9200cc] to-[#34075a] text-white hover:opacity-95'}`}
                >
                  <Power size={16} className="mr-2" />
                  {config.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
              { label: 'Knowledge Sources', value: knowledge.length, sub: `${websiteCount} websites · ${documentCount} docs`, icon: Globe },
              { label: 'Prompt Size', value: promptLength, sub: 'characters configured', icon: Settings },
              { label: 'Model', value: config.model_name || 'gpt-4-turbo', sub: 'response provider', icon: Bot },
              { label: 'Console', value: chatMessages.length, sub: 'test messages', icon: CheckCircle }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-3xl border border-white bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                      <Icon size={20} />
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase text-emerald-700">
                      Ready
                    </span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
                  <p className="mt-1 truncate text-2xl font-bold text-slate-950">{item.value}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{item.sub}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_0.9fr]">
            <Card className="overflow-hidden rounded-3xl border-white bg-white shadow-sm">
              <CardHeader className="border-b border-purple-100 bg-white px-6 py-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
                      <Settings size={18} />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-950">Agent Settings</CardTitle>
                      <p className="text-xs font-medium text-slate-500">Persona, model and fallback behavior.</p>
                    </div>
                  </div>
                  <Button onClick={handleSaveConfig} variant="outline" className="rounded-2xl border-purple-100 bg-purple-50 font-semibold text-purple-700 hover:bg-purple-100">
                    Save Configuration
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Model</span>
                    <Input
                      value={config.model_name || ''}
                      onChange={e => setConfig(prev => ({ ...prev, model_name: e.target.value }))}
                      className="h-11 rounded-2xl border-purple-100 bg-purple-50/30 font-semibold focus:border-purple-300"
                    />
                  </label>
                  <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4">
                    <div className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${config.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <p className="text-sm font-semibold text-slate-900">{config.is_active ? 'Auto replies enabled' : 'Auto replies paused'}</p>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">Toggle from the header when you want the agent to answer live conversations.</p>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">System Prompt</label>
                  <textarea
                    className="w-full min-h-[180px] rounded-3xl border border-purple-100 bg-purple-50/20 p-4 text-sm font-mono leading-relaxed text-slate-800 outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                    placeholder="Define the AI's persona and rules..."
                    value={config.system_prompt || ''}
                    onChange={e => setConfig(prev => ({ ...prev, system_prompt: e.target.value }))}
                  />
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Instructions for the AI on how to behave, what tone to use, and how to handle unknown answers.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card id="ai-knowledge-section" className="overflow-hidden rounded-3xl border-white bg-white shadow-sm">
                <CardHeader className="border-b border-purple-100 bg-white px-6 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg font-bold text-slate-950">Knowledge Base</CardTitle>
                      <p className="text-xs font-medium text-slate-500">Websites and documents used by the assistant.</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowAddUrl(!showAddUrl)} className="rounded-2xl border-purple-100 font-semibold text-purple-700 hover:bg-purple-50">
                        <Plus size={15} className="mr-2" /> Website
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowUpload(!showUpload)} className="rounded-2xl border-purple-100 font-semibold text-purple-700 hover:bg-purple-50">
                        <Upload size={15} className="mr-2" /> Upload
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  {showAddUrl && (
                    <div className="rounded-3xl border border-purple-100 bg-purple-50/50 p-4">
                      <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto_auto] md:items-end">
                        <label>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Title</span>
                          <Input
                            placeholder="Course Catalog"
                            value={urlForm.title}
                            onChange={e => setUrlForm(prev => ({ ...prev, title: e.target.value }))}
                            className="rounded-2xl bg-white"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">URL</span>
                          <Input
                            placeholder="https://example.com/courses"
                            value={urlForm.url}
                            onChange={e => setUrlForm(prev => ({ ...prev, url: e.target.value }))}
                            className="rounded-2xl bg-white"
                          />
                        </label>
                        <Button onClick={handleAddUrl} disabled={loadingKnow} className="rounded-2xl bg-purple-700 font-semibold">Add</Button>
                        <Button variant="ghost" onClick={() => setShowAddUrl(false)} className="rounded-2xl">Cancel</Button>
                      </div>
                    </div>
                  )}

                  {showUpload && (
                    <div className="rounded-3xl border border-purple-100 bg-purple-50/50 p-4">
                      <div className="grid gap-3 md:grid-cols-[1fr_1.5fr_auto_auto] md:items-end">
                        <label>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">Title</span>
                          <Input
                            placeholder="Document Name"
                            value={fileForm.title}
                            onChange={e => setFileForm(prev => ({ ...prev, title: e.target.value }))}
                            className="rounded-2xl bg-white"
                          />
                        </label>
                        <label>
                          <span className="mb-1 block text-xs font-semibold text-slate-500">File</span>
                          <input
                            type="file"
                            className="block w-full rounded-2xl border border-purple-100 bg-white px-3 py-2 text-sm text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-purple-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-purple-700"
                            onChange={e => setFileForm(prev => ({ ...prev, file: e.target.files[0] }))}
                            accept=".pdf,.txt,.md,.doc,.docx"
                          />
                        </label>
                        <Button onClick={handleUploadFile} disabled={loadingKnow} className="rounded-2xl bg-purple-700 font-semibold">Upload</Button>
                        <Button variant="ghost" onClick={() => setShowUpload(false)} className="rounded-2xl">Cancel</Button>
                      </div>
                    </div>
                  )}

                  <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                    {knowledge.map((item) => (
                      <div key={item.id} className="group rounded-3xl border border-purple-100 bg-white p-4 shadow-sm transition hover:border-purple-200 hover:shadow-md">
                        <div className="flex items-start gap-3">
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                            item.source_type === 'website' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                          }`}>
                            {item.source_type === 'website' ? <Globe size={19} /> : <FileText size={19} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-semibold text-slate-900">{item.title}</h3>
                            <p className="mt-1 truncate text-xs font-medium text-slate-500">{item.source_url || 'Uploaded content'}</p>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase text-emerald-700">
                                <CheckCircle size={10} /> Active
                              </span>
                              <span className="text-[10px] font-medium text-slate-400">
                                {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recently'}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteSource(item.id)}
                            className="rounded-2xl p-2 text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                            title="Remove source"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {knowledge.length === 0 && !loading && (
                      <div className="rounded-3xl border-2 border-dashed border-purple-100 bg-purple-50/40 py-12 text-center">
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-purple-300 shadow-sm">
                          <File size={24} />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900">No knowledge sources yet</h3>
                        <p className="mt-1 text-xs font-medium text-slate-500">Add websites or documents to train your AI.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-3xl border border-white bg-gradient-to-br from-slate-950 to-purple-950 p-5 text-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-purple-100">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Production Tip</p>
                    <p className="mt-1 text-xs font-medium text-purple-100/80">Keep the prompt crisp and add fresh knowledge sources for better WhatsApp auto-replies.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className="flex w-[430px] shrink-0 flex-col overflow-hidden rounded-[28px] border border-white bg-white shadow-sm">
        <div className="border-b border-purple-100 bg-gradient-to-br from-white via-purple-50/70 to-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100 text-purple-700">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-950">Test Console</h3>
                <p className="text-xs font-medium text-slate-500">Ask and verify live behavior.</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClearChat} className="h-9 rounded-2xl text-xs font-semibold text-purple-700 hover:bg-purple-50">
              <RefreshCw size={12} className="mr-1" /> Clear
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-purple-50/30 p-4">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[86%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'rounded-br-md bg-gradient-to-b from-[#9200cc] to-[#34075a] text-white'
                  : msg.role === 'system'
                    ? 'w-full rounded-2xl bg-white/80 text-center text-xs font-semibold italic text-slate-500'
                    : 'rounded-bl-md border border-purple-100 bg-white text-slate-800'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {isChatLoading && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-3xl rounded-bl-md border border-purple-100 bg-white px-4 py-3 shadow-sm">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400 delay-75" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-purple-400 delay-150" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-purple-100 bg-white p-4">
          <div className="flex gap-2 rounded-3xl border border-purple-100 bg-purple-50/40 p-2">
            <input
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTestSend()}
              disabled={isChatLoading}
            />
            <Button onClick={handleTestSend} disabled={isChatLoading || !chatInput.trim()} size="sm" className="rounded-2xl bg-purple-700 px-5 font-semibold text-white hover:bg-purple-800">
              Send
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}


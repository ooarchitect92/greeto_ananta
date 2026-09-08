import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { 
  getAiConfig, updateAiConfig, getAiKnowledge, 
  addAiTextKnowledge, deleteAiKnowledge, uploadAiDocument 
} from '../api.js';
import { confirmAction } from '@/components/ui/confirmAction';

export const useAiAgent = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState({ is_active: false, system_prompt: '', model_name: 'gpt-4-turbo' });
  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingKnow, setLoadingKnow] = useState(false);
  
  // Test Chat State
  const [chatMessages, setChatMessages] = useState([{ role: 'system', content: 'AI Agent Test Console' }]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Modals/Forms State
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
      const [confRes, knowRes] = await Promise.all([
        getAiConfig(),
        getAiKnowledge()
      ]);
      if (confRes) setConfig(confRes);
      if (Array.isArray(knowRes)) setKnowledge(knowRes);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', description: 'Failed to load AI settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    const newState = !config.is_active;
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
        content: '',
      });
      setUrlForm({ title: '', url: '' });
      setShowAddUrl(false);
      loadData();
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
      message: 'Remove this knowledge source?',
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

  return {
    config,
    setConfig,
    knowledge,
    loading,
    loadingKnow,
    chatMessages,
    chatInput,
    setChatInput,
    isChatLoading,
    showAddUrl,
    setShowAddUrl,
    showUpload,
    setShowUpload,
    urlForm,
    setUrlForm,
    fileForm,
    setFileForm,
    handleToggleActive,
    handleSaveConfig,
    handleAddUrl,
    handleUploadFile,
    handleDeleteSource,
    handleTestSend,
    handleClearChat
  };
};

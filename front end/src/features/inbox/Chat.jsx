'use strict';
import React, { useEffect, useState, useRef } from 'react';
import {
  sendText, sendMedia, sendTemplate, uploadMedia, getTemplates,
  starTemplate, unstarTemplate, retryTemplateMessage,
  sendInstagramText, sendInstagramMedia, sendMessengerText, sendMessengerMedia, testAiAgent, getConversationContact
} from './api.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { ProposalModal } from '../crm/ProposalModal.jsx';
import { TemplateListModal } from '../content/TemplateListModal.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { GallerySelectModal } from '../media/GallerySelectModal.jsx';
import GreetoLoader from '../../components/ui/GreetoLoader.jsx';
import { Send, Paperclip, Image as ImageIcon, File, Mic, FileText, BookOpen, BarChart, DollarSign, Loader2, MessageSquare, MapPin, User, Video, Star, MoreHorizontal, Phone, ExternalLink, RotateCcw, Sparkles } from 'lucide-react';

export default function Chat({ socket, conversationId, channelExternalId, channelType, messages, onRefresh, isLoading, loadError, onRetry }) {
  const [text, setText] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [mediaLink, setMediaLink] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaKind, setMediaKind] = useState('image');
  const [caption, setCaption] = useState('');
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isGeneratingReply, setIsGeneratingReply] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTypingSelf, setIsTypingSelf] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesReady, setTemplatesReady] = useState(false);
  const [contactInfo, setContactInfo] = useState({ name: '', number: '', course: '' });
  const [showTemplateSendModal, setShowTemplateSendModal] = useState(false);
  const [selectedTemplateForSend, setSelectedTemplateForSend] = useState(null);
  const [templateVariables, setTemplateVariables] = useState({});
  const [templateHeaderMedia, setTemplateHeaderMedia] = useState('');
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [showGallerySelect, setShowGallerySelect] = useState(false);
  const [galleryResourceType, setGalleryResourceType] = useState('auto');
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastScrolledConversationRef = useRef(null);

  const getSafeValue = (val) => {
    if (val == null) return '';
    if (typeof val === 'string' || typeof val === 'number') return val;
    if (typeof val === 'object') {
      if (typeof val.text === 'string') return val.text;
      if (typeof val.type === 'string') return val.type;
      return '';
    }
    return String(val);
  };

  const formatWhatsAppText = (text) => {
    if (!text) return null;

    // Helper to render a single line with markdown
    const renderFormattedLine = (line) => {
      let fragments = [{ type: 'text', content: line }];

      // Handle ```code```
      fragments = fragments.flatMap(f => {
        if (f.type !== 'text') return [f];
        const parts = f.content.split(/```([^`]+)```/g);
        return parts.map((part, idx) => ({
          type: idx % 2 === 1 ? 'code' : 'text',
          content: part
        }));
      });

      // Handle *bold*
      fragments = fragments.flatMap(f => {
        if (f.type !== 'text') return [f];
        const parts = f.content.split(/\*([^*\n]+)\*/g);
        return parts.map((part, idx) => ({
          type: idx % 2 === 1 ? 'bold' : 'text',
          content: part
        }));
      });

      // Handle _italic_
      fragments = fragments.flatMap(f => {
        if (f.type !== 'text') return [f];
        const parts = f.content.split(/_([^_]+)_/g);
        return parts.map((part, idx) => ({
          type: idx % 2 === 1 ? 'italic' : 'text',
          content: part
        }));
      });

      // Handle ~strike~
      fragments = fragments.flatMap(f => {
        if (f.type !== 'text') return [f];
        const parts = f.content.split(/~([^~]+)~/g);
        return parts.map((part, idx) => ({
          type: idx % 2 === 1 ? 'strike' : 'text',
          content: part
        }));
      });

      // Handle links
      fragments = fragments.flatMap(f => {
        if (f.type !== 'text') return [f];
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = f.content.split(urlRegex);
        return parts.map((part, idx) => ({
          type: idx % 2 === 1 ? 'link' : 'text',
          content: part
        }));
      });

      return fragments.map((f, i) => {
        if (f.type === 'bold') return <strong key={i} className="font-bold">{f.content}</strong>;
        if (f.type === 'italic') return <em key={i} className="italic text-slate-800">{f.content}</em>;
        if (f.type === 'strike') return <del key={i} className="line-through opacity-70">{f.content}</del>;
        if (f.type === 'code') return <code key={i} className="bg-black/10 px-1 rounded font-mono text-xs">{f.content}</code>;
        if (f.type === 'link') return <a key={i} href={f.content} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{f.content}</a>;
        return f.content;
      });
    };

    const lines = String(text).split('\n');
    return lines.map((line, i) => (
      <React.Fragment key={i}>
        {renderFormattedLine(line)}
        {i < lines.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const scrollToBottom = (behavior = 'smooth') => {
    if (containerRef.current) {
      if (behavior === 'instant') {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      } else {
        containerRef.current.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
      }
    }
  };

  const scrollToLatestAfterRender = (behavior = 'instant') => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollToBottom(behavior));
    });
  };

  const headerFileInputRef = useRef(null);

  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const res = await getTemplates();
        if (res && res.data) {
          const mapped = res.data.map(t => {
            const bodyComp = t.components && t.components.find(c => c.type === 'BODY');
            const headerComp = t.components && t.components.find(c => c.type === 'HEADER');
            const footerComp = t.components && t.components.find(c => c.type === 'FOOTER');
            const buttonsComp = t.components && t.components.find(c => c.type === 'BUTTONS');

            let examples = {};
            if (bodyComp && bodyComp.example) {
              if (t.parameter_format === 'NAMED' && bodyComp.example.body_text_named_params) {
                bodyComp.example.body_text_named_params.forEach(p => {
                  examples[p.param_name] = p.example;
                });
              } else if (bodyComp.example.body_text && Array.isArray(bodyComp.example.body_text[0])) {
                bodyComp.example.body_text[0].forEach((ex, i) => {
                  examples[(i + 1).toString()] = ex;
                });
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
              status: t.status,
              category: t.category,
              headerType: headerComp ? headerComp.format : 'NONE',
              headerText: headerComp && headerComp.format === 'TEXT' ? headerComp.text : '',
              headerHandle,
              bodyText: bodyComp ? bodyComp.text : '',
              footerText: footerComp ? footerComp.text : '',
              buttons: buttonsComp ? buttonsComp.buttons : [],
              parameterFormat: t.parameter_format || 'POSITIONAL',
              examples,
              is_starred: t.is_starred,
              components: t.components || []
            };
          });
          setTemplates(mapped);
        } else {
          setTemplates([]);
        }
      } catch (err) {
        console.error('Failed to load templates in Chat:', err);
        setTemplates([]);
      } finally {
        setTemplatesReady(true);
      }
    };
    loadTemplates();
  }, []);

  useEffect(() => {
    if (!conversationId) {
      setContactInfo({ name: '', number: '', course: '' });
      return;
    }
    const fetchContact = async () => {
      try {
        const data = await getConversationContact(conversationId);
        if (data?.error) return;
        setContactInfo({
          name: data.name || '',
          number: data.number || '',
          course: data.course || ''
        });
      } catch (e) {
      }
    };
    fetchContact();
  }, [conversationId]);

    const renderTemplateMessage = (m) => {
      const templateName = m.rawPayload?.name || m.templateName || m.template_name || '';
      // Try to find template definition (case insensitive and trimmed)
      const templateDef = templates.find(t => 
        String(t.name).trim().toLowerCase() === String(templateName).trim().toLowerCase()
      );
  
      // Helper to substitute parameters into text in order
      const substituteParams = (text, params) => {
        if (!text) return '';
        if (!params || params.length === 0) return text;
        let res = text;
        
        // Find all {{...}} patterns and replace them one by one with the provided params
        const regex = /\{\{[^}]+\}\}/g;
        let matchCount = 0;
        res = res.replace(regex, (match) => {
          const val = getSafeValue(params[matchCount]);
          matchCount++;
          return val !== undefined ? val : match;
        });
        return res;
      };
  
      if (!templateDef) {
        return (
          <div className="flex flex-col">
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {formatWhatsAppText(m.textBody || 'Template message (definition unavailable)')}
            </div>
            <div className="text-[10px] text-slate-500 mt-2 opacity-70">
              <span className="font-medium bg-slate-100 px-1 py-0.5 rounded text-[9px] uppercase tracking-wider mr-1">TEMPLATE</span>
              {templateName || 'Unknown'}
            </div>
          </div>
        );
      }
  
      const headerComp = templateDef.components.find(c => c.type?.toUpperCase() === 'HEADER');
      const bodyComp = templateDef.components.find(c => c.type?.toUpperCase() === 'BODY');
      const footerComp = templateDef.components.find(c => c.type?.toUpperCase() === 'FOOTER');
      const buttonsComp = templateDef.components.find(c => c.type?.toUpperCase() === 'BUTTONS');
  
      const msgBodyParams = m.rawPayload.components?.find(c => c.type?.toLowerCase() === 'body')?.parameters || [];
      const msgHeaderParams = m.rawPayload.components?.find(c => c.type?.toLowerCase() === 'header')?.parameters || [];
  
      let headerContent = null;
      if (headerComp) {
        if (headerComp.format === 'TEXT') {
          const text = substituteParams(headerComp.text, msgHeaderParams);
          headerContent = <div className="font-bold text-sm mb-1">{formatWhatsAppText(text)}</div>;
        } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
          const mediaParam = msgHeaderParams[0];
          if (mediaParam && mediaParam.image) {
            const src = mediaParam.image.link || '';
            headerContent = (
              <div className="-mx-4 -mt-3 mb-3 border-b border-slate-100/50 overflow-hidden bg-slate-100">
                <img src={src} alt="Header" className="w-full h-auto object-cover max-h-[220px]" />
              </div>
            );
          } else {
            headerContent = (
              <div className="mb-2 flex items-center gap-2 text-xs text-slate-500 bg-slate-100 p-2 rounded">
                <ImageIcon size={14} /> <span>{headerComp.format} Header</span>
              </div>
            );
          }
        }
      }
  
      let bodyContent = null;
      if (bodyComp) {
        const text = substituteParams(bodyComp.text, msgBodyParams);
        bodyContent = <div className="text-sm leading-relaxed">{formatWhatsAppText(text)}</div>;
      }
  
      let footerContent = null;
      if (footerComp) {
        footerContent = <div className="text-[10px] text-slate-400 mt-2 opacity-80">{footerComp.text}</div>;
      }
  
      let buttonsContent = null;
      if (buttonsComp && buttonsComp.buttons) {
        buttonsContent = (
          <div className="grid grid-cols-1 divide-y divide-slate-100 border-t border-slate-100/80 -mx-4 -mb-3 mt-3 overflow-hidden rounded-b-2xl">
            {buttonsComp.buttons.map((btn, idx) => {
              const commonClasses = "flex w-full items-center justify-center gap-2 bg-white/50 px-4 py-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50";
              if (btn.type === 'QUICK_REPLY') {
                return (
                  <div key={idx} className={commonClasses}>
                    <MessageSquare size={14} className="opacity-50" />
                    {btn.text}
                  </div>
                );
              }
              if (btn.type === 'URL') {
                return (
                  <a key={idx} href={btn.url} target="_blank" rel="noreferrer" className={commonClasses}>
                    <ExternalLink size={14} className="opacity-50" />
                    {btn.text}
                  </a>
                );
              }
              if (btn.type === 'PHONE_NUMBER') {
                return (
                  <a key={idx} href={`tel:${btn.phone_number}`} className={commonClasses}>
                    <Phone size={14} className="opacity-50" />
                    {btn.text}
                  </a>
                );
              }
              return null;
            })}
          </div>
        );
      }
  
      return (
        <div className="flex flex-col">
          {headerContent}
          {bodyContent}
          {footerContent}
          {buttonsContent}
        </div>
      );
    };

  useEffect(() => {
    if (!conversationId || isLoading) return;
    const isNewConversation = lastScrolledConversationRef.current !== conversationId;
    lastScrolledConversationRef.current = conversationId;
    scrollToLatestAfterRender(isNewConversation ? 'instant' : 'smooth');
  }, [conversationId, isLoading, messages.length]);

  useEffect(() => {
    setSendError('');
    setIsInitiating(false);
    lastScrolledConversationRef.current = null;
  }, [conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit('join:conversation', conversationId);

    const onStatus = (evt) => {
      if (evt.conversationId === conversationId) onRefresh();
    };
    const onTyping = ({ conversationId: cId, userId, isTyping }) => {
      console.log('[Chat] onTyping event:', { cId, userId, isTyping });
      if (cId !== conversationId) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        if (isTyping) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    // socket.on('message:new', onNew); // Handled by App.jsx optimistically
    socket.on('message:status', onStatus);
    socket.on('conversation:typing', onTyping);
    return () => {
      // socket.off('message:new', onNew);
      socket.off('message:status', onStatus);
      socket.off('conversation:typing', onTyping);
    };
  }, [socket, conversationId, onRefresh]);

  const handleInputChange = (e) => {
    setText(e.target.value);

    if (socket && conversationId) {
      socket.emit('conversation:typing', { conversationId, isTyping: true });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('conversation:typing', { conversationId, isTyping: false });
      }, 3000);
    }
  };

  const handleSendText = async () => {
    if (!text.trim()) return;
    setIsSending(true);
    setSendError('');
    try {
      let resp;
      if (channelType === 'instagram') {
        resp = await sendInstagramText(conversationId, text.trim());
      } else if (channelType === 'messenger') {
        resp = await sendMessengerText(conversationId, text.trim());
      } else {
        resp = await sendText(conversationId, text.trim());
      }
      
      if (resp && resp.error) {
        throw new Error(resp.message || 'Failed to send message');
      }
      setText('');
    } catch (err) {
      setSendError(err?.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMedia = async () => {
    if (!mediaLink.trim() && !selectedFile) return;
    setIsSending(true);
    setSendError('');
    try {
      let linkToSend = mediaLink.trim();

      if (selectedFile) {
        // 1. Upload file to backend -> WhatsApp
        const uploadResp = await uploadMedia(conversationId, selectedFile);
        if (uploadResp && uploadResp.error) {
          throw new Error(uploadResp.message || 'Failed to upload media');
        }
        if (!uploadResp.id) {
          throw new Error('Upload successful but no media ID returned');
        }
        linkToSend = uploadResp.id;
      }

      const resp = channelType === 'instagram'
        ? await sendInstagramMedia(conversationId, mediaKind, linkToSend, caption || null)
        : channelType === 'messenger'
          ? await sendMessengerMedia(conversationId, mediaKind, linkToSend, caption || null)
          : await sendMedia(conversationId, mediaKind, linkToSend, caption || null);
      if (resp && resp.error) {
        throw new Error(resp.message || 'Failed to send media');
      }
      setMediaLink('');
      setSelectedFile(null);
      setCaption('');
      setShowMediaInput(false);
      await onRefresh();
    } catch (err) {
      setSendError(err?.message || 'Failed to send media');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendProposal = async (data) => {
    // Construct WhatsApp Template components
    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: data.courseName },
          { type: 'text', text: data.packageName },
          { type: 'text', text: `₹${data.finalPrice.toLocaleString()}` }
        ]
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          { type: 'text', text: `${data.finalPrice}` } // Dynamic part of URL
        ]
      }
    ];

    // For the prototype, we assume a template named 'proposal_invoice' exists
    setIsSending(true);
    setSendError('');
    try {
      const proposalTmpl = templates.find((t) => t.name === 'proposal_invoice');
      const lang = proposalTmpl?.language || 'en_US';
      const resp = await sendTemplate(conversationId, 'proposal_invoice', lang, components);
      if (resp && resp.error) {
        throw new Error(resp.message || 'Failed to send template');
      }
      setShowProposalModal(false);
      await onRefresh();
    } catch (err) {
      setSendError(err?.message || 'Failed to send template');
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleStar = async (template) => {
    // Optimistic update
    const isStarred = template.is_starred;
    setTemplates(prev => prev.map(t =>
      t.name === template.name ? { ...t, is_starred: !isStarred } : t
    ));

    try {
      if (isStarred) {
        await unstarTemplate(template.name);
      } else {
        await starTemplate(template.name);
      }
    } catch (err) {
      console.error('Failed to toggle star:', err);
      // Revert on error
      setTemplates(prev => prev.map(t =>
        t.name === template.name ? { ...t, is_starred: isStarred } : t
      ));
    }
  };

  const handleSendStarredTemplate = (template) => {
    if (!template) return;
    setSelectedTemplateForSend(template);
    const vars = {};
    if (template.headerText) {
      const regex = /{{([a-zA-Z0-9_]+)}}/g;
      const matches = [...template.headerText.matchAll(regex)];
      matches.forEach((m) => {
        const key = m[1];
        if (Object.prototype.hasOwnProperty.call(vars, key)) return;
        const lower = key.toLowerCase();
        let val = '';
        if (lower === 'name' && contactInfo.name) {
          val = contactInfo.name;
        } else if ((lower === 'phone' || lower === 'number' || lower === 'mobile') && contactInfo.number) {
          val = contactInfo.number;
        } else if (lower.includes('course') && contactInfo.course) {
          val = contactInfo.course;
        } else if (template.examples && Object.prototype.hasOwnProperty.call(template.examples, key)) {
          val = template.examples[key];
        }
        vars[key] = val;
      });
    }
    if (template.bodyText) {
      const regex = /{{([a-zA-Z0-9_]+)}}/g;
      const matches = [...template.bodyText.matchAll(regex)];
      matches.forEach((m) => {
        const key = m[1];
        if (Object.prototype.hasOwnProperty.call(vars, key)) return;
        const lower = key.toLowerCase();
        let val = '';
        if (lower === 'name' && contactInfo.name) {
          val = contactInfo.name;
        } else if ((lower === 'phone' || lower === 'number' || lower === 'mobile') && contactInfo.number) {
          val = contactInfo.number;
        } else if (lower.includes('course') && contactInfo.course) {
          val = contactInfo.course;
        } else if (template.examples && Object.prototype.hasOwnProperty.call(template.examples, key)) {
          val = template.examples[key];
        }
        vars[key] = val;
      });
    }
    setTemplateVariables(vars);
    setTemplateHeaderMedia('');
    setShowTemplateSendModal(true);
  };

  const handleRetryMessage = async (messageId) => {
    if (retryingMessageId) return;
    setRetryingMessageId(messageId);
    try {
      const resp = await retryTemplateMessage(messageId);
      if (resp && resp.error) {
        throw new Error(resp.message || 'Failed to retry message');
      }
      await onRefresh();
    } catch (err) {
      setSendError(err?.message || 'Failed to retry message');
    } finally {
      setRetryingMessageId(null);
    }
  };

  const handleSendTemplateFromChat = async () => {
    if (!selectedTemplateForSend) return;
    setIsSending(true);
    setSendError('');
    try {
      const tmpl =
        templates.find(
          (t) => t.name === selectedTemplateForSend.name && t.language === selectedTemplateForSend.language
        ) || selectedTemplateForSend;
      const lang = tmpl.language || 'en_US';
      const components = [];

      if (tmpl && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(tmpl.headerType)) {
        const mediaVal = (templateHeaderMedia || '').trim();
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
            text: templateVariables[m[1]] || `[${m[1]}]`
          }));
          components.push({
            type: 'header',
            parameters: headerParams
          });
        }
      }

      if (tmpl && tmpl.bodyText) {
        const regex = /{{([a-zA-Z0-9_]+)}}/g;
        const matches = [...tmpl.bodyText.matchAll(regex)];
        if (matches.length > 0) {
          const bodyParams = matches.map((m) => {
            const key = m[1];
            const param = {
              type: 'text',
              text: templateVariables[key] || `[${key}]`
            };
            return param;
          });
          components.push({
            type: 'body',
            parameters: bodyParams
          });
        }
      }

      if (tmpl && tmpl.buttons) {
        tmpl.buttons.forEach((btn, idx) => {
          if (btn.type === 'COPY_CODE') {
            let codeValue = 'TESTCODE';
            const codeVarName = Object.keys(templateVariables).find((k) => {
              const lk = k.toLowerCase();
              return lk.includes('code') || lk.includes('coupon') || lk === 'promocode';
            });
            if (codeVarName && templateVariables[codeVarName]) {
              codeValue = templateVariables[codeVarName];
            } else if (tmpl.examples) {
              const exampleKey = Object.keys(tmpl.examples).find((k) => {
                const lk = k.toLowerCase();
                return lk.includes('code') || lk.includes('coupon');
              });
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
                text: templateVariables[m[1]] || 'track'
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

      const resp = await sendTemplate(conversationId, tmpl.name, lang, components);
      if (resp && resp.error) {
        throw new Error(resp.message || 'Failed to send template');
      }
      setShowTemplateSendModal(false);
      setSelectedTemplateForSend(null);
      setTemplateVariables({});
      setTemplateHeaderMedia('');
      await onRefresh();
    } catch (err) {
      setSendError(err?.message || 'Failed to send template');
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickAction = async (action) => {
    if (action === 'proposal') {
      setShowProposalModal(true);
      return;
    }
  };

  const handleAiAssist = async () => {
    if (isGeneratingReply) return;
    const lastInbound = [...messages].reverse().find((m) => m.direction !== 'outbound' && m.textBody);
    if (!lastInbound) {
      setSendError('No customer message to reply to yet.');
      return;
    }
    setIsGeneratingReply(true);
    setSendError('');
    try {
      const res = await testAiAgent(lastInbound.textBody);
      if (res && res.response) {
        setText(res.response);
      } else {
        setSendError(res?.error || 'AI Agent could not generate a reply. Check your AI Agent settings.');
      }
    } catch (err) {
      setSendError('Failed to generate an AI reply. Please try again.');
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  const currentTemplate =
    selectedTemplateForSend &&
    (templates.find(
      (t) => t.name === selectedTemplateForSend.name && t.language === selectedTemplateForSend.language
    ) ||
      selectedTemplateForSend);

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 text-slate-500">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-white border border-purple-100 shadow-sm flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-purple-500" />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-1">Select Conversation</h3>
          <p className="text-sm text-slate-500">Select any conversation to view all the messages.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 text-slate-500">
        <GreetoLoader label="Loading conversation..." sublabel="Fetching message history" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 text-slate-500">
        <div className="text-center max-w-sm">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-white border border-red-100 shadow-sm flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-1">Couldn't load this conversation</h3>
          <p className="text-sm text-slate-500 mb-6">{loadError}</p>
          {onRetry && (
            <Button onClick={onRetry} className="rounded-2xl bg-purple-700 hover:bg-purple-800">
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  const visibleMessages = messages;

  // A conversation can have message history that is intentionally hidden because
  // its old Meta templates are no longer available. Keep the normal reply area
  // open in that case; only show the start screen for a truly new conversation.
  if (messages.length === 0 && !isInitiating) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 text-slate-500">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 rounded-3xl bg-white border border-purple-100 shadow-sm flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 text-purple-500" />
          </div>
          <h3 className="text-lg font-black text-slate-800 mb-1">Start a Conversation</h3>
          <p className="text-sm text-slate-500 mb-6">There are no messages here yet.</p>
          <Button onClick={() => setIsInitiating(true)} className="rounded-2xl bg-purple-700 hover:bg-purple-800">
            Initiate new conversation
          </Button>
        </div>
      </div>
    );
  }

  return (
      <div className="flex h-full flex-col bg-white">
      <div
        ref={containerRef}
        className="flex-1 space-y-3 overflow-y-auto bg-[#efeae2] px-5 py-4"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(93, 115, 98, 0.13) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        {visibleMessages.map((m, index) => {
          const isOutbound = m.direction === 'outbound';
          const failureReason = m.errorReason || m.errorDetails?.title || m.errorDetails?.message ||
            m.rawPayload?.meta_status?.errors?.[0]?.title || m.rawPayload?.meta_status?.errors?.[0]?.message || '';
          const messageDate = new Date(m.createdAt);
          const dateStr = messageDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

          let showDateHeader = false;
          if (index === 0) {
            showDateHeader = true;
          } else {
            const prevDate = new Date(visibleMessages[index - 1].createdAt);
            const prevDateStr = prevDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            if (dateStr !== prevDateStr) {
              showDateHeader = true;
            }
          }

          return (
            <React.Fragment key={m.id}>
              {showDateHeader && (
                <div className="flex justify-center my-4 sticky top-0 z-10">
                  <span className="rounded-full border border-[#d7e4d0] bg-[#f7f7ef]/95 px-3 py-1.5 text-[11px] font-medium text-[#54656f] shadow-sm">
                    {dateStr}
                  </span>
                </div>
              )}
              <div className={cn("flex w-full", isOutbound ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[min(72%,46rem)] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
                  isOutbound
                    ? (channelType === 'instagram' ? "rounded-br-md bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white" : "rounded-br-md border border-emerald-100 bg-[#dcf8c6] text-slate-900")
                    : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
                )}>
                  {/* Channel Identifier for Inbound */}
                  {!isOutbound && (channelExternalId || channelType) && (
                    <div className="text-[9px] text-slate-400 mb-1 flex items-center gap-1">
                      <span className="opacity-70">To:</span> <span className="font-bold uppercase text-emerald-700">{channelType || 'WhatsApp'}</span>
                      {channelExternalId && <span className="text-slate-200">• {channelExternalId}</span>}
                    </div>
                  )}
                  {/* Reply Context - Hide for Interactive/Button replies to match WhatsApp UI */}
                  {m.rawPayload?.context && m.rawPayload?.type !== 'interactive' && m.rawPayload?.type !== 'button' && (
                    <div className="mb-2 text-xs bg-black/5 p-1.5 rounded border-l-2 border-slate-400 opacity-80">
                      <div className="font-semibold text-[10px] text-slate-600 flex items-center gap-1">
                        <MessageSquare size={10} />
                        Replying to a message
                      </div>
                    </div>
                  )}
                  {m.contentType === 'template' || m.rawPayload?.type === 'template' ? (
                    renderTemplateMessage(m)
                  ) : m.contentType === 'text' ? (
                    <>
                      <div className="leading-relaxed">
                          {(() => {
                            const base =
                              m.textBody ||
                              (m.rawPayload?.type === 'interactive' && m.rawPayload.interactive?.button_reply?.title) ||
                              (m.rawPayload?.type === 'interactive' && m.rawPayload.interactive?.list_reply?.title) ||
                              (m.rawPayload?.type === 'button' && m.rawPayload.button?.text) ||
                              '';
                            const translated =
                              !isOutbound && m.translation && m.translation.englishText
                                ? m.translation.englishText
                                : base;
                            return formatWhatsAppText(getSafeValue(translated || base));
                          })()}
                        </div>
                        {!isOutbound && m.translation && m.translation.originalText && m.translation.languageCode && m.translation.languageCode !== 'en' && (
                          <div className="mt-1 text-[10px] text-slate-500 opacity-80">
                            {`Original (${m.translation.languageCode}): `}{getSafeValue(m.translation.originalText)}
                          </div>
                        )}
                    </>
                  ) : (
                    <div className="space-y-2">
                      {m.attachments.map((a) => {
                        const isUrl = a.url && (a.url.startsWith('http') || a.url.startsWith('/'));
                        const src = isUrl ? a.url : `/api/media/${a.url}`;
                        const isImage = m.contentType === 'image' || a.kind === 'image' || m.contentType === 'sticker' || a.kind === 'sticker';
                        const isVideo = m.contentType === 'video' || a.kind === 'video';

                        return (
                          <div key={a.id} className="rounded bg-black/5 p-2">
                            {isImage ? (
                              <div className="relative">
                                <img
                                  src={src}
                                  alt="Attachment"
                                  className="rounded-md max-w-[250px] h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                  onClick={() => window.open(src, '_blank')}
                                  onLoad={() => scrollToBottom('instant')}
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                  }}
                                />
                                {m.contentType !== 'sticker' && a.kind !== 'sticker' && (
                                  <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                                    <ImageIcon size={12} /> Image
                                  </div>
                                )}
                              </div>
                            ) : isVideo ? (
                              <div className="relative">
                                <video
                                  src={src}
                                  controls
                                  className="rounded-md max-w-[250px] h-auto"
                                  onLoadedData={scrollToBottom}
                                />
                                <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                                  <Video size={12} /> Video
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <File size={16} />
                                <a href={src} target="_blank" rel="noreferrer" className="underline text-xs truncate max-w-[150px]">
                                  View {a.kind || 'Attachment'}
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Location */}
                      {m.contentType === 'location' && m.rawPayload?.location && (
                        <div className="rounded bg-black/5 p-2 min-w-[200px]">
                          <div className="flex items-start gap-2">
                            <MapPin size={20} className="text-red-500 mt-0.5" />
                            <div>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${m.rawPayload.location.latitude},${m.rawPayload.location.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-medium text-blue-600 hover:underline block"
                              >
                                {m.rawPayload.location.name || 'Shared Location'}
                              </a>
                              <div className="text-xs text-slate-500 mt-0.5">{m.rawPayload.location.address}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Contact */}
                      {m.contentType === 'contact' && m.rawPayload?.contacts && (
                        <div className="space-y-2">
                          {m.rawPayload.contacts.map((c, idx) => (
                            <div key={idx} className="rounded bg-black/5 p-2 min-w-[200px] flex items-center gap-3">
                              <div className="bg-slate-200 p-2 rounded-full">
                                <User size={20} className="text-slate-500" />
                              </div>
                              <div>
                                <div className="text-sm font-medium">{c.name?.formatted_name}</div>
                                {c.phones && c.phones[0] && (
                                  <div className="text-xs text-slate-500">{c.phones[0].phone}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {m.textBody && (
                        <div className="text-xs opacity-90 pt-1">
                          {formatWhatsAppText(getSafeValue(m.textBody))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-[10px] mt-1 text-right opacity-70 text-slate-500 flex items-center justify-end gap-1">
                    <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {isOutbound && m.deliveryStatus && (
                      <>
                        <span className="opacity-50">•</span>
                        <span
                          className={cn(
                            "font-medium",
                            m.deliveryStatus === 'failed' ? 'text-red-600' :
                            m.deliveryStatus === 'read' ? 'text-blue-600' :
                            m.deliveryStatus === 'delivered' ? 'text-green-600' :
                            m.deliveryStatus === 'sending' ? 'text-slate-500' :
                            'text-slate-600'
                          )}
                          title={failureReason}
                        >
                          {m.deliveryStatus}
                        </span>
                        {m.deliveryStatus === 'failed' && m.contentType === 'template' && (
                          <button
                            onClick={() => handleRetryMessage(m.id)}
                            disabled={retryingMessageId === m.id}
                            title="Retry sending this template"
                            className="flex items-center gap-0.5 text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                          >
                            <RotateCcw size={10} className={retryingMessageId === m.id ? 'animate-spin' : ''} />
                            Retry
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {isOutbound && m.deliveryStatus === 'failed' && failureReason && (
                    <p className="mt-1 max-w-[260px] text-[10px] leading-4 text-red-700" title={failureReason}>
                      {failureReason}
                    </p>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {typingUsers.size > 0 && (
          <div className="flex w-full justify-start mb-2">
            <div className="bg-white text-slate-500 border border-slate-200 rounded-tl-md rounded-2xl px-4 py-2 text-xs italic shadow-sm flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
              </span>
              Someone is typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-emerald-100 bg-[#f0f2f5] px-4 py-3 shadow-[0_-6px_16px_rgba(15,23,42,0.04)]">
        {sendError ? (
          <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {sendError}
          </div>
        ) : null}
        <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200 flex-nowrap">

          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0 whitespace-nowrap rounded-lg border-violet-200 bg-violet-50 text-xs text-violet-700 hover:bg-violet-100"
            onClick={handleAiAssist}
            disabled={isSending || isGeneratingReply}
            title="Generate a suggested reply with AI Agent"
          >
            {isGeneratingReply ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI Assist
          </Button>

          <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

          {templates.filter(t => t.is_starred).map(t => (
            <Button
              key={t.name}
              variant="outline"
              size="sm"
              className="h-8 shrink-0 whitespace-nowrap rounded-lg border-amber-200 bg-amber-50 text-xs text-slate-700 hover:bg-amber-100"
              onClick={() => handleSendStarredTemplate(t)}
              disabled={isSending}
            >
              <Star size={14} className="fill-yellow-400 text-yellow-400" />
              {t.name.replace(/_/g, ' ')}
            </Button>
          ))}

          <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />

          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-violet-50 shrink-0 rounded-xl" onClick={() => setShowTemplateModal(true)} title="Manage Templates">
            <MoreHorizontal size={16} className="text-slate-500" />
          </Button>
        </div>

        {showMediaInput && (
          <div className="mb-3 rounded-xl border border-emerald-100 bg-white p-3 shadow-sm space-y-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mediaKind === 'image' ? 'default' : 'outline'}
                className={mediaKind === 'image' ? 'h-8 rounded-lg bg-emerald-600 px-3 text-xs hover:bg-emerald-700' : 'h-8 rounded-lg px-3 text-xs'}
                onClick={() => setMediaKind('image')}
              >
                <ImageIcon size={14} className="mr-1.5" /> Image
              </Button>
              <Button
                size="sm"
                variant={mediaKind === 'document' ? 'default' : 'outline'}
                className={mediaKind === 'document' ? 'h-8 rounded-lg bg-emerald-600 px-3 text-xs hover:bg-emerald-700' : 'h-8 rounded-lg px-3 text-xs'}
                onClick={() => setMediaKind('document')}
              >
                <File size={14} className="mr-1.5" /> Document
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-lg px-3 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {selectedFile ? 'Change File' : 'Choose File'}
                </Button>
                <span className="text-xs text-slate-500 truncate max-w-[200px]">
                  {selectedFile ? selectedFile.name : 'No file selected'}
                </span>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setSelectedFile(e.target.files[0]);
                      setMediaLink('');
                    }
                  }}
                  accept={mediaKind === 'image' ? "image/*" : "*/*"}
                />
              </div>
              <div className="text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">or paste a link</div>
              <Input
                placeholder="Media URL (e.g., https://example.com/image.png)"
                value={mediaLink}
                onChange={(e) => {
                  setMediaLink(e.target.value);
                  if (e.target.value) setSelectedFile(null);
                }}
                disabled={!!selectedFile}
              />
            </div>

            <Input
              placeholder="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={() => {
                setShowMediaInput(false);
                setSelectedFile(null);
                setMediaLink('');
              }}>Cancel</Button>
              <Button size="sm" className="h-8 rounded-lg bg-emerald-600 px-3 text-xs hover:bg-emerald-700" onClick={handleSendMedia} disabled={!mediaLink && !selectedFile}>Send media</Button>
            </div>
          </div>
        )}

        <div id="tour-chat-input-area" className="flex items-end gap-2">
          <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900" onClick={() => setShowMediaInput(!showMediaInput)} title="Attach media" aria-label="Attach media">
            <Paperclip size={20} />
          </Button>
          <div className="flex-1 relative">
            <Input
              className="min-h-[44px] max-h-32 h-auto py-3 pr-10"
              style={{ color: '#111827', background: '#ffffff', caretColor: '#111827' }}
              placeholder="Type a message..."
              value={text}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
            />
          </div>
          <Button
            id="tour-chat-send-btn"
            className={cn(
              "h-11 w-11 rounded-lg text-white shadow-sm disabled:!text-white",
              channelType === 'instagram' ? "bg-pink-600 hover:bg-pink-700" : "bg-[#00a884] hover:bg-[#008f6f]"
            )}
            onClick={handleSendText}
            disabled={!text.trim() || isSending}
            title="Send message"
            aria-label="Send message"
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
      <ProposalModal
        isOpen={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        onSend={handleSendProposal}
      />
      <Modal
        isOpen={showTemplateSendModal}
        onClose={() => setShowTemplateSendModal(false)}
        title="Send Template"
      >
        {currentTemplate && (
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm font-medium text-slate-900">{currentTemplate.name}</div>
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>{currentTemplate.language}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>{currentTemplate.status}</span>
              </div>
            </div>

            {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(currentTemplate.headerType) && (() => {
              const label =
                currentTemplate.headerType === 'IMAGE'
                  ? 'Image header (URL or media ID)'
                  : currentTemplate.headerType === 'VIDEO'
                    ? 'Video header (URL or media ID)'
                    : 'Document header (URL or media ID)';
              const effectiveMedia = (templateHeaderMedia || '').trim();
              const isUrl = /^https?:\/\//i.test(effectiveMedia);
              const accept =
                currentTemplate.headerType === 'IMAGE'
                  ? 'image/*'
                  : currentTemplate.headerType === 'VIDEO'
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
                      onClick={() => headerFileInputRef.current?.click()}
                      disabled={isUploadingHeader}
                    >
                      {isUploadingHeader ? 'Uploading...' : 'Upload file'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setGalleryResourceType(currentTemplate.headerType === 'DOCUMENT' ? 'raw' : currentTemplate.headerType.toLowerCase());
                        setShowGallerySelect(true);
                      }}
                      disabled={isUploadingHeader}
                    >
                      Gallery
                    </Button>
                    <Input
                      placeholder="Paste URL or media ID, or use Upload."
                      value={templateHeaderMedia}
                      onChange={(e) => setTemplateHeaderMedia(e.target.value)}
                      disabled={isUploadingHeader}
                    />
                  </div>
                  <input
                    type="file"
                    ref={headerFileInputRef}
                    className="hidden"
                    accept={accept}
                    onChange={async (e) => {
                      const file = e.target.files && e.target.files[0];
                      if (!file) return;
                      setIsUploadingHeader(true);
                      try {
                        const uploadResp = await uploadMedia(conversationId, file);
                        if (uploadResp && uploadResp.error) {
                          throw new Error(uploadResp.message || 'Failed to upload header media');
                        }
                        if (!uploadResp.id) {
                          throw new Error('Upload successful but no media ID returned');
                        }
                        setTemplateHeaderMedia(uploadResp.id);
                      } catch (err) {
                        alert(err?.message || 'Failed to upload header media');
                      } finally {
                        setIsUploadingHeader(false);
                        e.target.value = '';
                      }
                    }}
                  />
                  {effectiveMedia && (
                    <div className="mt-1">
                      {isUrl ? (
                        currentTemplate.headerType === 'IMAGE' ? (
                          <img
                            src={effectiveMedia}
                            alt="Header preview"
                            className="max-h-32 max-w-full rounded border border-slate-200"
                          />
                        ) : currentTemplate.headerType === 'VIDEO' ? (
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

            {Object.keys(templateVariables).length > 0 && (
              <div className="space-y-2 border-t pt-2 mt-2">
                <label className="text-sm font-medium text-slate-700">Template Variables</label>
                <div className="grid grid-cols-1 gap-2">
                  {Object.keys(templateVariables).map((key) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-xs text-slate-500 font-mono">{'{{' + key + '}}'}</label>
                      <Input
                        placeholder={`Value for ${key}`}
                        value={templateVariables[key]}
                        onChange={(e) =>
                          setTemplateVariables((prev) => ({
                            ...prev,
                            [key]: e.target.value
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTemplateSendModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendTemplateFromChat} disabled={isSending}>
                {isSending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <TemplateListModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        templates={templates}
        onToggleStar={handleToggleStar}
      />
      <GallerySelectModal
        isOpen={showGallerySelect}
        onClose={() => setShowGallerySelect(false)}
        resourceType={galleryResourceType}
        onSelect={(url) => setTemplateHeaderMedia(url)}
      />
    </div>
  );
}

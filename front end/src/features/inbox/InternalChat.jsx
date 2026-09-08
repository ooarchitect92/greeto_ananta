'use strict';
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Paperclip, MessageSquare, Loader2, Download, ArrowLeft, Plus, Search } from 'lucide-react';
import { Button } from '../../components/ui/Button.jsx';

function tok() {
  return localStorage.getItem('accessToken') || localStorage.getItem('token') || '';
}
function authH() { return { Authorization: `Bearer ${tok()}` }; }
function jsonH() { return { ...authH(), 'Content-Type': 'application/json' }; }

function memberName(m) {
  if (!m) return '';
  if (m.firstname || m.lastname) return `${m.firstname || ''} ${m.lastname || ''}`.trim();
  return m.name || m.email || '';
}

function initials(name = '') {
  const n = typeof name === 'object' ? memberName(name) : name;
  return n.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
}
function avatarColor(name = '') {
  const n = typeof name === 'object' ? memberName(name) : name;
  const palette = ['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444','#6366f1','#ec4899','#0ea5e9','#14b8a6'];
  let h = 0;
  for (const c of n) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return palette[h % palette.length];
}
function fmt(iso) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function isImg(mime) { return mime?.startsWith('image/'); }

function Avatar({ name, size = 32 }) {
  return (
    <div style={{ background: avatarColor(name), width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.375, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
}

// ── Room label ────────────────────────────────────────────────────────────────
function roomLabel(room, myId) {
  if (room.name) return room.name;
  const others = (room.members || []).filter(m => m.id !== myId);
  if (others.length === 0) return 'Just you';
  if (others.length === 1) return memberName(others[0]);
  return others.map(m => memberName(m).split(' ')[0]).join(', ');
}

// ── Room list view ────────────────────────────────────────────────────────────
function RoomList({ rooms, loading, currentUser, onOpen, onNewChat }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-3 border-b border-slate-200">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-blue-300 text-blue-600 text-sm font-medium hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat  — type @ to pick a member
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        )}
        {!loading && rooms.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center px-6">
            <MessageSquare className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-500">No chats yet</p>
            <p className="text-xs text-slate-400 mt-1">Click "New Chat" and type @ to start a private conversation</p>
          </div>
        )}
        {rooms.map(room => {
          const label = roomLabel(room, currentUser?.id);
          const others = (room.members || []).filter(m => m.id !== currentUser?.id);
          const preview = room.last_body || (room.last_file ? `📎 ${room.last_file}` : null);
          return (
            <button key={room.id} onClick={() => onOpen(room)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
              {others.length === 1
                ? <Avatar name={memberName(others[0])} size={36} />
                : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👥</div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 truncate">{label}</span>
                  {room.last_msg_at && <span className="text-[10px] text-slate-400 flex-none ml-2">{fmt(room.last_msg_at)}</span>}
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{preview || 'No messages yet'}</p>
              </div>
              {Number(room.unread) > 0 && (
                <span className="flex-none min-w-[20px] h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                  {room.unread > 9 ? '9+' : room.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── New-chat composer — pick members via @ or search ─────────────────────────
function NewChat({ teamMembers, currentUser, onStart, onBack }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [starting, setStarting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const mid = (m) => m?.id || m?._id;
  const myId = currentUser?.id || currentUser?._id;

  const filtered = teamMembers.filter(m =>
    mid(m) !== myId &&
    memberName(m).toLowerCase().includes(query.replace(/^@/, '').toLowerCase())
  );

  const toggle = (m) => {
    setSelected(prev =>
      prev.some(p => mid(p) === mid(m))
        ? prev.filter(p => mid(p) !== mid(m))
        : [...prev, m]
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-3 border-b border-slate-200">
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="@ or type name to search…"
            className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
          />
        </div>
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {selected.map(m => (
              <span key={mid(m)} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                {memberName(m)}
                <button onClick={() => toggle(m)} className="hover:text-blue-900">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">No members found</p>
        )}
        {filtered.map(m => {
          const isSelected = selected.some(p => mid(p) === mid(m));
          const name = memberName(m);
          return (
            <button key={mid(m)} onClick={() => toggle(m)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}>
              <Avatar name={name} size={36} />
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-slate-900">{name}</p>
                <p className="text-xs text-slate-400 capitalize">{m.role}</p>
              </div>
              {isSelected && <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs">✓</div>}
            </button>
          );
        })}
      </div>

      <div className="flex-none p-3 border-t border-slate-200">
        <Button
          className="w-full"
          disabled={selected.length === 0 || starting}
          onClick={async () => {
            setStarting(true);
            try { await onStart(selected); } finally { setStarting(false); }
          }}
        >
          {starting
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Starting…</>
            : selected.length > 1
            ? `Start group chat (${selected.length})`
            : selected.length === 1
            ? `Chat with ${memberName(selected[0])}`
            : 'Select members first'}
        </Button>
      </div>
    </div>
  );
}

// ── Chat room view ────────────────────────────────────────────────────────────
function ChatRoom({ room, currentUser, socket, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const bottomRef = useRef(null);
  const listRef = useRef(null);
  const fileRef = useRef(null);
  const oldestRef = useRef(null);

  const load = useCallback(async (before = null) => {
    const params = new URLSearchParams({ limit: 60 });
    if (before) params.set('before', before);
    try {
      const res = await fetch(`/api/internal-chat/rooms/${room.id}/messages?${params}`, { headers: authH() });
      const data = await res.json();
      const msgs = data.messages || [];
      if (before) {
        setMessages(prev => [...msgs, ...prev]);
      } else {
        setMessages(msgs);
        setTimeout(() => {
          if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
        }, 50);
      }
      if (msgs.length < 60) setHasMore(false);
      if (msgs.length > 0) oldestRef.current = msgs[0].created_at;
    } catch {}
  }, [room.id]);

  useEffect(() => {
    setMessages([]); setHasMore(true); oldestRef.current = null;
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      if (msg.roomId !== room.id) return;
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, 50);
    };
    socket.on('internal_chat:message', handler);
    return () => socket.off('internal_chat:message', handler);
  }, [socket, room.id]);

  const handleScroll = () => {
    if (listRef.current?.scrollTop < 60 && hasMore && oldestRef.current) {
      load(oldestRef.current);
    }
  };

  const send = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await fetch(`/api/internal-chat/rooms/${room.id}/messages`, {
        method: 'POST', headers: jsonH(),
        body: JSON.stringify({ body: text }),
      });
      setBody('');
    } catch {}
    finally { setSending(false); }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const upRes = await fetch('/api/gallery/upload', { method: 'POST', headers: authH(), body: fd });
      const upData = await upRes.json();
      if (!upData.url) throw new Error('Upload failed');
      await fetch(`/api/internal-chat/rooms/${room.id}/messages`, {
        method: 'POST', headers: jsonH(),
        body: JSON.stringify({ file_url: upData.url, file_name: file.name, file_mime: file.type }),
      });
    } catch (err) { console.error(err); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const label = roomLabel(room, currentUser?.id);
  const others = (room.members || []).filter(m => m.id !== currentUser?.id);

  return (
    <div className="flex flex-col h-full">
      {/* Room header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50 flex-none">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" />
        </button>
        {others.length === 1
          ? <Avatar name={memberName(others[0])} size={28} />
          : <span className="text-base">👥</span>
        }
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{label}</p>
          {others.length > 1 && (
            <p className="text-[10px] text-slate-400 truncate">{others.map(m => memberName(m).split(' ')[0]).join(', ')}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
        {!loading && hasMore && (
          <button onClick={() => load(oldestRef.current)} className="w-full text-xs text-blue-500 hover:text-blue-700 py-1">
            Load older
          </button>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-slate-400">No messages yet. Say hello 👋</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isMine = msg.author_id === currentUser?.id;
          const showMeta = idx === 0 || messages[idx - 1]?.author_id !== msg.author_id;

          return (
            <div key={msg.id} className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}>
              <div className="flex-none">
                {showMeta ? <Avatar name={msg.author_name || '?'} size={28} /> : <div style={{ width: 28 }} />}
              </div>
              <div className={`flex flex-col max-w-[78%] ${isMine ? 'items-end' : 'items-start'}`}>
                {showMeta && (
                  <div className={`flex items-baseline gap-2 mb-0.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[11px] font-semibold text-slate-600">{isMine ? 'You' : msg.author_name}</span>
                    <span className="text-[10px] text-slate-400">{fmt(msg.created_at)}</span>
                  </div>
                )}

                {msg.body && (
                  <div className={`rounded-2xl px-3 py-2 text-sm leading-snug break-words whitespace-pre-wrap ${
                    isMine ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  }`}>
                    {msg.body}
                  </div>
                )}

                {msg.file_url && (
                  <div className={`rounded-xl overflow-hidden border mt-1 max-w-[220px] ${isMine ? 'border-blue-300' : 'border-slate-200'}`}>
                    {isImg(msg.file_mime)
                      ? <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={msg.file_url} alt={msg.file_name} className="max-w-full max-h-44 object-cover block" />
                        </a>
                      : <a href={msg.file_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors">
                          <Download className="w-4 h-4 text-slate-500 flex-none" />
                          <span className="text-xs text-slate-700 truncate max-w-[160px]">{msg.file_name || 'File'}</span>
                        </a>
                    }
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-none border-t border-slate-200 p-3 bg-white">
        <div className="flex items-end gap-2">
          <div className="flex-1 border border-slate-200 rounded-xl bg-slate-50 overflow-hidden focus-within:border-blue-400 focus-within:bg-white transition-colors">
            <textarea
              rows={1}
              value={body}
              onChange={e => setBody(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type a message…"
              className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none max-h-28 overflow-y-auto"
              style={{ lineHeight: '1.4' }}
            />
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" />
          <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-slate-600 flex-none"
            onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </Button>
          <Button size="icon" className="h-9 w-9 flex-none" onClick={send} disabled={!body.trim() || sending}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 mt-1.5 pl-1">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ── Main shell ────────────────────────────────────────────────────────────────
export default function InternalChat({ socket, currentUser, teamMembers = [], teamId, onClose }) {
  const [view, setView] = useState('list'); // 'list' | 'new' | 'room'
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState(null);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const res = await fetch('/api/internal-chat/rooms', { headers: authH() });
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch {}
    finally { setRoomsLoading(false); }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  // Refresh room list on new message (update previews + unread)
  useEffect(() => {
    if (!socket) return;
    const handler = () => loadRooms();
    socket.on('internal_chat:message', handler);
    socket.on('internal_chat:invited', (data) => { loadRooms(); });
    return () => {
      socket.off('internal_chat:message', handler);
      socket.off('internal_chat:invited', handler);
    };
  }, [socket, loadRooms]);

  const openRoom = (room) => { setActiveRoom(room); setView('room'); };

  const startChat = async (members) => {
    const myId = currentUser?.id || currentUser?._id;
    const ids = members.map(m => m.id || m._id).filter(Boolean);
    if (!ids.length) return;

    const res = await fetch('/api/internal-chat/rooms', {
      method: 'POST', headers: jsonH(),
      body: JSON.stringify({ memberIds: ids, teamId }),
    });
    const data = await res.json();
    if (!data.roomId) { console.error('[InternalChat] createRoom failed', data); return; }

    await loadRooms();
    const normalised = members.map(m => ({ id: m.id || m._id, name: memberName(m) }));
    const myName = memberName(currentUser) || currentUser?.name || 'Me';
    openRoom({ id: data.roomId, members: [{ id: myId, name: myName }, ...normalised] });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Shell header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 flex-none">
        <div className="flex items-center gap-2">
          {view !== 'list' && (
            <button onClick={() => { setView('list'); setActiveRoom(null); }} className="text-slate-400 hover:text-slate-600 mr-1">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-slate-900">
            {view === 'new' ? 'New Chat' : view === 'room' ? 'Team Chat' : 'Team Chat'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {view === 'list' && (
            <button onClick={() => setView('new')} className="text-slate-400 hover:text-slate-600" title="New chat">
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Views */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {view === 'list' && (
          <RoomList
            rooms={rooms}
            loading={roomsLoading}
            currentUser={currentUser}
            onOpen={openRoom}
            onNewChat={() => setView('new')}
          />
        )}
        {view === 'new' && (
          <NewChat
            teamMembers={teamMembers}
            currentUser={currentUser}
            onStart={startChat}
            onBack={() => setView('list')}
          />
        )}
        {view === 'room' && activeRoom && (
          <ChatRoom
            room={activeRoom}
            currentUser={currentUser}
            socket={socket}
            onBack={() => { setView('list'); setActiveRoom(null); loadRooms(); }}
          />
        )}
      </div>
    </div>
  );
}

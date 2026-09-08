'use strict';
import React, { useEffect, useState } from 'react';
import { getNotes, createNote, updateNote, deleteNote } from './api.js';
import { Button } from '../../components/ui/Button.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card.jsx';
import { StickyNote, Clock, Pencil, Trash2, Check, X } from 'lucide-react';
import { confirmAction } from '../../components/ui/confirmAction.jsx';

export default function NotesPanel({ conversationId, currentUser, socket }) {
  const [notes, setNotes] = useState([]);
  const [body, setBody] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingBody, setEditingBody] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const canManageNotes = currentUser?.role === 'admin';

  const refresh = async () => {
    if (!conversationId) return;
    const res = await getNotes(conversationId);
    setNotes(res.notes || []);
  };

  useEffect(() => {
    refresh();
  }, [conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    const onNew = (evt) => {
      if (evt.conversationId === conversationId) refresh();
    };
    const onUpdated = (evt) => {
      if (evt.conversationId === conversationId) refresh();
    };
    const onDeleted = (evt) => {
      if (evt.conversationId === conversationId) refresh();
    };
    socket.on('staff_note:new', onNew);
    socket.on('staff_note:updated', onUpdated);
    socket.on('staff_note:deleted', onDeleted);
    return () => {
      socket.off('staff_note:new', onNew);
      socket.off('staff_note:updated', onUpdated);
      socket.off('staff_note:deleted', onDeleted);
    };
  }, [socket, conversationId]);

  const handleCreate = async () => {
    if (!body.trim()) return;
    await createNote(conversationId, currentUser.id, body.trim());
    setBody('');
    refresh();
  };

  const startEdit = (note) => {
    setConfirmingDeleteId(null);
    setEditingNoteId(note.id);
    setEditingBody(note.body || '');
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditingBody('');
  };

  const handleSaveEdit = async (noteId) => {
    if (!editingBody.trim()) return;
    await updateNote(conversationId, noteId, editingBody.trim());
    cancelEdit();
    refresh();
  };

  const handleDelete = async (noteId) => {
    if (!(await confirmAction({
      title: 'Delete internal note?',
      message: 'Delete this private internal note?',
      confirmLabel: 'Delete note',
      tone: 'danger',
    }))) return;
    setConfirmingDeleteId(null);
    await deleteNote(conversationId, noteId);
    refresh();
  };

  if (!conversationId) return null;

  return (
    <Card className="h-full flex flex-col shadow-sm border-slate-200">
      <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
           <StickyNote className="w-4 h-4 text-slate-500" />
           <CardTitle className="text-sm font-semibold text-slate-900">Internal Notes</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          {notes.length === 0 && (
             <div className="text-center py-8 text-xs text-slate-400 italic">
                No notes yet. Add one below.
             </div>
          )}
          {notes.map((n) => (
            <div key={n.id} className="group relative border border-slate-100 rounded-lg p-3 bg-yellow-50/50 hover:bg-yellow-50 transition-colors">
              <div className="flex items-center justify-between gap-1 mb-1">
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Clock className="w-3 h-3" />
                  {new Date(n.created_at).toLocaleString()}
                </div>
                {canManageNotes && editingNoteId !== n.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(n)}
                      className="p-1 rounded hover:bg-yellow-100 text-slate-400 hover:text-slate-700"
                      title="Edit note"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className={confirmingDeleteId === n.id
                        ? "px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white"
                        : "p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600"}
                      title={confirmingDeleteId === n.id ? "Click again to confirm delete" : "Delete note"}
                    >
                      {confirmingDeleteId === n.id ? "Confirm?" : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
              {editingNoteId === n.id ? (
                <div className="space-y-2">
                  <Textarea
                    className="w-full min-h-[60px] bg-white resize-none text-sm"
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit}>
                      <X className="w-3 h-3" />
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(n.id)} disabled={!editingBody.trim()}>
                      <Check className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-800 leading-snug">{n.body}</div>
              )}
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-slate-100 bg-slate-50/30">
          <Textarea
            className="w-full min-h-[80px] bg-white resize-none text-sm mb-2 focus:ring-1 focus:ring-blue-500"
            placeholder="Add a private note..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleCreate} disabled={!body.trim()}>
              Add Note
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

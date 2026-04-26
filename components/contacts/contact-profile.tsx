'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText, Plus, Trash2, Phone, Mail,
  MapPin, CreditCard, Bot, User, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RelativeTime } from '@/components/ui/relative-time';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/database-helpers';
import type { ContactNote, ContactFieldDefinition, ContactFieldValue } from '@/types/crm';

interface Props {
  contact: Contact;
  conversations: Array<{
    id: string;
    status: string;
    ia_active: boolean;
    last_message_at: string | null;
    created_at: string;
  }>;
  notes: ContactNote[];
  fieldDefs: ContactFieldDefinition[];
  fieldValues: ContactFieldValue[];
}

export function ContactProfile({ contact, conversations, notes: initialNotes, fieldDefs, fieldValues }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [newNote, setNewNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'conversations' | 'notes' | 'fields'>('info');

  const fieldMap = Object.fromEntries(fieldValues.map((v) => [v.field_key, v.value]));

  const handleAddNote = async () => {
    if (!newNote.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setNotes((prev) => [created, ...prev]);
        setNewNote('');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const res = await fetch(`/api/contacts/${contact.id}/notes?note_id=${noteId}`, { method: 'DELETE' });
    if (res.ok) setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const tabs = [
    { key: 'info' as const, label: 'Informações' },
    { key: 'conversations' as const, label: `Conversas (${conversations.length})` },
    { key: 'notes' as const, label: `Notas (${notes.length})` },
    ...(fieldDefs.length > 0 ? [{ key: 'fields' as const, label: 'Campos CRM' }] : []),
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b bg-card flex-shrink-0">
        <button
          onClick={() => router.push('/contacts')}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3"
        >
          ← Contatos
        </button>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-bold text-primary uppercase">
              {(contact.name || contact.phone || '?')[0]}
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold">{contact.name || contact.phone}</h1>
            <p className="text-sm text-muted-foreground">{contact.phone}</p>
          </div>
          {(contact as any).is_muted && <Badge variant="secondary" className="ml-auto">Silenciado</Badge>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b px-4 bg-card flex-shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-2 text-sm border-b-2 transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Info tab */}
        {activeTab === 'info' && (
          <div className="space-y-4 max-w-md">
            {contact.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{contact.phone}</span>
              </div>
            )}
            {contact.cpf && (
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{contact.cpf}</span>
              </div>
            )}
            {(contact.address_street || contact.city) && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {[contact.address_street, contact.address_number, contact.city, contact.zip_code]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Conversations tab */}
        {activeTab === 'conversations' && (
          <div className="space-y-2">
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma conversa ainda</p>
            ) : (
              conversations.map((conv) => {
                const Icon = conv.ia_active ? Bot : User;
                return (
                  <div
                    key={conv.id}
                    onClick={() => router.push(`/inbox?conversation=${conv.id}`)}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={conv.status === 'closed' ? 'secondary' : 'default'}
                            className={cn(
                              'text-xs',
                              conv.status !== 'closed' && conv.ia_active && 'bg-green-500',
                              conv.status !== 'closed' && !conv.ia_active && 'bg-blue-500'
                            )}
                          >
                            {conv.status === 'closed' ? 'Encerrada' : conv.ia_active ? 'IA Ativa' : 'Manual'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          <RelativeTime timestamp={conv.last_message_at || conv.created_at} />
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Notes tab */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            {/* Add note */}
            <div className="space-y-2">
              <Textarea
                placeholder="Adicionar nota interna..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
              />
              <Button onClick={handleAddNote} disabled={saving || !newNote.trim()} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar nota
              </Button>
            </div>

            {notes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <FileText className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhuma nota ainda</p>
              </div>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="p-3 border rounded-lg bg-card space-y-1">
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      <RelativeTime timestamp={note.created_at} />
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Fields tab */}
        {activeTab === 'fields' && (
          <div className="space-y-3 max-w-md">
            {fieldDefs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum campo customizado configurado
              </p>
            ) : (
              fieldDefs.map((def) => (
                <div key={def.id} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {def.field_label}
                  </label>
                  <p className="text-sm border rounded-md px-3 py-2 bg-muted/30 min-h-[36px]">
                    {fieldMap[def.field_key] || '—'}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

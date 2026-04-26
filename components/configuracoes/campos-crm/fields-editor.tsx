'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import type { ContactFieldDefinition } from '@/types/crm';

const FIELD_TYPE_LABELS: Record<ContactFieldDefinition['field_type'], string> = {
  text:    'Texto',
  number:  'Número',
  date:    'Data',
  select:  'Lista de opções',
  boolean: 'Sim/Não',
};

interface Props {
  initialFields: ContactFieldDefinition[];
}

interface NewFieldForm {
  field_label: string;
  field_type: ContactFieldDefinition['field_type'];
  is_required: boolean;
  options_raw: string;
}

const EMPTY_FORM: NewFieldForm = {
  field_label: '',
  field_type: 'text',
  is_required: false,
  options_raw: '',
};

export function FieldsEditor({ initialFields }: Props) {
  const [fields, setFields] = useState<ContactFieldDefinition[]>(initialFields);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewFieldForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!form.field_label.trim()) {
      setError('Nome do campo é obrigatório');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const options =
        form.field_type === 'select' && form.options_raw.trim()
          ? form.options_raw.split(',').map((s) => s.trim()).filter(Boolean)
          : null;

      const res = await fetch('/api/crm/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_label: form.field_label.trim(),
          field_key: form.field_label.trim().toLowerCase().replace(/\s+/g, '_'),
          field_type: form.field_type,
          is_required: form.is_required,
          options,
          display_order: fields.length,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error || 'Erro ao criar campo');
        return;
      }

      const created = await res.json();
      setFields((prev) => [...prev, created]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/crm/fields/${id}`, { method: 'DELETE' });
    if (res.ok) setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleToggleRequired = async (field: ContactFieldDefinition) => {
    const newVal = !field.is_required;
    setFields((prev) => prev.map((f) => f.id === field.id ? { ...f, is_required: newVal } : f));
    await fetch(`/api/crm/fields/${field.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_required: newVal }),
    });
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Campos customizados de contato</h2>
          <p className="text-sm text-muted-foreground">
            Defina campos extras que aparecem no perfil de cada contato
          </p>
        </div>
        <Button size="sm" onClick={() => { setShowForm(true); setError(''); }}>
          <Plus className="h-4 w-4 mr-1" />
          Novo campo
        </Button>
      </div>

      {/* Field list */}
      {fields.length === 0 && !showForm ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          <p className="text-sm">Nenhum campo customizado ainda.</p>
          <p className="text-xs mt-1">Clique em "Novo campo" para começar.</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {fields.map((field) => (
            <div key={field.id} className="flex items-center gap-3 px-4 py-3">
              <GripVertical className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{field.field_label}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {FIELD_TYPE_LABELS[field.field_type]}
                  </Badge>
                  {field.is_required && (
                    <Badge variant="secondary" className="text-[10px]">Obrigatório</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground font-mono">{field.field_key}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Obrig.</span>
                  <Switch
                    checked={field.is_required}
                    onCheckedChange={() => handleToggleRequired(field)}
                    className="scale-75"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(field.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New field form */}
      {showForm && (
        <div className="border rounded-lg p-4 space-y-4 bg-card">
          <h3 className="text-sm font-semibold">Novo campo</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="field_label">Nome do campo *</Label>
              <Input
                id="field_label"
                placeholder="Ex: Empresa, Cargo, CNPJ"
                value={form.field_label}
                onChange={(e) => setForm((f) => ({ ...f, field_label: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.field_type}
                onValueChange={(v) => setForm((f) => ({ ...f, field_type: v as ContactFieldDefinition['field_type'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                  <ChevronDown className="h-4 w-4 opacity-50 ml-auto" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.field_type === 'select' && (
            <div className="space-y-1.5">
              <Label htmlFor="options">Opções (separadas por vírgula)</Label>
              <Input
                id="options"
                placeholder="Ex: Opção A, Opção B, Opção C"
                value={form.options_raw}
                onChange={(e) => setForm((f) => ({ ...f, options_raw: e.target.value }))}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              checked={form.is_required}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_required: v }))}
            />
            <Label className="cursor-pointer">Campo obrigatório</Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={saving} size="sm">
              {saving ? 'Salvando...' : 'Criar campo'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(''); }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

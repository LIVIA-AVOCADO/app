/* eslint-disable max-lines */
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { SchedService, SchedResource, SchedUnit, SchedSettings, ResourceType } from '@/types/scheduling';

interface AgendamentosConfiguracoesProps {
  tenantId:        string;
  initialServices: SchedService[];
  initialUnits:    SchedUnit[];
  initialResources: SchedResource[];
  initialSettings: SchedSettings | null;
}

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  staff:     'Profissional',
  room:      'Sala',
  equipment: 'Equipamento',
  vehicle:   'Veículo',
  team:      'Equipe',
};

// =============================================================================
// Tab: Serviços
// =============================================================================

interface ServiceFormState {
  name:                string;
  description:         string;
  durationMinutes:     number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes:  number;
  priceCents:          string;
  isActive:            boolean;
}

const defaultServiceForm = (): ServiceFormState => ({
  name:                '',
  description:         '',
  durationMinutes:     60,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes:  0,
  priceCents:          '',
  isActive:            true,
});

function ServicosTab({ tenantId, initialServices }: { tenantId: string; initialServices: SchedService[] }) {
  const [services, setServices] = useState<SchedService[]>(initialServices);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<ServiceFormState>(defaultServiceForm());
  const [saving, setSaving]         = useState(false);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [deleting, setDeleting]     = useState(false);

  const openCreate = () => { setEditingId(null); setForm(defaultServiceForm()); setDialogOpen(true); };
  const openEdit   = (s: SchedService) => {
    setEditingId(s.id);
    setForm({
      name:                s.name,
      description:         s.description ?? '',
      durationMinutes:     s.duration_minutes,
      bufferBeforeMinutes: s.buffer_before_minutes,
      bufferAfterMinutes:  s.buffer_after_minutes,
      priceCents:          s.price_cents != null ? String(s.price_cents / 100) : '',
      isActive:            s.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!form.durationMinutes || form.durationMinutes <= 0) { toast.error('Duração deve ser positiva'); return; }
    setSaving(true);
    try {
      const priceCents = form.priceCents ? Math.round(parseFloat(form.priceCents) * 100) : null;
      const payload = {
        tenantId,
        name:                form.name.trim(),
        description:         form.description || null,
        durationMinutes:     form.durationMinutes,
        bufferBeforeMinutes: form.bufferBeforeMinutes,
        bufferAfterMinutes:  form.bufferAfterMinutes,
        priceCents,
        isActive:            form.isActive,
      };

      if (editingId) {
        const res = await fetch(`/api/agendamentos/servicos/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Erro ao atualizar serviço');
        const json = await res.json();
        setServices((prev) => prev.map((s) => s.id === editingId ? json.data : s));
        toast.success('Serviço atualizado');
      } else {
        const res = await fetch('/api/agendamentos/servicos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Erro ao criar serviço');
        const json = await res.json();
        setServices((prev) => [...prev, json.data]);
        toast.success('Serviço criado');
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar serviço');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agendamentos/servicos/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir serviço');
      setServices((prev) => prev.filter((s) => s.id !== deleteId));
      setDeleteId(null);
      toast.success('Serviço excluído');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir serviço');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{services.length} serviço{services.length !== 1 ? 's' : ''} cadastrado{services.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo serviço
        </Button>
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhum serviço cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{s.name}</p>
                    {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  </div>
                </TableCell>
                <TableCell>{s.duration_minutes} min</TableCell>
                <TableCell>{s.price_cents != null ? `R$ ${(s.price_cents / 100).toFixed(2)}` : '—'}</TableCell>
                <TableCell>
                  <Badge variant={s.is_active ? 'default' : 'secondary'}>
                    {s.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Consulta, Corte de cabelo..." />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Duração (min) *</Label>
                <Input type="number" min={1} value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Buffer antes (min)</Label>
                <Input type="number" min={0} value={form.bufferBeforeMinutes} onChange={(e) => setForm((f) => ({ ...f, bufferBeforeMinutes: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Buffer depois (min)</Label>
                <Input type="number" min={0} value={form.bufferAfterMinutes} onChange={(e) => setForm((f) => ({ ...f, bufferAfterMinutes: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input type="number" min={0} step="0.01" value={form.priceCents} onChange={(e) => setForm((f) => ({ ...f, priceCents: e.target.value }))} placeholder="0.00" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço</AlertDialogTitle>
            <AlertDialogDescription>Esta ação desativará o serviço. Agendamentos existentes não serão afetados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// Tab: Recursos
// =============================================================================

interface ResourceFormState {
  name:         string;
  resourceType: ResourceType;
  unitId:       string;
  isActive:     boolean;
}

const defaultResourceForm = (): ResourceFormState => ({
  name:         '',
  resourceType: 'staff',
  unitId:       '',
  isActive:     true,
});

function RecursosTab({ tenantId, initialResources, units }: { tenantId: string; initialResources: SchedResource[]; units: SchedUnit[] }) {
  const [resources, setResources] = useState<SchedResource[]>(initialResources);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<ResourceFormState>(defaultResourceForm());
  const [saving, setSaving]         = useState(false);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [deleting, setDeleting]     = useState(false);

  const openCreate = () => { setEditingId(null); setForm(defaultResourceForm()); setDialogOpen(true); };
  const openEdit   = (r: SchedResource) => {
    setEditingId(r.id);
    setForm({ name: r.name, resourceType: r.resource_type as ResourceType, unitId: r.unit_id ?? '', isActive: r.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        tenantId,
        name:         form.name.trim(),
        resourceType: form.resourceType,
        unitId:       form.unitId || null,
        isActive:     form.isActive,
      };

      if (editingId) {
        const res = await fetch(`/api/agendamentos/recursos/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Erro ao atualizar recurso');
        const json = await res.json();
        setResources((prev) => prev.map((r) => r.id === editingId ? json.data : r));
        toast.success('Recurso atualizado');
      } else {
        const res = await fetch('/api/agendamentos/recursos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Erro ao criar recurso');
        const json = await res.json();
        setResources((prev) => [...prev, json.data]);
        toast.success('Recurso criado');
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar recurso');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agendamentos/recursos/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir recurso');
      setResources((prev) => prev.filter((r) => r.id !== deleteId));
      setDeleteId(null);
      toast.success('Recurso excluído');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir recurso');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{resources.length} recurso{resources.length !== 1 ? 's' : ''} cadastrado{resources.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo recurso
        </Button>
      </div>

      {resources.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhum recurso cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {resources.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{RESOURCE_TYPE_LABELS[r.resource_type as ResourceType] ?? r.resource_type}</TableCell>
                <TableCell>{units.find((u) => u.id === r.unit_id)?.name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={r.is_active ? 'default' : 'secondary'}>
                    {r.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar recurso' : 'Novo recurso'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Dr. Silva, Sala 1..." />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={form.resourceType} onValueChange={(v) => setForm((f) => ({ ...f, resourceType: v as ResourceType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RESOURCE_TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {units.length > 0 && (
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={form.unitId || '_none'} onValueChange={(v) => setForm((f) => ({ ...f, unitId: v === '_none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sem unidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Sem unidade</SelectItem>
                    {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recurso</AlertDialogTitle>
            <AlertDialogDescription>Esta ação desativará o recurso. Agendamentos existentes não serão afetados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// Tab: Unidades
// =============================================================================

interface UnitFormState {
  name:     string;
  timezone: string;
  isActive: boolean;
}

const defaultUnitForm = (): UnitFormState => ({ name: '', timezone: 'America/Fortaleza', isActive: true });

function UnidadesTab({ tenantId, initialUnits }: { tenantId: string; initialUnits: SchedUnit[] }) {
  const [units, setUnits]           = useState<SchedUnit[]>(initialUnits);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState<UnitFormState>(defaultUnitForm());
  const [saving, setSaving]         = useState(false);
  const [deleteId, setDeleteId]     = useState<string | null>(null);
  const [deleting, setDeleting]     = useState(false);

  const openCreate = () => { setEditingId(null); setForm(defaultUnitForm()); setDialogOpen(true); };
  const openEdit   = (u: SchedUnit) => {
    setEditingId(u.id);
    setForm({ name: u.name, timezone: u.timezone, isActive: u.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = { tenantId, name: form.name.trim(), timezone: form.timezone, isActive: form.isActive };

      if (editingId) {
        const res = await fetch(`/api/agendamentos/unidades/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Erro ao atualizar unidade');
        const json = await res.json();
        setUnits((prev) => prev.map((u) => u.id === editingId ? json.data : u));
        toast.success('Unidade atualizada');
      } else {
        const res = await fetch('/api/agendamentos/unidades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, addressJson: {} }),
        });
        if (!res.ok) throw new Error('Erro ao criar unidade');
        const json = await res.json();
        setUnits((prev) => [...prev, json.data]);
        toast.success('Unidade criada');
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar unidade');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agendamentos/unidades/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao excluir unidade');
      setUnits((prev) => prev.filter((u) => u.id !== deleteId));
      setDeleteId(null);
      toast.success('Unidade excluída');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir unidade');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{units.length} unidade{units.length !== 1 ? 's' : ''} cadastrada{units.length !== 1 ? 's' : ''}</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova unidade
        </Button>
      </div>

      {units.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma unidade cadastrada.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Timezone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.timezone}</TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? 'default' : 'secondary'}>{u.is_active ? 'Ativa' : 'Inativa'}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteId(u.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar unidade' : 'Nova unidade'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Clínica Centro, Unidade Sul..." />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} placeholder="America/Fortaleza" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir unidade</AlertDialogTitle>
            <AlertDialogDescription>Esta ação desativará a unidade.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================================================================
// Tab: Configurações gerais
// =============================================================================

function ConfiguracoesTab({ tenantId, initialSettings }: { tenantId: string; initialSettings: SchedSettings | null }) {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    minNoticeMinutes:     initialSettings?.min_notice_minutes     ?? 60,
    maxBookingWindowDays: initialSettings?.max_booking_window_days ?? 30,
    slotGranularityMinutes: initialSettings?.slot_granularity_minutes ?? 30,
    holdDurationMinutes:  initialSettings?.hold_duration_minutes  ?? 30,
    allowCustomerChooseProfessional: initialSettings?.allow_customer_choose_professional ?? false,
    allowAnyAvailableProfessional:   initialSettings?.allow_any_available_professional   ?? true,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/agendamentos/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          minNoticeMinutes:               settings.minNoticeMinutes,
          maxBookingWindowDays:           settings.maxBookingWindowDays,
          slotGranularityMinutes:         settings.slotGranularityMinutes,
          holdDurationMinutes:            settings.holdDurationMinutes,
          allowCustomerChooseProfessional: settings.allowCustomerChooseProfessional,
          allowAnyAvailableProfessional:   settings.allowAnyAvailableProfessional,
        }),
      });
      if (!res.ok) throw new Error('Erro ao salvar configurações');
      toast.success('Configurações salvas');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Antecedência mínima para agendamento (minutos)</Label>
          <Input
            type="number"
            min={0}
            value={settings.minNoticeMinutes}
            onChange={(e) => setSettings((s) => ({ ...s, minNoticeMinutes: parseInt(e.target.value) || 0 }))}
          />
          <p className="text-xs text-muted-foreground">Impede agendamentos em menos de X minutos a partir de agora.</p>
        </div>

        <div className="space-y-2">
          <Label>Janela máxima de agendamento (dias)</Label>
          <Input
            type="number"
            min={1}
            value={settings.maxBookingWindowDays}
            onChange={(e) => setSettings((s) => ({ ...s, maxBookingWindowDays: parseInt(e.target.value) || 1 }))}
          />
          <p className="text-xs text-muted-foreground">Máximo de dias no futuro para agendar.</p>
        </div>

        <div className="space-y-2">
          <Label>Granularidade dos slots (minutos)</Label>
          <Select
            value={String(settings.slotGranularityMinutes)}
            onValueChange={(v) => setSettings((s) => ({ ...s, slotGranularityMinutes: parseInt(v) }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 15, 20, 30, 45, 60].map((v) => (
                <SelectItem key={v} value={String(v)}>{v} min</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Intervalo entre horários disponíveis exibidos ao cliente.</p>
        </div>

        <div className="space-y-2">
          <Label>Duração do hold (minutos)</Label>
          <Input
            type="number"
            min={1}
            value={settings.holdDurationMinutes}
            onChange={(e) => setSettings((s) => ({ ...s, holdDurationMinutes: parseInt(e.target.value) || 1 }))}
          />
          <p className="text-xs text-muted-foreground">Tempo que um horário fica reservado antes de expirar se não confirmado.</p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <Label>Permitir cliente escolher profissional</Label>
            <p className="text-xs text-muted-foreground">Via IA ou chatbot.</p>
          </div>
          <Switch
            checked={settings.allowCustomerChooseProfessional}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, allowCustomerChooseProfessional: v }))}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Usar qualquer profissional disponível</Label>
            <p className="text-xs text-muted-foreground">Se nenhum for indicado, usa o primeiro disponível.</p>
          </div>
          <Switch
            checked={settings.allowAnyAvailableProfessional}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, allowAnyAvailableProfessional: v }))}
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Salvar configurações
      </Button>
    </div>
  );
}

// =============================================================================
// Componente principal
// =============================================================================

export function AgendamentosConfiguracoes({
  tenantId,
  initialServices,
  initialUnits,
  initialResources,
  initialSettings,
}: AgendamentosConfiguracoesProps) {
  return (
    <Tabs defaultValue="servicos">
      <TabsList className="mb-6">
        <TabsTrigger value="servicos">Serviços</TabsTrigger>
        <TabsTrigger value="recursos">Recursos</TabsTrigger>
        <TabsTrigger value="unidades">Unidades</TabsTrigger>
        <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
      </TabsList>

      <TabsContent value="servicos">
        <ServicosTab tenantId={tenantId} initialServices={initialServices} />
      </TabsContent>

      <TabsContent value="recursos">
        <RecursosTab tenantId={tenantId} initialResources={initialResources} units={initialUnits} />
      </TabsContent>

      <TabsContent value="unidades">
        <UnidadesTab tenantId={tenantId} initialUnits={initialUnits} />
      </TabsContent>

      <TabsContent value="configuracoes">
        <ConfiguracoesTab tenantId={tenantId} initialSettings={initialSettings} />
      </TabsContent>
    </Tabs>
  );
}

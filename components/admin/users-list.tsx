'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Users, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FeatureModule { key: string; name: string; description: string; }
interface TenantUser {
  id: string; full_name: string; email: string;
  avatar_url: string | null; modules: string[]; role: string; is_active: boolean;
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface EditModulesDialogProps {
  user: TenantUser;
  featureModules: FeatureModule[];
  open: boolean;
  onClose: () => void;
  onSaved: (userId: string, modules: string[]) => void;
}

function EditModulesDialog({ user, featureModules, open, onClose, onSaved }: EditModulesDialogProps) {
  const [selected, setSelected] = useState<string[]>(user.modules);
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (key: string) =>
    setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}/modules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao salvar módulos');
        return;
      }
      toast.success(`Módulos de ${user.full_name} atualizados!`);
      onSaved(user.id, selected);
      onClose();
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar acesso de {user.full_name}</DialogTitle>
          <DialogDescription>
            Selecione os módulos que este usuário poderá acessar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {featureModules.map((mod) => (
            <label
              key={mod.key}
              className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selected.includes(mod.key)}
                onCheckedChange={() => toggle(mod.key)}
                disabled={isSaving}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{mod.name}</p>
                {mod.description && (
                  <p className="text-xs text-muted-foreground">{mod.description}</p>
                )}
              </div>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UsersList({
  tenantUsers, featureModules,
}: { tenantUsers: TenantUser[]; featureModules: FeatureModule[] }) {
  const router = useRouter();
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [users, setUsers] = useState<TenantUser[]>(tenantUsers);

  const handleSaved = (userId: string, modules: string[]) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, modules } : u))
    );
    router.refresh();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            Usuários da Equipe
          </CardTitle>
          <CardDescription>
            {users.length === 0
              ? 'Nenhum usuário associado ainda'
              : `${users.length} usuário${users.length > 1 ? 's' : ''} na equipe`}
          </CardDescription>
        </CardHeader>
        {users.length > 0 && (
          <CardContent>
            <div className="space-y-3">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-4 rounded-lg border p-3">
                  <Avatar className="h-10 w-10">
                    {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.full_name} />}
                    <AvatarFallback>{getInitials(u.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {u.modules.length > 0 ? (
                      u.modules.map((mod) => {
                        const moduleInfo = featureModules.find((fm) => fm.key === mod);
                        return (
                          <Badge key={mod} variant="secondary" className="text-xs">
                            {moduleInfo?.name || mod}
                          </Badge>
                        );
                      })
                    ) : (
                      <Badge variant="outline" className="text-xs">Sem módulos</Badge>
                    )}
                    {u.role !== 'super_admin' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setEditingUser(u)}
                        title="Editar módulos"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {editingUser && (
        <EditModulesDialog
          user={editingUser}
          featureModules={featureModules}
          open={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}

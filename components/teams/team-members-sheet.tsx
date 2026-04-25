'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, UserPlus, Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Team, EligibleUser } from './teams-content';

interface TeamMember {
  role: string;
  joined_at: string;
  user: EligibleUser;
}

const STATUS_DOT: Record<string, string> = {
  online: 'bg-green-500',
  busy: 'bg-yellow-500',
  offline: 'bg-gray-400',
};

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agente',
  supervisor: 'Supervisor',
};

interface TeamMembersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
  tenantId: string;
  eligibleUsers: EligibleUser[];
}

export function TeamMembersSheet({
  open,
  onOpenChange,
  team,
  tenantId,
  eligibleUsers,
}: TeamMembersSheetProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('agent');
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!team) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/members?tenantId=${tenantId}`);
      const json = await res.json();
      if (res.ok) setMembers(json.members ?? []);
    } finally {
      setIsLoading(false);
    }
  }, [team, tenantId]);

  useEffect(() => {
    if (open && team) fetchMembers();
    else setMembers([]);
  }, [open, team, fetchMembers]);

  const memberIds = new Set(members.map((m) => m.user.id));
  const available = eligibleUsers.filter((u) => !memberIds.has(u.id));

  const handleAdd = async () => {
    if (!team || !addUserId) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/teams/${team.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, userId: addUserId, role: addRole }),
      });
      if (!res.ok) throw new Error('Erro ao adicionar membro');
      toast.success('Membro adicionado');
      setAddUserId('');
      await fetchMembers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao adicionar membro');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!team) return;
    setRemovingId(userId);
    try {
      const res = await fetch(
        `/api/teams/${team.id}/members/${userId}?tenantId=${tenantId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Erro ao remover membro');
      toast.success('Membro removido');
      setMembers((prev) => prev.filter((m) => m.user.id !== userId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover membro');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle className="flex items-center gap-2">
            {team && (
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: team.color }}
              />
            )}
            {team?.name ?? 'Membros'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Adicionar membro */}
          {available.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">Adicionar membro</p>
              <div className="flex gap-2">
                <Select value={addUserId} onValueChange={setAddUserId}>
                  <SelectTrigger className="flex-1 h-8 text-xs">
                    <SelectValue placeholder="Selecionar agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <span className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[u.availability_status] ?? 'bg-gray-400'}`} />
                          {u.full_name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={addRole} onValueChange={setAddRole}>
                  <SelectTrigger className="w-[110px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agente</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!addUserId || isAdding}
                className="w-full h-8"
              >
                {isAdding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5 mr-2" />
                )}
                Adicionar
              </Button>
            </div>
          )}

          {/* Lista de membros */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Membros atuais{' '}
              <span className="text-muted-foreground font-normal">({members.length})</span>
            </p>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum membro ainda.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border">
                {members.map((m) => (
                  <li key={m.user.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="relative shrink-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                        {m.user.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${STATUS_DOT[m.user.availability_status] ?? 'bg-gray-400'}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.user.full_name}</p>
                      <Badge variant="outline" className="text-xs mt-0.5">
                        {ROLE_LABELS[m.role] ?? m.role}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemove(m.user.id)}
                      disabled={removingId === m.user.id}
                    >
                      {removingId === m.user.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

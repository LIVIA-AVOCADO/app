'use client';

import { useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamCard } from './team-card';
import { TeamFormDialog } from './team-form-dialog';
import { TeamMembersSheet } from './team-members-sheet';
import { toast } from 'sonner';

export interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface EligibleUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  availability_status: 'online' | 'busy' | 'offline';
}

interface TeamsContentProps {
  tenantId: string;
  initialTeams: Team[];
  eligibleUsers: EligibleUser[];
}

export function TeamsContent({ tenantId, initialTeams, eligibleUsers }: TeamsContentProps) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [membersTeam, setMembersTeam] = useState<Team | null>(null);

  const handleCreate = useCallback(async (data: { name: string; description: string; color: string }) => {
    const res = await fetch('/api/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, ...data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Erro ao criar time');
    setTeams((prev) => [...prev, json.team].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success('Time criado');
  }, [tenantId]);

  const handleEdit = useCallback(async (teamId: string, data: { name: string; description: string; color: string }) => {
    const res = await fetch(`/api/teams/${teamId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, ...data }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Erro ao atualizar time');
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? { ...t, ...json.team } : t))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    toast.success('Time atualizado');
  }, [tenantId]);

  const handleDelete = useCallback(async (teamId: string) => {
    const res = await fetch(`/api/teams/${teamId}?tenantId=${tenantId}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error((json as { error?: string }).error ?? 'Erro ao excluir time');
    }
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
    toast.success('Time excluído');
  }, [tenantId]);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Times</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Organize agentes em times para roteamento e relatórios
            </p>
          </div>
          <Button onClick={() => { setEditingTeam(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo time
          </Button>
        </div>

        {teams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <Plus className="h-6 w-6" />
            </div>
            <p className="text-sm">Nenhum time criado ainda.</p>
            <Button variant="outline" size="sm" onClick={() => { setEditingTeam(null); setFormOpen(true); }}>
              Criar primeiro time
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                onEdit={() => { setEditingTeam(team); setFormOpen(true); }}
                onDelete={handleDelete}
                onManageMembers={() => setMembersTeam(team)}
              />
            ))}
          </div>
        )}
      </div>

      <TeamFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        team={editingTeam}
        onCreate={handleCreate}
        onEdit={handleEdit}
      />

      <TeamMembersSheet
        open={!!membersTeam}
        onOpenChange={(open) => { if (!open) setMembersTeam(null); }}
        team={membersTeam}
        tenantId={tenantId}
        eligibleUsers={eligibleUsers}
      />
    </div>
  );
}

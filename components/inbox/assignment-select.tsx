'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, UserX } from 'lucide-react';
import { toast } from 'sonner';

interface TeamUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  availability_status: 'online' | 'busy' | 'offline';
}

const STATUS_DOT: Record<string, string> = {
  online: 'bg-green-500',
  busy: 'bg-yellow-500',
  offline: 'bg-gray-400',
};

interface AssignmentSelectProps {
  conversationId: string;
  tenantId: string;
  assignedTo?: string | null;
  onAssignmentChange?: (userId: string | null) => void;
}

export function AssignmentSelect({
  conversationId,
  tenantId,
  assignedTo,
  onAssignmentChange,
}: AssignmentSelectProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string>(assignedTo ?? '__none__');

  useEffect(() => {
    setSelectedValue(assignedTo ?? '__none__');
  }, [assignedTo]);

  const fetchUsers = useCallback(async () => {
    if (hasFetched) return;
    setIsFetchingUsers(true);
    try {
      const res = await fetch(`/api/teams/users?tenantId=${tenantId}`);
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users ?? []);
        setHasFetched(true);
      }
    } catch {
      // silencioso — lista fica vazia
    } finally {
      setIsFetchingUsers(false);
    }
  }, [tenantId, hasFetched]);

  const handleChange = async (value: string) => {
    if (isLoading) return;
    const userId = value === '__none__' ? null : value;
    const prevValue = selectedValue;

    setSelectedValue(value);
    onAssignmentChange?.(userId);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tenantId }),
      });
      if (!res.ok) throw new Error('Erro ao atribuir conversa');
      toast.success(userId ? 'Conversa atribuída' : 'Atribuição removida');
    } catch (err) {
      setSelectedValue(prevValue);
      onAssignmentChange?.(prevValue === '__none__' ? null : prevValue);
      toast.error(err instanceof Error ? err.message : 'Erro ao atribuir conversa');
    } finally {
      setIsLoading(false);
    }
  };

  const assignedUser = users.find((u) => u.id === assignedTo);

  return (
    <Select
      value={selectedValue}
      onValueChange={handleChange}
      disabled={isLoading}
      onOpenChange={(open) => open && fetchUsers()}
    >
      <SelectTrigger className="h-7 text-xs w-[152px]">
        <SelectValue>
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-muted-foreground">Salvando...</span>
            </span>
          ) : assignedUser ? (
            <span className="flex items-center gap-1.5 truncate">
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[assignedUser.availability_status] ?? 'bg-gray-400'}`}
              />
              <span className="truncate">{assignedUser.full_name.split(' ')[0]}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <UserX className="h-3 w-3 shrink-0" />
              <span>Não atribuído</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {isFetchingUsers ? (
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Carregando agentes...
          </div>
        ) : (
          <>
            <SelectItem value="__none__">
              <span className="flex items-center gap-2 text-muted-foreground">
                <UserX className="h-3.5 w-3.5" />
                Não atribuído
              </span>
            </SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[user.availability_status] ?? 'bg-gray-400'}`}
                  />
                  <span>{user.full_name}</span>
                </span>
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, UserPlus, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { UsersList } from './users-list';

interface FeatureModule { id: string; key: string; name: string; description: string; icon: string; }
interface FoundUser { id: string; full_name: string; email: string; avatar_url: string | null; }
interface TenantUser {
  id: string; full_name: string; email: string;
  avatar_url: string | null; modules: string[]; role: string; is_active: boolean;
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function ManageUsersContent({
  featureModules, tenantUsers, currentUserId,
}: { featureModules: FeatureModule[]; tenantUsers: TenantUser[]; currentUserId: string }) {
  const router = useRouter();
  const [code, setCode]                   = useState('');
  const [isSearching, setIsSearching]     = useState(false);
  const [isAssociating, setIsAssociating] = useState(false);
  const [foundUser, setFoundUser]         = useState<FoundUser | null>(null);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [searchError, setSearchError]     = useState<string | null>(null);

  const handleSearch = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) { setSearchError('Digite um código válido (mínimo 4 caracteres)'); return; }
    setIsSearching(true); setSearchError(null); setFoundUser(null);
    try {
      const res = await fetch(`/api/users/associate?code=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) { setSearchError(data.error || 'Usuário não encontrado'); return; }
      setFoundUser(data.user); setSelectedModules([]);
    } catch { setSearchError('Erro ao buscar usuário. Tente novamente.'); }
    finally { setIsSearching(false); }
  };

  const handleAssociate = async () => {
    if (!foundUser) return;
    setIsAssociating(true);
    try {
      const res = await fetch('/api/users/associate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: foundUser.id, modules: selectedModules }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erro ao associar usuário'); return; }
      toast.success(`${foundUser.full_name} foi associado com sucesso!`);
      setFoundUser(null); setCode(''); setSelectedModules([]);
      router.refresh();
    } catch { toast.error('Erro ao associar usuário. Tente novamente.'); }
    finally { setIsAssociating(false); }
  };

  const toggleModule = (moduleKey: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleKey) ? prev.filter((k) => k !== moduleKey) : [...prev, moduleKey]
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Gerenciar Usuários</h1>
        <p className="text-muted-foreground mt-1">Associe novos usuários e gerencie o acesso da sua equipe</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" /> Associar Novo Usuário
          </CardTitle>
          <CardDescription>Digite o código de 6 caracteres que o usuário recebeu ao criar a conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-3">
            <Input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setSearchError(null); }}
              placeholder="Ex: A3X9K2"
              className="font-mono text-lg tracking-wider uppercase max-w-[200px]"
              maxLength={10}
              disabled={isSearching || isAssociating}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isSearching || isAssociating || code.trim().length < 4} className="gap-2">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Buscar
            </Button>
          </div>

          {searchError && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400">
              {searchError}
            </div>
          )}

          {foundUser && (
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  {foundUser.avatar_url && <AvatarImage src={foundUser.avatar_url} alt={foundUser.full_name} />}
                  <AvatarFallback>{getInitials(foundUser.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{foundUser.full_name}</p>
                  <p className="text-sm text-muted-foreground">{foundUser.email}</p>
                </div>
              </div>

              {featureModules.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium">Selecione os módulos que este usuário terá acesso:</p>
                  <div className="grid gap-2">
                    {featureModules.map((mod) => (
                      <label key={mod.key} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <Checkbox checked={selectedModules.includes(mod.key)} onCheckedChange={() => toggleModule(mod.key)} disabled={isAssociating} />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{mod.name}</p>
                          {mod.description && <p className="text-xs text-muted-foreground">{mod.description}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={handleAssociate} disabled={isAssociating} className="w-full gap-2">
                {isAssociating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {isAssociating ? 'Associando...' : `Associar ${foundUser.full_name}`}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <UsersList tenantUsers={tenantUsers} featureModules={featureModules} currentUserId={currentUserId} />
    </div>
  );
}

'use client';

import { useState, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getContactDisplayName } from '@/lib/utils/contact-helpers';
import { cn } from '@/lib/utils';
import type { Contact } from '@/types/database-helpers';

interface Props {
  initialContacts: Contact[];
  initialTotal: number;
  initialPage: number;
  totalPages: number;
}

export function ContactListView({ initialContacts, initialTotal, initialPage, totalPages }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState('');

  const navigate = useCallback(
    (page: number, q: string) => {
      startTransition(() => {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (page > 1) params.set('page', String(page));
        router.push(`/contacts?${params.toString()}`);
      });
    },
    [router]
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      navigate(1, search);
    },
    [navigate, search]
  );

  return (
    <div className="flex flex-col h-full min-w-0 bg-background">
      {/* Header */}
      <div className="p-4 border-b bg-card flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Contatos</h1>
            <p className="text-sm text-muted-foreground">{initialTotal} contatos cadastrados</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={isPending}>Buscar</Button>
        </form>
      </div>

      {/* Table */}
      <div className={cn('flex-1 overflow-auto', isPending && 'opacity-60')}>
        {initialContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
            <UserCircle2 className="h-12 w-12 opacity-30" />
            <p>Nenhum contato encontrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Telefone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Status</th>
              </tr>
            </thead>
            <tbody>
              {initialContacts.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => router.push(`/contacts/${contact.id}`)}
                  className="border-b hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-primary uppercase">
                          {(contact.name || contact.phone || '?')[0]}
                        </span>
                      </div>
                      <span className="font-medium">
                        {getContactDisplayName(contact.name, contact.phone)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {contact.phone || '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {contact.email || '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {(contact as any).is_muted ? (
                      <Badge variant="secondary">Silenciado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-600">Ativo</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-card flex-shrink-0">
          <span className="text-sm text-muted-foreground">
            Página {initialPage} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={initialPage <= 1 || isPending}
              onClick={() => navigate(initialPage - 1, search)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={initialPage >= totalPages || isPending}
              onClick={() => navigate(initialPage + 1, search)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

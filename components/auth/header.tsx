'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { LogOut } from 'lucide-react';
import { logout } from '@/app/actions/auth';

interface HeaderProps {
  userName: string;
  userEmail?: string;
  avatarUrl?: string;
}

export function Header({ userName, userEmail, avatarUrl }: HeaderProps) {
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <h1 className="text-xl font-bold">
            LIVIA
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={userName} />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-sm">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {userName}
              </p>
              {userEmail && (
                <p className="text-xs text-zinc-500 dark:text-zinc-500">
                  {userEmail}
                </p>
              )}
            </div>
          </div>

          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}

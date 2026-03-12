'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Copy, Check, LogOut, Users, Rocket } from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { toast } from 'sonner';

interface WaitingAccessContentProps {
  fullName: string;
  email: string;
  inviteCode: string | null;
}

export function WaitingAccessContent({
  fullName,
  email,
  inviteCode,
}: WaitingAccessContentProps) {
  const [isCopied, setIsCopied] = useState(false);
  const router = useRouter();

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setIsCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar código.');
    }
  };

  return (
    <div className="w-full max-w-lg space-y-4">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bem-vindo, {fullName.split(' ')[0]}!</h1>
        <p className="text-sm text-muted-foreground">{email}</p>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Como deseja prosseguir?
      </p>

      {/* Opção A: Entrar em um tenant existente */}
      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-base">Entrar em um workspace existente</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Compartilhe seu código com o administrador da empresa
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {inviteCode && (
            <div className="flex items-center justify-between rounded-lg bg-muted/60 px-4 py-3">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">
                  Seu código de acesso
                </p>
                <span className="text-2xl font-mono font-bold tracking-[0.25em] text-foreground">
                  {inviteCode}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyCode}
                className="shrink-0"
              >
                {isCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}
          <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1 pl-1">
            <li>Copie o código acima</li>
            <li>Envie para o administrador da sua empresa</li>
            <li>Aguarde ele associar seu acesso</li>
            <li>Faça login novamente</li>
          </ol>
        </CardContent>
      </Card>

      {/* Opção B: Criar próprio workspace */}
      <Card className="border-zinc-200 dark:border-zinc-800 cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => router.push('/onboarding')}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
              <Rocket className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">Criar meu próprio workspace</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Configure seu ambiente com IA em poucos minutos
              </CardDescription>
            </div>
            <Button size="sm" className="shrink-0">
              Começar
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="pt-1">
        <form action={logout} className="w-full">
          <Button type="submit" variant="ghost" className="w-full gap-2 text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
            Sair da conta
          </Button>
        </form>
      </div>
    </div>
  );
}

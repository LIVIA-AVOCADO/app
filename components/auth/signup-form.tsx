'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 8,        label: 'Ao menos 8 caracteres' },
  { test: (p: string) => /[A-Z]/.test(p),      label: 'Ao menos uma letra maiúscula' },
  { test: (p: string) => /[0-9]/.test(p),      label: 'Ao menos um número' },
  { test: (p: string) => /^[A-Za-z0-9]+$/.test(p), label: 'Apenas letras e números' },
];

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const passwordValid = PASSWORD_RULES.every((r) => r.test(password));
  const passwordsMatch = password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passwordValid) {
      setError('A senha não atende aos requisitos.');
      return;
    }
    if (!passwordsMatch) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ full_name: fullName, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Erro ao criar conta.');
        return;
      }

      // Redireciona para login para que o usuário autentique
      // Após login vai para /aguardando-acesso onde verá seu invite_code
      router.push('/login?cadastro=ok');
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-zinc-200 dark:border-zinc-800">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>
          Após criar sua conta, você receberá um código para compartilhar com o administrador do seu workspace
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="full_name"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Nome completo
            </label>
            <Input
              id="full_name"
              type="text"
              placeholder="Seu nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Senha
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordTouched(true); }}
              disabled={isLoading}
              required
              autoComplete="new-password"
            />
            {passwordTouched && (
              <ul className="space-y-1 pt-1">
                {PASSWORD_RULES.map((rule) => (
                  <li
                    key={rule.label}
                    className={`flex items-center gap-1.5 text-xs ${
                      rule.test(password)
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    <span>{rule.test(password) ? '✓' : '○'}</span>
                    {rule.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirm_password"
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Confirmar senha
            </label>
            <Input
              id="confirm_password"
              type="password"
              placeholder="Repita a senha"
              value={confirmPassword}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="new-password"
            />
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-red-500">As senhas não coincidem.</p>
            )}
          </div>
        </CardContent>

        <CardFooter className="mt-4 flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Criando conta...' : 'Criar conta'}
          </Button>

          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            Já tem conta?{' '}
            <a
              href="/login"
              className="font-medium text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300"
            >
              Entrar
            </a>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

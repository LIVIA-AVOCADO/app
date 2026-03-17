'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';

export default function AceitarTermosPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!accepted) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/accept-terms', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(`Erro: ${JSON.stringify(data)}`);
        return;
      }
      router.push('/livechat');
      router.refresh();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-black flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="LIVIA" width={160} height={43} className="object-contain" priority />
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            Termos atualizados
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
            Para continuar usando a LIVIA, precisamos que você leia e aceite nossos Termos de Serviço e Política de Privacidade.
          </p>

          {/* Resumo */}
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-5 space-y-3 text-sm text-zinc-600 dark:text-zinc-400 mb-6">
            <div className="flex gap-3">
              <span className="text-lg leading-none">🔒</span>
              <p>Seus dados são protegidos com criptografia e armazenados com segurança, em conformidade com a <strong className="text-zinc-800 dark:text-zinc-200">LGPD</strong>.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg leading-none">📋</span>
              <p>Coletamos apenas as informações necessárias para operar a plataforma. Nunca vendemos seus dados a terceiros.</p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg leading-none">✉️</span>
              <p>Você pode solicitar acesso, correção ou exclusão dos seus dados a qualquer momento pelo e-mail <strong className="text-zinc-800 dark:text-zinc-200">privacidade@online24por7.ai</strong>.</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-4 text-sm mb-6">
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline underline-offset-2 font-medium"
            >
              Ler Termos de Serviço ↗
            </a>
            <a
              href="/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline underline-offset-2 font-medium"
            >
              Ler Política de Privacidade ↗
            </a>
          </div>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer mb-6">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              disabled={isLoading}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 accent-zinc-900"
            />
            <span className="text-sm text-zinc-700 dark:text-zinc-300 leading-snug">
              Li e aceito os{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                Termos de Serviço
              </a>{' '}
              e a{' '}
              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                Política de Privacidade
              </a>{' '}
              da LIVIA.
            </span>
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-sm text-red-600 dark:text-red-400 mb-4">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            disabled={!accepted || isLoading}
            onClick={handleAccept}
          >
            {isLoading ? 'Salvando...' : 'Aceitar e continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

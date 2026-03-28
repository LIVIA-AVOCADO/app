'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { Send, Loader2, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CompanyContext {
  name: string;
  niche: string;
  employee_count: string;
  website: string | null;
}

interface OnboardingChatProps {
  sessionId: string;
  userName: string;
  company: CompanyContext;
}

export function OnboardingChat({ sessionId, userName, company }: OnboardingChatProps) {
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [input,       setInput]       = useState('');
  const [isPending,   startTransition] = useTransition();
  const [hasStarted,  setHasStarted]  = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  // Scroll automático
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || isPending) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    startTransition(async () => {
      try {
        const res = await fetch('/api/onboarding/chat', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            sessionId,
            message:  text.trim(),
            userName,
            company,
          }),
        });

        const data = await res.json();
        const reply = res.ok
          ? (data.reply || 'Entendi! Pode continuar.')
          : (data.error || 'Ocorreu um erro. Tente novamente.');

        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } catch {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Erro de conexão. Tente novamente.' },
        ]);
      }

      setTimeout(() => inputRef.current?.focus(), 50);
    });
  }

  function handleStart() {
    setHasStarted(true);
    sendMessage(`Olá! Meu nome é ${userName} e minha empresa é ${company.name}.`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4 shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100">
          <Bot className="h-5 w-5 text-white dark:text-zinc-900" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Lívia</p>
          <p className="text-xs text-zinc-400">Assistente de configuração</p>
        </div>
        <div className="ml-auto">
          <Image src="/logo.png" alt="LIVIA" width={80} height={22} className="object-contain opacity-60" />
        </div>
      </div>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

        {!hasStarted && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-5 pb-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900 dark:bg-zinc-100">
              <Bot className="h-8 w-8 text-white dark:text-zinc-900" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Olá, {userName}!
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                Sou a Lívia e vou te ajudar a configurar o workspace de{' '}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{company.name}</span>.
                <br />Vai levar só alguns minutos.
              </p>
            </div>
            <Button size="lg" onClick={handleStart}>
              Começar configuração
            </Button>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100">
                <Bot className="h-3.5 w-3.5 text-white dark:text-zinc-900" />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-br-sm'
                  : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-100 dark:border-zinc-700 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isPending && (
          <div className="flex justify-start">
            <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100">
              <Bot className="h-3.5 w-3.5 text-white dark:text-zinc-900" />
            </div>
            <div className="rounded-2xl rounded-bl-sm bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {hasStarted && (
        <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua resposta..."
              disabled={isPending}
              className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-400/20 disabled:opacity-50"
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isPending}
              className="h-10 w-10 shrink-0 rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[10px] text-zinc-400">
            Pressione Enter para enviar
          </p>
        </div>
      )}
    </div>
  );
}

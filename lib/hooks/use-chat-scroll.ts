'use client';

/**
 * Hook: useChatScroll
 *
 * Gerencia comportamento de scroll inteligente para chat:
 * - Auto-scroll apenas se usuário está no final
 * - Detecta quando usuário rola para cima
 * - Conta novas mensagens não lidas
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseChatScrollOptions {
  /** Threshold em pixels para considerar "no final" */
  threshold?: number;
  /** Comportamento do scroll (auto, smooth, instant) */
  behavior?: ScrollBehavior;
  /** Chamado quando o usuário scrolla perto do topo (para carregar mensagens antigas). */
  onNearTop?: () => void;
  /** Pixels do topo para disparar onNearTop (padrão: 80) */
  topThreshold?: number;
  /** Ref externo: quando true, mensagens foram prependadas (não conta como não-lidas). */
  isPrependingRef?: React.RefObject<boolean>;
  /** Ref externo do elemento de scroll; se fornecido, usa este em vez de criar um novo. */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

export function useChatScroll<T>(
  messages: T[],
  options: UseChatScrollOptions = {}
) {
  const { threshold = 150, behavior = 'smooth', onNearTop, topThreshold = 80, isPrependingRef, scrollRef: externalScrollRef } = options;
  const onNearTopRef = useRef(onNearTop);
  useEffect(() => { onNearTopRef.current = onNearTop; }, [onNearTop]);

  const internalScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = externalScrollRef ?? internalScrollRef;
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const previousMessageCount = useRef(messages.length);

  // Rola para o final
  const scrollToBottom = useCallback((instantScroll = false) => {
    if (!scrollRef.current) {
      return;
    }

    const { scrollHeight } = scrollRef.current;

    scrollRef.current.scrollTo({
      top: scrollHeight,
      behavior: instantScroll ? 'instant' : behavior,
    });

    setUnreadCount(0);
    // scrollRef é estável (useRef) — não precisa nas deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [behavior]);

  // Adiciona listener de scroll
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const atBottom = distanceFromBottom < threshold;

      setIsAtBottom(atBottom);

      if (atBottom) {
        setUnreadCount(0);
      }

      if (scrollTop < topThreshold) {
        onNearTopRef.current?.();
      }
    };

    element.addEventListener('scroll', handleScroll);

    // Verifica estado inicial
    handleScroll();

    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
    // scrollRef e topThreshold são estáveis entre renders — omitidos intencionalmente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threshold]);

  // Auto-scroll quando novas mensagens chegam ou conversa muda
  useEffect(() => {
    const newMessageCount = messages.length - previousMessageCount.current;

    // Se a contagem de mensagens diminuiu, é uma nova conversa
    if (newMessageCount < 0) {
      // Nova conversa - reseta e faz scroll ao final
      // Aguarda próximo frame para garantir DOM atualizado e evitar cascading renders
      setTimeout(() => {
        setUnreadCount(0);
        setIsAtBottom(true);
        scrollToBottom(true);
      }, 0);
    } else if (newMessageCount > 0) {
      // Mensagens prependadas (carregamento de histórico): não contabiliza como não-lidas
      if (isPrependingRef?.current) {
        previousMessageCount.current = messages.length;
        return;
      }
      // Novas mensagens na conversa atual
      if (isAtBottom) {
        // Se está no final, faz scroll automático após renderização
        setTimeout(() => {
          scrollToBottom();
        }, 100); // 100ms para garantir que DOM renderizou
      } else {
        // Se não está no final, incrementa contador
        setUnreadCount((prev) => prev + newMessageCount);
      }
    }

    previousMessageCount.current = messages.length;
  }, [messages.length, isAtBottom, scrollToBottom, isPrependingRef]);

  // Scroll inicial ao montar (sem animação)
  useEffect(() => {
    // Aguarda renderização completa - múltiplas tentativas para garantir
    let attempts = 0;
    const maxAttempts = 5;

    const tryScroll = () => {
      attempts++;

      if (scrollRef.current && scrollRef.current.scrollHeight > 0) {
        scrollToBottom(true);
      } else if (attempts < maxAttempts) {
        setTimeout(tryScroll, 50);
      }
    };

    const timer = setTimeout(tryScroll, 100);
    return () => clearTimeout(timer);
    // scrollRef é estável (useRef) — não precisa nas deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToBottom]);

  return {
    scrollRef,
    isAtBottom,
    unreadCount,
    scrollToBottom,
  };
}

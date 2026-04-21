import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CRMConversationCard } from '../crm-conversation-card';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/utils/contact-list', () => ({
  formatMessagePreview: (content: string, _max: number) => content,
}));

vi.mock('@/components/ui/relative-time', () => ({
  RelativeTime: ({ timestamp }: { timestamp: string }) => <span>{timestamp}</span>,
}));

vi.mock('@/lib/utils/contact-helpers', () => ({
  getContactDisplayName: (name: string | null, phone: string) => name || phone,
}));

function buildConversation(overrides = {}) {
  return {
    id: 'conv-1',
    status: 'open' as const,
    ia_active: true,
    created_at: '2026-01-01T10:00:00Z',
    last_message_at: '2026-01-01T11:00:00Z',
    contact: { name: 'João Silva', phone: '+5511999990000' },
    lastMessage: { content: 'Olá!' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CRMConversationCard', () => {
  describe('renderização', () => {
    it('exibe nome do contato', () => {
      render(<CRMConversationCard conversation={buildConversation() as any} />);
      expect(screen.getByText('João Silva')).toBeDefined();
    });

    it('usa telefone como fallback quando nome é null', () => {
      render(<CRMConversationCard conversation={buildConversation({ contact: { name: null, phone: '+5511999990000' } }) as any} />);
      expect(screen.getByText('+5511999990000')).toBeDefined();
    });

    it('exibe preview da última mensagem', () => {
      render(<CRMConversationCard conversation={buildConversation() as any} />);
      expect(screen.getByText('Olá!')).toBeDefined();
    });

    it('exibe "Sem mensagens" quando não há lastMessage', () => {
      render(<CRMConversationCard conversation={buildConversation({ lastMessage: null }) as any} />);
      expect(screen.getByText('Sem mensagens')).toBeDefined();
    });
  });

  describe('getStatusConfig', () => {
    it('exibe "IA Ativa" quando status=open e ia_active=true', () => {
      render(<CRMConversationCard conversation={buildConversation({ status: 'open', ia_active: true }) as any} />);
      expect(screen.getByText('IA Ativa')).toBeDefined();
    });

    it('exibe "Modo Manual" quando status=open e ia_active=false', () => {
      render(<CRMConversationCard conversation={buildConversation({ status: 'open', ia_active: false }) as any} />);
      expect(screen.getByText('Modo Manual')).toBeDefined();
    });

    it('exibe "Encerrada" quando status=closed', () => {
      render(<CRMConversationCard conversation={buildConversation({ status: 'closed', ia_active: true }) as any} />);
      expect(screen.getByText('Encerrada')).toBeDefined();
    });
  });

  describe('navegação', () => {
    it('navega para /livechat?conversation=<id> ao clicar', () => {
      render(<CRMConversationCard conversation={buildConversation({ id: 'conv-abc' }) as any} />);
      fireEvent.click(screen.getByText('João Silva'));
      expect(mockPush).toHaveBeenCalledWith('/inbox?conversation=conv-abc');
    });
  });
});

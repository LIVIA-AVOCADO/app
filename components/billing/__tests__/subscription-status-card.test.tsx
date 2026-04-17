import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SubscriptionStatusCard } from '../subscription-status-card';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const defaultProps = {
  status: 'active' as const,
  periodEnd: '2026-05-01T00:00:00Z',
  cancelAtPeriodEnd: false,
  subscriptionProvider: 'stripe' as const,
  hasStripeSubscription: true,
  isLoading: false,
  onSubscribe: vi.fn(),
  onPixSubscribe: vi.fn(),
  onSwitchToPix: vi.fn(),
  onRevertToStripe: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SubscriptionStatusCard', () => {
  describe('getStatusBadge', () => {
    it('mostra "Ativa" para status=active', () => {
      render(<SubscriptionStatusCard {...defaultProps} />);
      expect(screen.getByText('Ativa')).toBeDefined();
    });

    it('mostra "Período de teste" para status=trialing', () => {
      render(<SubscriptionStatusCard {...defaultProps} status="trialing" />);
      expect(screen.getByText('Período de teste')).toBeDefined();
    });

    it('mostra "Pagamento pendente" para status=past_due', () => {
      render(<SubscriptionStatusCard {...defaultProps} status="past_due" />);
      expect(screen.getByText('Pagamento pendente')).toBeDefined();
    });

    it('mostra "Cancelada" para status=canceled', () => {
      render(<SubscriptionStatusCard {...defaultProps} status="canceled" />);
      expect(screen.getByText('Cancelada')).toBeDefined();
    });

    it('mostra "Inativa" para status desconhecido', () => {
      render(<SubscriptionStatusCard {...defaultProps} status={'inactive' as any} />);
      expect(screen.getByText('Inativa')).toBeDefined();
    });
  });

  describe('skeleton de loading', () => {
    it('exibe skeleton quando isLoading=true', () => {
      const { container } = render(<SubscriptionStatusCard {...defaultProps} isLoading />);
      // Skeleton substitui o badge e os botões
      const skeletons = container.querySelectorAll('[class*="animate-pulse"], [data-testid="skeleton"]');
      // Verifica que os botões de ação não aparecem
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('estado Stripe ativo (isStripeActive)', () => {
    it('mostra botão "Pagar próximo mês com PIX"', () => {
      render(<SubscriptionStatusCard {...defaultProps} />);
      expect(screen.getByText('Pagar próximo mês com PIX')).toBeDefined();
    });

    it('mostra "Gerenciar Assinatura"', () => {
      render(<SubscriptionStatusCard {...defaultProps} />);
      expect(screen.getByText('Gerenciar Assinatura')).toBeDefined();
    });

    it('chama onSwitchToPix ao clicar em "Pagar próximo mês com PIX"', () => {
      render(<SubscriptionStatusCard {...defaultProps} />);
      fireEvent.click(screen.getByText('Pagar próximo mês com PIX'));
      expect(defaultProps.onSwitchToPix).toHaveBeenCalledOnce();
    });
  });

  describe('estado PIX pendente (isPixPending)', () => {
    const pixPendingProps = {
      ...defaultProps,
      subscriptionProvider: 'pix_manual' as const,
      cancelAtPeriodEnd: true,
    };

    it('mostra "Gerar novo PIX"', () => {
      render(<SubscriptionStatusCard {...pixPendingProps} />);
      expect(screen.getByText('Gerar novo PIX')).toBeDefined();
    });

    it('mostra "Manter cobrança no cartão"', () => {
      render(<SubscriptionStatusCard {...pixPendingProps} />);
      expect(screen.getByText('Manter cobrança no cartão')).toBeDefined();
    });

    it('chama onPixSubscribe ao clicar em "Gerar novo PIX"', () => {
      render(<SubscriptionStatusCard {...pixPendingProps} />);
      fireEvent.click(screen.getByText('Gerar novo PIX'));
      expect(defaultProps.onPixSubscribe).toHaveBeenCalledOnce();
    });

    it('abre dialog de confirmação ao clicar em "Manter cobrança no cartão"', () => {
      render(<SubscriptionStatusCard {...pixPendingProps} />);
      fireEvent.click(screen.getByText('Manter cobrança no cartão'));
      expect(screen.getByText('Manter cobrança no cartão?')).toBeDefined();
    });

    it('chama onRevertToStripe após confirmar no dialog', async () => {
      render(<SubscriptionStatusCard {...pixPendingProps} />);
      fireEvent.click(screen.getByText('Manter cobrança no cartão'));
      fireEvent.click(screen.getByText('Confirmar'));
      await waitFor(() => {
        expect(defaultProps.onRevertToStripe).toHaveBeenCalledOnce();
      });
    });

    it('NÃO chama onRevertToStripe ao cancelar no dialog', () => {
      render(<SubscriptionStatusCard {...pixPendingProps} />);
      fireEvent.click(screen.getByText('Manter cobrança no cartão'));
      fireEvent.click(screen.getByText('Cancelar'));
      expect(defaultProps.onRevertToStripe).not.toHaveBeenCalled();
    });
  });

  describe('estado cancelado/inativo', () => {
    it('mostra "Assinar com Cartão" quando status=canceled', () => {
      render(<SubscriptionStatusCard {...defaultProps} status="canceled" />);
      expect(screen.getByText('Assinar com Cartão')).toBeDefined();
    });

    it('mostra "Assinar com PIX" quando status=canceled', () => {
      render(<SubscriptionStatusCard {...defaultProps} status="canceled" />);
      expect(screen.getByText('Assinar com PIX')).toBeDefined();
    });

    it('chama onSubscribe ao clicar em "Assinar com Cartão"', () => {
      render(<SubscriptionStatusCard {...defaultProps} status="canceled" />);
      fireEvent.click(screen.getByText('Assinar com Cartão'));
      expect(defaultProps.onSubscribe).toHaveBeenCalledOnce();
    });

    it('chama onPixSubscribe ao clicar em "Assinar com PIX"', () => {
      render(<SubscriptionStatusCard {...defaultProps} status="canceled" />);
      fireEvent.click(screen.getByText('Assinar com PIX'));
      expect(defaultProps.onPixSubscribe).toHaveBeenCalledOnce();
    });
  });
});

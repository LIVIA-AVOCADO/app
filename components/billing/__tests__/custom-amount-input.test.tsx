import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomAmountInput } from '../custom-amount-input';

const defaultProps = {
  onSubmit: vi.fn(),
  onPixSubmit: vi.fn(),
  isLoading: false,
  isPixLoading: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CustomAmountInput', () => {
  describe('rendering', () => {
    it('renderiza input com placeholder 0,00', () => {
      render(<CustomAmountInput {...defaultProps} />);
      expect(screen.getByPlaceholderText('0,00')).toBeDefined();
    });

    it('botões desabilitados quando amountCents === 0', () => {
      render(<CustomAmountInput {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((btn) => expect(btn).toHaveProperty('disabled', true));
    });

    it('não mostra preview de créditos quando valor é 0', () => {
      render(<CustomAmountInput {...defaultProps} />);
      expect(screen.queryByText(/créditos/)).toBeNull();
    });
  });

  describe('formatação do input', () => {
    it('formata 500 → 5,00', async () => {
      render(<CustomAmountInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0,00');
      await userEvent.type(input, '500');
      expect((input as HTMLInputElement).value).toBe('5,00');
    });

    it('formata 150000 → 1.500,00', async () => {
      render(<CustomAmountInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0,00');
      await userEvent.type(input, '150000');
      expect((input as HTMLInputElement).value).toBe('1.500,00');
    });

    it('ignora caracteres não numéricos', async () => {
      render(<CustomAmountInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0,00');
      await userEvent.type(input, 'abc1000');
      expect((input as HTMLInputElement).value).toBe('10,00');
    });
  });

  describe('preview de créditos', () => {
    it('mostra preview quando amountCents > 0', async () => {
      render(<CustomAmountInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0,00');
      await userEvent.type(input, '1000');
      expect(screen.getByText(/créditos/)).toBeDefined();
    });

    it('habilita botões quando amountCents > 0', async () => {
      render(<CustomAmountInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0,00');
      await userEvent.type(input, '1000');
      const buttons = screen.getAllByRole('button');
      buttons.forEach((btn) => expect(btn).toHaveProperty('disabled', false));
    });
  });

  describe('validação', () => {
    it('mostra erro quando valor < R$5', async () => {
      render(<CustomAmountInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0,00');
      await userEvent.type(input, '400'); // R$ 4,00
      fireEvent.click(screen.getByText('Pagar com Cartão'));
      expect(screen.getByText(/Valor mínimo/)).toBeDefined();
    });

    it('mostra erro quando valor > R$3000', async () => {
      render(<CustomAmountInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0,00');
      await userEvent.type(input, '300001'); // R$ 3.000,01
      fireEvent.click(screen.getByText('Pagar com PIX'));
      expect(screen.getByText(/Valor máximo/)).toBeDefined();
    });

    it('não chama onSubmit quando valor inválido', async () => {
      render(<CustomAmountInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0,00');
      await userEvent.type(input, '400'); // R$ 4,00
      fireEvent.click(screen.getByText('Pagar com Cartão'));
      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });

    it('não chama onPixSubmit quando valor inválido', async () => {
      render(<CustomAmountInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0,00');
      await userEvent.type(input, '400'); // R$ 4,00
      fireEvent.click(screen.getByText('Pagar com PIX'));
      expect(defaultProps.onPixSubmit).not.toHaveBeenCalled();
    });
  });

  describe('callbacks', () => {
    it('chama onSubmit com amountCents correto', async () => {
      render(<CustomAmountInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0,00');
      await userEvent.type(input, '50000'); // R$ 500,00 = 50000 centavos
      fireEvent.click(screen.getByText('Pagar com Cartão'));
      expect(defaultProps.onSubmit).toHaveBeenCalledWith(50000);
    });

    it('chama onPixSubmit com amountCents correto', async () => {
      render(<CustomAmountInput {...defaultProps} />);
      const input = screen.getByPlaceholderText('0,00');
      await userEvent.type(input, '50000'); // R$ 500,00
      fireEvent.click(screen.getByText('Pagar com PIX'));
      expect(defaultProps.onPixSubmit).toHaveBeenCalledWith(50000);
    });
  });

  describe('estados de loading', () => {
    it('desabilita botões quando isLoading=true', () => {
      render(<CustomAmountInput {...defaultProps} isLoading />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((btn) => expect(btn).toHaveProperty('disabled', true));
    });

    it('desabilita botões quando isPixLoading=true', () => {
      render(<CustomAmountInput {...defaultProps} isPixLoading />);
      const buttons = screen.getAllByRole('button');
      buttons.forEach((btn) => expect(btn).toHaveProperty('disabled', true));
    });
  });
});

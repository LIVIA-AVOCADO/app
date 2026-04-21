import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { StatusSelect } from '../status-select';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix UI Select usa pointer events não suportados pelo jsdom.
// Mock com <select> nativo para testar a lógica sem depender da UI do Radix.
vi.mock('@/components/ui/select', () => ({
  Select: ({ children, value, onValueChange, disabled }: any) => (
    <div>
      {/* <select> nativo com opções hardcoded — valor controlado por prop */}
      <select
        data-testid="status-select"
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange?.(e.target.value)}
      >
        <option value="open" />
        <option value="closed" />
      </select>
      {/* Renderiza children para exibir o badge (SelectTrigger > SelectValue) */}
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <>{children}</>,
  SelectValue: ({ children }: any) => <>{children}</>,
  SelectContent: () => null,
  SelectItem: () => null,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const defaultProps = {
  conversationId: 'conv-1',
  tenantId: 'tenant-1',
  currentStatus: 'open' as const,
  onStatusChange: vi.fn(),
};

function mockFetchSuccess() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  });
}

function mockFetchError(message = 'Erro no servidor') {
  mockFetch.mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({ error: message }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StatusSelect', () => {
  describe('renderização', () => {
    it('renderiza o select com status atual (open)', () => {
      render(<StatusSelect {...defaultProps} />);
      const select = screen.getByTestId('status-select') as HTMLSelectElement;
      expect(select.value).toBe('open');
    });

    it('renderiza com status closed', () => {
      render(<StatusSelect {...defaultProps} currentStatus="closed" />);
      const select = screen.getByTestId('status-select') as HTMLSelectElement;
      expect(select.value).toBe('closed');
    });
  });

  describe('sincronização via props (useEffect)', () => {
    it('atualiza o valor quando currentStatus muda', async () => {
      const { rerender } = render(<StatusSelect {...defaultProps} currentStatus="open" />);
      const select = screen.getByTestId('status-select') as HTMLSelectElement;
      expect(select.value).toBe('open');

      rerender(<StatusSelect {...defaultProps} currentStatus="closed" />);
      await waitFor(() => {
        expect((screen.getByTestId('status-select') as HTMLSelectElement).value).toBe('closed');
      });
    });
  });

  describe('mudança de status', () => {
    it('chama onStatusChange imediatamente (otimista) antes da resposta da API', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {})); // nunca resolve
      render(<StatusSelect {...defaultProps} />);

      const select = screen.getByTestId('status-select');
      fireEvent.change(select, { target: { value: 'closed' } });

      expect(defaultProps.onStatusChange).toHaveBeenCalledWith('closed');
    });

    it('chama fetch com payload correto', async () => {
      mockFetchSuccess();
      render(<StatusSelect {...defaultProps} />);

      const select = screen.getByTestId('status-select');
      fireEvent.change(select, { target: { value: 'closed' } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/conversations/update-status',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"status":"closed"'),
          })
        );
      });
    });

    it('reverte para status anterior quando API falha', async () => {
      mockFetchError('Erro');
      render(<StatusSelect {...defaultProps} currentStatus="open" />);

      const select = screen.getByTestId('status-select');
      fireEvent.change(select, { target: { value: 'closed' } });

      await waitFor(() => {
        // onStatusChange deve ser chamado 2x: 1x com 'closed' (otimista), 1x com 'open' (rollback)
        expect(defaultProps.onStatusChange).toHaveBeenCalledTimes(2);
        expect(defaultProps.onStatusChange).toHaveBeenLastCalledWith('open');
      });
    });

    it('NÃO chama fetch quando novo status === currentStatus', () => {
      render(<StatusSelect {...defaultProps} currentStatus="open" />);

      const select = screen.getByTestId('status-select');
      fireEvent.change(select, { target: { value: 'open' } }); // mesmo status

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('estado disabled', () => {
    it('select fica desabilitado quando disabled=true', () => {
      render(<StatusSelect {...defaultProps} disabled />);
      const select = screen.getByTestId('status-select');
      expect(select).toHaveProperty('disabled', true);
    });
  });
});

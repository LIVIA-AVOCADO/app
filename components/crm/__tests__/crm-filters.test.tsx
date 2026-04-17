import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CRMFilters } from '../crm-filters';
import type { CRMFiltersProps } from '@/types/crm';

const defaultProps: CRMFiltersProps = {
  currentFilter: 'all',
  onFilterChange: vi.fn(),
  statusCounts: { open: 3, paused: 2, closed: 1, all: 6 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CRMFilters', () => {
  it('renderiza os 4 badges de filtro', () => {
    render(<CRMFilters {...defaultProps} />);
    expect(screen.getByText(/IA/)).toBeDefined();
    expect(screen.getByText(/Modo Manual/)).toBeDefined();
    expect(screen.getByText(/Encerradas/)).toBeDefined();
    expect(screen.getByText(/Todas/)).toBeDefined();
  });

  it('exibe contadores corretos nos badges', () => {
    render(<CRMFilters {...defaultProps} />);
    expect(screen.getByText('IA (3)')).toBeDefined();
    expect(screen.getByText('Modo Manual (2)')).toBeDefined();
    expect(screen.getByText('Encerradas (1)')).toBeDefined();
    expect(screen.getByText('Todas (6)')).toBeDefined();
  });

  it('chama onFilterChange("ia") ao clicar no badge IA', () => {
    render(<CRMFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('IA (3)'));
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('ia');
  });

  it('chama onFilterChange("manual") ao clicar em Modo Manual', () => {
    render(<CRMFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('Modo Manual (2)'));
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('manual');
  });

  it('chama onFilterChange("closed") ao clicar em Encerradas', () => {
    render(<CRMFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('Encerradas (1)'));
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('closed');
  });

  it('chama onFilterChange("all") ao clicar em Todas', () => {
    render(<CRMFilters {...defaultProps} />);
    fireEvent.click(screen.getByText('Todas (6)'));
    expect(defaultProps.onFilterChange).toHaveBeenCalledWith('all');
  });

  it('renderiza sem erros para cada valor de filtro ativo', () => {
    const filters = ['ia', 'manual', 'closed', 'all'] as const;
    filters.forEach((filter) => {
      const { unmount } = render(<CRMFilters {...defaultProps} currentFilter={filter} />);
      expect(screen.getByText('IA (3)')).toBeDefined();
      unmount();
    });
  });
});

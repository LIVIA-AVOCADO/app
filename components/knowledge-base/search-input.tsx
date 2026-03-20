'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchInputProps {
  onSearch: (searchTerm: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

/**
 * Componente de busca com debounce
 *
 * Features:
 * - Debounce de 300ms
 * - Ícone de busca
 * - Botão para limpar
 * - Estado de loading
 */
export function SearchInput({
  onSearch,
  isLoading = false,
  placeholder = 'Buscar por nome ou conteúdo...',
}: SearchInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [inputValue]);

  // Trigger search when debounced value changes
  useEffect(() => {
    onSearch(debouncedValue);
  }, [debouncedValue, onSearch]);

  const handleClear = useCallback(() => {
    setInputValue('');
    setDebouncedValue('');
  }, []);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
        <Input
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="pl-10 pr-20"
          aria-label="Buscar bases de conhecimento"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {inputValue && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClear}
              title="Limpar busca"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {debouncedValue && debouncedValue.length < 2 && debouncedValue.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          Digite pelo menos 2 caracteres para buscar
        </p>
      )}
    </div>
  );
}










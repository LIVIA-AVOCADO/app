'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createBaseConhecimentoAction,
  updateBaseConhecimentoAction,
} from '@/app/actions/base-conhecimento';
import type { BaseConhecimento, KnowledgeDomain } from '@/types/knowledge-base';

interface BaseConhecimentoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  neurocoreId: string;
  domains: KnowledgeDomain[];
  selectedDomainId?: string | null;
  base?: BaseConhecimento; // Se fornecido, está editando
  onSuccess: () => void;
}

/**
 * Dialog para criar ou editar base de conhecimento
 *
 * Features:
 * - Modo criar/editar
 * - Select de domínio
 * - Campo nome (mín 3 chars)
 * - Campo conteúdo (textarea grande, obrigatório)
 * - Validação completa
 */
export function BaseConhecimentoFormDialog({
  open,
  onOpenChange,
  tenantId,
  neurocoreId,
  domains,
  selectedDomainId,
  base,
  onSuccess,
}: BaseConhecimentoFormDialogProps) {
  const isEditing = !!base;

  const [name, setName] = useState(base?.name || '');
  const [description, setDescription] = useState(base?.description || '');
  const [domainId, setDomainId] = useState(
    base?.domain || selectedDomainId || (domains.length > 0 ? domains[0]?.id : '') || ''
  );
  const [isLoading, setIsLoading] = useState(false);

  // Reset form quando dialog abre/fecha ou base muda
  useEffect(() => {
    if (open) {
      setName(base?.name || '');
      setDescription(base?.description || '');
      setDomainId(
        base?.domain || selectedDomainId || (domains.length > 0 ? domains[0]?.id : '') || ''
      );
    }
  }, [open, base, selectedDomainId, domains]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (name.trim().length < 3) {
      toast.error('Nome deve ter no mínimo 3 caracteres');
      return;
    }

    if (!description.trim()) {
      toast.error('Conteúdo é obrigatório');
      return;
    }

    if (description.trim().length < 10) {
      toast.error('Conteúdo deve ter no mínimo 10 caracteres');
      return;
    }

    if (!domainId) {
      toast.error('Selecione um domínio');
      return;
    }

    setIsLoading(true);

    try {
      const result = isEditing
        ? await updateBaseConhecimentoAction(base!.id, tenantId, {
            name: name.trim(),
            description: description.trim(),
            domain: domainId,
          })
        : await createBaseConhecimentoAction(tenantId, neurocoreId, {
            name: name.trim(),
            description: description.trim(),
            domain: domainId,
          });

      if (result.success) {
        toast.success(
          isEditing
            ? 'Base atualizada! O vetor será reprocessado.'
            : 'Base criada! Aguarde o processamento do vetor.'
        );
        onOpenChange(false);
        onSuccess();

        // Limpar form se for criação
        if (!isEditing) {
          setName('');
          setDescription('');
          setDomainId(selectedDomainId || (domains.length > 0 ? domains[0]?.id : '') || '');
        }
      } else {
        toast.error(result.error || 'Erro ao salvar base de conhecimento');
      }
    } catch (_error) {
      toast.error('Erro inesperado ao salvar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Base de Conhecimento' : 'Nova Base de Conhecimento'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações da base. O vetor será reprocessado automaticamente.'
              : 'Crie uma nova base de conhecimento. O conteúdo será vetorizado automaticamente.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="Ex: Perguntas Frequentes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              required
              minLength={3}
            />
            <p className="text-xs text-muted-foreground">
              Título descritivo para identificar esta base
            </p>
          </div>

          {/* Domínio */}
          <div className="space-y-2">
            <Label htmlFor="domain">
              Domínio <span className="text-destructive">*</span>
            </Label>
            <Select value={domainId} onValueChange={setDomainId} disabled={isLoading}>
              <SelectTrigger id="domain">
                <SelectValue placeholder="Selecione um domínio" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((domain) => (
                  <SelectItem key={domain.id} value={domain.id}>
                    {domain.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Categoria que agrupa bases relacionadas (ex: FAQ, Políticas)
            </p>
          </div>

          {/* Conteúdo */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Conteúdo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Escreva o conteúdo completo da base de conhecimento aqui...

Exemplo:
Perguntas Frequentes:

1. Qual o prazo de entrega?
Nossos pedidos são entregues em até 5 dias úteis após a confirmação do pagamento.

2. Quais formas de pagamento são aceitas?
Aceitamos cartão de crédito, débito, boleto bancário e Pix.

3. Como solicitar suporte?
Entre em contato pelo WhatsApp ou e-mail informados no site. Atendemos de segunda a sexta, das 08h às 18h."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              rows={12}
              className="resize-y font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Este conteúdo será vetorizado e usado pela IA para responder perguntas
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar Alterações' : 'Criar Base'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

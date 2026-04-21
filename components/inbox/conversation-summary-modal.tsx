'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { createClient } from '@/lib/supabase/client';
import { Loader2, FileText, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const FIELD_LABELS: Record<string, string> = {
  nome_completo: 'Nome Completo',
  nome: 'Nome',
  cpf: 'CPF',
  rg: 'RG',
  email: 'E-mail',
  telefone: 'Telefone',
  telefone_secundario: 'Telefone Secundário',
  endereco: 'Endereço',
  endereco_completo: 'Endereço Completo',
  logradouro: 'Logradouro',
  numero: 'Número',
  complemento: 'Complemento',
  bairro: 'Bairro',
  cidade: 'Cidade',
  estado: 'Estado',
  uf: 'UF',
  cep: 'CEP',
  pais: 'País',
  ultima_atualizacao: 'Última Atualização',
  ultimo_agente_ativo: 'Último Agente Ativo',
  resumo_acumulado: 'Resumo Acumulado',
  pendencias_abertas: 'Pendências Abertas',
  fase_concluida: 'Fase Concluída',
  data_nascimento: 'Data de Nascimento',
  profissao: 'Profissão',
  empresa: 'Empresa',
  cargo: 'Cargo',
  interesse: 'Interesse',
  interesses: 'Interesses',
  preferencias: 'Preferências',
  observacoes: 'Observações',
  motivo_contato: 'Motivo do Contato',
  produto_interesse: 'Produto de Interesse',
  valor_estimado: 'Valor Estimado',
  prazo: 'Prazo',
  forma_pagamento: 'Forma de Pagamento',
  status_negociacao: 'Status da Negociação',
  proximos_passos: 'Próximos Passos',
  historico_resumido: 'Histórico Resumido',
  sentimento: 'Sentimento',
  tom_conversa: 'Tom da Conversa',
  nivel_urgencia: 'Nível de Urgência',
  canal_preferido: 'Canal Preferido',
};

const SECTION_LABELS: Record<string, string> = {
  metadados: 'Informações Gerais',
  memoria_conversacional: 'Memória Conversacional',
  dados_pessoais: 'Dados Pessoais',
  dados_contato: 'Dados de Contato',
  dados_endereco: 'Endereço',
  dados_profissionais: 'Dados Profissionais',
  negociacao: 'Negociação',
  preferencias: 'Preferências',
  historico: 'Histórico',
};

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as object).length === 0
  )
    return true;
  return false;
}

function isDateString(value: string): boolean {
  if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/.test(value)) {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }
  return false;
}

function formatDateValue(value: string): string {
  const date = new Date(value);
  if (value.includes('T') || value.includes(':')) {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString('pt-BR');
}

function sectionHasVisibleData(content: Record<string, unknown>): boolean {
  return Object.entries(content).some(
    ([key, value]) => key !== 'fase_concluida' && !isEmptyValue(value)
  );
}

interface ConversationSummaryModalProps {
  contactId: string;
  conversationId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ExtractedData {
  metadados?: {
    ultima_atualizacao?: string;
    ultimo_agente_ativo?: string;
  };
  memoria_conversacional?: {
    resumo_acumulado?: string;
    pendencias_abertas?: string[];
  };
  [key: string]: unknown;
}

export function ConversationSummaryModal({
  contactId,
  conversationId,
  isOpen,
  onClose,
}: ConversationSummaryModalProps) {
  const [data, setData] = useState<ExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isContactIdCopied, setIsContactIdCopied] = useState(false);
  const [isConversationIdCopied, setIsConversationIdCopied] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && contactId && isMounted) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, contactId, isMounted]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: contact, error } = await supabase
        .from('contacts')
        .select('customer_data_extracted')
        .eq('id', contactId)
        .single();

      if (error) throw error;

      if (contact?.customer_data_extracted) {
        if (typeof contact.customer_data_extracted !== 'object') {
          console.warn(
            'customer_data_extracted is not an object:',
            contact.customer_data_extracted
          );
          setError('Dados em formato inválido.');
          return;
        }

        let extractedData: unknown = contact.customer_data_extracted;

        if (
          extractedData &&
          typeof extractedData === 'object' &&
          !Array.isArray(extractedData)
        ) {
          const objData = extractedData as Record<string, unknown>;
          if (
            'json' in objData &&
            typeof objData.json === 'object' &&
            objData.json !== null
          ) {
            extractedData = objData.json;
          }
        }

        setData(extractedData as ExtractedData);
      } else {
        setData(null);
      }
    } catch (err) {
      console.error('Error fetching conversation summary:', err);
      setError('Erro ao carregar o resumo da conversa.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyContactId = async () => {
    try {
      await navigator.clipboard.writeText(contactId);
      setIsContactIdCopied(true);
      toast.success('contact_id copiado!');
      setTimeout(() => setIsContactIdCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar.');
    }
  };

  const handleCopyConversationId = async () => {
    try {
      await navigator.clipboard.writeText(conversationId);
      setIsConversationIdCopied(true);
      toast.success('conversation_id copiado!');
      setTimeout(() => setIsConversationIdCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar.');
    }
  };

  const formatKey = (key: string): string => {
    const normalized = key.toLowerCase().trim();
    if (FIELD_LABELS[normalized]) return FIELD_LABELS[normalized];
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatSectionTitle = (key: string): string => {
    const normalized = key.toLowerCase().trim();
    if (SECTION_LABELS[normalized]) return SECTION_LABELS[normalized];
    return formatKey(key);
  };

  const formatValueForCopy = (value: unknown, indent = 0): string => {
    if (isEmptyValue(value)) return '';

    const indentation = '  '.repeat(indent);

    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';

    if (typeof value === 'string') {
      if (isDateString(value)) return formatDateValue(value);
      return value;
    }

    if (typeof value === 'number') return String(value);

    if (Array.isArray(value)) {
      const items = value
        .filter((item) => !isEmptyValue(item))
        .map((item) => `${indentation}  - ${formatValueForCopy(item, 0)}`)
        .join('\n');
      return items ? `\n${items}` : '';
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).filter(
        ([, v]) => !isEmptyValue(v)
      );
      if (entries.length === 0) return '';
      return entries
        .map(
          ([k, v]) =>
            `${indentation}${formatKey(k)}: ${formatValueForCopy(v, indent + 1)}`
        )
        .join('\n');
    }

    return String(value);
  };

  const handleCopyToClipboard = async () => {
    if (!data) return;

    try {
      let textContent = '═══════════════════════════════════\n';
      textContent += '     RESUMO DA CONVERSA\n';
      textContent += '═══════════════════════════════════\n\n';

      if (data.metadados && typeof data.metadados === 'object') {
        const entries = Object.entries(data.metadados).filter(
          ([, v]) => !isEmptyValue(v)
        );
        if (entries.length > 0) {
          textContent += `📋 ${formatSectionTitle('metadados').toUpperCase()}\n`;
          textContent += '───────────────────────────────────\n';
          entries.forEach(([key, value]) => {
            textContent += `${formatKey(key)}: ${formatValueForCopy(value)}\n`;
          });
          textContent += '\n';
        }
      }

      const sortedKeys = getSortedKeys(data).filter(
        (key) =>
          key.toLowerCase() !== 'metadados' &&
          key.toLowerCase() !== 'memoria_conversacional'
      );

      sortedKeys.forEach((key) => {
        const content = data[key];
        if (!content || typeof content !== 'object') return;
        const contentObj = content as Record<string, unknown>;
        const entries = Object.entries(contentObj).filter(
          ([k, v]) => k !== 'fase_concluida' && !isEmptyValue(v)
        );
        if (entries.length === 0 && contentObj.fase_concluida === undefined)
          return;

        textContent += `📌 ${formatSectionTitle(key).toUpperCase()}\n`;
        textContent += '───────────────────────────────────\n';

        entries.forEach(([fieldKey, fieldValue]) => {
          textContent += `${formatKey(fieldKey)}: ${formatValueForCopy(fieldValue)}\n`;
        });

        if (contentObj.fase_concluida !== undefined) {
          textContent += `Status: ${contentObj.fase_concluida ? '✓ Concluída' : '⏳ Em Andamento'}\n`;
        }
        textContent += '\n';
      });

      if (data.memoria_conversacional) {
        const mc = data.memoria_conversacional;
        const hasResumo = !isEmptyValue(mc.resumo_acumulado);
        const hasPendencias =
          Array.isArray(mc.pendencias_abertas) &&
          mc.pendencias_abertas.length > 0;

        if (hasResumo || hasPendencias) {
          textContent += '🧠 MEMÓRIA CONVERSACIONAL\n';
          textContent += '───────────────────────────────────\n';

          if (hasResumo) {
            textContent += `Resumo:\n${mc.resumo_acumulado}\n\n`;
          }

          if (hasPendencias) {
            textContent += 'Pendências:\n';
            mc.pendencias_abertas!.forEach((item, idx) => {
              textContent += `  ${idx + 1}. ${formatValueForCopy(item)}\n`;
            });
          }
        }
      }

      textContent += '\n═══════════════════════════════════\n';
      textContent += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n`;

      await navigator.clipboard.writeText(textContent);
      setIsCopied(true);
      toast.success('Dados copiados para área de transferência!');

      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      toast.error('Erro ao copiar dados.');
    }
  };

  const renderValue = (value: unknown, depth = 0): React.ReactNode => {
    try {
      if (isEmptyValue(value)) return null;

      if (typeof value === 'boolean') return value ? 'Sim' : 'Não';

      if (typeof value === 'string') {
        if (isDateString(value)) return formatDateValue(value);
        if (value.length > 120) {
          return (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {value}
            </p>
          );
        }
        return value;
      }

      if (typeof value === 'number') return String(value);

      if (Array.isArray(value)) {
        const nonEmpty = value.filter((item) => !isEmptyValue(item));
        if (nonEmpty.length === 0) return null;

        const allPrimitives = nonEmpty.every(
          (item) =>
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean'
        );

        if (allPrimitives && nonEmpty.length <= 3) {
          return nonEmpty.map(String).join(', ');
        }

        return (
          <ul className="list-disc list-inside text-sm space-y-0.5">
            {nonEmpty.map((item, idx) => (
              <li key={idx} className="text-muted-foreground">
                {typeof item === 'object'
                  ? renderValue(item, depth + 1)
                  : String(item)}
              </li>
            ))}
          </ul>
        );
      }

      if (typeof value === 'object' && depth < 2) {
        const obj = value as Record<string, unknown>;
        const entries = Object.entries(obj).filter(
          ([, v]) => !isEmptyValue(v)
        );
        if (entries.length === 0) return null;

        return (
          <div className="space-y-1.5 pl-2 border-l-2 border-muted">
            {entries.map(([k, v]) => (
              <div key={k} className="text-sm">
                <span className="font-medium text-foreground/70">
                  {formatKey(k)}:
                </span>{' '}
                <span className="text-muted-foreground">
                  {renderValue(v, depth + 1)}
                </span>
              </div>
            ))}
          </div>
        );
      }

      if (typeof value === 'object') {
        try {
          return (
            <pre className="text-xs bg-muted/50 p-2 rounded max-w-full overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(value, null, 2)}
            </pre>
          );
        } catch {
          return (
            <span className="text-xs text-red-500">[Dados indisponíveis]</span>
          );
        }
      }

      return String(value);
    } catch (err) {
      console.error('Error in renderValue:', err, 'value:', value);
      return (
        <span className="text-xs text-red-500">[Erro ao renderizar]</span>
      );
    }
  };

  const renderSection = (title: string, content: unknown) => {
    try {
      if (!content || typeof content !== 'object') return null;

      const contentObj = content as Record<string, unknown>;

      if (
        !sectionHasVisibleData(contentObj) &&
        contentObj.fase_concluida === undefined
      ) {
        return null;
      }

      const visibleEntries = Object.entries(contentObj).filter(
        ([key, value]) => key !== 'fase_concluida' && !isEmptyValue(value)
      );

      return (
        <div className="mb-6 last:mb-0">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            {formatSectionTitle(title)}
          </h3>
          <div className="bg-muted/30 rounded-lg p-3 space-y-2 border">
            {visibleEntries.map(([key, value]) => {
              try {
                const rendered = renderValue(value);
                if (rendered === null) return null;

                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:justify-between text-sm gap-2"
                  >
                    <span className="font-medium text-foreground/80 shrink-0">
                      {formatKey(key)}:
                    </span>
                    <span className="text-muted-foreground sm:text-right break-words max-w-[65%]">
                      {rendered}
                    </span>
                  </div>
                );
              } catch (err) {
                console.error(`Error rendering field ${key}:`, err);
                return null;
              }
            })}

            {contentObj.fase_concluida !== undefined && (
              <div className="mt-2 pt-2 border-t flex justify-between items-center">
                <span className="text-xs font-medium uppercase">
                  Status da Fase
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${contentObj.fase_concluida ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}
                >
                  {contentObj.fase_concluida ? 'Concluída' : 'Em Andamento'}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    } catch (err) {
      console.error(`Error rendering section ${title}:`, err);
      return null;
    }
  };

  const isPhaseKey = (key: string): boolean => {
    const lowerKey = key.toLowerCase();
    return /^fase[\s_\-]/.test(lowerKey) || /^fase\d/.test(lowerKey);
  };

  const extractPhaseNumber = (key: string): number | null => {
    const match = key.match(/fase[\s_\-]+(\d+)/i);
    if (match && match[1]) {
      const num = parseInt(match[1], 10);
      return isNaN(num) ? null : num;
    }
    const matchNoSeparator = key.match(/fase(\d+)/i);
    if (matchNoSeparator && matchNoSeparator[1]) {
      const num = parseInt(matchNoSeparator[1], 10);
      return isNaN(num) ? null : num;
    }
    return null;
  };

  const getSortedKeys = (obj: ExtractedData): string[] => {
    const keys = Object.keys(obj);

    const specialSections = {
      first: ['metadados'],
      last: ['memoria_conversacional'],
    };

    const metadataKeys: string[] = [];
    const phaseKeys: Array<{
      key: string;
      num: number | null;
      originalIndex: number;
    }> = [];
    const otherKeys: Array<{ key: string; originalIndex: number }> = [];
    const memoryKeys: string[] = [];

    keys.forEach((key, index) => {
      if (specialSections.first.includes(key.toLowerCase())) {
        metadataKeys.push(key);
      } else if (specialSections.last.includes(key.toLowerCase())) {
        memoryKeys.push(key);
      } else if (isPhaseKey(key)) {
        const phaseNum = extractPhaseNumber(key);
        phaseKeys.push({ key, num: phaseNum, originalIndex: index });
      } else {
        otherKeys.push({ key, originalIndex: index });
      }
    });

    phaseKeys.sort((a, b) => {
      if (a.num !== null && b.num !== null) return a.num - b.num;
      if (a.num !== null && b.num === null) return -1;
      if (a.num === null && b.num !== null) return 1;
      return a.originalIndex - b.originalIndex;
    });

    otherKeys.sort((a, b) => a.originalIndex - b.originalIndex);

    return [
      ...metadataKeys,
      ...phaseKeys.map((p) => p.key),
      ...otherKeys.map((o) => o.key),
      ...memoryKeys,
    ];
  };

  const hasAnyVisibleContent = (obj: ExtractedData): boolean => {
    if (
      obj.metadados &&
      typeof obj.metadados === 'object' &&
      sectionHasVisibleData(obj.metadados as Record<string, unknown>)
    ) {
      return true;
    }

    if (obj.memoria_conversacional) {
      if (!isEmptyValue(obj.memoria_conversacional.resumo_acumulado))
        return true;
      if (
        Array.isArray(obj.memoria_conversacional.pendencias_abertas) &&
        obj.memoria_conversacional.pendencias_abertas.length > 0
      )
        return true;
    }

    const dynamicKeys = Object.keys(obj).filter(
      (k) =>
        k.toLowerCase() !== 'metadados' &&
        k.toLowerCase() !== 'memoria_conversacional'
    );
    for (const key of dynamicKeys) {
      const content = obj[key];
      if (content && typeof content === 'object' && !Array.isArray(content)) {
        if (sectionHasVisibleData(content as Record<string, unknown>))
          return true;
      }
      if (!isEmptyValue(content) && typeof content !== 'object') return true;
    }
    return false;
  };

  if (!isMounted) {
    return null;
  }

  const showCollectingState = data !== null && !hasAnyVisibleContent(data);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5" />
            Resumo da Conversa
          </DialogTitle>
          <DialogDescription>
            Dados extraídos e resumo das interações com o cliente
          </DialogDescription>

          <div className="mt-3 bg-muted/40 rounded-md border text-xs font-mono divide-y">
            <div className="px-3 py-1.5 flex items-center justify-between gap-2">
              <div className="flex gap-2 min-w-0">
                <span className="text-muted-foreground shrink-0">contact_id:</span>
                <span className="truncate">{contactId}</span>
              </div>
              <button
                onClick={handleCopyContactId}
                className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
                title="Copiar contact_id"
              >
                {isContactIdCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
            <div className="px-3 py-1.5 flex items-center justify-between gap-2">
              <div className="flex gap-2 min-w-0">
                <span className="text-muted-foreground shrink-0">conversation_id:</span>
                <span className="truncate">{conversationId}</span>
              </div>
              <button
                onClick={handleCopyConversationId}
                className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
                title="Copiar conversation_id"
              >
                {isConversationIdCopied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-3">
            <Button
              onClick={handleCopyToClipboard}
              disabled={!data || isLoading || showCollectingState}
              variant="outline"
              size="sm"
              className="gap-2 w-full"
            >
              {isCopied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar dados
                </>
              )}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500">{error}</div>
          ) : !data ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum resumo disponível para esta conversa.
            </div>
          ) : showCollectingState ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Dados sendo coletados</p>
              <p className="text-sm mt-1">
                A IA ainda está extraindo as informações desta conversa. Volte
                em breve para ver o resumo completo.
              </p>
            </div>
          ) : (
            <div className="py-2 space-y-6">
              {data.metadados && (
                <div key="metadados">
                  {renderSection('metadados', data.metadados)}
                </div>
              )}

              {(() => {
                const sortedKeys = getSortedKeys(data);
                const filteredKeys = sortedKeys.filter(
                  (key) =>
                    key.toLowerCase() !== 'metadados' &&
                    key.toLowerCase() !== 'memoria_conversacional'
                );

                return filteredKeys.map((key) => {
                  const section = renderSection(key, data[key]);
                  if (!section) return null;
                  return <div key={key}>{section}</div>;
                });
              })()}

              {data.memoria_conversacional &&
                (!isEmptyValue(
                  data.memoria_conversacional.resumo_acumulado
                ) ||
                  (Array.isArray(
                    data.memoria_conversacional.pendencias_abertas
                  ) &&
                    data.memoria_conversacional.pendencias_abertas.length >
                      0)) && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      Memória Conversacional
                    </h3>
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 border border-blue-100 dark:border-blue-900/50">
                      {!isEmptyValue(
                        data.memoria_conversacional.resumo_acumulado
                      ) && (
                        <p className="text-sm leading-relaxed text-foreground/90 mb-3">
                          {data.memoria_conversacional.resumo_acumulado}
                        </p>
                      )}
                      {Array.isArray(
                        data.memoria_conversacional.pendencias_abertas
                      ) &&
                        data.memoria_conversacional.pendencias_abertas.length >
                          0 && (
                          <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-900/50">
                            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400 block mb-1">
                              Pendências:
                            </span>
                            <ul className="list-disc list-inside text-sm text-muted-foreground">
                              {data.memoria_conversacional.pendencias_abertas.map(
                                (item, idx) => (
                                  <li key={idx}>{String(item)}</li>
                                )
                              )}
                            </ul>
                          </div>
                        )}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

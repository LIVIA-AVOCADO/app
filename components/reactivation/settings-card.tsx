'use client';

import type { UseFormReturn } from 'react-hook-form';
import { BotOff, ShieldAlert, Timer } from 'lucide-react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { ReactivationFormDataValidated } from '@/lib/validations/reactivationValidation';

interface SettingsCardProps {
  form: UseFormReturn<ReactivationFormDataValidated>;
}

const fallbackActionLabels: Record<string, string> = {
  end_conversation: 'Encerrar Conversa',
  transfer_to_human: 'Transferir para Humano',
  do_nothing: 'Nao fazer nada',
};

export function SettingsCard({ form }: SettingsCardProps) {
  const exhaustedAction = form.watch('settings.exhausted_action');
  const maxWindowAction = form.watch('settings.max_window_action');

  return (
    <div className="space-y-6">
      {/* Secao: Etapas Esgotadas */}
      <Card className="overflow-hidden">
        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Etapas Esgotadas</h3>
              <p className="text-xs text-muted-foreground">
                O que fazer quando todas as etapas forem executadas sem resposta.
              </p>
            </div>
          </div>
        </div>
        <CardContent className="p-6 space-y-4">
          <FormField
            control={form.control}
            name="settings.exhausted_action"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Acao</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione uma acao" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(fallbackActionLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {exhaustedAction !== 'do_nothing' && (
            <FormField
              control={form.control}
              name="settings.exhausted_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Mensagem enviada antes de executar a acao..."
                      className="min-h-[80px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </CardContent>
      </Card>

      {/* Secao: Conversas sem IA */}
      <Card className="overflow-hidden">
        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <BotOff className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Reativar Conversas sem IA</h3>
              <p className="text-xs text-muted-foreground">
                Inclui conversas com IA desativada no fluxo de reativacao.
              </p>
            </div>
          </div>
        </div>
        <CardContent className="p-6">
          <FormField
            control={form.control}
            name="settings.reactivate_when_ia_active_false"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4">
                <div>
                  <FormLabel>Reativar quando IA estiver desativada</FormLabel>
                  <FormDescription>
                    Quando ativo, conversas com IA desativada tambem serao processadas pelo fluxo de reativacao. A IA nao sera reativada automaticamente.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Secao: Janela Maxima */}
      <Card className="overflow-hidden">
        <div className="border-b bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Timer className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Janela Maxima de Reativacao</h3>
              <p className="text-xs text-muted-foreground">
                Tempo maximo total para tentar reativar. Deixe em branco para nao limitar.
              </p>
            </div>
          </div>
        </div>
        <CardContent className="p-6 space-y-4">
          <FormField
            control={form.control}
            name="settings.max_reactivation_window_minutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tempo Maximo (minutos)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Ex: 1440 (24h)"
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      field.onChange(val === '' ? null : Number(val));
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Exemplos: 60 (1h), 1440 (24h), 4320 (3 dias)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="settings.max_window_action"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Acao ao atingir janela</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione uma acao" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(fallbackActionLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {maxWindowAction !== 'do_nothing' && (
            <FormField
              control={form.control}
              name="settings.max_window_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensagem (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Mensagem enviada antes de executar a acao..."
                      className="min-h-[80px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

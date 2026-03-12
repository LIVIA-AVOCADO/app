import { z } from 'zod';

export const createSessionSchema = z.object({
  templateId: z.string().uuid('Template inválido'),
});

export const saveStepSchema = z.object({
  stepKey:     z.string().min(1, { message: 'Step inválido' }),
  stepPayload: z.record(z.string(), z.unknown()),
});

// ------------------------------------------------------------
// Schemas por step (validação frontend + backend)
// ------------------------------------------------------------

export const companyStepSchema = z.object({
  trade_name: z.string().min(2, { message: 'Nome da empresa obrigatório' }),
  cnpj:       z.string().min(14, { message: 'CNPJ inválido' }),
  phone:      z.string().min(10, { message: 'Telefone inválido' }),
  plan:       z.string().optional(),
  responsibles: z.object({
    technical: z.object({
      name:     z.string().min(2, { message: 'Nome do responsável técnico obrigatório' }),
      whatsapp: z.string().min(10, { message: 'WhatsApp inválido' }),
      email:    z.string().email({ message: 'Email inválido' }),
    }),
    financial: z.object({
      name:     z.string().min(2, { message: 'Nome do responsável financeiro obrigatório' }),
      whatsapp: z.string().min(10, { message: 'WhatsApp inválido' }),
      email:    z.string().email({ message: 'Email inválido' }),
    }),
  }).optional(),
});

export const agentStepSchema = z.object({
  name:     z.string().min(2, { message: 'Nome do agente obrigatório' }),
  type:     z.string().min(1, { message: 'Tipo obrigatório' }),
  reactive: z.boolean().optional(),
  persona: z.object({
    gender: z.string().optional(),
    age:    z.string().optional(),
  }).optional(),
  profile: z.object({
    objective:     z.string().min(10, { message: 'Objetivo deve ter ao menos 10 caracteres' }),
    communication: z.string().optional(),
    personality:   z.string().optional(),
  }).optional(),
});

export const knowledgeStepSchema = z.object({
  name:              z.string().min(2, { message: 'Nome da base obrigatório' }),
  description:       z.string().optional(),
  extra_information: z.array(z.string()).optional(),
});

export const tagsStepSchema = z.object({
  items: z.array(z.object({
    tag_name:          z.string().min(1, { message: 'Nome da tag obrigatório' }),
    color:             z.string().default('#3b82f6'),
    order_index:       z.number().optional(),
    active:            z.boolean().optional(),
    pause_ia_on_apply: z.boolean().optional(),
  })).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SaveStepInput      = z.infer<typeof saveStepSchema>;
export type CompanyStepInput   = z.infer<typeof companyStepSchema>;
export type AgentStepInput     = z.infer<typeof agentStepSchema>;

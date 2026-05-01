# Decisões de Design — LIVIA App

Decisões permanentes de arquitetura. Cada entrada explica o WHY — não o HOW.

---

## D-001 — Deploy automático: cada commit em `main` vai direto para produção

O repositório está conectado à Vercel com deploy automático na branch `main`.
Qualquer push impacta usuários reais imediatamente.

**Regras obrigatórias:**
- Nunca commitar código incompleto em arquivos que afetam rotas ativas
- Toda alteração deve passar por `npm run build` localmente antes do commit
- Features em andamento que afetam fluxo de produção devem usar branch separada

---

## D-002 — Gateway Go é o processador de todas as mensagens inbound

**Contexto histórico:** antes do gateway, o n8n processava tudo — recebimento
do webhook, roteamento, persistência no Supabase, IA e envio outbound. Era um
ponto único de falha: se o n8n caísse, nenhuma mensagem chegava ao sistema.

O gateway Go (`livia-avocado/gateway`) foi criado para assumir o inbound:
recebe webhooks da Evolution e Meta, persiste no Supabase, avalia regras URA
e aciona o Neurocore (n8n) apenas para chamadas de IA.

**Estado atual:** gateway ativo para todos os canais. n8n restrito ao Neurocore
(processamento de IA/LLM). O app se comunica com o gateway via `/v2/send`,
`/presence` e `/notify`.

---

## D-003 — n8n é exclusivo para IA (Neurocore) — nunca para mensagens de atendentes

Mensagens enviadas por operadores humanos vão direto para o gateway (`/v2/send`).
O n8n só recebe payloads do gateway quando a URA Engine decide acionar a IA.

Motivo: misturar mensagens humanas com o pipeline de IA cria acoplamento
desnecessário e dificulta auditoria de quem enviou o quê.

---

## D-004 — Gateway é um repositório separado — zero risco para o Next.js

O gateway roda na VPS em processo e deploy independentes. Alterações no gateway
não geram commit neste repositório e não afetam o deploy da Vercel.

O app só é tocado quando o contrato de API do gateway muda — e mesmo assim
de forma incremental (sempre `/v2/send` antes de remover o fallback).

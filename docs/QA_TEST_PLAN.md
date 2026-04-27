# LIVIA Platform — Plano de QA Completo
# Baseado em: PLATFORM_EVOLUTION_PLAN.md

**Data:** 2026-04-26  
**Versão:** 1.0  
**Escopo:** Fases 0 a 5 + Backlog crítico  
**Ambiente de referência:** produção (`main` → Vercel) + VPS Hostinger (`livia-gateway`)

---

## Índice

1. [Estratégia Geral de Testes](#1-estratégia-geral-de-testes)
2. [Fase 0 — Performance do Livechat/Inbox](#2-fase-0--performance-do-livechatinbox)
3. [Fase 1 — Modularização](#3-fase-1--modularização)
4. [Fase 2 — Go Message Gateway](#4-fase-2--go-message-gateway)
5. [Fase 3 — Multi-Agente e URA Engine](#5-fase-3--multi-agente-e-ura-engine)
6. [Fase 4 — Logs de Canal](#6-fase-4--logs-de-canal)
7. [Fase 5 — CRM](#7-fase-5--crm)
8. [Segurança e Dados](#8-segurança-e-dados)
9. [Testes de Regressão Transversais](#9-testes-de-regressão-transversais)
10. [Critérios de Aceite Globais](#10-critérios-de-aceite-globais)

---

## 1. Estratégia Geral de Testes

### 1.1 Pirâmide de cobertura

```
         [E2E]
       poucos, críticos

     [Integração / API]
    fluxos entre serviços

 [Unitário / Funcional manual]
   componentes e regras isoladas
```

### 1.2 Ambientes

| Ambiente | Uso | Observação |
|---|---|---|
| Local (`localhost:3000`) | Desenvolvimento e smoke |  |
| Vercel Preview (PR branch) | Validação pré-merge | Ainda sem staging Supabase dedicado (ver Backlog) |
| Produção (`main`) | Validação pós-deploy | Deploy automático — rollback em < 60s via webhook |
| VPS Hostinger | Go Gateway | `https://livia-gw.online24por7.ai/health` |

### 1.3 Regras obrigatórias antes de qualquer teste em produção

- [ ] `npm run build` sem erros antes de qualquer commit em `main`
- [ ] Rollback documentado para cada mudança (URL webhook Evolution anotada)
- [ ] Shadow mode ativo no Go Gateway para novos tenants antes de cutover
- [ ] Validação 24h mínima em dual-write antes de desligar n8n no inbound

### 1.4 Prioridades de severidade

| Severidade | Critério | Ação |
|---|---|---|
| P0 — Bloqueante | Mensagem perdida, dados incorretos, acesso negado erroneamente | Rollback imediato |
| P1 — Crítico | Feature principal quebrada, UX inoperante | Hotfix em < 4h |
| P2 — Moderado | Comportamento errado mas workaround existe | Sprint atual |
| P3 — Baixo | Visual, edge case, texto errado | Backlog |

---

## 2. Fase 0 — Performance do Livechat/Inbox

### 2.1 Fix A — Middleware JWT Local

#### Testes funcionais

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F0-A01 | Login válido → navegar para `/inbox` | Acesso liberado sem chamada HTTP extra ao Supabase Auth | P1 |
| F0-A02 | Cookie `x-user-ctx` expirado (> 5 min) | Middleware renova o cookie transparentemente | P1 |
| F0-A03 | JWT inválido / adulterado | Redirect para `/login` com status 401 | P0 |
| F0-A04 | Token expirado (`exp` no passado) | Redirect para `/login` | P0 |
| F0-A05 | Usuário sem `tenant_id` no cookie | Redirect correto (não crash 500) | P1 |
| F0-A06 | Super admin acessa rota protegida | Acesso liberado (bypass de módulos) | P1 |
| F0-A07 | Usuário `role=user` sem módulo `livechat` acessa `/inbox` | Redirect para dashboard padrão | P1 |
| F0-A08 | Múltiplas abas abertas simultaneamente | Sem conflito de cookie; todas funcionam | P2 |

#### Testes de performance

| ID | Caso | Meta | Ferramenta |
|---|---|---|---|
| P0-A01 | Tempo de navegação `/inbox` após login | < 200ms de overhead de middleware | DevTools Network |
| P0-A02 | Verificar que `getUser()` HTTP call não aparece nas requests | 0 chamadas a `auth/v1/user` por navegação | DevTools → XHR filter |
| P0-A03 | Teste de carga: 50 req/s simultâneos no middleware | 0 erros, latência < 300ms p99 | `wrk` ou `k6` |

---

### 2.2 Fix B — SSR Enxuto + Lazy Loading Encerradas

#### Testes funcionais

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F0-B01 | Abrir `/inbox` pela primeira vez | Apenas conversas abertas carregam no SSR | P1 |
| F0-B02 | Clicar em aba "Encerradas" | Conversas encerradas carregam via API (lazy) | P1 |
| F0-B03 | Aba "Encerradas" com erro de rede | Mensagem de erro + botão de retry visíveis | P2 |
| F0-B04 | Clicar em conversa diferente | URL muda sem reload de página completa (`history.pushState`) | P1 |
| F0-B05 | F5 na página com conversa selecionada | Conversa correta abre via SSR (URL preservada) | P1 |
| F0-B06 | Cache de mensagens (< 5 min) | Segunda abertura da mesma conversa é instantânea | P2 |
| F0-B07 | Cache L2 (localStorage) sobrevive F5 | Dados carregados do storage antes da API | P2 |

#### Testes de performance

| ID | Caso | Meta | Ferramenta |
|---|---|---|---|
| P0-B01 | Tempo de troca entre conversas (cache miss) | < 400ms | DevTools → Timeline |
| P0-B02 | Tempo de troca entre conversas (cache hit) | < 50ms | DevTools |
| P0-B03 | Número de queries SSR na abertura do `/inbox` | ≤ 3 (tags + tab counts + msgs iniciais) | Supabase logs |

---

### 2.3 Fix C — WebSocket Realtime

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F0-C01 | Nova mensagem recebida enquanto inbox aberta | Aparece sem F5 em < 2s | P0 |
| F0-C02 | Conversa muda de status (ex: encerrada) | Lista atualiza via Realtime | P1 |
| F0-C03 | Reconexão após perda de rede | Realtime se reconecta automaticamente | P1 |
| F0-C04 | Verificar endpoint WS (DevTools → Network → WS) | Deve ser `wss://[projeto].supabase.co` OU proxy configurado | P2 |
| F0-C05 | Abrir com proxy configurado (`NEXT_PUBLIC_REALTIME_PROXY_URL`) | Conexão vai para `wss://gateway.*/realtime` | P2 |

---

### 2.4 Fix D — Cache L1/L2/L3 + Prefetch

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F0-D01 | Hover sobre conversa antes de clicar | Mensagens pré-carregadas (prefetch) | P3 |
| F0-D02 | Prefetch de 100 conversas após carregamento | Conversas manuais priorizadas no prefetch | P2 |
| F0-D03 | Navegar entre 10 conversas já visitadas | Todas instantâneas (cache hit) | P2 |
| F0-D04 | Unmount do componente | AbortController cancela prefetches pendentes | P2 |

---

### 2.5 Fix E — Virtualização da Lista

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F0-E01 | Tenant com 300 conversas abertas | DOM renderiza ~15 itens visíveis, não 300 | P1 |
| F0-E02 | Scroll na lista de conversas | Performance fluida, sem jank | P1 |
| F0-E03 | Busca na lista com virtualização | Resultados filtram corretamente | P1 |
| F0-E04 | Conversa marcada como importante na lista virtualizada | Badge visível no item correto | P2 |
| F0-E05 | Contato mutado na lista | Não aparece na lista (filtrado) | P1 |

---

## 3. Fase 1 — Modularização

### 3.1 Redirecionamento de rotas

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F1-01 | Acessar URL `/livechat` (antiga) | Redirect 301 → `/inbox` | P1 |
| F1-02 | Acessar `/livechat/qualquer-subrota` | Redirect 301 → `/inbox/qualquer-subrota` | P1 |
| F1-03 | Links de deep link para conversa (CRM card) | URL usa `/inbox?conversation=uuid` | P1 |
| F1-04 | Bookmark da URL antiga funcionando | Redirect transparente | P2 |

### 3.2 Build e importações

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F1-05 | `npm run build` sem erros | 0 erros de compilação TS | P0 |
| F1-06 | Todos os imports de `components/livechat` foram atualizados | Nenhum import antigo restante | P0 |
| F1-07 | `lib/queries/livechat.ts` não referenciado em nenhum arquivo | 0 ocorrências de `queries/livechat` | P1 |
| F1-08 | `components/shared/tag-badge` importado de local correto | Sem import duplicado de `components/livechat/tag-badge` | P2 |

---

## 4. Fase 2 — Go Message Gateway

### 4.1 Health e Deploy

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F2-01 | `GET /health` no gateway | `{"status":"ok","mode":"ATIVO ..."}` com 200 | P0 |
| F2-02 | Deploy novo no Swarm | Serviço sobe sem downtime (rolling update) | P1 |
| F2-03 | Variáveis de ambiente obrigatórias ausentes | Gateway não sobe, log de erro claro | P1 |

### 4.2 Inbound — Recebimento de mensagens Evolution

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F2-I01 | Mensagem de texto recebida via WhatsApp (Baileys) | Persiste em `messages` com `sender_type='customer'` e `external_message_id` preenchido | P0 |
| F2-I02 | Mensagem de imagem com legenda | `content` = legenda; `media_type='image'` | P1 |
| F2-I03 | Mensagem de áudio | Edge function `upload-audio-message` chamada; mensagem gravada | P1 |
| F2-I04 | Mensagem de sticker | `content='[sticker]'` gravado | P2 |
| F2-I05 | Mensagem duplicada (mesmo `external_message_id`) | Segunda inserção ignorada (dedup LRU) | P0 |
| F2-I06 | Mensagem `fromMe=true` (echo da instância) | Ignorada, nada gravado | P0 |
| F2-I07 | Payload com `remoteJidAlt` e `remoteJid` diferentes | Usa `remoteJidAlt` como `logicalJid` | P1 |
| F2-I08 | Canal não encontrado (apikey inválido) | 500 retornado; nenhuma gravação parcial | P1 |
| F2-I09 | Contato novo (primeiro contato) | Novo registro em `contacts` e `conversations` criados | P0 |
| F2-I10 | Contato existente com nova mensagem | `conversations.last_message_at` atualizado | P0 |
| F2-I11 | Contato com `is_muted=true` envia mensagem | Mensagem dropada (200 OK), sem gravação | P0 |
| F2-I12 | Contato muted fecha conversa e abre nova | Nova conversa **não** criada (drop no gateway) | P0 |
| F2-I13 | `CONNECTION_UPDATE` recebido (canal conecta) | Log `connected` gravado em `channel_connection_logs` | P1 |
| F2-I14 | `CONNECTION_UPDATE` recebido (canal desconecta) | Log `disconnected` gravado | P1 |

### 4.3 Outbound — Envio de mensagens

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F2-O01 | Agente humano envia mensagem de texto (Evolution) | Mensagem aparece na UI como `sent` imediatamente (UX otimista) | P0 |
| F2-O02 | Confirmação de envio chega | `external_message_id` preenchido; ícone muda para CheckCheck | P0 |
| F2-O03 | Falha real no envio | `status='failed'` via Realtime; ícone de erro na UI | P1 |
| F2-O04 | Timeout de 30s no gateway | Status permanece `sent` (sem falso `failed`) | P1 |
| F2-O05 | Envio de mensagem Meta (WhatsApp Cloud) | Fluxo via n8n mantido; sem regressão | P0 |
| F2-O06 | Balão de mensagem não re-anima após confirmação | `stableKeyMap` mantém chave `temp-xxx` → sem `slide-in` duplo | P2 |
| F2-O07 | Botão de reply visível apenas após confirmação | `opacity-0` enquanto `id` é temporário | P2 |

### 4.4 Dual-Write (fase de validação)

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F2-DW01 | Mensagem recebida em modo `DUAL_WRITE=true` | Gravada pelo Go **e** pelo n8n; sem duplicata na `messages` | P0 |
| F2-DW02 | Comparação de 24h de mensagens Go vs n8n | Contagem idêntica; campos `external_message_id`, `conversation_id`, `content` iguais | P0 |
| F2-DW03 | Cutover para `DUAL_WRITE=false` | Apenas Go persiste; n8n não recebe mais o webhook | P1 |

### 4.5 Rollback

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F2-RB01 | Reverter webhook Evolution para n8n direto | Mensagens voltam a fluir via n8n em < 60s | P0 |
| F2-RB02 | Rollback documentado e testado antes de cada cutover | Comando de rollback anotado e validado | P0 |

---

## 5. Fase 3 — Multi-Agente e URA Engine

### 5.1 Disponibilidade de agentes

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F3-D01 | Agente faz login pela primeira vez | Dialog "Você está pronto para atender?" aparece (apenas `role=user` com módulo `livechat`) | P1 |
| F3-D02 | Dialog não aparece para super admin | Nenhum dialog de disponibilidade para admins | P1 |
| F3-D03 | Agente clica "Ficar disponível agora" | `availability_status = 'online'`; sidebar mostra ícone verde | P0 |
| F3-D04 | Agente muda para "Ocupado" via sidebar | `availability_status = 'busy'`; não recebe auto-assign | P1 |
| F3-D05 | Agente vai para "Offline" | Invisível para o URA Engine; sem auto-assign | P1 |
| F3-D06 | Mudança de status via Realtime | Overview do admin atualiza sem polling | P1 |
| F3-D07 | `PATCH /api/users/me/availability` com status inválido | 400 retornado com erro descritivo | P2 |

### 5.2 URA Engine — Roteamento automático

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F3-U01 | Tenant no modo `intent_agent` recebe nova mensagem | Go chama `neurocores.webhook_url` diretamente | P0 |
| F3-U02 | Tenant no modo `direct` recebe mensagem | Conversa vai para fila (`conversation_queue`) | P1 |
| F3-U03 | Tenant no modo `ura` com regra `contact_tag=VIP` | Conversa atribuída ao agente configurado na regra | P0 |
| F3-U04 | Regra `time_range` (horário comercial) | Atribui corretamente dentro e fora do horário | P1 |
| F3-U05 | Regra `first_message_keyword` com "suporte" | Match case-insensitive; atribui para time correto | P1 |
| F3-U06 | Conversa existente com atribuição ativa (sticky) | Mesma atribuição mantida; URA não re-roteia | P0 |
| F3-U07 | Nenhuma regra faz match | Fallback para fila geral | P1 |
| F3-U08 | Erro ao buscar config do tenant | `fallbackDecision()` ativado; nenhum drop de mensagem | P0 |
| F3-U09 | Cache de regras (30s TTL) | Regra editada pelo admin → máximo 30s para valer | P2 |

### 5.3 Estratégias de distribuição

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F3-S01 | Estratégia `round_robin` com 3 agentes | Distribuição circular correta após 9 mensagens (3 para cada) | P1 |
| F3-S02 | `least_busy` — agente com menos conversas abertas | Agente com menos conversas recebe a próxima | P1 |
| F3-S03 | `random` — distribuição estatística | Distribuição não concentra em único agente em 100 chamadas | P2 |
| F3-S04 | Estratégia com agente offline | Agente offline excluído do pool de seleção | P0 |
| F3-S05 | Estratégia `assign_percentage` 70/30 | Em 100 atribuições: 65-75 para time A, 25-35 para time B | P2 |

### 5.4 UI — Inbox com atribuições

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F3-I01 | Filtro "Meus" | Mostra apenas conversas com `assigned_to = user_id` | P0 |
| F3-I02 | Filtro "Não atribuídos" | Mostra apenas conversas com `assigned_to IS NULL AND status='open'` | P0 |
| F3-I03 | Filtro "Times" | Dropdown com times do tenant; filtra por `team_id` | P1 |
| F3-I04 | Super admin vê filtro "Todos" | Acesso irrestrito a todas as conversas | P1 |
| F3-I05 | Header da conversa mostra agente atribuído | Dropdown "Agente: João ▼" visível | P1 |
| F3-I06 | Reatribuição manual via dropdown | `conversation_assignments` registra log; Realtime atualiza outros agentes | P1 |
| F3-I07 | Agente reatribuído recebe conversa no filtro "Meus" | Realtime; sem F5 | P1 |

### 5.5 UI — Overview (admin)

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F3-OV01 | Página `/overview` acessível apenas para super admin | `role=user` recebe 403/redirect | P0 |
| F3-OV02 | Lista de agentes online/busy/offline em tempo real | Atualiza via Realtime sem polling | P1 |
| F3-OV03 | Fila de conversas no QueuePanel | Conversas com `assigned_to IS NULL` listadas | P1 |
| F3-OV04 | Atribuição direta de agente pela fila | Conversa sai da fila, aparece no inbox do agente | P1 |

### 5.6 UI — Times (`/teams`)

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F3-T01 | Criar novo time | Time aparece na lista; disponível no URA | P1 |
| F3-T02 | Adicionar membro ao time | Membro aparece em `team_members`; disponível nas estratégias | P1 |
| F3-T03 | Remover membro do time | Sem regras quebradas; `team_members` limpo | P1 |
| F3-T04 | Deletar time com regras URA ativas | Aviso ao admin; regra deve ser desativada primeiro | P2 |

### 5.7 UI — Automação URA (`/automation`)

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F3-A01 | Trocar modo de `direct` para `ura` | Seção de regras aparece automaticamente | P1 |
| F3-A02 | Criar regra com condição `contact_tag=VIP` e ação `assign_agent` | Regra salva e ativa; Go processa corretamente | P0 |
| F3-A03 | Reordenar regras (prioridade) | Ordem refletida no `priority` da tabela; Go avalia na ordem correta | P1 |
| F3-A04 | Desativar regra | `is_active=false`; regra ignorada pelo engine | P1 |
| F3-A05 | Modo `intent_agent` (agente único) | Seção de regras oculta; toda mensagem vai para IA | P1 |
| F3-A06 | Clicar em modo URA já selecionado → regras aparecem (auto-save) | Fix implementado — validar comportamento | P1 |

### 5.8 Billing e roles

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F3-B01 | Count de seats faturáveis | Conta apenas `users` com `livechat` em modules E `is_internal=false` | P0 |
| F3-B02 | Usuário interno (`is_internal=true`) | Não conta no billing; acesso mantido | P1 |
| F3-B03 | Preço do seat vem de `platform_configs` | Sem hardcode; editável sem deploy | P1 |

---

## 6. Fase 4 — Logs de Canal

### 6.1 Gravação de logs

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F4-L01 | Mensagem recebida via Go Gateway | `message_received` gravado em `channel_connection_logs` | P1 |
| F4-L02 | Canal conecta (Evolution `CONNECTION_UPDATE`) | `connected` gravado | P1 |
| F4-L03 | Canal desconecta | `disconnected` gravado | P1 |
| F4-L04 | Webhook do Next.js existente | `connected`/`disconnected` também gravados via `webhook/route.ts` | P1 |
| F4-L05 | Gravação de log não bloqueia 200 OK | Fire-and-forget; latência do gateway não aumenta | P1 |
| F4-L06 | `event_data` com payload relevante | JSON estruturado gravado corretamente | P2 |

### 6.2 UI — Tela de logs (`/configuracoes/conexoes/logs`)

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F4-UI01 | Novo evento ocorre com a tela aberta | Linha aparece no topo sem F5 (Realtime) | P1 |
| F4-UI02 | Filtro por canal | Mostra apenas logs do canal selecionado | P1 |
| F4-UI03 | Filtro por tipo de evento | Filtra corretamente (ex: apenas `disconnected`) | P1 |
| F4-UI04 | Expandir linha | JSON do `event_data` visível e formatado | P2 |
| F4-UI05 | Paginação | 50 itens por página; navegação funcional | P2 |
| F4-UI06 | Exportar CSV | Arquivo baixado com todos os registros do filtro atual | P2 |
| F4-UI07 | API `GET /api/channels/logs` sem filtros | Retorna 50 registros mais recentes | P1 |

### 6.3 Badge de alertas na sidebar

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F4-B01 | Canal desconectado com `is_active=true` | Badge vermelho aparece no nav "Conexões" | P1 |
| F4-B02 | Canal reconecta | Badge some automaticamente | P1 |
| F4-B03 | Zero canais desconectados | Sem badge | P2 |

---

## 7. Fase 5 — CRM

### 7.1 Contatos (`/contacts`)

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F5-C01 | Lista paginada de contatos | Contatos do tenant exibidos corretamente | P1 |
| F5-C02 | Busca por nome/telefone | Filtra em tempo real | P1 |
| F5-C03 | Perfil completo (`/contacts/[id]`) | Nome, telefone, email, CPF, endereço, campos customizados | P1 |
| F5-C04 | Histórico de conversas no perfil | Todas as conversas do contato listadas | P1 |
| F5-C05 | Adicionar nota interna | Nota salva em `contact_notes`; visível no perfil | P1 |
| F5-C06 | Campos customizados definidos pelo tenant | Exibidos e editáveis no perfil | P1 |
| F5-C07 | Isolamento entre tenants (RLS) | Contato de tenant A não visível para tenant B | P0 |

### 7.2 Editor de campos customizados (`/configuracoes/campos-crm`)

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F5-CF01 | Criar campo do tipo `text` | Campo aparece em `contact_field_definitions`; exibido no perfil | P1 |
| F5-CF02 | Criar campo do tipo `select` com opções | Dropdown funcional no perfil do contato | P1 |
| F5-CF03 | Campo `is_required` sem valor | Formulário bloqueia save com erro de validação | P1 |
| F5-CF04 | Reordenar campos (display_order) | Ordem respeitada no perfil do contato | P2 |

### 7.3 CRM Kanban (`/crm`)

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F5-K01 | Pipeline com estágios do tenant exibidos | Colunas corretas no Kanban | P1 |
| F5-K02 | Drag-and-drop entre estágios | `conversations.pipeline_stage_id` atualizado; histórico em `pipeline_stage_history` | P1 |
| F5-K03 | Mover para estágio `is_won=true` | Conversa marcada como ganha | P1 |
| F5-K04 | Mover para estágio `is_closed=true` | Conversa encerrada no Kanban | P1 |
| F5-K05 | Valor do deal editável no card | `deal_value` persistido corretamente | P2 |
| F5-K06 | Kanban vazio (sem conversas no pipeline) | Estado vazio amigável, sem erros | P2 |

### 7.4 Relatórios (`/relatorios/crm`)

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| F5-R01 | KPIs em tempo real | Conversas ativas, fechadas, por IA, por humano | P1 |
| F5-R02 | Pipeline breakdown | Contagem por estágio | P1 |
| F5-R03 | Job `metrics_daily` (quando ativado) | `metrics_daily` populado diariamente | P2 |
| F5-R04 | Cron sem `CRON_SECRET` configurado | Job retorna 401; sem execução | P1 |

---

## 8. Segurança e Dados

### 8.1 RLS e isolamento de tenants

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| S-01 | Tenant A tenta acessar dados do Tenant B via API | 403 ou resultado vazio | P0 |
| S-02 | RLS em `agents` (BACKLOG-016) | Filtro por `tenant_id` funcional; workaround no código ainda ativo | P0 |
| S-03 | Supabase service role key não exposta ao frontend | `SUPABASE_SERVICE_ROLE_KEY` ausente em bundle público | P0 |
| S-04 | Credenciais em variáveis de ambiente (não em código) | Sem secrets no código-fonte ou docs públicas | P0 |

### 8.2 Autenticação e autorização

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| S-05 | JWT adulterado | Middleware rejeita com 401 | P0 |
| S-06 | Acesso a rota `adminOnly` por `role=user` | 403/redirect | P0 |
| S-07 | Acesso a `/overview`, `/teams`, `/automation` por agente | Bloqueado por `lib/permissions/index.ts` | P0 |
| S-08 | Webhook do gateway sem `GATEWAY_API_KEY` | 401 retornado | P1 |
| S-09 | Evolution webhook sem `EVOLUTION_WEBHOOK_SECRET` correto | Payload rejeitado | P1 |

### 8.3 LGPD / Dados pessoais

| ID | Caso | Esperado | Severidade |
|---|---|---|---|
| S-10 | Backup via Telegram (BACKLOG-LGPD) | Verificar se `backup.sh` ainda envia dump para Telegram | P1 |
| S-11 | Dados de clientes em logs do gateway | Logs não devem persistir conteúdo de mensagens de clientes | P1 |

---

## 9. Testes de Regressão Transversais

Executar após cada deploy em `main`.

### 9.1 Fluxo completo de mensagem (E2E crítico)

```
1. Enviar WhatsApp para instância conectada
2. ✓ Mensagem aparece no Inbox em < 3s (Realtime)
3. ✓ Campos preenchidos: contact, conversation, message, external_message_id
4. ✓ URA Engine roteia conforme configuração do tenant
5. ✓ Agente atribuído recebe no filtro "Meus"
6. ✓ Agente responde → mensagem entregue via gateway → confirmação via Realtime
```

### 9.2 Checklist pós-deploy

| Item | Verificação |
|---|---|
| `GET /health` no gateway | `{"status":"ok"}` |
| `npm run build` sem erros | 0 erros TypeScript |
| Realtime ativo | WebSocket conectado (DevTools) |
| Filtros do Inbox | "Meus", "Não atribuídos", "Encerradas" funcionando |
| Disponibilidade de agente | Toggle na sidebar funcional |
| Logs de canal | Novos eventos aparecem na tela |
| CRM Kanban | Drag-and-drop funcional |

### 9.3 Rollback smoke test

| Item | Procedimento |
|---|---|
| Rollback do Go Gateway | Trocar webhook Evolution de volta para n8n; verificar mensagem recebida |
| Rollback de deploy Next.js | Vercel → Deployments → Promote previous |

---

## 10. Critérios de Aceite Globais

### 10.1 Critérios de Go/No-Go para cada fase

| Fase | Critério mínimo |
|---|---|
| Fase 0 | Nenhum P0/P1 aberto; tempo de troca de conversa < 400ms medido |
| Fase 1 | Build sem erros; redirect `/livechat` → `/inbox` funcional |
| Fase 2 | 24h de dual-write sem divergência; rollback testado e documentado |
| Fase 3 | Roteamento URA funcional em 3 tipos de regra; agentes recebem no filtro "Meus" |
| Fase 4 | Logs gravados em produção; badge de alerta funcional |
| Fase 5 | Kanban drag-and-drop; perfil de contato com campos customizados |

### 10.2 Métricas de performance alvo

| Métrica | Meta |
|---|---|
| Tempo de abertura do Inbox | < 1.5s (cold) |
| Troca de conversa (cache hit) | < 50ms |
| Troca de conversa (cache miss) | < 400ms |
| Overhead de middleware | < 200ms |
| Latência do gateway (inbound) | < 200ms p99 |
| Latência do gateway (outbound) | < 500ms p95 |
| Aparição de mensagem no Inbox (Realtime) | < 3s ponta a ponta |

### 10.3 Itens do Backlog que bloqueiam lançamento para múltiplos tenants

- [ ] **BACKLOG-016** — Corrigir RLS policy na tabela `agents` (vazamento entre tenants)
- [ ] Staging completo com Supabase dedicado (evitar testar em produção)
- [ ] Ativar `CRON_SECRET` para o job `metrics_daily`

---

## Apêndice — Comandos úteis para QA

```bash
# Verificar health do gateway
curl https://livia-gw.online24por7.ai/health

# Logs ao vivo do gateway
ssh vps-livia "docker service logs livia-gateway_app -f 2>&1"

# Verificar RPC no Supabase
# SELECT proname FROM pg_proc WHERE proname = 'upsert_contact_conversation';

# Status das migrations
npm run db:status

# Build local antes de qualquer commit
npm run build

# Verificar se livechat ainda é referenciado (deve retornar apenas redirects)
grep -r "components/livechat" /home/frank/livia_dev_01 --include="*.ts" --include="*.tsx" | grep -v ".next"
grep -r "queries/livechat" /home/frank/livia_dev_01 --include="*.ts" --include="*.tsx" | grep -v ".next"
```

---

*Gerado com base no PLATFORM_EVOLUTION_PLAN.md — versão 2026-04-20, status atual 2026-04-26.*

CONVERSA CHATGPT
https://chatgpt.com/share/697225e4-f79c-8004-8b03-726d4c6b3105

Abaixo está o projeto completo (documentação + schemas + migração + RPCs + padrões de payload + queries de UI + blueprint n8n) para você implementar a bilhetagem por tenant, com 1 crédito = R$ 0,01, overdraft de 10%, catálogo genérico (provider+sku+componentes+vigência) e um motor único para LLM / ElevenLabs / futuros providers.

1) Visão geral
Objetivo
Registrar uso técnico (telemetria) em usages
Controlar saldo por tenant (wallets)
Registrar extrato contábil (ledger_entries)
Calcular custo de qualquer IA via catálogo genérico:
pricing_skus → “o que é cobrado” (provider+sku)
pricing_components → “em que unidade” (tokens, chars, seconds, images, request…)
pricing_component_prices → preço USD com vigência versionada
Aplicar markup (global / tenant / provider / sku / agent) via markup_rules
Aplicar câmbio USD→BRL via fx_usd_brl_history (com fallback)
Enfileirar notificações para o tenant (não para o cliente final) em billing_notifications, para o n8n disparar WhatsApp/email.
Regras de crédito
balance_credits é inteiro em centavos:
1 crédito = R$ 0,01
Débito:
debit_credits = ceil(sell_brl * 100)
Overdraft (margem extra):
available = balance + floor(max(balance, 0) * overdraft_percent)
Default: overdraft_percent = 0.10 (10%)
Se saldo ficar negativo, não aumenta limite (evita bola de neve).

2) SQL — Estrutura completa
Rode no Supabase SQL Editor.
Observação: usamos btree_gist para impedir sobreposição de vigência. No Supabase geralmente é permitido.
2.1 Extensão necessária
create extension if not exists btree_gist;

2.2 Alterações em tabelas existentes
(A) usages: adicionar campos padronizados
alter table public.usages
add column if not exists provider text,
add column if not exists sku text,
add column if not exists measures jsonb,
add column if not exists base_usd numeric,
add column if not exists sell_usd numeric,
add column if not exists fx_used numeric,
add column if not exists debited_credits bigint;

(B) markup_rules: migrar para provider+sku (mantém compatibilidade)
alter table public.markup_rules
add column if not exists provider text,
add column if not exists sku text;

-- compat: se você já usa "model", preenche "sku"
update public.markup_rules
set sku = coalesce(sku, model)
where sku is null;


2.3 Tabelas novas
2.3.1 Carteira do tenant
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,

  -- saldo em centavos (1 crédito = R$0,01)
  balance_credits bigint not null default 0,

  -- overdraft: 10% por padrão
  overdraft_percent numeric not null default 0.10,

  -- alertas de saldo baixo
  low_balance_threshold_credits bigint not null default 5000, -- R$50,00
  notify_low_balance boolean not null default true,
  notify_hard_stop boolean not null default true,

  -- estado de hard stop (pra dashboard e controle)
  hard_stop_active boolean not null default false,
  last_low_balance_notified_at timestamptz,
  last_hard_stop_notified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

2.3.2 Extrato contábil
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,

  direction text not null check (direction in ('credit','debit')),
  amount_credits bigint not null check (amount_credits > 0),
  balance_after bigint not null,

  source_type text not null,     -- 'purchase','usage','adjustment','refund',...
  source_ref text,              -- ex: 'usages.id=12345' ou 'purchase.id=...'
  usage_id bigint,              -- opcional: facilita join com usages

  description text,

  -- Opção A: meta ENXUTO (snapshot essencial do cálculo)
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_ledger_tenant_created_at
  on public.ledger_entries (tenant_id, created_at desc);

create index if not exists idx_ledger_usage_id
  on public.ledger_entries (usage_id);

2.3.3 Fila de notificações (para o n8n enviar ao tenant)
create table if not exists public.billing_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  severity text not null check (severity in ('info','warning','critical')),
  type text not null check (type in ('low_balance','hard_stop','recovered')),

  title text not null,
  message text not null,

  channels text[] not null default '{whatsapp,email}'::text[],
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  tries int not null default 0,
  last_error text,

  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_billing_notifications_pending
  on public.billing_notifications (status, created_at);

2.3.4 Câmbio USD→BRL
create table if not exists public.fx_usd_brl_history (
  id bigserial primary key,
  rate numeric not null, -- ex: 5.12
  source text,
  fetched_at timestamptz not null default now()
);

create index if not exists idx_fx_latest
  on public.fx_usd_brl_history (fetched_at desc);

2.3.5 Catálogo genérico de preços (SKU + componentes + preços versionados)
create table if not exists public.pricing_skus (
  id uuid primary key default gen_random_uuid(),
  provider text not null,     -- 'openai', 'elevenlabs', ...
  sku text not null,          -- 'gpt-4.1-mini', 'tts_standard', ...
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(provider, sku)
);

create table if not exists public.pricing_components (
  id uuid primary key default gen_random_uuid(),
  sku_id uuid not null references public.pricing_skus(id) on delete cascade,
  measure_key text not null,         -- 'input_tokens','output_tokens','chars','seconds','images','request'
  unit_multiplier numeric not null default 1.0,
  -- tokens por 1M -> 0.000001
  -- chars por 1k -> 0.001
  created_at timestamptz not null default now(),
  unique(sku_id, measure_key)
);

create table if not exists public.pricing_component_prices (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.pricing_components(id) on delete cascade,
  usd_per_unit numeric not null,
  effective_range tstzrange not null, -- [inicio, fim)
  created_at timestamptz not null default now(),
  exclude using gist (component_id with =, effective_range with &&)
);

create index if not exists idx_pricing_component_prices_range
  on public.pricing_component_prices using gist (component_id, effective_range);


3) SQL — Funções utilitárias e RPCs
3.1 FX “último câmbio” (com fallback)
create or replace function public.get_latest_fx_usd_brl()
returns numeric
language sql
stable
as $$
  select coalesce(
    (select rate from public.fx_usd_brl_history order by fetched_at desc limit 1),
    5.00
  );
$$;

3.2 Disponível com overdraft
create or replace function public.wallet_available_credits(p_balance bigint, p_overdraft_percent numeric)
returns bigint
language sql
immutable
as $$
  select
    p_balance
    + case
        when p_balance > 0 then floor(p_balance * p_overdraft_percent)::bigint
        else 0
      end;
$$;

3.3 Resolver markup (provider+sku+tenant+agent com prioridade)
create or replace function public.resolve_markup_v2(
  p_tenant_id uuid,
  p_agent_id uuid,
  p_provider text,
  p_sku text
)
returns table(multiplier numeric, fixed_usd numeric, rule_id uuid)
language sql
stable
as $$
  select mr.multiplier, mr.fixed_usd, mr.id
  from public.markup_rules mr
  where mr.is_active = true
    and (mr.tenant_id is null or mr.tenant_id = p_tenant_id)
    and (mr.provider is null or mr.provider = p_provider)
    and (mr.sku is null or mr.sku = p_sku)
    and (mr.agent_id is null or mr.agent_id = p_agent_id)
  order by
    mr.priority asc,
    (mr.tenant_id is not null) desc,
    (mr.provider is not null) desc,
    (mr.sku is not null) desc,
    (mr.agent_id is not null) desc
  limit 1;
$$;

3.4 Preço vigente de um componente
create or replace function public.get_component_price_usd(p_component_id uuid, p_at timestamptz)
returns numeric
language sql
stable
as $$
  select pcp.usd_per_unit
  from public.pricing_component_prices pcp
  where pcp.component_id = p_component_id
    and p_at <@ pcp.effective_range
  order by lower(pcp.effective_range) desc
  limit 1;
$$;

3.5 Enfileirar notificação
create or replace function public.enqueue_billing_notification(
  p_tenant_id uuid,
  p_type text,
  p_severity text,
  p_title text,
  p_message text,
  p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql
as $$
begin
  insert into public.billing_notifications(
    tenant_id, type, severity, title, message, meta
  ) values (
    p_tenant_id, p_type, p_severity, p_title, p_message, p_meta
  );
end;
$$;


3.6 RPC: Creditar carteira (compra/ajuste)
create or replace function public.credit_wallet(
  p_tenant_id uuid,
  p_amount_credits bigint,
  p_source_type text default 'purchase',
  p_source_ref text default null,
  p_description text default 'Compra de créditos',
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_wallet_id uuid;
  v_balance bigint;
  v_new_balance bigint;
begin
  if p_amount_credits <= 0 then
    raise exception 'INVALID_CREDIT_AMOUNT';
  end if;

  insert into public.wallets (tenant_id)
  values (p_tenant_id)
  on conflict (tenant_id) do nothing;

  select id, balance_credits
    into v_wallet_id, v_balance
  from public.wallets
  where tenant_id = p_tenant_id
  for update;

  v_new_balance := v_balance + p_amount_credits;

  update public.wallets
    set balance_credits = v_new_balance,
        updated_at = now()
  where id = v_wallet_id;

  insert into public.ledger_entries (
    tenant_id, wallet_id, direction, amount_credits, balance_after,
    source_type, source_ref, description, meta
  ) values (
    p_tenant_id, v_wallet_id, 'credit', p_amount_credits, v_new_balance,
    p_source_type, p_source_ref, p_description,
    jsonb_build_object(
      'credited_credits', p_amount_credits,
      'balance_after', v_new_balance
    ) || coalesce(p_meta,'{}'::jsonb)
  );

  -- se estava em hard_stop e voltou a ter disponível > 0, notifica recovered
  if (select hard_stop_active from public.wallets where tenant_id = p_tenant_id) = true then
    if public.wallet_available_credits(v_new_balance, (select overdraft_percent from public.wallets where tenant_id=p_tenant_id)) > 0 then
      update public.wallets
        set hard_stop_active = false
      where tenant_id = p_tenant_id;

      perform public.enqueue_billing_notification(
        p_tenant_id,
        'recovered',
        'info',
        'IA liberada após recarga',
        'Créditos recarregados. Sua operação pode voltar a usar IA normalmente.',
        jsonb_build_object('balance_credits', v_new_balance)
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'credited_credits', p_amount_credits,
    'balance_credits', v_new_balance,
    'balance_brl', (v_new_balance / 100.0)
  );
end;
$$;


3.7 RPC: Cobrança única para qualquer provider (motor final)
Assinatura
n8n envia: provider, sku, measures (JSONB)
o banco calcula base_usd lendo o catálogo e preços vigentes
aplica markup + fx → débito em créditos
grava usages + ledger_entries
dispara low_balance / hard_stop na fila de notificações, com anti-spam
create or replace function public.bill_usage_v2(
  p_tenant_id uuid,
  p_contact_id uuid,
  p_agent_id uuid,
  p_conversation_id uuid,

  p_provider text,
  p_sku text,
  p_measures jsonb,

  p_workflow_id text default null,
  p_execution_id int default null,
  p_billed_at timestamptz default now(),   -- permite auditoria/retrocessos se precisar
  p_meta jsonb default '{}'::jsonb         -- meta adicional do n8n (rota, node, etc.)
)
returns jsonb
language plpgsql
as $$
declare
  v_wallet_id uuid;
  v_balance bigint;
  v_overdraft numeric;
  v_available bigint;

  v_fx numeric;

  v_m_mult numeric;
  v_m_fixed numeric;
  v_m_rule uuid;

  v_sku_id uuid;

  v_base_usd numeric := 0;
  v_sell_usd numeric := 0;
  v_sell_brl numeric := 0;

  v_debit_credits bigint;
  v_new_balance bigint;

  v_usage_id bigint;

  -- componentes loop
  r record;
  v_unit_value numeric;
  v_price_usd numeric;
  v_measure_text text;

  -- alertas
  v_threshold bigint;
  v_notify_low boolean;
  v_notify_stop boolean;
  v_available_after bigint;
begin
  if p_provider is null or trim(p_provider) = '' then
    raise exception 'INVALID_PROVIDER';
  end if;
  if p_sku is null or trim(p_sku) = '' then
    raise exception 'INVALID_SKU';
  end if;
  if p_measures is null then
    p_measures := '{}'::jsonb;
  end if;

  -- garante wallet
  insert into public.wallets (tenant_id)
  values (p_tenant_id)
  on conflict (tenant_id) do nothing;

  -- trava wallet
  select id, balance_credits, overdraft_percent, low_balance_threshold_credits, notify_low_balance, notify_hard_stop
    into v_wallet_id, v_balance, v_overdraft, v_threshold, v_notify_low, v_notify_stop
  from public.wallets
  where tenant_id = p_tenant_id
  for update;

  v_available := public.wallet_available_credits(v_balance, v_overdraft);

  -- valida SKU ativa
  select id into v_sku_id
  from public.pricing_skus
  where provider = p_provider and sku = p_sku and is_active = true;

  if v_sku_id is null then
    raise exception 'SKU_NOT_FOUND_OR_INACTIVE: %/%', p_provider, p_sku;
  end if;

  -- calcula base_usd somando componentes
  for r in
    select pc.id as component_id, pc.measure_key, pc.unit_multiplier
    from public.pricing_components pc
    where pc.sku_id = v_sku_id
  loop
    -- pega value das medidas
    -- regra: se measure_key = 'request' e não veio, assume 1
    if r.measure_key = 'request' and not (p_measures ? r.measure_key) then
      v_unit_value := 1;
    else
      v_measure_text := p_measures ->> r.measure_key;
      if v_measure_text is null or trim(v_measure_text) = '' then
        v_unit_value := 0;
      else
        -- cast seguro: tenta numeric; se falhar, zera
        begin
          v_unit_value := v_measure_text::numeric;
        exception when others then
          v_unit_value := 0;
        end;
      end if;
    end if;

    if v_unit_value <> 0 then
      v_price_usd := public.get_component_price_usd(r.component_id, p_billed_at);
      if v_price_usd is null then
        raise exception 'NO_ACTIVE_PRICE_FOR_COMPONENT: %', r.component_id;
      end if;

      v_base_usd := v_base_usd + (v_unit_value * v_price_usd * r.unit_multiplier);
    end if;
  end loop;

  if v_base_usd < 0 then
    raise exception 'INVALID_BASE_USD';
  end if;

  -- markup
  select rm.multiplier, rm.fixed_usd, rm.rule_id
    into v_m_mult, v_m_fixed, v_m_rule
  from public.resolve_markup_v2(p_tenant_id, p_agent_id, p_provider, p_sku) rm;

  v_m_mult := coalesce(v_m_mult, 1.0);
  v_m_fixed := coalesce(v_m_fixed, 0.0);

  v_sell_usd := (v_base_usd * v_m_mult) + v_m_fixed;

  if v_sell_usd < 0 then
    raise exception 'INVALID_SELL_USD';
  end if;

  -- fx e conversão
  v_fx := public.get_latest_fx_usd_brl();
  v_sell_brl := v_sell_usd * v_fx;

  -- créditos (centavos): 1 crédito = R$0,01 => *100
  v_debit_credits := ceil(v_sell_brl * 100.0)::bigint;

  if v_debit_credits < 0 then
    raise exception 'INVALID_DEBIT_CREDITS';
  end if;

  -- hard stop: considera available com overdraft
  if v_available < v_debit_credits then
    -- marca hard_stop ativo
    update public.wallets set hard_stop_active = true, last_hard_stop_notified_at = now(), updated_at = now()
    where tenant_id = p_tenant_id
      and hard_stop_active = false
      and (last_hard_stop_notified_at is null or last_hard_stop_notified_at <= now() - interval '60 minutes');

    if found and v_notify_stop then
      perform public.enqueue_billing_notification(
        p_tenant_id,
        'hard_stop',
        'critical',
        'IA pausada por falta de créditos',
        'Seus créditos chegaram ao limite. Recarregue para continuar utilizando IA.',
        jsonb_build_object(
          'balance_credits', v_balance,
          'available_credits', v_available,
          'needed_credits', v_debit_credits,
          'provider', p_provider,
          'sku', p_sku
        )
      );
    end if;

    raise exception 'INSUFFICIENT_CREDITS: balance=% available=% needed=%', v_balance, v_available, v_debit_credits;
  end if;

  -- debita
  v_new_balance := v_balance - v_debit_credits;

  -- grava usage (padronizado)
  insert into public.usages (
    model, input_tokens, output_tokens, total_tokens,
    workflow_id, execution_id,
    id_tenant, id_contact, id_agent, id_conversation,
    provider, sku, measures,
    base_usd, sell_usd, fx_used, debited_credits
  ) values (
    -- model: mantemos por compatibilidade; para LLM pode ser o sku; para outros também
    p_sku,
    coalesce((p_measures->>'input_tokens')::int, 0),
    coalesce((p_measures->>'output_tokens')::int, 0),
    coalesce((p_measures->>'input_tokens')::int, 0) + coalesce((p_measures->>'output_tokens')::int, 0),
    p_workflow_id, p_execution_id,
    p_tenant_id, p_contact_id, p_agent_id, p_conversation_id,
    p_provider, p_sku, p_measures,
    v_base_usd, v_sell_usd, v_fx, v_debit_credits
  )
  returning id into v_usage_id;

  -- atualiza saldo
  update public.wallets
    set balance_credits = v_new_balance,
        updated_at = now()
  where id = v_wallet_id;

  -- extrato (meta enxuto)
  insert into public.ledger_entries (
    tenant_id, wallet_id, direction, amount_credits, balance_after,
    source_type, source_ref, usage_id, description, meta
  ) values (
    p_tenant_id, v_wallet_id, 'debit', v_debit_credits, v_new_balance,
    'usage', 'usages.id=' || v_usage_id::text, v_usage_id,
    'Cobrança de uso IA',
    jsonb_build_object(
      'provider', p_provider,
      'sku', p_sku,
      'measures', p_measures,
      'base_usd', v_base_usd,
      'sell_usd', v_sell_usd,
      'fx_used', v_fx,
      'sell_brl', v_sell_brl,
      'markup_multiplier', v_m_mult,
      'markup_fixed_usd', v_m_fixed,
      'markup_rule_id', v_m_rule
    ) || coalesce(p_meta,'{}'::jsonb)
  );

  -- ALERTA low balance (anti-spam 6h)
  v_available_after := public.wallet_available_credits(v_new_balance, v_overdraft);

  if v_notify_low and v_available_after <= v_threshold then
    update public.wallets
      set last_low_balance_notified_at = now()
    where tenant_id = p_tenant_id
      and (last_low_balance_notified_at is null or last_low_balance_notified_at <= now() - interval '6 hours');

    if found then
      perform public.enqueue_billing_notification(
        p_tenant_id,
        'low_balance',
        'warning',
        'Créditos perto do fim',
        'Seu saldo está baixo. Recarregue créditos para evitar pausa da IA.',
        jsonb_build_object(
          'balance_credits', v_new_balance,
          'available_credits', v_available_after,
          'threshold_credits', v_threshold
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'usage_id', v_usage_id,
    'debited_credits', v_debit_credits,
    'balance_credits', v_new_balance,
    'balance_brl', (v_new_balance / 100.0),
    'sell_usd', v_sell_usd,
    'sell_brl', v_sell_brl
  );
end;
$$;


4) Migração: ai_models → catálogo pricing (LLM)
Este script cria SKUs e components para cada linha de ai_models:
provider = 'openai' (ajuste se você quiser outro)
component input_tokens e output_tokens
unit_multiplier para tokens por 1M: 0.000001
preço vigente: [now(), infinity)
do $$
declare
  r record;
  v_sku_id uuid;
  v_in_component_id uuid;
  v_out_component_id uuid;
begin
  for r in select * from public.ai_models where is_active = true
  loop
    -- SKU
    insert into public.pricing_skus(provider, sku, description, is_active)
    values ('openai', r.model, 'Migrado de ai_models', true)
    on conflict (provider, sku) do update set is_active = true
    returning id into v_sku_id;

    -- INPUT component
    insert into public.pricing_components(sku_id, measure_key, unit_multiplier)
    values (v_sku_id, 'input_tokens', 0.000001)
    on conflict (sku_id, measure_key) do update set unit_multiplier = excluded.unit_multiplier
    returning id into v_in_component_id;

    -- OUTPUT component
    insert into public.pricing_components(sku_id, measure_key, unit_multiplier)
    values (v_sku_id, 'output_tokens', 0.000001)
    on conflict (sku_id, measure_key) do update set unit_multiplier = excluded.unit_multiplier
    returning id into v_out_component_id;

    -- Preços vigentes (fecha vigência atual se existir e recria)
    -- INPUT
    begin
      insert into public.pricing_component_prices(component_id, usd_per_unit, effective_range)
      values (v_in_component_id, r.input_usd_per_1m, tstzrange(now(), 'infinity', '[)'));
    exception when others then
      -- se já existe vigência atual, você decide manualmente como versionar; aqui mantemos o existente
      null;
    end;

    -- OUTPUT
    begin
      insert into public.pricing_component_prices(component_id, usd_per_unit, effective_range)
      values (v_out_component_id, r.output_usd_per_1m, tstzrange(now(), 'infinity', '[)'));
    exception when others then
      null;
    end;
  end loop;
end $$;


5) Exemplo: cadastrar ElevenLabs (chars)
Você vai criar 1 SKU (ex.: tts_standard) com component chars.
Escolha recomendada: cobrar por 1 char com unit_multiplier = 1.0
(se quiser por 1k chars, use unit_multiplier=0.001 e usd_per_unit como “USD por 1k chars”)
-- SKU
insert into public.pricing_skus(provider, sku, description)
values ('elevenlabs', 'tts_standard', 'TTS padrão (cobrança por chars)')
on conflict (provider, sku) do nothing;

-- component chars
with s as (
  select id from public.pricing_skus where provider='elevenlabs' and sku='tts_standard'
)
insert into public.pricing_components(sku_id, measure_key, unit_multiplier)
select s.id, 'chars', 1.0 from s
on conflict (sku_id, measure_key) do nothing;

-- preço vigente (EXEMPLO: 0.00002 USD por char)
with c as (
  select pc.id
  from public.pricing_components pc
  join public.pricing_skus ps on ps.id = pc.sku_id
  where ps.provider='elevenlabs' and ps.sku='tts_standard' and pc.measure_key='chars'
)
insert into public.pricing_component_prices(component_id, usd_per_unit, effective_range)
select c.id, 0.00002, tstzrange(now(), 'infinity', '[)') from c;


6) Markup: regra padrão + exemplos
Regra global default (ex.: vender 4x tudo)
insert into public.markup_rules(tenant_id, provider, sku, agent_id, multiplier, fixed_usd, priority, is_active)
values (null, null, null, null, 4.0, 0.0, 100, true);

Tenant específico com multiplicador maior só no ElevenLabs
insert into public.markup_rules(tenant_id, provider, sku, multiplier, priority)
values ('TENANT_UUID', 'elevenlabs', 'tts_standard', 6.0, 10);


7) Como o n8n chama o motor (padrão único)
Endpoint Supabase RPC
POST {SUPABASE_URL}/rest/v1/rpc/bill_usage_v2
Headers:
apikey: SERVICE_ROLE_KEY
Authorization: Bearer SERVICE_ROLE_KEY
Content-Type: application/json
Payload LLM
{
  "p_tenant_id": "UUID_TENANT",
  "p_contact_id": "UUID_CONTACT",
  "p_agent_id": "UUID_AGENT",
  "p_conversation_id": "UUID_CONVERSATION",
  "p_provider": "openai",
  "p_sku": "gpt-4.1-mini",
  "p_measures": { "input_tokens": 1234, "output_tokens": 456 },
  "p_workflow_id": "wf_x",
  "p_execution_id": 999,
  "p_meta": { "node": "OpenAI", "route": "sales_agent" }
}

Payload ElevenLabs (chars)
{
  "p_tenant_id": "UUID_TENANT",
  "p_contact_id": "UUID_CONTACT",
  "p_agent_id": "UUID_AGENT",
  "p_conversation_id": "UUID_CONVERSATION",
  "p_provider": "elevenlabs",
  "p_sku": "tts_standard",
  "p_measures": { "chars": 980 },
  "p_workflow_id": "wf_tts",
  "p_execution_id": 1001,
  "p_meta": { "voice_id": "abc", "latency_ms": 420 }
}

Tratamento de erro no n8n
Se o RPC retornar erro INSUFFICIENT_CREDITS...:
não responder ao contato final
enfileira notificação já foi criada no DB
seu fluxo pode:
parar a automação
opcionalmente pausar IA do tenant/conversa do lado do seu app (via update)

8) Workflow n8n para NOTIFICAÇÕES (WhatsApp/email ao tenant)
Passo A — Buscar pendentes
Query:
select * from public.billing_notifications
where status = 'pending'
order by created_at asc
limit 20;

Passo B — Marcar “processing”
update public.billing_notifications
set status='processing'
where id = :id and status='pending';

Passo C — Descobrir destinatários (tenant)
Você já tem em tenants:
responsible_finance_whatsapp, responsible_finance_email
responsible_tech_whatsapp, responsible_tech_email
Então n8n faz:
select responsible_finance_whatsapp, responsible_finance_email,
       responsible_tech_whatsapp, responsible_tech_email,
       name
from public.tenants
where id = :tenant_id;

Passo D — Enviar
WhatsApp: via seu provider (Evolution API / Z-API / etc.)
Email: via seu canal (SMTP / Sendgrid / etc.)
Passo E — Marcar “sent” ou “failed”
Sent:
update public.billing_notifications
set status='sent', sent_at=now()
where id = :id;

Failed:
update public.billing_notifications
set status='failed', tries=tries+1, last_error=:err
where id = :id;


9) Queries prontas para o seu painel
9.1 Saldo + disponível
select
  w.tenant_id,
  w.balance_credits,
  (w.balance_credits / 100.0) as balance_brl,
  public.wallet_available_credits(w.balance_credits, w.overdraft_percent) as available_credits,
  (public.wallet_available_credits(w.balance_credits, w.overdraft_percent) / 100.0) as available_brl,
  w.hard_stop_active
from public.wallets w
where w.tenant_id = :tenant_id;

9.2 Extrato (últimos 50)
select
  created_at,
  direction,
  amount_credits,
  (amount_credits / 100.0) as amount_brl,
  balance_after,
  (balance_after / 100.0) as balance_brl,
  source_type,
  description,
  meta
from public.ledger_entries
where tenant_id = :tenant_id
order by created_at desc
limit 50;

9.3 Consumo por provider/sku (últimos 7 dias)
select
  provider,
  sku,
  count(*) as calls,
  sum(debited_credits) as debited_credits,
  (sum(debited_credits) / 100.0) as debited_brl
from public.usages
where id_tenant = :tenant_id
  and created_at >= now() - interval '7 days'
group by provider, sku
order by debited_credits desc;


10) Operação: atualização de câmbio e versionamento de preço
Atualizar câmbio (via n8n cron)
Insere 1 linha por atualização:
insert into public.fx_usd_brl_history(rate, source)
values (:rate, 'n8n');

Alterar preço com vigência a partir de uma data T
(encerra o atual e cria o novo)
-- 1) fecha o atual vigente
update public.pricing_component_prices
set effective_range = tstzrange(lower(effective_range), :T, '[)')
where component_id = :component_id
  and now() <@ effective_range;

-- 2) cria o novo
insert into public.pricing_component_prices(component_id, usd_per_unit, effective_range)
values (:component_id, :novo_preco, tstzrange(:T, 'infinity', '[)'));


11) Checklist de testes (rápido e certeiro)
Criar wallet automaticamente: chamar credit_wallet e ver se cria wallet.
Creditar: credit_wallet(tenant, 10000) → saldo = R$100,00
Cadastrar SKU LLM (migração ai_models) + markup global
Bill LLM: bill_usage_v2 com tokens → verifica:
usages inserido
ledger_entries debit inserido
wallet.balance_credits decrementou
Bill ElevenLabs: SKU tts + chars → mesmo comportamento
Forçar saldo baixo → ver billing_notifications low_balance
Forçar hard stop → ver billing_notifications hard_stop e erro INSUFFICIENT_CREDITS

12) Observação importante sobre segurança (Supabase + n8n)
Para o n8n cobrar corretamente e sem dor: use SERVICE_ROLE_KEY nas chamadas RPC.
Para o seu painel (usuários do tenant): você pode aplicar RLS em wallets/ledger_entries/usages/billing_notifications filtrando por tenant_id.
Se você quiser, eu te mando também um pacote de RLS policies prontas baseado na sua tabela public.users (id, tenant_id).

Se você quiser, no próximo passo eu também posso te entregar:
um “seed” padrão completo (cria markup default, cria SKU/ElevenLabs padrão, cria thresholds por tenant),
e um snippet n8n (Code Node) que normaliza automaticamente qualquer retorno em measures (tokens/chars/etc.) antes de chamar o RPC.


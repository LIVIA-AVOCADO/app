# Meta WhatsApp Oficial — Documentação Técnica

> Módulo implementado em 30/03/2026.  
> Permite adicionar canais WhatsApp via Meta Business Cloud API (API Oficial da Meta).

---

## Visão Geral

O LIVIA suporta dois tipos de conexão WhatsApp:

| Tipo | Identificador | Autenticação | Vantagem |
|---|---|---|---|
| **Evolution API** | `evolution_001` | QR code gerado no LIVIA | Setup simples, sem conta Meta |
| **Meta Oficial** | `meta_oficial_whatsapp` | Phone Number ID + Access Token | API oficial, mais estável, sem banimento |

---

## Arquitetura

### Fluxo de criação de canal Meta

```
Usuário preenche formulário (nome, phone_number_id, access_token)
        ↓
POST /api/configuracoes/conexoes/meta/create
        ↓
Verifica credenciais na Graph API (GET /v18.0/{phone_number_id})
        ↓
Sucesso   → salva channels com connection_status = 'connected'
4xx Meta  → retorna erro 422 (credencial inválida, não salva)
Rede/5xx  → salva com connection_status = 'unknown' + warning
        ↓
router.refresh() → card aparece na página de Conexões
```

### Fluxo de verificação de status

```
Usuário clica "Atualizar Status" no card Meta
        ↓
GET /api/configuracoes/conexoes/meta/status?channelId={id}
        ↓
Lê config_json.access_token do banco
        ↓
Chama GET /v18.0/{phone_number_id} com Authorization: Bearer {token}
        ↓
Sucesso → connection_status = 'connected', atualiza DB se mudou
Falha   → connection_status = 'disconnected', atualiza DB se mudou
        ↓
Retorna dados para o card atualizar o badge
```

---

## Estrutura de Arquivos

```
lib/
└── meta/
    └── client.ts                          # Wrapper Graph API (verifyPhoneNumber)

app/api/configuracoes/conexoes/meta/
├── create/route.ts                        # POST — criar canal
├── status/route.ts                        # GET  — verificar status
├── delete/route.ts                        # DELETE — remover canal (soft delete)
├── webhook/route.ts                       # GET (hub challenge) + POST (eventos)
└── update-credentials/route.ts           # PATCH — atualizar token expirado

components/configuracoes/conexoes/
├── add-meta-channel-dialog.tsx            # Dialog de criação (form/loading/connected/warning/error)
└── update-meta-credentials-dialog.tsx    # Dialog de atualização de token

supabase/migrations/
└── 20260330_seed_meta_provider.sql       # Seed do provedor na tabela channel_providers
```

---

## Banco de Dados

### Tabela `channel_providers`

O provedor Meta é inserido pela migration `20260330_seed_meta_provider.sql`:

```sql
channel_provider_identifier_code = 'meta_oficial_whatsapp'
name                              = 'Meta Oficial WhatsApp'
channel_type_id                   → FK para channel_types WHERE name = 'whatsapp'
```

### Tabela `channels` — estrutura por canal Meta

| Coluna | Valor | Descrição |
|---|---|---|
| `provider_external_channel_id` | `123456789012345` | Phone Number ID da Meta |
| `config_json` | `{ "access_token": "EAAA..." }` | Token de acesso (server-side only) |
| `identification_number` | `+55 11 99999-9999` | Número formatado (display) |
| `instance_company_name` | `"Nome da Empresa"` | verified_name retornado pela Graph API |
| `connection_status` | `connected \| disconnected \| unknown` | Status da conexão |
| `channel_provider_id` | UUID | FK para channel_providers |

> **Segurança:** o campo `config_json` (com o `access_token`) **nunca é enviado ao browser**.  
> O `page.tsx` não seleciona essa coluna. Todas as rotas que leem o token usam `createAdminClient()` (service role, server-side).

---

## Variáveis de Ambiente

```env
# Meta Official WhatsApp API
# Gere um token aleatório e registre-o no Meta for Developers > seu App > Webhooks > Verify Token
META_WEBHOOK_VERIFY_TOKEN=seu-token-secreto-aqui
```

> O `META_WEBHOOK_VERIFY_TOKEN` é diferente do `access_token` por canal:
> - **Access token** → token de autenticação da API por número, salvo no banco
> - **META_WEBHOOK_VERIFY_TOKEN** → token fixo da aplicação para verificação do endpoint webhook

---

## API Routes

### `POST /api/configuracoes/conexoes/meta/create`

Cria um canal Meta. Valida credenciais na Graph API antes de salvar.

**Body:**
```json
{
  "name": "WhatsApp Atendimento",
  "phoneNumberId": "123456789012345",
  "accessToken": "EAAA..."
}
```

**Respostas:**
- `200` — canal criado (`connectionStatus: connected` ou `unknown` + `warning`)
- `400` — dados inválidos
- `401` — não autenticado
- `403` — sem permissão (módulo `conexoes`)
- `422` — provedor não encontrado ou credencial inválida (4xx da Meta)
- `500` — erro no banco

---

### `GET /api/configuracoes/conexoes/meta/status?channelId={id}`

Verifica o status atual consultando a Graph API e sincroniza o banco.

**Resposta `200`:**
```json
{
  "id": "uuid",
  "name": "WhatsApp Atendimento",
  "phoneNumberId": "123456789012345",
  "connectionStatus": "connected",
  "phoneNumber": "+55 11 99999-9999",
  "verifiedName": "Nome da Empresa"
}
```

---

### `DELETE /api/configuracoes/conexoes/meta/delete`

Soft delete do canal (seta `is_active = false`). Não há instância externa para remover — o token é gerenciado pelo Meta Business Manager.

**Body:** `{ "channelId": "uuid" }`

---

### `PATCH /api/configuracoes/conexoes/meta/update-credentials`

Atualiza o access token de um canal (quando expirado ou trocado).

**Body:**
```json
{
  "channelId": "uuid",
  "phoneNumberId": "123456789012345",
  "accessToken": "EAAA_novo_token..."
}
```

---

### `GET /api/configuracoes/conexoes/meta/webhook`

Verificação do endpoint pela Meta (hub challenge).

**Query params esperados:**
- `hub.mode = subscribe`
- `hub.verify_token` = valor de `META_WEBHOOK_VERIFY_TOKEN`
- `hub.challenge` = string a ser retornada

---

### `POST /api/configuracoes/conexoes/meta/webhook`

Recebe eventos da Meta. Atualiza `connection_status = 'disconnected'` quando a Meta reporta erros no número.

---

## Configuração na Meta (passo a passo)

### 1. Criar o App

1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. **Meus Apps → Criar App → Business**
3. Vincule a uma Meta Business Account
4. Adicione o produto **WhatsApp**

### 2. Obter Phone Number ID e Access Token

1. **WhatsApp → API Setup**
2. Copie o **Phone Number ID** (número de 15 dígitos)
3. Para testes: use o **Temporary access token** (expira em 24h)
4. Para produção: crie um **System User Token permanente** (veja passo 4)

### 3. Adicionar número de produção

1. **WhatsApp → API Setup → Add phone number**
2. Siga o processo de verificação
3. Após verificado, o número aparece no seletor com seu Phone Number ID definitivo

### 4. Criar System User Token (produção)

1. Acesse [business.facebook.com](https://business.facebook.com)
2. **Configurações do Business → Usuários → Usuários do Sistema**
3. Criar usuário **Admin**
4. **Gerar novo token** → selecione o app
5. Permissões necessárias: `whatsapp_business_messaging` + `whatsapp_business_management`
6. Token gerado começa com `EAAA...` e **não expira**

### 5. Configurar Webhook

1. **WhatsApp → Configuration → Webhook → Edit**
2. **Callback URL:** `https://SEU_DOMINIO/api/configuracoes/conexoes/meta/webhook`
3. **Verify Token:** string aleatória que você escolhe (ex: `livia-webhook-2024-abc`)
4. Adicione essa string ao `.env.local`:
   ```env
   META_WEBHOOK_VERIFY_TOKEN=livia-webhook-2024-abc
   ```
5. Clique em **Verify and Save**
6. Em **Webhook Fields**, ative: **`messages`**

> **Em desenvolvimento local:** use [ngrok](https://ngrok.com) para expor o localhost com HTTPS.  
> Comando: `ngrok http 3000` → use a URL gerada como Callback URL.

### 6. Adicionar canal no LIVIA

1. **Configurações → Conexões → Adicionar canal → WhatsApp (Meta Oficial)**
2. Preencha nome, Phone Number ID e Access Token
3. Clique em **"Conectar canal"**

---

## Limitações e Decisões de Design

### Por que o usuário precisa acessar a plataforma Meta?

A Meta exige verificação de identidade da empresa e do número feita dentro do ecossistema deles (Meta Business Manager). Não é possível registrar um número diretamente pelo LIVIA sem passar por esse processo.

**Alternativa futura: Meta Embedded Signup**  
Fluxo OAuth onde o popup da Meta aparece dentro do LIVIA. O usuário faz login, seleciona o número e o LIVIA recebe `access_token` + `phone_number_id` automaticamente. Usado por Intercom, Zendesk e outros. Requer app Meta aprovado e revisado pela Meta.

### Por que o access_token fica no banco e não em env vars?

Cada tenant/canal tem seu próprio token. Variáveis de ambiente são únicas por instância — não escalam para múltiplos clientes.

### Por que salvar o canal mesmo sem verificação (status `unknown`)?

Erros de rede são transitórios. Se o servidor não consegue alcançar `graph.facebook.com` no momento do cadastro, seria ruim perder os dados do formulário. O usuário pode verificar depois clicando em "Atualizar Status" no card.

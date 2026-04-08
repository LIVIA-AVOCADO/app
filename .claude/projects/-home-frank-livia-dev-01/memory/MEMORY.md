# LIVIA Project Memory

## Zod Version
- Project uses Zod v4. `z.enum()` does NOT accept `required_error` — use `message` instead.

## Common Patterns
- Supabase types are outdated for some tables (reactivation, tags fields like `tenant_id`, `send_text`, `send_text_message`). Use `(supabase as any)` with eslint-disable comments.
- Auth pattern: `createClient() → auth.getUser() → users.select('tenant_id') → validate tenant match`
- API routes follow pattern from `app/api/quick-replies/` (auth + tenant validation + Zod schema)
- Nav items in `components/layout/nav-items.tsx` support nested `items[]` for subitems

## Planned Features
- [Silenciar Contato](project_mute_contact.md) — mute de contatos no livechat, Sprint 1 planejado

## Project Structure
- Dashboard pages: `app/(dashboard)/`
- API routes: `app/api/`
- Queries: `lib/queries/`
- Validations: `lib/validations/`
- UI components: `components/ui/` (shadcn)
- Lint script: `npx eslint` (NOT `next lint`)
- Type check: `npx tsc --noEmit`

## Channels Table — config_json Architecture
- [channels_config_json_design.md](channels_config_json_design.md) — design de provider-specific data no config_json

## Evolution API
- [project_evolution_webhook.md](project_evolution_webhook.md) — webhook URL do n8n first integrator

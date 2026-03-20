# Design tokens LIVIA (Stitch / Material 3 alinhado)

Fonte única: variáveis CSS em [`app/globals.css`](../app/globals.css) (`:root` e `.dark`), expostas ao Tailwind via `@theme inline`. **Não** usar hex em componentes para cores de interface.

## Papéis de superfície

| Token CSS | Uso recomendado | Classe Tailwind |
|-----------|-----------------|-----------------|
| `--background` | Canvas da app (área atrás do conteúdo) | `bg-background` |
| `--surface` | Folhas elevadas (sidebar, painéis claros) | `bg-surface` |
| `--foreground` / `--on-surface` | Texto principal | `text-foreground`, `text-on-surface` |
| `--on-surface-variant` | Texto secundário, subtítulos, labels | `text-on-surface-variant` |
| `--surface-container-low` | Inputs, filtros, chips discretos | `bg-surface-container-low` |
| `--surface-container` | Faixas intermediárias | `bg-surface-container` |
| `--surface-container-high` | Hover de linha, barras, destaques suaves | `bg-surface-container-high` |
| `--surface-container-highest` | Bordas de área, zebra forte | `bg-surface-container-highest` |

## Bordas e contorno

| Token | Uso | Classe |
|-------|-----|--------|
| `--border` | Bordas padrão (cards, divisórias) | `border-border` |
| `--outline-variant` | Divisórias mais suaves, separadores leves | `border-outline-variant` |
| `--input` | Anel de campo (compatível shadcn) | `border-input` |

## Marca e ação

| Token | Uso |
|-------|-----|
| `--primary` / `--primary-foreground` | CTA principal, links de ação (Button default) |
| `--primary-container` | Superfície preenchida com azul marca (chips, badges em fundo primário) |
| `--on-primary-container` | Texto sobre `primary-container` quando não for branco puro |
| `--accent` / `--accent-foreground` | Tom verde marca (estados positivos, highlights) |
| `--success` / `--warning` / `--destructive` | Semântica de status |

## Sidebar (shadcn)

| Token | Uso |
|-------|-----|
| `--sidebar` | Fundo do menu (referencia `--surface` no tema claro) |
| `--sidebar-primary` | Item ativo / destaque |
| `--sidebar-primary-foreground` | Texto do item ativo |
| `--sidebar-foreground` | Itens inativos |
| `--sidebar-border` | Borda direita do menu |

## Mapeamento Stitch → LIVIA (referência)

| Stitch (HTML) | Token LIVIA |
|---------------|-------------|
| `bg-[#F2F5FA]` (main canvas) | `bg-background` |
| `bg-[#FCFDFF]` (sidebar) | `bg-surface` / `bg-sidebar` |
| `text-[#5E687C]` | `text-muted-foreground` ou `text-on-surface-variant` |
| `text-[#454656]` | `text-on-surface-variant` |
| `bg-[#EDEFFC]` (nav ativo) | `bg-sidebar-primary` + `text-sidebar-primary-foreground` |
| `border-[#E4EAF3]` | `border-border` |
| `bg-surface-container-low` | `bg-surface-container-low` |
| `primary-container` | `bg-primary` / `bg-primary-container` (mesmo tom de marca) |

## Verde “secundário” (Stitch vs LIVIA)

- **Accent** (`--accent`): fundos suaves verdes (hover, listas).
- **Success** (`--success`): status “ok”, confirmação, badges de sucesso.

## Manutenção

Ao alterar a marca, editar apenas `:root` e `.dark` em `globals.css` e validar contraste (WCAG AA) para pares texto/fundo.

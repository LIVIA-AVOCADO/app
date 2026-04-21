'use client';

import { Tag, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { TagBadge } from '@/components/shared/tag-badge';
import type { Tag as TagType } from '@/types/database-helpers';
import type { TagSelectorMode } from './tag-selector';

interface TagTypeSectionProps {
  type: 'description' | 'success' | 'fail';
  label: string;
  tags: TagType[];
  selectedTagIds: Set<string>;
  loadingTags: Set<string>;
  mode: TagSelectorMode;
  onTagClick: (tagId: string) => void;
}

const ICONS = {
  description: Tag,
  success: CheckCircle2,
  fail: XCircle,
};

export function TagTypeSection({
  type,
  label,
  tags,
  selectedTagIds,
  loadingTags,
  mode,
  onTagClick,
}: TagTypeSectionProps) {
  // Se não houver tags desse tipo, não renderizar
  if (tags.length === 0) {
    return null;
  }

  const Icon = ICONS[type];

  return (
    <div className="space-y-2">
      {/* Header da seção */}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h5 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          {label}
        </h5>
      </div>

      {/* Lista de tags */}
      <div className="space-y-1">
        {tags.map((tag) => {
          const isSelected = selectedTagIds.has(tag.id);
          const isLoading = loadingTags.has(tag.id);

          return (
            <button
              key={tag.id}
              onClick={() => onTagClick(tag.id)}
              disabled={isLoading}
              className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-accent transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* Checkbox (apenas modo filter) */}
              {mode === 'filter' && (
                <Checkbox
                  checked={isSelected}
                  className="pointer-events-none"
                />
              )}

              {/* Loading spinner */}
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}

              {/* Tag badge */}
              <TagBadge tag={tag} size="sm" />

              {/* Label "Adicionar" (apenas modo assign e não loading) */}
              {mode === 'assign' && !isLoading && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Adicionar
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * TagBadge Component
 *
 * Badge para exibir categoria com cor
 *
 * Features:
 * - Exibe nome da tag
 * - Cor customizada do banco de dados
 * - Tamanhos: sm, md
 * - Acessível (alt text)
 */

'use client';

import type { Tag } from '@/types/database-helpers';
import { cn } from '@/lib/utils';

interface TagBadgeProps {
  tag: Tag;
  size?: 'sm' | 'md';
  className?: string;
}

export function TagBadge({ tag, size = 'sm', className }: TagBadgeProps) {
  // Converter hex para RGB para usar com opacity
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1]??"00", 16),
          g: parseInt(result[2]??"00", 16),
          b: parseInt(result[3]??"00", 16),
        }
      : { r: 59, g: 130, b: 246 }; // fallback: azul
      
  };

  const rgb = hexToRgb(tag.color || '#3B82F6');
  const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;
  const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
  const textColor = tag.color || '#3B82F6';

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        className
      )}
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        color: textColor,
      }}
      title={tag.tag_name}
    >
      {tag.tag_name}
    </span>
  );
}

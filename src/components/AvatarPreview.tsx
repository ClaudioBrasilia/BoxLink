/**
 * src/components/AvatarPreview.tsx
 * Avatar sempre exibido em proporção 2:3 (mesma do canvas 1024×1536 e upload 512×768).
 *
 * Para exibir avatar redondo (header, ranking), envolva com um wrapper externo:
 *   <div className="w-12 h-12 rounded-full overflow-hidden">
 *     <AvatarPreview equipped={...} size="sm" showBorder={false} />
 *   </div>
 */
import React, { useState } from 'react';
import type { AvatarSlot } from '../types';
import { cn } from '../lib/utils';
import { buildAvatarLayers, adjustmentToCSS, LayerAdjustment } from '../lib/avatarLayers';

interface AvatarPreviewProps {
  equipped: AvatarSlot;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Overrides de ajuste por itemId — vem do campo layer_adjustment do banco */
  itemAdjustments?: Record<string, Partial<LayerAdjustment>>;
  /** Exibe borda e brilho verde (padrão: true) */
  showBorder?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'avatar-assets';

function getAvatarImageUrl(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encoded}.png`;
}

/**
 * Tamanhos sempre em proporção 2:3.
 * Mesma proporção do canvas de arte (1024×1536) e do upload (512×768).
 * Isso garante que tênis, calça e acessórios apareçam na posição correta.
 */
const SIZE_CLASSES: Record<NonNullable<AvatarPreviewProps['size']>, string> = {
  sm: 'w-16 aspect-[2/3]',   // ~16×24 — para avatares compactos (listas, ranking)
  md: 'w-28 aspect-[2/3]',   // ~28×42 — padrão
  lg: 'w-40 aspect-[2/3]',   // ~40×60 — perfil
  xl: 'w-56 aspect-[2/3]',   // ~56×84 — customização
};

export default function AvatarPreview({
  equipped,
  className,
  size = 'md',
  itemAdjustments = {},
  showBorder = true,
}: AvatarPreviewProps) {
  const [failedLayers, setFailedLayers] = useState<Set<number>>(new Set());

  const layers = buildAvatarLayers(equipped, getAvatarImageUrl, itemAdjustments);
  const isFemale = equipped.base_outfit === 'base_feminina';
  const fallbackBase = getAvatarImageUrl(isFemale ? 'base feminina' : 'base masculina');

  const handleError = (index: number, e: React.SyntheticEvent<HTMLImageElement>) => {
    if (index === 0) {
      if (e.currentTarget.src !== fallbackBase) {
        e.currentTarget.src = fallbackBase;
        return;
      }
    }
    setFailedLayers(prev => new Set(prev).add(index));
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-surface-container-highest',
        'rounded-2xl',
        showBorder && 'border-4 border-primary shadow-[0_0_30px_rgba(202,253,0,0.2)]',
        SIZE_CLASSES[size],
        className
      )}
    >
      {layers.map((layer, index) => {
        if (failedLayers.has(index)) return null;
        const style = adjustmentToCSS(layer.adjustment);
        return (
          <img
            key={`${layer.slot}-${index}`}
            src={layer.url}
            alt={layer.alt}
            style={style}
            onError={(e) => handleError(index, e)}
            draggable={false}
          />
        );
      })}
    </div>
  );
}

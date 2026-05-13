/**
 * src/components/AvatarPreview.tsx
 * Avatar sempre exibido em proporção 2:3 (mesma do canvas 1024×1536 e upload 512×768).
 *
 * Para exibir avatar redondo (header, ranking), envolva com um wrapper externo:
 *   <div className="w-12 h-12 rounded-full overflow-hidden">
 *     <AvatarPreview equipped={...} size="sm" showBorder={false} />
 *   </div>
 *
 * Prop `fadePercent` (0–100): aplica desbote + ícone 💤 por inatividade.
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
  /**
   * 0 = normal | 1–100 = grau de desbote por inatividade.
   * 100 = totalmente cinza + 💤
   */
  fadePercent?: number;
  /** Exibe ícone 💤 por cima do avatar */
  showSleeping?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'avatar-assets';

function getAvatarImageUrl(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encoded}.png`;
}

const SIZE_CLASSES: Record<NonNullable<AvatarPreviewProps['size']>, string> = {
  sm: 'w-16 aspect-[2/3]',
  md: 'w-28 aspect-[2/3]',
  lg: 'w-40 aspect-[2/3]',
  xl: 'w-56 aspect-[2/3]',
};

const SLEEP_ICON_SIZE: Record<NonNullable<AvatarPreviewProps['size']>, string> = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
};

export default function AvatarPreview({
  equipped,
  className,
  size = 'md',
  itemAdjustments = {},
  showBorder = true,
  fadePercent = 0,
  showSleeping = false,
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

  // CSS filter: desbote progressivo até cinza total
  const fade = Math.min(Math.max(fadePercent ?? 0, 0), 100);
  const saturation = 1 - fade / 100;           // 1.0 → 0.0
  const brightness = 1 - (fade / 100) * 0.25;  // 1.0 → 0.75 (leve escurecimento)
  const filterStyle = fade > 0
    ? { filter: `saturate(${saturation}) brightness(${brightness})`, transition: 'filter 1s ease' }
    : undefined;

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
      {/* Camadas do avatar com filtro de desbote */}
      <div style={filterStyle} className="absolute inset-0">
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

      {/* Overlay escuro progressivo */}
      {fade > 0 && (
        <div
          className="absolute inset-0 bg-black rounded-2xl pointer-events-none"
          style={{ opacity: (fade / 100) * 0.3, transition: 'opacity 1s ease' }}
        />
      )}

      {/* Ícone 💤 */}
      {showSleeping && (
        <div className={cn(
          'absolute top-1 right-1 animate-bounce pointer-events-none select-none',
          SLEEP_ICON_SIZE[size]
        )}>
          💤
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { AvatarSlot } from '../types';
import { cn } from '../lib/utils';
import { buildAvatarLayers, adjustmentToCSS, LayerAdjustment } from '../lib/avatarLayers';

interface AvatarPreviewProps {
  equipped: AvatarSlot;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  itemAdjustments?: Record<string, Partial<LayerAdjustment>>;
  showBorder?: boolean;
  shape?: 'circle' | 'rect';
  fullBody?: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'avatar-assets';

function getAvatarImageUrl(filename: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(filename)}.png`;
}

// Tamanhos quadrados — usados quando fullBody=false (avatar de rosto/busto)
const SIZE_CLASSES = { sm:'w-14 h-14', md:'w-28 h-28', lg:'w-40 h-40', xl:'w-56 h-56' };

// Tamanhos de corpo inteiro — proporção 9:16 (retrato), avatar visível dos pés à cabeça
const FULL_BODY_SIZE_CLASSES = { sm:'w-16 h-28', md:'w-28 h-48', lg:'w-36 h-64', xl:'w-48 h-80' };

export default function AvatarPreview({
  equipped, className, size = 'md',
  itemAdjustments = {}, showBorder = true, shape = 'circle', fullBody = false,
}: AvatarPreviewProps) {
  const [failedLayers, setFailedLayers] = useState<Set<number>>(new Set());
  const layers = buildAvatarLayers(equipped, getAvatarImageUrl, itemAdjustments);
  const isFemale = equipped.base_outfit === 'base_feminina';
  const fallbackBase = getAvatarImageUrl(isFemale ? 'base feminina' : 'base masculina');

  const sizeClass = fullBody ? FULL_BODY_SIZE_CLASSES[size] : SIZE_CLASSES[size];
  const shapeClass = fullBody ? 'rounded-2xl' : shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  return (
    <div className={cn(
      'relative flex items-center justify-center overflow-hidden bg-surface-container-highest',
      shapeClass,
      showBorder && 'border-4 border-primary shadow-[0_0_30px_rgba(202,253,0,0.2)]',
      sizeClass, className
    )}>
      {layers.map((layer, index) => {
        if (failedLayers.has(index)) return null;
        return (
          <img
            key={`${layer.slot}-${index}`}
            src={layer.url}
            alt={layer.alt}
            style={adjustmentToCSS(layer.adjustment)}
            draggable={false}
            onError={(e) => {
              if (index === 0 && e.currentTarget.src !== fallbackBase) {
                e.currentTarget.src = fallbackBase;
              } else {
                setFailedLayers(prev => new Set(prev).add(index));
              }
            }}
          />
        );
      })}
    </div>
  );
}

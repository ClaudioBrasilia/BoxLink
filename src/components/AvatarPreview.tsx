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
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'avatar-assets';

function getAvatarImageUrl(filename: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(filename)}.png`;
}

const SIZE_CLASSES = { sm:'w-12 h-12', md:'w-24 h-24', lg:'w-32 h-32', xl:'w-48 h-48' };

export default function AvatarPreview({
  equipped, className, size = 'md',
  itemAdjustments = {}, showBorder = true, shape = 'circle',
}: AvatarPreviewProps) {
  const [failedLayers, setFailedLayers] = useState<Set<number>>(new Set());
  const layers = buildAvatarLayers(equipped, getAvatarImageUrl, itemAdjustments);
  const isFemale = equipped.base_outfit === 'base_feminina';
  const fallbackBase = getAvatarImageUrl(isFemale ? 'base feminina' : 'base masculina');

  return (
    <div className={cn(
      'relative flex items-center justify-center overflow-hidden bg-surface-container-highest',
      shape === 'circle' ? 'rounded-full' : 'rounded-2xl',
      showBorder && 'border-4 border-primary shadow-[0_0_30px_rgba(202,253,0,0.2)]',
      SIZE_CLASSES[size], className
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

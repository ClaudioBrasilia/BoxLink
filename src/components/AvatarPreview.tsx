import React from 'react';
import { AvatarSlot } from '../types';
import { cn } from '../lib/utils';
import { AvatarLayers } from './AvatarLayers';

interface AvatarPreviewProps {
  equipped: AvatarSlot;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function AvatarPreview({ equipped, className, size = 'md' }: AvatarPreviewProps) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
    xl: 'w-48 h-48',
  };

  const baseId = equipped.base_outfit || 'base_1';
  const isMale = baseId === 'base_1';

  return (
    <div className={cn(
      "relative rounded-full bg-surface-container-highest flex items-center justify-center overflow-hidden border-4 border-primary shadow-[0_0_30px_rgba(202,253,0,0.2)]",
      sizeClasses[size],
      className
    )}>
      <svg
        viewBox="0 0 200 300"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Base Body */}
        <g className="text-on-surface-variant opacity-30">
          {isMale ? AvatarLayers.base.male : AvatarLayers.base.female}
        </g>

        {/* Bottom Layer (Pants) */}
        {equipped.bottom && (AvatarLayers.bottom as any)[equipped.bottom]?.(equipped.bottom.includes('premium') ? '#1A1A1A' : '#4F46E5')}

        {/* Top Layer (Shirt) */}
        {equipped.top && (AvatarLayers.top as any)[equipped.top]?.(equipped.top.includes('premium') ? '#000000' : '#CAFD00')}

        {/* Shoes Layer */}
        {equipped.shoes && (AvatarLayers.shoes as any)[equipped.shoes]?.(equipped.shoes.includes('premium') ? '#111111' : '#FFFFFF')}

        {/* Head Accessory */}
        {equipped.head_accessory && (AvatarLayers.head_accessory as any)[equipped.head_accessory]?.('#000000')}

        {/* Wrist Accessory (Grips) */}
        {equipped.wrist_accessory && (AvatarLayers.wrist_accessory as any)[equipped.wrist_accessory]?.('#333333')}

        {/* Accessory (Glasses/Belt) */}
        {equipped.accessory && (AvatarLayers.accessory as any)[equipped.accessory]?.(equipped.accessory === 'belt_1' ? '#111111' : '#000000')}

        {/* Special Effects */}
        {equipped.special && (
          <g>
            {(AvatarLayers.special as any)[equipped.special]?.('#CAFD00')}
            <circle cx="100" cy="150" r="80" fill="url(#grad)" className="animate-pulse opacity-30" />
            <defs>
              <radialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="#CAFD00" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#CAFD00" stopOpacity="0" />
              </radialGradient>
            </defs>
          </g>
        )}
      </svg>
    </div>
  );
}

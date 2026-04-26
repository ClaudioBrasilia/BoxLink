import React from 'react';
import { AvatarSlot, Item } from '../types';
import { cn } from '../lib/utils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BUCKET = 'avatar-assets';

function getItemImageUrl(imageKey: string | undefined): string {
  const rawKey = imageKey?.trim();
  if (!rawKey) return '';
  if (rawKey.startsWith('http')) return rawKey;
  if (!SUPABASE_URL) return '';

  const withoutStoragePrefix = rawKey
    .replace(/^\/+/, '')
    .replace(/^storage\/v1\/object\/public\//, '')
    .replace(new RegExp(`^${BUCKET}/`), '');

  const hasExtension = /\.(png|jpe?g|webp|gif|svg)$/i.test(withoutStoragePrefix);
  const normalizedKey = (hasExtension ? withoutStoragePrefix : `${withoutStoragePrefix}.png`)
    .toLowerCase()
    .replace(/\s+/g, '_');
  const encodedKey = normalizedKey.split('/').map(encodeURIComponent).join('/');

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodedKey}`;
}

function getBaseImageUrl(equipped: AvatarSlot): string {
  const isFemale =
    equipped?.base_outfit === 'base_female' ||
    equipped?.base_outfit?.includes('female') ||
    equipped?.base_outfit?.toLowerCase().includes('feminina');
  return getItemImageUrl(isFemale ? 'base_feminina' : 'base_masculina');
}

const LAYER_ORDER: (keyof AvatarSlot)[] = [
  'bottom',
  'top',
  'shoes',
  'wrist_accessory',
  'accessory',
  'head_accessory',
  'special',
];

interface AvatarPreviewProps {
  equipped: AvatarSlot;
  items: Item[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  overrideSlot?: { slot: keyof AvatarSlot; itemId: string | null };
}

const sizeClasses: Record<NonNullable<AvatarPreviewProps['size']>, string> = {
  sm: 'w-16 h-24',
  md: 'w-24 h-36',
  lg: 'w-full h-full',
  xl: 'w-full h-full',
};

export default function AvatarPreview({
  equipped,
  items,
  size = 'lg',
  className,
  overrideSlot,
}: AvatarPreviewProps) {
  const baseUrl = getBaseImageUrl(equipped || ({} as AvatarSlot));

  const resolvedEquipped: AvatarSlot = {
    ...(equipped || ({} as AvatarSlot)),
    ...(overrideSlot ? { [overrideSlot.slot]: overrideSlot.itemId } : {}),
  } as AvatarSlot;

  const layers = LAYER_ORDER.map((slot) => {
    const itemId = resolvedEquipped[slot];
    if (!itemId) return null;
    const item = (items || []).find((i) => i.id === itemId);
    if (!item?.image) return null;
    return { slot, url: getItemImageUrl(item.image) };
  }).filter(Boolean) as { slot: keyof AvatarSlot; url: string }[];

  return (
    <div className={cn('relative overflow-hidden', sizeClasses[size], className)}>
      {baseUrl && (
        <img
          src={baseUrl}
          alt="Base"
          className="absolute inset-0 w-full h-full object-contain object-top select-none pointer-events-none"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      )}
      {layers.map(({ slot, url }) => (
        <img
          key={String(slot)}
          src={url}
          alt={String(slot)}
          className="absolute inset-0 w-full h-full object-contain object-top select-none pointer-events-none"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ))}
    </div>
  );
}

export { getItemImageUrl, getBaseImageUrl };

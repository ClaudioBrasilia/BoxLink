import { supabase } from '../lib/supabase';
import type { AvatarSlotKey } from '../lib/avatarLayers';

const BUCKET = 'avatar-assets';

/**
 * Faz upload de uma imagem de roupa para o bucket do avatar.
 * Redimensiona automaticamente para 512×768, centralizada, fundo transparente.
 * O arquivo salvo se chamará {itemId}.png — exatamente o que o AvatarPreview busca.
 *
 * @param file   Arquivo selecionado pelo admin
 * @param itemId ID do item (deve estar preenchido antes do upload)
 * @param slot   Slot da roupa (top, bottom, shoes, etc.)
 * @returns      URL pública da imagem no bucket
 */
export async function uploadAvatarItem(
  file: File,
  itemId: string,
  slot: AvatarSlotKey
): Promise<string> {
  const TARGET = { w: 512, h: 768 };

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async (ev) => {
      const img = new Image();
      img.src = ev.target?.result as string;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = TARGET.w;
        canvas.height = TARGET.h;
        const ctx = canvas.getContext('2d')!;

        // Centraliza mantendo proporção, fundo transparente
        const scale = Math.min(TARGET.w / img.width, TARGET.h / img.height);
        const dx = (TARGET.w - img.width * scale) / 2;
        const dy = (TARGET.h - img.height * scale) / 2;
        ctx.drawImage(img, dx, dy, img.width * scale, img.height * scale);

        canvas.toBlob(async (blob) => {
          if (!blob) { reject(new Error('Falha ao processar imagem')); return; }

          const filename = `${itemId}.png`;
          const { data, error } = await supabase.storage
            .from(BUCKET)
            .upload(filename, blob, { upsert: true, contentType: 'image/png' });

          if (error) { reject(error); return; }

          const { data: { publicUrl } } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(data.path);

          resolve(publicUrl);
        }, 'image/png');
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

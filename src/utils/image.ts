import { supabase } from '../lib/supabase';

// Perfis de compressão por contexto
export const COMPRESS_PROFILES = {
  challenge_photo: { maxWidth: 1200, maxHeight: 1200, quality: 0.82 }, // feed — boa qualidade
  avatar:          { maxWidth: 600,  maxHeight: 600,  quality: 0.80 }, // avatar — quadrado
  logo:            { maxWidth: 800,  maxHeight: 800,  quality: 0.85 }, // logo do box
  banner:          { maxWidth: 1400, maxHeight: 600,  quality: 0.80 }, // banner wide
  thumbnail:       { maxWidth: 400,  maxHeight: 400,  quality: 0.75 }, // miniaturas
} as const;

type CompressProfile = keyof typeof COMPRESS_PROFILES;

/**
 * Comprime uma imagem via Canvas antes do upload.
 * Mantém proporção, converte para JPEG, respeita maxWidth/maxHeight.
 * Retorna o Blob comprimido + tamanho original e final para log.
 */
export const compressImage = (
  file: File,
  maxWidth  = 1200,
  maxHeight = 1200,
  quality   = 0.82
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        let { width, height } = img;

        // Redimensiona mantendo proporção
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width  = Math.round(width  * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas não suportado'));
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Falha ao comprimir imagem'));
            const saved = ((file.size - blob.size) / file.size * 100).toFixed(0);
            console.log(`[compressImage] ${file.name}: ${(file.size/1024).toFixed(0)}KB → ${(blob.size/1024).toFixed(0)}KB (−${saved}%)`);
            resolve(blob);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });

/**
 * Comprime e faz upload para o Supabase Storage.
 * @param file       Arquivo original do input
 * @param bucket     Nome do bucket no Supabase
 * @param path       Caminho dentro do bucket
 * @param profile    Perfil de compressão (default: logo)
 * @returns          URL pública da imagem
 */
export const uploadImage = async (
  file: File,
  bucket: string,
  path: string,
  profile: CompressProfile = 'logo'
): Promise<string> => {
  const { maxWidth, maxHeight, quality } = COMPRESS_PROFILES[profile];
  const blob = await compressImage(file, maxWidth, maxHeight, quality);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return publicUrl;
};

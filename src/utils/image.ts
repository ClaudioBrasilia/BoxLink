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

// Formatos de imagem que suportam transparência (fundo transparente)
const TRANSPARENT_FORMATS = /image\/(png|webp|gif|svg\+xml|avif)/i;

/**
 * Comprime uma imagem via Canvas antes do upload.
 * Mantém proporção e respeita maxWidth/maxHeight.
 * - format 'jpeg': converte para JPEG (menor, sem transparência).
 * - format 'png':  mantém o fundo transparente (ideal para logos).
 * Retorna o Blob comprimido + tamanho original e final para log.
 */
export const compressImage = (
  file: File,
  maxWidth  = 1200,
  maxHeight = 1200,
  quality   = 0.82,
  format: 'jpeg' | 'png' = 'jpeg'
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
        // Canvas nasce transparente — desenhar por cima preserva o fundo
        // transparente quando exportamos em PNG.
        ctx.drawImage(img, 0, 0, width, height);

        const mime = format === 'png' ? 'image/png' : 'image/jpeg';
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Falha ao comprimir imagem'));
            const saved = ((file.size - blob.size) / file.size * 100).toFixed(0);
            console.log(`[compressImage] ${file.name}: ${(file.size/1024).toFixed(0)}KB → ${(blob.size/1024).toFixed(0)}KB (−${saved}%)`);
            resolve(blob);
          },
          mime,
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

  // Se a imagem original tem transparência (logo em PNG/WebP/SVG…),
  // mantemos como PNG para não criar um retângulo com fundo sólido em
  // volta da logo. Assim qualquer logo se adapta às áreas da TV/celular
  // sem precisar ser recortada na "medida certa".
  const keepTransparency = TRANSPARENT_FORMATS.test(file.type);
  const format: 'jpeg' | 'png' = keepTransparency ? 'png' : 'jpeg';
  const contentType = keepTransparency ? 'image/png' : 'image/jpeg';

  const blob = await compressImage(file, maxWidth, maxHeight, quality, format);

  // Ajusta a extensão do arquivo ao formato realmente gerado.
  const ext = keepTransparency ? 'png' : 'jpg';
  const finalPath = path.replace(/\.[^./]+$/, '') + `.${ext}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(finalPath, blob, { upsert: true, contentType });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return publicUrl;
};

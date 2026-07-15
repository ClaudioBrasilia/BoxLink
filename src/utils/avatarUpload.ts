import { supabase } from '../lib/supabase';
import type { AvatarSlotKey } from '../lib/avatarLayers';
import { PIECE_SPECS, loadImage, fitPieceToCanvas, detectImageContentBox, chooseFitMode, STRETCH_MAX_DISTORTION, STRETCH_MAX_DISTORTION_BODY } from '../lib/fitting';

const BUCKET = 'avatar-assets';

export interface UploadAvatarItemResult {
  /** URL pública da imagem processada no bucket */
  url: string;
  /** true quando o itemId bate com uma peça de PROMPTS_AVATAR.md (M-XX/F-XX) e o encaixe automático foi aplicado */
  autoFitted: boolean;
  /** Só definido quando autoFitted=true: a imagem enviada já estava dentro da caixa esperada, sem precisar de correção relevante */
  wasAlreadyWellPositioned?: boolean;
  /** Avisos do encaixe automático (ex.: imagem totalmente transparente) */
  warnings?: string[];
}

/**
 * Faz upload de uma imagem de roupa/acessório para o bucket do avatar.
 *
 * `pieceSpecId` é independente do `itemId`/nome do item na loja — é a
 * chave da especificação de encaixe em `src/lib/fitting/pieceSpecs.ts`
 * (ex.: "M-01", "F-05"), escolhida pelo admin num menu "Tipo de peça".
 * Quando informado, a imagem passa pelo sistema de encaixe
 * (`src/lib/fitting`): a posição real do conteúdo é detectada e a peça é
 * reposicionada/escalada para ocupar exatamente a CAIXA EXATA da
 * especificação antes de ser salva — sem necessidade de calibração manual.
 *
 * Quando `pieceSpecId` não é informado (item sem tipo de peça definido),
 * mantém o comportamento anterior: centraliza a imagem mantendo a
 * proporção original.
 *
 * Em ambos os casos o resultado final é padronizado para 512×768,
 * fundo transparente, e salvo como `{itemId}.png` — exatamente o que o
 * AvatarPreview busca. O `itemId` pode ser qualquer texto livre.
 *
 * @param file        Arquivo selecionado pelo admin
 * @param itemId      ID do item na loja (texto livre, deve estar preenchido antes do upload)
 * @param slot        Slot da roupa (top, bottom, shoes, etc.)
 * @param pieceSpecId Tipo de peça para encaixe automático (ex.: "M-01"); omitido/null = sem encaixe automático
 */
export async function uploadAvatarItem(
  file: File,
  itemId: string,
  slot: AvatarSlotKey,
  pieceSpecId?: string | null
): Promise<UploadAvatarItemResult> {
  const TARGET = { w: 512, h: 768 };
  const spec = pieceSpecId ? PIECE_SPECS[pieceSpecId] : undefined;

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = TARGET.w;
  canvas.height = TARGET.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D não suportado neste ambiente');

  let autoFitted = false;
  let wasAlreadyWellPositioned: boolean | undefined;
  let warnings: string[] | undefined;

  if (spec) {
    // Mesmo critério do encaixe em renderização: 'stretch' preenche a caixa
    // exata; proporção muito diferente da caixa cai para 'contain'. Peças
    // que vestem o corpo (top/bottom) toleram deformação maior.
    const contentBox = detectImageContentBox(img);
    const boxAspect = (spec.box.y2 - spec.box.y1) / (spec.box.x2 - spec.box.x1);
    const contentAspect = contentBox
      ? (contentBox.y2 - contentBox.y1) / (contentBox.x2 - contentBox.x1)
      : boxAspect;
    const maxDistortion =
      slot === 'top' || slot === 'bottom' ? STRETCH_MAX_DISTORTION_BODY : STRETCH_MAX_DISTORTION;
    const fitted = fitPieceToCanvas(img, spec, chooseFitMode(contentAspect, boxAspect, maxDistortion));
    ctx.drawImage(fitted.canvas, 0, 0, TARGET.w, TARGET.h);
    autoFitted = true;
    wasAlreadyWellPositioned = fitted.wasAlreadyWellPositioned;
    warnings = fitted.warnings;
  } else {
    // Item sem especificação cadastrada: centraliza mantendo proporção (comportamento anterior).
    const scale = Math.min(TARGET.w / img.naturalWidth, TARGET.h / img.naturalHeight);
    const dx = (TARGET.w - img.naturalWidth * scale) / 2;
    const dy = (TARGET.h - img.naturalHeight * scale) / 2;
    ctx.drawImage(img, dx, dy, img.naturalWidth * scale, img.naturalHeight * scale);
  }

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao processar imagem'))), 'image/png');
  });

  const filename = `${itemId}.png`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, blob, { upsert: true, contentType: 'image/png' });

  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(data.path);

  return { url: publicUrl, autoFitted, wasAlreadyWellPositioned, warnings };
}

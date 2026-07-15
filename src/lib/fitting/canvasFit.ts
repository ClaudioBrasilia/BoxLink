/**
 * src/lib/fitting/canvasFit.ts
 * Camada dependente de DOM/Canvas do sistema de encaixe.
 * Usa a Canvas API do browser (mesma abordagem já usada em
 * src/utils/avatarUpload.ts e src/utils/rankingImage.ts) — funciona tanto
 * em web quanto no WebView do Capacitor, sem dependências nativas extras.
 */

import { CANVAS, PieceSpec } from './pieceSpecs';
import { computeFitTransform, detectContentBBox, validateFit, removeBorderConnectedBackground, FitMode, FitTransform, Box } from './geometry';

/** Imagem de peça aceita pelas funções de encaixe (foto ou canvas processado) */
export type PieceImageSource = HTMLImageElement | HTMLCanvasElement;

function sourceWidth(img: PieceImageSource): number {
  return img instanceof HTMLImageElement ? img.naturalWidth : img.width;
}

function sourceHeight(img: PieceImageSource): number {
  return img instanceof HTMLImageElement ? img.naturalHeight : img.height;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/** Desenha a imagem em um canvas do próprio tamanho e devolve o ImageData (RGBA). */
export function getImageData(img: HTMLImageElement | HTMLCanvasElement): ImageData {
  const width = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const height = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[fitting] Canvas 2D não suportado neste ambiente');
  ctx.drawImage(img, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/** Detecta a bounding box do conteúdo opaco de uma imagem já carregada. */
export function detectImageContentBox(img: PieceImageSource, alphaThreshold = 10): Box | null {
  const data = getImageData(img);
  return detectContentBBox(data.data, data.width, data.height, alphaThreshold);
}

/**
 * Garante que a imagem de uma peça tenha fundo transparente.
 *
 * Geradores de imagem (ChatGPT/DALL-E etc.) frequentemente entregam a peça
 * sobre um fundo sólido mesmo quando o prompt pede PNG transparente. Sem
 * transparência, o encaixe detectaria a imagem inteira como conteúdo e
 * desenharia um retângulo opaco sobre o avatar.
 *
 * Se a imagem já tem transparência real (>0,5% dos pixels), é devolvida
 * intacta. Caso contrário, o fundo sólido conectado às bordas é removido
 * (flood fill pela cor mediana da borda) e um canvas processado é devolvido.
 * Limitação: aberturas totalmente fechadas (ex.: interior de um anel)
 * continuam opacas — precisam vir vazadas na arte.
 */
export function ensureTransparentBackground(img: HTMLImageElement): PieceImageSource {
  const data = getImageData(img);
  const totalPixels = data.width * data.height;
  if (totalPixels === 0) return img;

  let transparent = 0;
  for (let i = 3; i < data.data.length; i += 4) {
    if (data.data[i] < 245) transparent++;
  }
  if (transparent / totalPixels > 0.005) return img; // já tem alpha útil

  const removed = removeBorderConnectedBackground(data.data, data.width, data.height);
  if (removed === 0) return img;

  const canvas = document.createElement('canvas');
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img;
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export interface FitPieceResult {
  /** Canvas 1024x1536 com a peça já reposicionada/escalada na caixa exata */
  canvas: HTMLCanvasElement;
  spec: PieceSpec;
  transform: FitTransform;
  /** bounding box do conteúdo detectado na imagem de origem, antes do fit */
  detectedContentBox: Box | null;
  /**
   * true quando a imagem de origem já estava dentro da tolerância da caixa
   * exata (i.e. o fit aplicado foi mínimo/apenas corretivo)
   */
  wasAlreadyWellPositioned: boolean;
  warnings: string[];
}

/**
 * Reposiciona/escala a imagem de uma peça (PNG transparente 1024x1536,
 * ou um recorte apertado da peça) para que ocupe exatamente a CAIXA EXATA
 * definida em `spec.box`, preservando todas as aberturas vazadas (alpha=0)
 * porque a imagem inteira — incluindo seus buracos internos — é
 * redesenhada com a mesma transformação afim.
 */
export function fitPieceToCanvas(
  img: PieceImageSource,
  spec: PieceSpec,
  mode: FitMode = 'contain'
): FitPieceResult {
  const warnings: string[] = [];
  const detectedContentBox = detectImageContentBox(img);

  if (!detectedContentBox) {
    warnings.push(`Peça "${spec.id}": imagem de origem está totalmente transparente — nada para encaixar.`);
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS.width;
    canvas.height = CANVAS.height;
    return {
      canvas,
      spec,
      transform: { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 },
      detectedContentBox: null,
      wasAlreadyWellPositioned: false,
      warnings,
    };
  }

  // Normaliza a bounding box detectada (pixels da imagem de origem) para as
  // coordenadas do canvas de referência antes de validar — sem isso, imagens
  // que não sejam 1024×1536 (ex.: uploads 512×768) nunca seriam consideradas
  // bem posicionadas mesmo quando estão.
  const normX = CANVAS.width / (sourceWidth(img) || CANVAS.width);
  const normY = CANVAS.height / (sourceHeight(img) || CANVAS.height);
  const normalizedContentBox = {
    x1: detectedContentBox.x1 * normX,
    y1: detectedContentBox.y1 * normY,
    x2: detectedContentBox.x2 * normX,
    y2: detectedContentBox.y2 * normY,
  };
  const validation = validateFit(normalizedContentBox, spec.box);
  const wasAlreadyWellPositioned = validation.withinTolerance;

  const transform = computeFitTransform(detectedContentBox, spec.box, mode);

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[fitting] Canvas 2D não suportado neste ambiente');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    transform.translateX,
    transform.translateY,
    sourceWidth(img) * transform.scaleX,
    sourceHeight(img) * transform.scaleY
  );

  return { canvas, spec, transform, detectedContentBox, wasAlreadyWellPositioned, warnings };
}

export interface AvatarLayerInput {
  /** URL ou data URL da imagem da peça (PNG transparente) */
  imageUrl: string;
  spec: PieceSpec;
  /** Ordem de empilhamento; maior = mais acima. Padrão: ordem de entrada. */
  zIndex?: number;
}

export interface ComposeAvatarResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  perPiece: Array<Pick<FitPieceResult, 'spec' | 'transform' | 'wasAlreadyWellPositioned' | 'warnings'>>;
}

/**
 * Compõe a base do avatar com uma lista de peças já encaixadas, na ordem
 * de camadas fornecida (ou por zIndex quando presente).
 */
export async function composeAvatar(
  baseImageUrl: string,
  pieces: AvatarLayerInput[],
  mode: FitMode = 'contain'
): Promise<ComposeAvatarResult> {
  const baseImg = await loadImage(baseImageUrl);

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[fitting] Canvas 2D não suportado neste ambiente');

  ctx.drawImage(baseImg, 0, 0, CANVAS.width, CANVAS.height);

  const ordered = [...pieces].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
  const perPiece: ComposeAvatarResult['perPiece'] = [];

  for (const piece of ordered) {
    const pieceImg = await loadImage(piece.imageUrl);
    const fitted = fitPieceToCanvas(pieceImg, piece.spec, mode);
    ctx.drawImage(fitted.canvas, 0, 0);
    perPiece.push({
      spec: fitted.spec,
      transform: fitted.transform,
      wasAlreadyWellPositioned: fitted.wasAlreadyWellPositioned,
      warnings: fitted.warnings,
    });
  }

  return { canvas, dataUrl: canvas.toDataURL('image/png'), perPiece };
}

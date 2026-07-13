/**
 * src/lib/fitting/canvasFit.ts
 * Camada dependente de DOM/Canvas do sistema de encaixe.
 * Usa a Canvas API do browser (mesma abordagem já usada em
 * src/utils/avatarUpload.ts e src/utils/rankingImage.ts) — funciona tanto
 * em web quanto no WebView do Capacitor, sem dependências nativas extras.
 */

import { CANVAS, PieceSpec } from './pieceSpecs';
import { computeFitTransform, detectContentBBox, validateFit, FitMode, FitTransform, Box } from './geometry';

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
export function detectImageContentBox(img: HTMLImageElement, alphaThreshold = 10): Box | null {
  const data = getImageData(img);
  return detectContentBBox(data.data, data.width, data.height, alphaThreshold);
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
  img: HTMLImageElement,
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

  const validation = validateFit(detectedContentBox, spec.box);
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
    img.naturalWidth * transform.scaleX,
    img.naturalHeight * transform.scaleY
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

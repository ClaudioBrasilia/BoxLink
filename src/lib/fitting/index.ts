/**
 * src/lib/fitting/index.ts
 * API pública do sistema de encaixe de roupas/acessórios do BoxLink.
 *
 * Uso básico:
 *
 *   import { fitClothingPiece } from '@/lib/fitting';
 *
 *   const result = await fitClothingPiece({
 *     avatarBase: 'masculina',
 *     pecaId: 'M-01',
 *     pieceImageUrl: 'https://.../avatar-assets/M-01.png',
 *     baseImageUrl: 'https://.../avatar-assets/base masculina.png',
 *     estiloVisual: { cor: 'azul royal', material: 'dri-fit' },
 *   });
 *
 *   avatarImgElement.src = result.dataUrl;
 *
 * Para várias peças de uma vez (um "look" completo), veja `fitOutfit`.
 */

import { getPieceSpec, listPieceSpecs, PIECE_SPECS, PieceSpec, AvatarBaseId, CANVAS, ANATOMY_ZONES, BASE_WIDTHS } from './pieceSpecs';
import { computeFitTransform, detectContentBBox, validateFit, applyTransformToBox } from './geometry';
import type { Box, FitTransform, FitMode, FitValidation } from './geometry';
import { loadImage, fitPieceToCanvas, composeAvatar, detectImageContentBox, getImageData } from './canvasFit';
import type { FitPieceResult, AvatarLayerInput, ComposeAvatarResult } from './canvasFit';

export {
  getPieceSpec,
  listPieceSpecs,
  PIECE_SPECS,
  CANVAS,
  ANATOMY_ZONES,
  BASE_WIDTHS,
  computeFitTransform,
  detectContentBBox,
  validateFit,
  applyTransformToBox,
  loadImage,
  fitPieceToCanvas,
  composeAvatar,
  detectImageContentBox,
  getImageData,
};
export type { PieceSpec, AvatarBaseId, Box, FitTransform, FitMode, FitValidation, FitPieceResult, AvatarLayerInput, ComposeAvatarResult };

export interface FitClothingPieceParams {
  /** Base do avatar de destino */
  avatarBase: AvatarBaseId;
  /** Identificador da peça, ex.: "M-01", "F-05" (deve existir em pieceSpecs) */
  pecaId: string;
  /** URL (ou data URL) da imagem PNG transparente da peça */
  pieceImageUrl: string;
  /** URL (ou data URL) da imagem da base do avatar ("base-masculina.png" / "base-feminina.png") */
  baseImageUrl: string;
  /** Detalhes de estilo (cor, material, estampa...) — apenas repassados nos metadados de saída */
  estiloVisual?: Record<string, unknown> | string;
  /**
   * 'stretch' (padrão): faz a peça ocupar exatamente a caixa da especificação.
   * 'contain': preserva a proporção da peça, centralizando dentro da caixa.
   */
  mode?: FitMode;
}

export interface FitClothingPieceResult {
  /** Avatar final (base + peça encaixada) como PNG data URL */
  dataUrl: string;
  /** Canvas com o resultado, caso o chamador precise desenhar/manipular mais */
  canvas: HTMLCanvasElement;
  /** Especificação usada para o encaixe */
  spec: PieceSpec;
  /** Transformação (escala/translação) aplicada à imagem de origem da peça */
  transform: FitTransform;
  /** Metadados de estilo repassados pelo chamador */
  estiloVisual?: Record<string, unknown> | string;
  /** true se a imagem de origem já estava dentro da caixa exata (sem correção significativa) */
  wasAlreadyWellPositioned: boolean;
  /** Avisos (ex.: peça vazia, desvio grande da caixa esperada) */
  warnings: string[];
}

/**
 * Encaixa uma peça de vestuário/acessório sobre a base do avatar,
 * seguindo a CAIXA EXATA, ÂNCORA ANATÔMICA e TAMANHO RELATIVO
 * definidos em PROMPTS_AVATAR.md para `pecaId`.
 */
export async function fitClothingPiece(params: FitClothingPieceParams): Promise<FitClothingPieceResult> {
  const { avatarBase, pecaId, pieceImageUrl, baseImageUrl, estiloVisual, mode = 'stretch' } = params;

  const spec = getPieceSpec(pecaId);
  if (spec.avatarBase !== avatarBase) {
    throw new Error(
      `[fitting] Peça "${pecaId}" foi projetada para a base "${spec.avatarBase}", mas "${avatarBase}" foi solicitada.`
    );
  }

  const [pieceImg, baseImg] = await Promise.all([loadImage(pieceImageUrl), loadImage(baseImageUrl)]);

  const fitted = fitPieceToCanvas(pieceImg, spec, mode);

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[fitting] Canvas 2D não suportado neste ambiente');

  ctx.drawImage(baseImg, 0, 0, CANVAS.width, CANVAS.height);
  ctx.drawImage(fitted.canvas, 0, 0);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    canvas,
    spec,
    transform: fitted.transform,
    estiloVisual,
    wasAlreadyWellPositioned: fitted.wasAlreadyWellPositioned,
    warnings: fitted.warnings,
  };
}

export interface FitOutfitPiece {
  pecaId: string;
  pieceImageUrl: string;
  estiloVisual?: Record<string, unknown> | string;
}

export interface FitOutfitParams {
  avatarBase: AvatarBaseId;
  baseImageUrl: string;
  /** Peças a compor, na ordem em que devem ser empilhadas (última = mais acima) */
  pieces: FitOutfitPiece[];
  mode?: FitMode;
}

export interface FitOutfitResult {
  dataUrl: string;
  canvas: HTMLCanvasElement;
  perPiece: Array<{
    pecaId: string;
    spec: PieceSpec;
    transform: FitTransform;
    estiloVisual?: Record<string, unknown> | string;
    wasAlreadyWellPositioned: boolean;
    warnings: string[];
  }>;
}

/** Encaixa um conjunto completo de peças (um "look") sobre a base do avatar. */
export async function fitOutfit(params: FitOutfitParams): Promise<FitOutfitResult> {
  const { avatarBase, baseImageUrl, pieces, mode = 'stretch' } = params;

  const specs = pieces.map((p) => {
    const spec = getPieceSpec(p.pecaId);
    if (spec.avatarBase !== avatarBase) {
      throw new Error(
        `[fitting] Peça "${p.pecaId}" foi projetada para a base "${spec.avatarBase}", mas "${avatarBase}" foi solicitada.`
      );
    }
    return spec;
  });

  const layerInputs: AvatarLayerInput[] = pieces.map((p, index) => ({
    imageUrl: p.pieceImageUrl,
    spec: specs[index],
    zIndex: index,
  }));

  const composed = await composeAvatar(baseImageUrl, layerInputs, mode);

  return {
    dataUrl: composed.dataUrl,
    canvas: composed.canvas,
    perPiece: composed.perPiece.map((p, index) => ({
      pecaId: pieces[index].pecaId,
      spec: p.spec,
      transform: p.transform,
      estiloVisual: pieces[index].estiloVisual,
      wasAlreadyWellPositioned: p.wasAlreadyWellPositioned,
      warnings: p.warnings,
    })),
  };
}

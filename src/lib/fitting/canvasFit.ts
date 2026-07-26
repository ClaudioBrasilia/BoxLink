/**
 * src/lib/fitting/canvasFit.ts
 * Camada dependente de DOM/Canvas do sistema de encaixe.
 * Usa a Canvas API do browser (mesma abordagem já usada em
 * src/utils/avatarUpload.ts e src/utils/rankingImage.ts) — funciona tanto
 * em web quanto no WebView do Capacitor, sem dependências nativas extras.
 */

import { CANVAS, PieceSpec } from './pieceSpecs';
import { computeFitTransform, detectContentBBox, validateFit, removeBorderConnectedBackground, FitMode, FitTransform, Box } from './geometry';
import { computeConformMaps, invertRowMap, mapRowX, RowSpan } from './bodyProfile';

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
 * intacta. Caso contrário, o fundo conectado às bordas é removido (flood
 * fill pela cor da borda) e um canvas processado é devolvido.
 *
 * DUAS PASSADAS: a 1ª usa tolerância APERTADA (45), que preserva peças
 * coladas ao fundo em cor — short preto sobre preto, ou o branco/preto de
 * um tênis sobre xadrez claro. Mas um xadrez claro MUITO sutil (ex.: legging
 * preta cujo fundo tem tiles a distância ~48) não é totalmente limpo nessa
 * tolerância, deixando pixels soltos que incham a caixa de conteúdo. Quando
 * isso acontece (conteúdo ainda ocupa quase a imagem toda), refaz com
 * tolerância LARGA (90) — seguro porque esse caso só ocorre com fundo claro
 * e uniforme, onde a peça é sempre muito mais escura/colorida.
 *
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

  // Fundo não limpo? (conteúdo ainda ocupa >90% da largura E da altura) →
  // 2ª passada com tolerância larga sobre uma cópia limpa da imagem.
  const box = detectContentBBox(data.data, data.width, data.height);
  const notCleaned =
    !!box &&
    box.x2 - box.x1 > data.width * 0.9 &&
    box.y2 - box.y1 > data.height * 0.9;

  const finalData = notCleaned ? getImageData(img) : data;
  if (notCleaned) {
    removeBorderConnectedBackground(finalData.data, finalData.width, finalData.height, 90);
  }

  const canvas = document.createElement('canvas');
  canvas.width = finalData.width;
  canvas.height = finalData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img;
  ctx.putImageData(finalData, 0, 0);
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

const IDENTITY_TRANSFORM: FitTransform = { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 };

/**
 * Coluna de menor densidade opaca no terço central de [box.x1, box.x2] — o
 * vão entre as duas unidades de um par (ex.: entre os dois tênis).
 */
function findPairSplitColumn(data: ImageData, box: Box): number {
  const { width } = data;
  const lo = Math.round(box.x1 + 0.35 * (box.x2 - box.x1));
  const hi = Math.round(box.x1 + 0.65 * (box.x2 - box.x1));
  let best = Math.round((box.x1 + box.x2) / 2);
  let bestCount = Infinity;
  for (let x = lo; x <= hi; x++) {
    let count = 0;
    for (let y = box.y1; y < box.y2; y++) {
      if (data.data[(y * width + x) * 4 + 3] > 10) count++;
    }
    if (count < bestCount) {
      bestCount = count;
      best = x;
    }
  }
  return best;
}

/**
 * Recorta a faixa de colunas [xStart, xEnd) da fonte (uma unidade do par),
 * detecta o conteúdo real dela e o encaixa (contain, sem distorcer) na
 * caixa-alvo do membro correspondente, desenhando no ctx do canvas final.
 */
function drawPairUnit(
  ctx: CanvasRenderingContext2D,
  img: PieceImageSource,
  xStart: number,
  xEnd: number,
  target: Box,
  anchor: 'center' | 'bottom' = 'center'
): FitTransform {
  const w = Math.max(1, Math.round(xEnd - xStart));
  const h = sourceHeight(img);
  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  const tctx = temp.getContext('2d');
  if (!tctx) return IDENTITY_TRANSFORM;
  tctx.drawImage(img, Math.round(xStart), 0, w, h, 0, 0, w, h);

  const unitBox = detectImageContentBox(temp);
  if (!unitBox) return IDENTITY_TRANSFORM;

  let t = computeFitTransform(unitBox, target, 'contain');
  if (anchor === 'bottom') {
    // 'contain' centraliza a folga vertical; aqui a peça desce para encostar
    // no fundo do alvo (solado no chão em vez de flutuando sobre o pé).
    const slack = target.y2 - (unitBox.y2 * t.scaleY + t.translateY);
    t = { ...t, translateY: t.translateY + slack };
  }
  ctx.drawImage(temp, t.translateX, t.translateY, w * t.scaleX, h * t.scaleY);
  return t;
}

/** Ruído abaixo desta largura não conta como perna nem como vão entre pernas. */
const MIN_ROW_FEATURE = 4;

/**
 * O que a peça ocupa em cada linha: as bordas externas e, quando a linha se
 * divide em duas pernas, o maior vão interno. Linhas vazias viram null.
 */
function rowSpans(data: ImageData, alphaThreshold = 40): Array<RowSpan | null> {
  const { width, height, data: rgba } = data;
  const spans: Array<RowSpan | null> = [];

  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    const runs: Array<{ x1: number; x2: number }> = [];
    let start = -1;
    for (let x = 0; x <= width; x++) {
      const opaque = x < width && rgba[row + x * 4 + 3] > alphaThreshold;
      if (opaque && start < 0) start = x;
      if (!opaque && start >= 0) {
        if (x - start >= MIN_ROW_FEATURE) runs.push({ x1: start, x2: x });
        start = -1;
      }
    }

    if (runs.length === 0) {
      spans.push(null);
      continue;
    }

    let gap: { x1: number; x2: number } | null = null;
    for (let i = 1; i < runs.length; i++) {
      const candidate = { x1: runs[i - 1].x2, x2: runs[i].x1 };
      if (candidate.x2 - candidate.x1 < MIN_ROW_FEATURE) continue;
      if (!gap || candidate.x2 - candidate.x1 > gap.x2 - gap.x1) gap = candidate;
    }

    spans.push({ x1: runs[0].x1, x2: runs[runs.length - 1].x2, gap });
  }
  return spans;
}

/**
 * Molda uma peça já encaixada à silhueta real da base: em cada linha, as
 * bordas da peça são levadas às bordas do corpo naquela altura — as externas
 * e, abaixo da virilha, também as internas de cada perna (ver bodyProfile).
 * É o que faz uma calça VESTIR a perna em vez de apenas preencher o
 * retângulo da caixa: a mesma caixa que cobre a panturrilha aberta sobraria
 * no quadril e na coxa.
 *
 * A reamostragem é bilinear e só em x: linhas continuam sendo linhas, então
 * a barra, o cós e as costuras horizontais da arte não entortam.
 */
export function conformCanvasToBody(canvas: HTMLCanvasElement, spec: PieceSpec): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const maps = computeConformMaps(rowSpans(src), spec.avatarBase);
  const { width, height } = src;
  const out = ctx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    const map = maps[y];
    if (!map) {
      out.data.set(src.data.subarray(row, row + width * 4), row);
      continue;
    }
    const inverse = invertRowMap(map);
    for (let x = 0; x < width; x++) {
      const sample = mapRowX(inverse, x); // de onde na peça veio este pixel
      if (sample < -0.5 || sample > width - 0.5) continue; // fora da arte → transparente
      const i0 = Math.min(width - 1, Math.max(0, Math.floor(sample)));
      const i1 = Math.min(width - 1, i0 + 1);
      const frac = Math.min(1, Math.max(0, sample - i0));
      const a = row + i0 * 4;
      const b = row + i1 * 4;
      const dst = row + x * 4;
      for (let c = 0; c < 4; c++) {
        out.data[dst + c] = src.data[a + c] * (1 - frac) + src.data[b + c] * frac;
      }
    }
  }

  ctx.putImageData(out, 0, 0);
}

/**
 * Reposiciona/escala a imagem de uma peça (PNG transparente 1024x1536,
 * ou um recorte apertado da peça) para que ocupe exatamente a CAIXA EXATA
 * definida em `spec.box`, preservando todas as aberturas vazadas (alpha=0)
 * porque a imagem inteira — incluindo seus buracos internos — é
 * redesenhada com a mesma transformação afim.
 *
 * Peças em par com `pairTargets` (tênis, luvas, joelheiras, munhequeiras)
 * são tratadas à parte: a arte é dividida no vão central e CADA unidade é
 * posicionada no seu membro da base — assim o par acompanha a pose da base
 * (pés/pulsos afastados) independentemente de como a arte foi gerada.
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

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS.width;
  canvas.height = CANVAS.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('[fitting] Canvas 2D não suportado neste ambiente');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // — Par com alvos por unidade: separa no vão central e encaixa cada lado —
  if (spec.pairTargets) {
    const data = getImageData(img);
    const split = findPairSplitColumn(data, detectedContentBox);
    const anchor = spec.pairAnchor ?? 'center';
    const leftT = drawPairUnit(ctx, img, detectedContentBox.x1, split, spec.pairTargets.left, anchor);
    drawPairUnit(ctx, img, split, detectedContentBox.x2, spec.pairTargets.right, anchor);
    return { canvas, spec, transform: leftT, detectedContentBox, wasAlreadyWellPositioned, warnings };
  }

  const transform = computeFitTransform(detectedContentBox, spec.box, mode);
  ctx.drawImage(
    img,
    transform.translateX,
    transform.translateY,
    sourceWidth(img) * transform.scaleX,
    sourceHeight(img) * transform.scaleY
  );

  if (spec.conformToBody) conformCanvasToBody(canvas, spec);

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

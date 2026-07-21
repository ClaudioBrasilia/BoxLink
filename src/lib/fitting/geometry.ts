/**
 * src/lib/fitting/geometry.ts
 * Matemática pura de encaixe (sem DOM/Canvas) — testável isoladamente.
 */

import { Box, boxWidth, boxHeight } from './pieceSpecs';

export type { Box };

/** Escala/translação a aplicar sobre a imagem de origem inteira. */
export interface FitTransform {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
}

export type FitMode = 'stretch' | 'contain';

/**
 * Calcula a transformação (escala + translação) que leva `contentBox`
 * (bounding box do conteúdo opaco detectado na imagem de origem) a coincidir
 * exatamente com `targetBox` (a CAIXA EXATA definida na especificação).
 *
 * A transformação resultante deve ser aplicada à imagem de origem INTEIRA
 * (não apenas ao recorte do contentBox), preservando proporcionalmente
 * tudo o que está fora dele — incluindo aberturas vazadas (alpha=0).
 *
 * mode 'contain' (padrão): preserva a proporção do conteúdo detectado,
 *   centralizando dentro da targetBox (letterbox) — evita distorcer a arte
 *   original quando a proporção dela não bate exatamente com a da caixa.
 * mode 'stretch': preenche a targetBox exatamente, permitindo escalas X/Y
 *   diferentes — garante ocupação total da caixa, mas pode esticar/espremer
 *   a peça se a proporção original for diferente da proporção da caixa.
 */
export function computeFitTransform(
  contentBox: Box,
  targetBox: Box,
  mode: FitMode = 'contain'
): FitTransform {
  const contentW = boxWidth(contentBox);
  const contentH = boxHeight(contentBox);
  const targetW = boxWidth(targetBox);
  const targetH = boxHeight(targetBox);

  if (contentW <= 0 || contentH <= 0) {
    throw new Error('[fitting] contentBox inválido: largura/altura devem ser positivas');
  }
  if (targetW <= 0 || targetH <= 0) {
    throw new Error('[fitting] targetBox inválido: largura/altura devem ser positivas');
  }

  let scaleX = targetW / contentW;
  let scaleY = targetH / contentH;

  let extraOffsetX = 0;
  let extraOffsetY = 0;

  if (mode === 'contain') {
    const scale = Math.min(scaleX, scaleY);
    scaleX = scale;
    scaleY = scale;
    extraOffsetX = (targetW - contentW * scale) / 2;
    extraOffsetY = (targetH - contentH * scale) / 2;
  }

  const translateX = targetBox.x1 - contentBox.x1 * scaleX + extraOffsetX;
  const translateY = targetBox.y1 - contentBox.y1 * scaleY + extraOffsetY;

  return { scaleX, scaleY, translateX, translateY };
}

/**
 * Razão máxima de deformação aceita para usar 'stretch'. Acima disso a
 * proporção da arte é considerada incompatível com a caixa e usa-se
 * 'contain' para não deformar a peça.
 */
export const STRETCH_MAX_DISTORTION = 1.35;

/**
 * Limite de deformação para peças que VESTEM o corpo (top, camiseta,
 * short, calça): nelas, casar com a largura do corpo importa mais que
 * preservar a proporção da arte — um top estreito deixa a base à mostra
 * nas laterais. Artes de vestuário geradas "soltas" (e fotos de produto
 * com fundo removido) costumam ser quase quadradas, enquanto a região do
 * corpo que cobrem é larga e baixa — um top real precisou de 1,77× —
 * então o limite é bem maior que o dos acessórios.
 */
export const STRETCH_MAX_DISTORTION_BODY = 2.0;

/**
 * Escolhe o modo de encaixe a partir das proporções (altura/largura) do
 * conteúdo detectado e da caixa alvo. Roupas devem casar com a largura do
 * corpo, então o padrão é 'stretch' (preenche a caixa exata — evita camiseta
 * estreita deixando os ombros da base à mostra); quando a proporção da arte
 * difere demais da caixa, cai para 'contain' para não deformar.
 *
 * `maxDistortion` permite calibrar o limite por tipo de peça
 * (STRETCH_MAX_DISTORTION_BODY para roupas de corpo).
 */
export function chooseFitMode(
  contentAspect: number,
  boxAspect: number,
  maxDistortion: number = STRETCH_MAX_DISTORTION
): FitMode {
  if (!isFinite(contentAspect) || !isFinite(boxAspect) || contentAspect <= 0 || boxAspect <= 0) {
    return 'contain';
  }
  const ratio = contentAspect > boxAspect ? contentAspect / boxAspect : boxAspect / contentAspect;
  return ratio <= maxDistortion ? 'stretch' : 'contain';
}

/** Aplica um FitTransform a um ponto/caixa arbitrário (útil para testes/QA). */
export function applyTransformToBox(box: Box, t: FitTransform): Box {
  return {
    x1: box.x1 * t.scaleX + t.translateX,
    y1: box.y1 * t.scaleY + t.translateY,
    x2: box.x2 * t.scaleX + t.translateX,
    y2: box.y2 * t.scaleY + t.translateY,
  };
}

export interface FitValidation {
  withinTolerance: boolean;
  deltaX1: number;
  deltaY1: number;
  deltaX2: number;
  deltaY2: number;
  maxDelta: number;
}

/**
 * Compara duas caixas (ex.: contentBox detectado vs. targetBox esperado)
 * e informa se a diferença está dentro de uma tolerância em pixels.
 * Útil para validar peças já pré-posicionadas (geradas por IA) sem
 * precisar reescalar/mover — apenas para alertar o admin em caso de desvio.
 */
export function validateFit(box: Box, targetBox: Box, tolerancePx = 12): FitValidation {
  const deltaX1 = box.x1 - targetBox.x1;
  const deltaY1 = box.y1 - targetBox.y1;
  const deltaX2 = box.x2 - targetBox.x2;
  const deltaY2 = box.y2 - targetBox.y2;
  const maxDelta = Math.max(Math.abs(deltaX1), Math.abs(deltaY1), Math.abs(deltaX2), Math.abs(deltaY2));
  return {
    withinTolerance: maxDelta <= tolerancePx,
    deltaX1,
    deltaY1,
    deltaX2,
    deltaY2,
    maxDelta,
  };
}

/**
 * Remove o fundo sólido de um buffer RGBA in-place: detecta a(s) cor(es) de
 * fundo pela borda e zera o alpha de tudo que é parecido com elas E
 * conectado à borda (flood fill 4-vizinhos).
 *
 * Suporta até DOIS tons de fundo: geradores de imagem às vezes pintam um
 * xadrez cinza de "transparência falsa" como pixels reais. Quando a borda
 * tem um segundo tom relevante e ambos são neutros (cinzas), pixels neutros
 * na faixa de luminância do xadrez também são tratados como fundo — isso
 * cobre o vinhete que clareia o xadrez em direção ao centro.
 *
 * Aberturas totalmente fechadas (ex.: interior de um anel) não são
 * alcançadas — essas ainda precisam vir vazadas na arte.
 *
 * A tolerância é deliberadamente APERTADA (45): peças escuras sobre fundo
 * escuro (ex.: short preto sobre fundo preto puro) têm o tecido a poucas
 * unidades do fundo — uma tolerância larga apagava a própria peça, deixando
 * só as barras claras. Sombras da peça na exata cor do fundo continuam
 * inseparáveis (limitação da arte, não do algoritmo).
 *
 * Retorna o número de pixels removidos (0 = nada parecia fundo).
 */
export function removeBorderConnectedBackground(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance = 45
): number {
  if (width <= 0 || height <= 0) return 0;

  const borderIdx: number[] = [];
  for (let x = 0; x < width; x++) {
    borderIdx.push(x * 4, ((height - 1) * width + x) * 4);
  }
  for (let y = 0; y < height; y++) {
    borderIdx.push(y * width * 4, (y * width + width - 1) * 4);
  }
  const medianOf = (idx: number[], channel: number) => {
    const arr = idx.map((i) => rgba[i + channel]).sort((a, b) => a - b);
    return arr[arr.length >> 1];
  };
  const tone1 = [medianOf(borderIdx, 0), medianOf(borderIdx, 1), medianOf(borderIdx, 2)];

  const distTo = (i: number, tone: number[]) =>
    Math.abs(rgba[i] - tone[0]) + Math.abs(rgba[i + 1] - tone[1]) + Math.abs(rgba[i + 2] - tone[2]);

  // Segundo tom de fundo (xadrez): pixels de borda longe do tom principal
  const farIdx = borderIdx.filter((i) => distTo(i, tone1) > tolerance);
  const tone2 =
    farIdx.length >= borderIdx.length * 0.15
      ? [medianOf(farIdx, 0), medianOf(farIdx, 1), medianOf(farIdx, 2)]
      : null;

  // Ambos os tons neutros → fundo tipo "xadrez de transparência": aceita
  // qualquer pixel neutro na faixa de luminância do xadrez (com folga para
  // o vinhete que clareia em direção ao centro).
  let neutralRange: { min: number; max: number } | null = null;
  if (tone2) {
    const spread = (t: number[]) => Math.max(...t) - Math.min(...t);
    if (spread(tone1) <= 30 && spread(tone2) <= 30) {
      const lum1 = (tone1[0] + tone1[1] + tone1[2]) / 3;
      const lum2 = (tone2[0] + tone2[1] + tone2[2]) / 3;
      neutralRange = { min: Math.min(lum1, lum2) - 40, max: Math.max(lum1, lum2) + 80 };
    }
  }

  const isBgish = (i: number) => {
    if (distTo(i, tone1) <= tolerance) return true;
    if (tone2 && distTo(i, tone2) <= tolerance) return true;
    if (neutralRange) {
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (spread <= 30) {
        const lum = (r + g + b) / 3;
        if (lum >= neutralRange.min && lum <= neutralRange.max) return true;
      }
    }
    return false;
  };

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const seed = (x: number, y: number) => {
    const p = y * width + x;
    if (!visited[p] && isBgish(p * 4)) {
      visited[p] = 1;
      queue.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    seed(0, y);
    seed(width - 1, y);
  }

  let removed = 0;
  while (queue.length) {
    const p = queue.pop()!;
    rgba[p * 4 + 3] = 0;
    removed++;
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) seed(x - 1, y);
    if (x < width - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < height - 1) seed(x, y + 1);
  }
  return removed;
}

/**
 * Varre um buffer RGBA (ex.: ImageData.data) e retorna a bounding box dos
 * pixels com alpha acima de `alphaThreshold`. Retorna null se a imagem for
 * inteiramente transparente. Função pura — recebe qualquer array RGBA
 * (Uint8ClampedArray no browser, array plano em testes).
 */
export function detectContentBBox(
  rgba: ArrayLike<number>,
  width: number,
  height: number,
  alphaThreshold = 10
): Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const alpha = rgba[rowOffset + x * 4 + 3];
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return { x1: minX, y1: minY, x2: maxX + 1, y2: maxY + 1 };
}

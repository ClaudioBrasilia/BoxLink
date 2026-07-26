/**
 * src/lib/fitting/bodyProfile.ts
 * Silhueta real do corpo de cada base, linha a linha, e a matemática que
 * "molda" uma peça já encaixada a essa silhueta.
 *
 * POR QUE ISTO EXISTE
 * A caixa exata de `pieceSpecs` é um retângulo: ela acerta onde a peça
 * começa e termina, mas não tem como acompanhar a cintura estreita, o
 * quadril largo, o joelho fino e a panturrilha aberta ao longo da mesma
 * peça. Como a arte das roupas vem de corpos com proporções diferentes das
 * bases (as bases são cartunizadas — coxa curta, panturrilha aberta), um
 * único esticamento afim deixa a calça mais LARGA que a perna em uns
 * pontos e mais estreita em outros.
 *
 * A solução é conformar a peça linha a linha: em cada altura, as bordas da
 * peça são levadas às bordas reais do corpo naquela altura — inclusive as
 * bordas INTERNAS, o vão entre as duas pernas. Sem tratar o vão, encolher a
 * peça pelo contorno externo afasta as duas pernas da calça uma da outra e
 * deixa aparecer pele no meio.
 *
 * Aplica-se só a peças que ABRAÇAM o corpo (short, calça — `conformToBody`
 * na spec). Camisetas e jaquetas têm mangas que saem do tronco e ficam de
 * fora deste tratamento.
 *
 * COORDENADAS medidas na silhueta (canal alpha) das artes reais em
 * public/avatar-bases/, no canvas de referência 1024×1536. Os braços foram
 * excluídos: o envelope é obtido crescendo a região a partir do tronco para
 * baixo, aceitando apenas segmentos conectados verticalmente ao anterior —
 * mãos e antebraços ficam separados por vão transparente e não entram.
 *
 * Módulo puro (sem DOM/Canvas) para ser testável isoladamente.
 */

import type { AvatarBaseId } from './pieceSpecs';

/**
 * Uma amostra da silhueta: `[y, x1, x2]` acima da virilha (corpo inteiriço)
 * ou `[y, x1, x2, vaoX1, vaoX2]` abaixo dela, onde as pernas já se separaram.
 */
export type BodyProfileSample =
  | readonly [number, number, number]
  | readonly [number, number, number, number, number];

/**
 * Envelope do tronco+pernas por altura, amostrado a cada 16 px do quadril
 * alto até o tornozelo. Termina ANTES de os pés se abrirem (y ≈ 1445): a
 * barra da calça é o tornozelo, e incluir a abertura dos pés faria a barra
 * "abanar" para fora da perna.
 */
export const BODY_PROFILE: Record<AvatarBaseId, readonly BodyProfileSample[]> = {
  masculina: [
    [672, 409, 617], [688, 408, 617], [704, 406, 618],
    [720, 405, 620], [736, 403, 621], [752, 401, 624],
    [768, 395, 629], [784, 392, 632], [800, 389, 635],
    [816, 386, 638], [832, 383, 642], [848, 381, 643],
    [864, 378, 646], [880, 377, 648], [896, 375, 649],
    [912, 374, 651], [928, 372, 652, 506, 520], [944, 371, 654, 504, 521],
    [960, 371, 656, 502, 523], [976, 369, 657, 500, 524], [992, 367, 657, 499, 526],
    [1008, 374, 649, 497, 529], [1024, 377, 648, 489, 535], [1040, 379, 646, 488, 537],
    [1056, 381, 643, 485, 540], [1072, 385, 640, 482, 543], [1088, 388, 637, 479, 546],
    [1104, 389, 635, 475, 548], [1120, 389, 635, 474, 551], [1136, 388, 636, 472, 552],
    [1152, 385, 640, 472, 552], [1168, 380, 645, 475, 549], [1184, 377, 648, 479, 546],
    [1200, 374, 651, 482, 543], [1216, 372, 652, 483, 543], [1232, 372, 652, 483, 541],
    [1248, 374, 651, 483, 541], [1264, 377, 648, 482, 543], [1280, 380, 645, 479, 546],
    [1296, 383, 642, 474, 549], [1312, 386, 640, 471, 554], [1328, 389, 637, 468, 557],
    [1344, 391, 634, 463, 560], [1360, 394, 631, 461, 565], [1376, 396, 628, 457, 567],
    [1392, 399, 626, 455, 569], [1408, 400, 624, 454, 571], [1424, 400, 624, 452, 572],
    [1440, 395, 629, 452, 572],
  ],
  feminina: [
    [672, 428, 598], [688, 424, 604], [704, 415, 612],
    [720, 405, 622], [736, 395, 631], [752, 386, 640],
    [768, 378, 647], [784, 370, 654], [800, 364, 660],
    [816, 360, 665], [832, 356, 669], [848, 352, 672],
    [864, 349, 676], [880, 347, 677, 510, 515], [896, 345, 679, 507, 519],
    [912, 344, 680, 505, 521], [928, 344, 680, 503, 524], [944, 345, 680, 501, 526],
    [960, 346, 678, 498, 529], [976, 349, 676, 493, 532], [992, 351, 674, 489, 537],
    [1008, 353, 671, 485, 542], [1024, 356, 669, 480, 546], [1040, 358, 666, 475, 552],
    [1056, 361, 665, 470, 557], [1072, 361, 664, 465, 561], [1088, 361, 665, 462, 564],
    [1104, 358, 667, 458, 569], [1120, 355, 670, 452, 574], [1136, 350, 674, 445, 581],
    [1152, 345, 679, 440, 586], [1168, 340, 685, 438, 587], [1184, 336, 689, 437, 587],
    [1200, 333, 692, 436, 588], [1216, 331, 693, 436, 589], [1232, 331, 694, 434, 592],
    [1248, 332, 693, 430, 596], [1264, 333, 692, 424, 601], [1280, 334, 690, 418, 606],
    [1296, 336, 689, 413, 611], [1312, 337, 688, 409, 616], [1328, 339, 686, 405, 620],
    [1344, 340, 684, 402, 623], [1360, 341, 683, 399, 626], [1376, 343, 683, 398, 628],
    [1392, 343, 683, 396, 628], [1408, 341, 684, 396, 628], [1424, 339, 686, 396, 629],
    [1440, 338, 688, 395, 632], [1448, 337, 689, 394, 632],
  ],
};

/** Extensão horizontal ocupada numa linha, com o vão interno quando existe. */
export interface RowSpan {
  x1: number;
  x2: number;
  /** Vão entre as duas pernas nesta linha (ausente acima da virilha) */
  gap?: { x1: number; x2: number } | null;
}

/**
 * Silhueta do corpo na altura `y`, interpolada entre as amostras.
 * O vão só é devolvido quando as duas amostras vizinhas têm vão — na
 * transição da virilha ele simplesmente não existe ainda.
 * Devolve null fora da faixa coberta pelo perfil.
 */
export function bodySpanAt(base: AvatarBaseId, y: number): RowSpan | null {
  const samples = BODY_PROFILE[base];
  if (!samples || samples.length === 0) return null;
  if (y < samples[0][0] || y > samples[samples.length - 1][0]) return null;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const next = samples[i];
    if (y > next[0]) continue;

    const t = next[0] === prev[0] ? 0 : (y - prev[0]) / (next[0] - prev[0]);
    const span: RowSpan = {
      x1: lerp(prev[1], next[1], t),
      x2: lerp(prev[2], next[2], t),
    };
    if (prev.length === 5 && next.length === 5) {
      span.gap = { x1: lerp(prev[3], next[3], t), x2: lerp(prev[4], next[4], t) };
    }
    return span;
  }

  const last = samples[samples.length - 1];
  const span: RowSpan = { x1: last[1], x2: last[2] };
  if (last.length === 5) span.gap = { x1: last[3], x2: last[4] };
  return span;
}

/** Caixa de um membro, medida na silhueta da base. */
export interface LimbBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Onde estão, de fato, os membros que recebem peças em PAR (tênis,
 * joelheira). Medido separando as duas pernas da silhueta de cada base —
 * abaixo da virilha elas são blocos independentes, então cada pé e cada
 * joelho tem caixa própria.
 *
 * Serve de referência para os `pairTargets` das specs: um alvo que não está
 * centrado no membro joga a peça para dentro ou para fora do corpo. Foi
 * exatamente esse o caso do tênis — os dois alvos estavam simétricos, mas
 * 17 px (feminina) e 7 px (masculina) mais juntos que os pés, deixando o par
 * visivelmente fechado.
 */
export const LIMB_ANCHORS: Record<AvatarBaseId, { knees: { left: LimbBox; right: LimbBox }; feet: { left: LimbBox; right: LimbBox } }> = {
  masculina: {
    knees: {
      left: { x1: 377, y1: 1070, x2: 482, y2: 1180 },
      right: { x1: 543, y1: 1070, x2: 648, y2: 1180 },
    },
    feet: {
      left: { x1: 332, y1: 1400, x2: 463, y2: 1529 },
      right: { x1: 563, y1: 1400, x2: 694, y2: 1530 },
    },
  },
  feminina: {
    knees: {
      left: { x1: 335, y1: 1090, x2: 462, y2: 1190 },
      right: { x1: 565, y1: 1090, x2: 689, y2: 1190 },
    },
    feet: {
      left: { x1: 301, y1: 1400, x2: 396, y2: 1530 },
      right: { x1: 628, y1: 1400, x2: 723, y2: 1530 },
    },
  },
};

/** Centro horizontal de uma caixa. */
export function limbCenterX(box: LimbBox): number {
  return (box.x1 + box.x2) / 2;
}

/** Extremos horizontais do corpo entre duas alturas — usado para conferir caixas. */
export function bodyEnvelope(base: AvatarBaseId, yTop: number, yBottom: number): { x1: number; x2: number } | null {
  const samples = BODY_PROFILE[base].filter(([y]) => y >= yTop && y <= yBottom);
  if (samples.length === 0) return null;
  return {
    x1: Math.min(...samples.map((s) => s[1])),
    x2: Math.max(...samples.map((s) => s[2])),
  };
}

/**
 * Deformação horizontal de UMA linha, como pontos de controle crescentes:
 * `from[i]` (posição na peça encaixada) vai para `to[i]` (posição no corpo).
 * Duas bordas quando a linha é um bloco só; quatro quando há vão entre as
 * pernas (borda externa e interna de cada perna).
 */
export interface RowMap {
  from: number[];
  to: number[];
}

/** Aplica o mapa a um x, interpolando entre os pontos e extrapolando nas pontas. */
export function mapRowX(map: RowMap, x: number): number {
  const { from, to } = map;
  const n = from.length;
  if (n === 0) return x;
  if (n === 1) return x - from[0] + to[0];

  if (x <= from[0]) {
    const slope = (to[1] - to[0]) / (from[1] - from[0]);
    return to[0] + (x - from[0]) * slope;
  }
  for (let i = 1; i < n; i++) {
    if (x <= from[i]) {
      const slope = (to[i] - to[i - 1]) / (from[i] - from[i - 1]);
      return to[i - 1] + (x - from[i - 1]) * slope;
    }
  }
  const slope = (to[n - 1] - to[n - 2]) / (from[n - 1] - from[n - 2]);
  return to[n - 1] + (x - from[n - 1]) * slope;
}

/** Inverte o mapa (corpo → peça), usado na reamostragem. */
export function invertRowMap(map: RowMap): RowMap {
  return { from: map.to, to: map.from };
}

export interface ConformOptions {
  /** Folga em px de cada lado, para a roupa cobrir o contorno escuro da base */
  margin?: number;
  /** Limites de correção — protegem contra deformar demais um encaixe ruim */
  minScale?: number;
  maxScale?: number;
  /** Janela (em linhas) do alisamento da silhueta da peça */
  spanSmoothing?: number;
  /** Janela (em linhas) do alisamento da correção final */
  transformSmoothing?: number;
  /** Em quantas linhas as bordas internas entram, saindo da virilha */
  gapBlendRows?: number;
}

const DEFAULTS: Required<ConformOptions> = {
  margin: 3,
  minScale: 0.72,
  maxScale: 1.3,
  spanSmoothing: 21,
  transformSmoothing: 15,
  gapBlendRows: 60,
};

/** Vizinhança de `i` (janela `window`) sem os buracos (null). */
function neighbourhood(values: Array<number | null>, i: number, window: number): number[] {
  const half = Math.floor(window / 2);
  const out: number[] = [];
  for (let j = Math.max(0, i - half); j < Math.min(values.length, i + half + 1); j++) {
    const v = values[j];
    if (v !== null) out.push(v);
  }
  return out;
}

/** Média móvel que ignora buracos (null) — mantém null onde não há dado. */
function smoothMean(values: Array<number | null>, window: number): Array<number | null> {
  if (window <= 1) return values.slice();
  return values.map((value, i) => {
    if (value === null) return null;
    const w = neighbourhood(values, i, window);
    return w.length > 0 ? w.reduce((a, b) => a + b, 0) / w.length : value;
  });
}

/**
 * Mediana móvel, para as BORDAS da peça. A média não serve aqui: a barra e o
 * cós terminam de repente, e as últimas linhas da arte costumam ser
 * fragmentos (um pedaço de bainha, uma sombra solta) muito fora do lugar.
 * Na média esses poucos valores puxam a borda por dezenas de pixels, e o
 * tecido em volta acaba jogado para fora da perna; a mediana os ignora.
 */
function smoothMedian(values: Array<number | null>, window: number): Array<number | null> {
  if (window <= 1) return values.slice();
  return values.map((value, i) => {
    if (value === null) return null;
    const w = neighbourhood(values, i, window).sort((a, b) => a - b);
    if (w.length === 0) return value;
    const mid = w.length >> 1;
    return w.length % 2 === 0 ? (w[mid - 1] + w[mid]) / 2 : w[mid];
  });
}

/** Largura mínima (px) para uma perna/linha valer a pena deformar. */
const MIN_FEATURE_WIDTH = 4;

/**
 * Calcula, para cada linha do canvas, como deformar horizontalmente a peça
 * para que ela vista o corpo naquela altura.
 *
 * `spans[y]` é o que a peça ocupa na linha y (null onde não há peça). O
 * retorno tem o mesmo comprimento; null significa "deixar a linha como
 * está" — fora do perfil do corpo, sem peça, ou sem dado suficiente.
 *
 * Quando peça e corpo têm vão entre as pernas na mesma linha, o mapa tem
 * quatro pontos de controle e cada perna é levada à sua perna da base. Nas
 * demais linhas, só as duas bordas externas.
 *
 * As bordas da peça e o resultado são alisados ao longo de y para o contorno
 * final não ficar serrilhado por causa do antialiasing da arte.
 */
export function computeConformMaps(
  spans: Array<RowSpan | null>,
  base: AvatarBaseId,
  options: ConformOptions = {}
): Array<RowMap | null> {
  const { margin, minScale, maxScale, spanSmoothing, transformSmoothing, gapBlendRows } = {
    ...DEFAULTS,
    ...options,
  };

  const pieceEdges = [
    smoothMedian(spans.map((s) => (s ? s.x1 : null)), spanSmoothing),
    smoothMedian(spans.map((s) => (s && s.gap ? s.gap.x1 : null)), spanSmoothing),
    smoothMedian(spans.map((s) => (s && s.gap ? s.gap.x2 : null)), spanSmoothing),
    smoothMedian(spans.map((s) => (s ? s.x2 : null)), spanSmoothing),
  ];

  // Alvos no corpo, por borda (mesma ordem). A folga entra para FORA nas
  // bordas externas e para DENTRO do vão nas internas: em ambos os casos a
  // roupa cobre o contorno da base em vez de parar em cima dele.
  const targets: Array<Array<number | null>> = [[], [], [], []];
  let firstGapRow: number | null = null;

  for (let y = 0; y < spans.length; y++) {
    const outerLeft = pieceEdges[0][y];
    const outerRight = pieceEdges[3][y];
    const body = bodySpanAt(base, y);

    if (outerLeft === null || outerRight === null || !body || outerRight - outerLeft < MIN_FEATURE_WIDTH) {
      targets.forEach((t) => t.push(null));
      continue;
    }

    // Escala externa limitada: um encaixe muito fora não deve ser esticado
    // até o corpo, só puxado na direção certa.
    const wanted = body.x2 + margin - (body.x1 - margin);
    const scale = Math.min(Math.max(wanted / (outerRight - outerLeft), minScale), maxScale);
    const half = ((outerRight - outerLeft) * scale) / 2;
    const center = (body.x1 + body.x2) / 2;
    const outerTargetLeft = center - half;
    const outerTargetRight = center + half;
    targets[0].push(outerTargetLeft);
    targets[3].push(outerTargetRight);

    const pieceGapLeft = pieceEdges[1][y];
    const pieceGapRight = pieceEdges[2][y];
    const bodyGap = body.gap;
    const bothHaveGap =
      bodyGap != null &&
      bodyGap.x2 - bodyGap.x1 >= MIN_FEATURE_WIDTH &&
      pieceGapLeft !== null &&
      pieceGapRight !== null &&
      pieceGapRight - pieceGapLeft >= MIN_FEATURE_WIDTH;

    if (!bothHaveGap) {
      targets[1].push(null);
      targets[2].push(null);
      continue;
    }
    if (firstGapRow === null) firstGapRow = y;

    // Logo abaixo da virilha o vão do corpo tem poucos pixels: prender a
    // entreperna da arte nele de uma vez faria um degrau horizontal visível
    // na coxa. As bordas internas entram progressivamente, saindo de onde o
    // mapa externo já as levaria.
    const blend = gapBlendRows > 0 ? Math.min(1, (y - firstGapRow) / gapBlendRows) : 1;
    const outerScale = (outerTargetRight - outerTargetLeft) / (outerRight - outerLeft);
    const asOuter = (x: number) => outerTargetLeft + (x - outerLeft) * outerScale;
    const lerp = (a: number, b: number) => a + (b - a) * blend;

    targets[1].push(lerp(asOuter(pieceGapLeft), bodyGap.x1 + margin));
    targets[2].push(lerp(asOuter(pieceGapRight), bodyGap.x2 - margin));
  }

  const smoothTargets = targets.map((t) => smoothMean(t, transformSmoothing));
  const smoothPiece = pieceEdges.map((p) => smoothMean(p, transformSmoothing));

  return spans.map((_, y) => {
    const from: number[] = [];
    const to: number[] = [];
    for (let e = 0; e < 4; e++) {
      const f = smoothPiece[e][y];
      const t = smoothTargets[e][y];
      if (f === null || t === null) continue;
      // Pontos de controle têm de ser estritamente crescentes dos dois lados,
      // senão o mapa dobra sobre si mesmo e a linha vira borrão.
      if (from.length > 0 && (f <= from[from.length - 1] || t <= to[to.length - 1])) continue;
      from.push(f);
      to.push(t);
    }
    return from.length >= 2 ? { from, to } : null;
  });
}

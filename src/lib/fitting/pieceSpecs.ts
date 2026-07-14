/**
 * src/lib/fitting/pieceSpecs.ts
 * Especificações de encaixe de cada peça (M-01..M-10, F-01..F-10).
 * Fonte única de verdade para caixa exata, âncora anatômica, tamanho
 * relativo e aberturas vazadas.
 *
 * Coordenadas CALIBRADAS A PARTIR DAS IMAGENS REAIS DAS BASES
 * (public/avatar-bases/base masculina.png e base feminina.png, 1024×1536),
 * medidas pela silhueta (canal alpha) e pelas regiões de roupa da própria
 * base — substituem os valores teóricos originais de PROMPTS_AVATAR.md,
 * que não batiam com a anatomia das artes geradas.
 *
 * Módulo puro (sem DOM/Canvas) para ser testável isoladamente.
 */

export type AvatarBaseId = 'masculina' | 'feminina';

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function boxWidth(box: Box): number {
  return box.x2 - box.x1;
}

export function boxHeight(box: Box): number {
  return box.y2 - box.y1;
}

export interface PieceSpec {
  /** Identificador único da peça, ex.: "M-01", "F-05" */
  id: string;
  /** Nome legível, ex.: "Camiseta" */
  name: string;
  /** Base de avatar para a qual esta peça foi projetada */
  avatarBase: AvatarBaseId;
  /** Caixa exata no canvas 1024x1536 onde a peça DEVE ocupar */
  box: Box;
  /** Descrição textual do ponto de referência anatômico (documentação) */
  anchor: string;
  /** Descrição textual do tamanho relativo à base (documentação) */
  sizeRelative: string;
  /** Áreas que devem permanecer alpha=0 (documentação/QA, não geometria) */
  cutouts: string[];
  /** true quando a peça é composta por duas unidades simétricas (par) */
  isPair?: boolean;
}

/** Canvas de referência usado por todas as bases e peças */
export const CANVAS = { width: 1024, height: 1536 } as const;

/**
 * Mapa de coordenadas das regiões anatômicas (y-ranges) POR BASE,
 * medido na silhueta real de cada arte (as duas têm proporções diferentes —
 * a base feminina tem cabeça maior e pernas mais curtas que a masculina).
 */
export const ANATOMY_ZONES = {
  masculina: {
    head: { y1: 60, y2: 310 },
    neck: { y1: 310, y2: 400 },
    shoulders: { y1: 400, y2: 480 },
    torso: { y1: 400, y2: 780 },
    hip: { y1: 780, y2: 1015 },
    thigh: { y1: 910, y2: 1120 },
    knee: { y1: 1070, y2: 1180 },
    calf: { y1: 1180, y2: 1400 },
    feet: { y1: 1400, y2: 1532 },
    wrists: { y1: 810, y2: 900 },
  },
  feminina: {
    head: { y1: 60, y2: 380 },
    neck: { y1: 380, y2: 440 },
    shoulders: { y1: 440, y2: 500 },
    torso: { y1: 440, y2: 725 },
    hip: { y1: 725, y2: 915 },
    thigh: { y1: 875, y2: 1140 },
    knee: { y1: 1090, y2: 1190 },
    calf: { y1: 1190, y2: 1380 },
    feet: { y1: 1380, y2: 1532 },
    wrists: { y1: 785, y2: 875 },
  },
} as const;

/** Larguras ombro-a-ombro e quadril por base (x-ranges), medidas na silhueta */
export const BASE_WIDTHS = {
  masculina: {
    shoulders: { x1: 293, x2: 731 },
    hip: { x1: 367, x2: 656 },
  },
  feminina: {
    shoulders: { x1: 351, x2: 677 },
    hip: { x1: 350, x2: 674 },
  },
} as const;

const MASCULINO: PieceSpec[] = [
  {
    id: 'M-01',
    name: 'Camiseta',
    avatarBase: 'masculina',
    box: { x1: 270, x2: 755, y1: 330, y2: 800 },
    anchor: 'Gola alinhada ao pescoço da base (y ≈ 330); ombros da peça nos ombros da base (y ≈ 400–480); barra cobrindo o cós do short da base (y ≈ 780).',
    sizeRelative: 'Largura = ombro-a-ombro da base + mangas curtas (≈ 485 px); Altura = pescoço até o cós.',
    cutouts: ['Gola redonda (centro superior)', '2 bocas de manga (esquerda e direita)'],
  },
  {
    id: 'M-02',
    name: 'Regata',
    avatarBase: 'masculina',
    box: { x1: 300, x2: 725, y1: 340, y2: 800 },
    anchor: 'Gola alinhada ao pescoço da base; cavas largas nos ombros; barra cobrindo o cós do short da base (y ≈ 780).',
    sizeRelative: 'Largura = largura do peito; Altura = pescoço até o cós.',
    cutouts: ['Gola (centro superior)', '2 cavas laterais (passagem dos braços, esquerda e direita)'],
  },
  {
    id: 'M-03',
    name: 'Jaqueta',
    avatarBase: 'masculina',
    box: { x1: 250, x2: 775, y1: 320, y2: 860 },
    anchor: 'Gola alinhada ao pescoço da base; ombros da jaqueta nos ombros da base; barra abaixo do cós (nível quadril alto, y ≈ 860).',
    sizeRelative: 'Largura = ombro-a-ombro + 5% cada lado; Altura = pescoço até quadril alto.',
    cutouts: ['Gola (centro superior)', '2 punhos de manga (extremidades das mangas)', 'Barra inferior aberta'],
  },
  {
    id: 'M-04',
    name: 'Short',
    avatarBase: 'masculina',
    box: { x1: 355, x2: 670, y1: 770, y2: 1020 },
    anchor: 'Cós alinhado ao cós do short da base (y ≈ 775); barra das pernas no meio da coxa (y ≈ 1015, mesma barra do short da base).',
    sizeRelative: 'Largura = largura do quadril (x ≈ 367–656); Altura = cós até meio da coxa.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna (saídas inferiores, esquerda e direita)'],
  },
  {
    id: 'M-05',
    name: 'Calça',
    avatarBase: 'masculina',
    box: { x1: 355, x2: 670, y1: 770, y2: 1440 },
    anchor: 'Cós alinhado ao cós do short da base (y ≈ 775); barra das pernas no tornozelo (y ≈ 1420).',
    sizeRelative: 'Largura = largura do quadril; Altura = cós até tornozelo.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna nos tornozelos (esquerda e direita)'],
  },
  {
    id: 'M-06',
    name: 'Boné',
    avatarBase: 'masculina',
    box: { x1: 390, x2: 630, y1: 60, y2: 210 },
    anchor: 'Copa cobre o topo da cabeça (y 60); aba termina na testa, acima das sobrancelhas (y ≈ 210). Cabeça da base: x ≈ 405–620.',
    sizeRelative: 'Largura = largura da cabeça (≈ 240 px); Altura = topo da cabeça até a testa.',
    cutouts: ['Abertura inferior circular (encaixe da cabeça)'],
  },
  {
    id: 'M-07',
    name: 'Munhequeira',
    avatarBase: 'masculina',
    box: { x1: 238, x2: 786, y1: 805, y2: 905 },
    anchor: 'Uma munhequeira em cada pulso da base (pulso esquerdo ≈ x 238–315 / pulso direito ≈ x 706–786); pulsos na altura y ≈ 810–900.',
    sizeRelative: 'Cada munhequeira: largura = pulso da base (≈ 78 px); altura ≈ 100 px.',
    cutouts: ['Interior do anel de cada munhequeira (buraco central de cada uma)'],
    isPair: true,
  },
  {
    id: 'M-08',
    name: 'Luvas',
    avatarBase: 'masculina',
    box: { x1: 225, x2: 792, y1: 820, y2: 1015 },
    anchor: 'Dedos apontados para baixo; encaixe do punho nos pulsos da base (mão esquerda ≈ x 225–330 / mão direita ≈ x 690–792); mãos terminam em y ≈ 1005.',
    sizeRelative: 'Cada luva: do punho (y ≈ 820) até a ponta dos dedos (y ≈ 1015).',
    cutouts: ['Punho de cada luva (abertura de encaixe no pulso)'],
    isPair: true,
  },
  {
    id: 'M-09',
    name: 'Joelheira',
    avatarBase: 'masculina',
    box: { x1: 378, x2: 645, y1: 1070, y2: 1180 },
    anchor: 'Centradas em cada joelho da base (joelho esquerdo ≈ x 378–485 / joelho direito ≈ x 538–645); joelhos na altura y ≈ 1070–1180.',
    sizeRelative: 'Cada joelheira: largura = joelho da base (≈ 105 px); altura ≈ 110 px.',
    cutouts: ['Interior do anel de cada joelheira (buraco central de cada uma)'],
    isPair: true,
  },
  {
    id: 'M-10',
    name: 'Tênis',
    avatarBase: 'masculina',
    box: { x1: 330, x2: 692, y1: 1400, y2: 1532 },
    anchor: 'Solado sob cada pé da base (pé esquerdo ≈ x 337–460 / pé direito ≈ x 565–685); cano alinhado ao tornozelo (y ≈ 1400).',
    sizeRelative: 'Cada tênis: largura = largura do pé (≈ 125 px); altura = solado (y 1530) até cano (y 1400).',
    cutouts: ['Cano superior de cada tênis (abertura de encaixe do pé)'],
    isPair: true,
  },
];

const FEMININO: PieceSpec[] = [
  {
    id: 'F-01',
    name: 'Camiseta',
    avatarBase: 'feminina',
    box: { x1: 330, x2: 700, y1: 400, y2: 780 },
    anchor: 'Gola alinhada ao pescoço da base (y ≈ 410); ombros da peça nos ombros da base (y ≈ 440–500); barra cobrindo o cós do short da base (y ≈ 725–780).',
    sizeRelative: 'Largura = ombro-a-ombro da base + mangas (≈ 370 px); Altura = pescoço até o cós.',
    cutouts: ['Gola (centro superior)', '2 bocas de manga (esquerda e direita)'],
  },
  {
    id: 'F-02',
    name: 'Top (Sports Bra)',
    avatarBase: 'feminina',
    box: { x1: 340, x2: 685, y1: 450, y2: 640 },
    anchor: 'Alças nos ombros da base (y ≈ 450); barra acima do umbigo (y ≈ 635 — mesma posição do top da própria base).',
    sizeRelative: 'Largura = largura do peito (x ≈ 351–677); Altura = ombros até costelas baixas.',
    cutouts: ['Decote (abertura superior)', '2 cavas laterais (esquerda e direita)', 'Barra inferior aberta'],
  },
  {
    id: 'F-03',
    name: 'Jaqueta',
    avatarBase: 'feminina',
    box: { x1: 310, x2: 720, y1: 390, y2: 840 },
    anchor: 'Gola alinhada ao pescoço da base; ombros nos ombros da base; barra no quadril alto (y ≈ 840).',
    sizeRelative: 'Largura = ombro-a-ombro + 5% cada lado; Altura = pescoço até quadril.',
    cutouts: ['Gola (centro superior)', '2 punhos de manga (extremidades das mangas)', 'Barra inferior aberta'],
  },
  {
    id: 'F-04',
    name: 'Short',
    avatarBase: 'feminina',
    box: { x1: 340, x2: 685, y1: 715, y2: 1000 },
    anchor: 'Cós de cintura alta alinhado ao cós do short da base (y ≈ 725); barra das pernas no meio da coxa (y ≈ 1000).',
    sizeRelative: 'Largura = largura do quadril (x ≈ 350–674); Altura = cós até meio da coxa.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna (esquerda e direita)'],
  },
  {
    id: 'F-05',
    name: 'Calça / Legging',
    avatarBase: 'feminina',
    box: { x1: 335, x2: 690, y1: 715, y2: 1430 },
    anchor: 'Cós de cintura alta alinhado ao cós do short da base (y ≈ 725); barra das pernas no tornozelo (y ≈ 1400).',
    sizeRelative: 'Largura = largura do quadril; Altura = cós até tornozelo.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna nos tornozelos (esquerda e direita)'],
  },
  {
    id: 'F-06',
    name: 'Boné',
    avatarBase: 'feminina',
    box: { x1: 370, x2: 655, y1: 60, y2: 225 },
    anchor: 'Copa cobre o topo da cabeça (y 60); aba termina na testa, acima das sobrancelhas (y ≈ 225); abertura traseira para o rabo de cavalo (lado direito, x ≈ 594–669).',
    sizeRelative: 'Largura = largura da cabeça (≈ 285 px); Altura = topo da cabeça até a testa.',
    cutouts: ['Abertura inferior circular (encaixe da cabeça)', 'Abertura traseira oval (passagem do rabo de cavalo)'],
  },
  {
    id: 'F-07',
    name: 'Munhequeira',
    avatarBase: 'feminina',
    box: { x1: 248, x2: 775, y1: 785, y2: 875 },
    anchor: 'Uma munhequeira em cada pulso da base (pulso esquerdo ≈ x 248–315 / pulso direito ≈ x 708–775); pulsos na altura y ≈ 785–875.',
    sizeRelative: 'Cada munhequeira: largura = pulso da base (≈ 67 px); altura ≈ 90 px.',
    cutouts: ['Interior do anel de cada munhequeira (buraco central de cada uma)'],
    isPair: true,
  },
  {
    id: 'F-08',
    name: 'Luvas',
    avatarBase: 'feminina',
    box: { x1: 218, x2: 805, y1: 800, y2: 945 },
    anchor: 'Dedos apontados para baixo; encaixe do punho nos pulsos da base (mão esquerda ≈ x 218–310 / mão direita ≈ x 715–805); mãos terminam em y ≈ 935.',
    sizeRelative: 'Cada luva: do punho (y ≈ 800) até a ponta dos dedos (y ≈ 945).',
    cutouts: ['Punho de cada luva (abertura de encaixe no pulso)'],
    isPair: true,
  },
  {
    id: 'F-09',
    name: 'Joelheira',
    avatarBase: 'feminina',
    box: { x1: 345, x2: 680, y1: 1090, y2: 1190 },
    anchor: 'Centradas em cada joelho da base (joelho esquerdo ≈ x 345–447 / joelho direito ≈ x 578–680); joelhos na altura y ≈ 1090–1190.',
    sizeRelative: 'Cada joelheira: largura = joelho da base (≈ 100 px); altura ≈ 100 px.',
    cutouts: ['Interior do anel de cada joelheira (buraco central de cada uma)'],
    isPair: true,
  },
  {
    id: 'F-10',
    name: 'Tênis',
    avatarBase: 'feminina',
    box: { x1: 295, x2: 725, y1: 1375, y2: 1532 },
    anchor: 'Solado sob cada pé da base (pé esquerdo ≈ x 303–390 / pé direito ≈ x 635–721); cano alinhado ao tornozelo (y ≈ 1380).',
    sizeRelative: 'Cada tênis: largura = largura do pé (≈ 90 px); altura = solado (y 1530) até cano (y 1380).',
    cutouts: ['Cano superior de cada tênis (abertura de encaixe do pé)'],
    isPair: true,
  },
];

export const PIECE_SPECS: Record<string, PieceSpec> = Object.fromEntries(
  [...MASCULINO, ...FEMININO].map((spec) => [spec.id, spec])
);

export function getPieceSpec(pecaId: string): PieceSpec {
  const spec = PIECE_SPECS[pecaId];
  if (!spec) {
    throw new Error(`[fitting] Especificação não encontrada para peça "${pecaId}"`);
  }
  return spec;
}

export function listPieceSpecs(avatarBase?: AvatarBaseId): PieceSpec[] {
  const all = Object.values(PIECE_SPECS);
  return avatarBase ? all.filter((s) => s.avatarBase === avatarBase) : all;
}

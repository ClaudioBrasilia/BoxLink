/**
 * src/lib/fitting/pieceSpecs.ts
 * Especificações de encaixe transcritas de PROMPTS_AVATAR.md.
 * Fonte única de verdade para caixa exata, âncora anatômica, tamanho
 * relativo e aberturas vazadas de cada peça (M-01..M-10, F-01..F-10).
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

/** Mapa de coordenadas das regiões anatômicas (y-ranges), da base do avatar */
export const ANATOMY_ZONES = {
  head: { y1: 60, y2: 310 },
  neck: { y1: 290, y2: 360 },
  shoulders: { y1: 320, y2: 420 },
  torso: { y1: 360, y2: 720 },
  hip: { y1: 720, y2: 950 },
  thigh: { y1: 950, y2: 1230 },
  knee: { y1: 1180, y2: 1290 },
  calf: { y1: 1230, y2: 1430 },
  feet: { y1: 1430, y2: 1530 },
  wrists: { y1: 880, y2: 1000 },
} as const;

/** Larguras ombro-a-ombro e quadril por base (x-ranges) */
export const BASE_WIDTHS = {
  masculina: {
    shoulders: { x1: 310, x2: 700 },
    hip: { x1: 360, x2: 670 },
  },
  feminina: {
    shoulders: { x1: 360, x2: 660 },
    hip: { x1: 370, x2: 660 },
  },
} as const;

const MASCULINO: PieceSpec[] = [
  {
    id: 'M-01',
    name: 'Camiseta',
    avatarBase: 'masculina',
    box: { x1: 280, x2: 740, y1: 320, y2: 720 },
    anchor: 'Gola alinhada ao pescoço da base; ombros da peça nos ombros da base; barra da camiseta na linha da cintura.',
    sizeRelative: 'Largura = ombro-a-ombro da base (≈ 390 px); Altura = pescoço até cintura.',
    cutouts: ['Gola redonda (centro superior)', '2 bocas de manga (esquerda e direita)'],
  },
  {
    id: 'M-02',
    name: 'Regata',
    avatarBase: 'masculina',
    box: { x1: 300, x2: 720, y1: 330, y2: 720 },
    anchor: 'Gola alinhada ao pescoço da base; cavas largas nos ombros; barra da regata na linha da cintura.',
    sizeRelative: 'Largura = largura do peito; Altura = pescoço até cintura.',
    cutouts: ['Gola (centro superior)', '2 cavas laterais (passagem dos braços, esquerda e direita)'],
  },
  {
    id: 'M-03',
    name: 'Jaqueta',
    avatarBase: 'masculina',
    box: { x1: 240, x2: 780, y1: 310, y2: 760 },
    anchor: 'Gola alinhada ao pescoço da base; ombros da jaqueta nos ombros da base; barra abaixo da cintura (nível quadril alto).',
    sizeRelative: 'Largura = ombro-a-ombro + 5% cada lado; Altura = pescoço até quadril alto.',
    cutouts: ['Gola (centro superior)', '2 punhos de manga (extremidades das mangas)', 'Barra inferior aberta'],
  },
  {
    id: 'M-04',
    name: 'Short',
    avatarBase: 'masculina',
    box: { x1: 340, x2: 690, y1: 720, y2: 960 },
    anchor: 'Cintura do short alinhada ao quadril da base; barra das pernas no meio da coxa.',
    sizeRelative: 'Largura = largura do quadril; Altura = quadril até meio da coxa.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna (saídas inferiores, esquerda e direita)'],
  },
  {
    id: 'M-05',
    name: 'Calça',
    avatarBase: 'masculina',
    box: { x1: 340, x2: 690, y1: 720, y2: 1430 },
    anchor: 'Cintura da calça alinhada ao quadril da base; barra das pernas no tornozelo.',
    sizeRelative: 'Largura = largura do quadril; Altura = quadril até tornozelo.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna nos tornozelos (esquerda e direita)'],
  },
  {
    id: 'M-06',
    name: 'Boné',
    avatarBase: 'masculina',
    box: { x1: 340, x2: 680, y1: 60, y2: 280 },
    anchor: 'Aba do boné sobre a testa do avatar; copa cobre o topo da cabeça.',
    sizeRelative: 'Largura = largura da cabeça; Altura = topo da cabeça até a testa.',
    cutouts: ['Abertura inferior circular (encaixe da cabeça)'],
  },
  {
    id: 'M-07',
    name: 'Munhequeira',
    avatarBase: 'masculina',
    box: { x1: 220, x2: 820, y1: 880, y2: 1000 },
    anchor: 'Uma munhequeira em cada pulso da base (pulso esquerdo ≈ x 220–370 / pulso direito ≈ x 670–820); altura = 80 px cada.',
    sizeRelative: 'Cada munhequeira: largura = pulso da base; altura = 80 px.',
    cutouts: ['Interior do anel de cada munhequeira (buraco central de cada uma)'],
    isPair: true,
  },
  {
    id: 'M-08',
    name: 'Luvas',
    avatarBase: 'masculina',
    box: { x1: 180, x2: 860, y1: 880, y2: 1040 },
    anchor: 'Dedos apontados para baixo; encaixe do punho nos pulsos da base (mão esquerda ≈ x 180–390 / mão direita ≈ x 650–860).',
    sizeRelative: 'Cada luva: de dedos até punho da base.',
    cutouts: ['Punho de cada luva (abertura de encaixe no pulso)'],
    isPair: true,
  },
  {
    id: 'M-09',
    name: 'Joelheira',
    avatarBase: 'masculina',
    box: { x1: 360, x2: 670, y1: 1180, y2: 1290 },
    anchor: 'Centradas em cada joelho da base (joelho esquerdo ≈ x 360–510 / joelho direito ≈ x 520–670); altura = 110 px cada.',
    sizeRelative: 'Cada joelheira: largura = joelho da base; altura = 110 px.',
    cutouts: ['Interior do anel de cada joelheira (buraco central de cada uma)'],
    isPair: true,
  },
  {
    id: 'M-10',
    name: 'Tênis',
    avatarBase: 'masculina',
    box: { x1: 340, x2: 690, y1: 1430, y2: 1530 },
    anchor: 'Solado sob cada pé da base (pé esquerdo ≈ x 340–510 / pé direito ≈ x 520–690); cano alinhado ao tornozelo.',
    sizeRelative: 'Cada tênis: largura = largura do pé; altura = solado até cano.',
    cutouts: ['Cano superior de cada tênis (abertura de encaixe do pé)'],
    isPair: true,
  },
];

const FEMININO: PieceSpec[] = [
  {
    id: 'F-01',
    name: 'Camiseta',
    avatarBase: 'feminina',
    box: { x1: 310, x2: 720, y1: 320, y2: 720 },
    anchor: 'Gola alinhada ao pescoço da base; ombros da peça nos ombros da base; barra da camiseta na linha da cintura.',
    sizeRelative: 'Largura = ombro-a-ombro da base (≈ 300 px); Altura = pescoço até cintura.',
    cutouts: ['Gola (centro superior)', '2 bocas de manga (esquerda e direita)'],
  },
  {
    id: 'F-02',
    name: 'Top (Sports Bra)',
    avatarBase: 'feminina',
    box: { x1: 340, x2: 690, y1: 340, y2: 560 },
    anchor: 'Alças nos ombros da base; barra acima do umbigo (nível das costelas baixas).',
    sizeRelative: 'Largura = largura do peito; Altura = ombros até costelas baixas.',
    cutouts: ['Decote (abertura superior)', '2 cavas laterais (esquerda e direita)', 'Barra inferior aberta'],
  },
  {
    id: 'F-03',
    name: 'Jaqueta',
    avatarBase: 'feminina',
    box: { x1: 270, x2: 760, y1: 310, y2: 760 },
    anchor: 'Gola alinhada ao pescoço da base; ombros nos ombros da base; barra no quadril alto.',
    sizeRelative: 'Largura = ombro-a-ombro + 5% cada lado; Altura = pescoço até quadril.',
    cutouts: ['Gola (centro superior)', '2 punhos de manga (extremidades das mangas)', 'Barra inferior aberta'],
  },
  {
    id: 'F-04',
    name: 'Short',
    avatarBase: 'feminina',
    box: { x1: 350, x2: 680, y1: 720, y2: 940 },
    anchor: 'Cintura alta alinhada ao quadril da base; barra das pernas no meio da coxa.',
    sizeRelative: 'Largura = largura do quadril; Altura = quadril até meio da coxa.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna (esquerda e direita)'],
  },
  {
    id: 'F-05',
    name: 'Calça / Legging',
    avatarBase: 'feminina',
    box: { x1: 350, x2: 680, y1: 720, y2: 1430 },
    anchor: 'Cintura alta alinhada ao quadril da base; barra das pernas no tornozelo.',
    sizeRelative: 'Largura = largura do quadril; Altura = quadril até tornozelo.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna nos tornozelos (esquerda e direita)'],
  },
  {
    id: 'F-06',
    name: 'Boné',
    avatarBase: 'feminina',
    box: { x1: 360, x2: 660, y1: 60, y2: 280 },
    anchor: 'Aba do boné sobre a testa do avatar; abertura traseira para passar o rabo de cavalo.',
    sizeRelative: 'Largura = largura da cabeça; Altura = topo da cabeça até a testa.',
    cutouts: ['Abertura inferior circular (encaixe da cabeça)', 'Abertura traseira oval (passagem do rabo de cavalo)'],
  },
  {
    id: 'F-07',
    name: 'Munhequeira',
    avatarBase: 'feminina',
    box: { x1: 240, x2: 800, y1: 880, y2: 1000 },
    anchor: 'Uma munhequeira em cada pulso da base (pulso esquerdo ≈ x 240–380 / pulso direito ≈ x 660–800); altura = 80 px cada.',
    sizeRelative: 'Cada munhequeira: largura = pulso da base; altura = 80 px.',
    cutouts: ['Interior do anel de cada munhequeira (buraco central de cada uma)'],
    isPair: true,
  },
  {
    id: 'F-08',
    name: 'Luvas',
    avatarBase: 'feminina',
    box: { x1: 200, x2: 840, y1: 880, y2: 1040 },
    anchor: 'Dedos apontados para baixo; encaixe do punho nos pulsos da base (mão esquerda ≈ x 200–390 / mão direita ≈ x 650–840).',
    sizeRelative: 'Cada luva: de dedos até punho da base.',
    cutouts: ['Punho de cada luva (abertura de encaixe no pulso)'],
    isPair: true,
  },
  {
    id: 'F-09',
    name: 'Joelheira',
    avatarBase: 'feminina',
    box: { x1: 370, x2: 660, y1: 1180, y2: 1290 },
    anchor: 'Centradas em cada joelho da base (joelho esquerdo ≈ x 370–510 / joelho direito ≈ x 520–660); altura = 110 px cada.',
    sizeRelative: 'Cada joelheira: largura = joelho da base; altura = 110 px.',
    cutouts: ['Interior do anel de cada joelheira (buraco central de cada uma)'],
    isPair: true,
  },
  {
    id: 'F-10',
    name: 'Tênis',
    avatarBase: 'feminina',
    box: { x1: 350, x2: 680, y1: 1430, y2: 1530 },
    anchor: 'Solado sob cada pé da base (pé esquerdo ≈ x 350–510 / pé direito ≈ x 520–680); cano alinhado ao tornozelo.',
    sizeRelative: 'Cada tênis: largura = largura do pé; altura = solado até cano.',
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

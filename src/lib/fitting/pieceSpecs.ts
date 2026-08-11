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

/**
 * Slots de renderização do avatar (mesmos de `AvatarSlotKey`, declarados aqui
 * para que `PieceSpec` possa apontar o slot correto sem depender de módulos
 * com DOM).
 */
export type RenderSlotKey =
  | 'top'
  | 'bottom'
  | 'shoes'
  | 'accessory'
  | 'wrist_accessory'
  | 'head_accessory'
  | 'special';

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
  /**
   * Slot em que um item desta peça DEVE ser cadastrado. Um boné (M-06/F-06)
   * pertence a `head_accessory`; cadastrado como `top`, o fallback por slot o
   * encaixaria na caixa da camiseta — que foi exatamente o bug que fez um boné
   * aparecer cobrindo o tronco do avatar.
   */
  slot: RenderSlotKey;
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
  /**
   * Caixas-alvo de CADA unidade do par (esquerda/direita), medidas nos
   * membros reais da base. Quando presente, o encaixe separa a arte no vão
   * central e posiciona cada unidade no seu membro — independente de como a
   * arte veio (pés juntos, afastados, etc.). "left"/"right" referem-se ao
   * lado da IMAGEM (esquerda da imagem = perna direita anatômica do avatar).
   */
  pairTargets?: { left: Box; right: Box };
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
    slot: 'top',
    name: 'Camiseta',
    avatarBase: 'masculina',
    // y1 = 365. O encaixe leva o pixel opaco MAIS ALTO da arte para o topo da
    // caixa, e numa camiseta desenhada chapada esse pixel é a COSTURA DO
    // OMBRO — a gola é uma concavidade abaixo dele. Histórico dos dois erros
    // opostos, medidos na base (pescoço reto y 310–368; trapézio alargando a
    // partir de 370; ombro cheio, 438 px, em y 485):
    //   y1=310 → ombro da arte no queixo, gola no meio do pescoço: tampava.
    //   y1=400 → gola certa, mas o ombro descia abaixo do trapézio e deixava
    //            a pele do ombro à mostra (a caixa também encurtava para 450,
    //            e cada ponto da peça desce 90·(1−f) da altura, então o topo
    //            descia os 90 px inteiros enquanto a barra não saía do lugar).
    // 365 é o meio-termo derivado, não empírico: com altura 485 o ponto de
    // 24% da peça — onde a arte deve atingir a largura máxima de ombro, ver
    // abaixo — cai em y ≈ 481, exatamente o ombro cheio da base (485), e a
    // gola (≈ 9% da altura numa camiseta chapada) cai em ≈ 409, abaixo da
    // base do pescoço (370), deixando o pescoço à mostra.
    //
    // Os 24% saem da própria base: da base do pescoço (370) ao ombro cheio
    // (485) são 115 px, numa peça que vai de 370 a 850 (480 px) → 115/480.
    // Arte com ombro caído (largura máxima só aos 35–40% da altura) não cabe
    // em NENHUM y1: gola e ombro têm distância fixa na arte, e a base exige
    // uma menor. Nesse caso o acerto sai da arte, não da caixa.
    box: { x1: 270, x2: 755, y1: 365, y2: 850 },
    anchor: 'Costura do ombro da peça (ponto mais alto da arte) em y ≈ 365; largura máxima de ombro em y ≈ 481, sobre o ombro cheio da base (485); gola caindo abaixo, no pescoço (y ≈ 409), com o pescoço da base (310–370) à mostra; barra cobrindo o cós do short da base (y ≈ 830).',
    sizeRelative: 'Largura = ombro-a-ombro da base + mangas curtas (≈ 485 px); Altura = ombro até o cós (≈ 485 px).',
    cutouts: ['Gola redonda (centro superior)', '2 bocas de manga (esquerda e direita)'],
  },
  {
    id: 'M-02',
    slot: 'top',
    name: 'Regata',
    avatarBase: 'masculina',
    box: { x1: 300, x2: 725, y1: 340, y2: 800 },
    anchor: 'Gola alinhada ao pescoço da base; cavas largas nos ombros; barra cobrindo o cós do short da base (y ≈ 780).',
    sizeRelative: 'Largura = largura do peito; Altura = pescoço até o cós.',
    cutouts: ['Gola (centro superior)', '2 cavas laterais (passagem dos braços, esquerda e direita)'],
  },
  {
    id: 'M-03',
    slot: 'top',
    name: 'Jaqueta',
    avatarBase: 'masculina',
    // Caixa engloba tronco + BRAÇOS: a jaqueta tem mangas longas que descem
    // pelos braços da base (punhos ≈ x 242/782, y 940). Uma caixa só do
    // tronco comprimia as mangas e as deixava paradas no quadril.
    box: { x1: 244, x2: 781, y1: 345, y2: 922 },
    anchor: 'Gola no pescoço da base; ombros nos ombros; mangas longas descendo pelos braços, punho terminando no pulso (y ≈ 922); barra do tronco no quadril alto.',
    sizeRelative: 'Largura = vão dos braços da base (≈ 545 px); Altura = pescoço até os punhos.',
    cutouts: ['Gola (centro superior)', '2 punhos de manga (extremidades das mangas)', 'Barra inferior aberta'],
  },
  {
    id: 'M-04',
    slot: 'bottom',
    name: 'Short',
    avatarBase: 'masculina',
    box: { x1: 355, x2: 670, y1: 770, y2: 1020 },
    anchor: 'Cós alinhado ao cós do short da base (y ≈ 775); barra das pernas no meio da coxa (y ≈ 1015, mesma barra do short da base).',
    sizeRelative: 'Largura = largura do quadril (x ≈ 367–656); Altura = cós até meio da coxa.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna (saídas inferiores, esquerda e direita)'],
  },
  {
    id: 'M-05',
    slot: 'bottom',
    name: 'Calça',
    avatarBase: 'masculina',
    // Largura estendida até o vão dos PÉS (x 337–685): as pernas da base
    // abrem em direção aos pés, então uma caixa só da largura do quadril
    // deixa as panturrilhas escaparem. Ver F-05.
    box: { x1: 330, x2: 695, y1: 765, y2: 1445 },
    anchor: 'Cós cobrindo o cós do short da base (y ≈ 765); barra das pernas no tornozelo (y ≈ 1440), acompanhando a pose de pernas abertas.',
    sizeRelative: 'Largura = vão dos pés da base (≈ 365 px); Altura = cós até tornozelo.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna nos tornozelos (esquerda e direita)'],
  },
  {
    id: 'M-06',
    slot: 'head_accessory',
    name: 'Boné',
    avatarBase: 'masculina',
    // Largura calibrada pelo CRÂNIO, não pelo vão das orelhas: os 240 px
    // anteriores eram a largura da cabeça medida em y ≈ 240, onde as orelhas
    // se projetam (x 392–631). A aba fica em y ≈ 190, onde o crânio tem só
    // 196 px (x 413–609) — com 240 px ela avançava ~21 px além da cabeça de
    // cada lado e o boné parecia grande demais. 216 px deixa a sobra em 10 px
    // por lado, e a caixa menos achatada reduz também o esmagamento vertical
    // da arte no modo 'stretch' (razão 1,31 → 1,18).
    box: { x1: 403, x2: 619, y1: 60, y2: 210 },
    anchor: 'Copa cobre o topo da cabeça (y 60); aba termina na testa, acima das sobrancelhas (y ≈ 210). Centrada no eixo da cabeça (x ≈ 511). Crânio da base na altura da aba: x ≈ 413–609.',
    sizeRelative: 'Largura = crânio da base + ~10 px de sobra por lado (≈ 216 px); Altura = topo da cabeça até a testa.',
    cutouts: ['Abertura inferior circular (encaixe da cabeça)'],
  },
  {
    id: 'M-07',
    slot: 'wrist_accessory',
    name: 'Munhequeira',
    avatarBase: 'masculina',
    box: { x1: 238, x2: 786, y1: 805, y2: 905 },
    anchor: 'Uma munhequeira em cada pulso da base (pulso esquerdo ≈ x 238–315 / pulso direito ≈ x 706–786); pulsos na altura y ≈ 810–900.',
    sizeRelative: 'Cada munhequeira: largura = pulso da base (≈ 78 px); altura ≈ 100 px.',
    cutouts: ['Interior do anel de cada munhequeira (buraco central de cada uma)'],
    isPair: true,
    pairTargets: {
      left: { x1: 226, y1: 800, x2: 328, y2: 912 },
      right: { x1: 694, y1: 800, x2: 796, y2: 912 },
    },
  },
  {
    id: 'M-08',
    slot: 'wrist_accessory',
    name: 'Luvas',
    avatarBase: 'masculina',
    box: { x1: 225, x2: 792, y1: 820, y2: 1015 },
    anchor: 'Dedos apontados para baixo; encaixe do punho nos pulsos da base (mão esquerda ≈ x 225–330 / mão direita ≈ x 690–792); mãos terminam em y ≈ 1005.',
    sizeRelative: 'Cada luva: do punho (y ≈ 820) até a ponta dos dedos (y ≈ 1015).',
    cutouts: ['Punho de cada luva (abertura de encaixe no pulso)'],
    isPair: true,
    pairTargets: {
      left: { x1: 214, y1: 815, x2: 340, y2: 1020 },
      right: { x1: 680, y1: 815, x2: 806, y2: 1020 },
    },
  },
  {
    id: 'M-09',
    slot: 'accessory',
    name: 'Joelheira',
    avatarBase: 'masculina',
    box: { x1: 378, x2: 645, y1: 1070, y2: 1180 },
    anchor: 'Centradas em cada joelho da base (joelho esquerdo ≈ x 378–485 / joelho direito ≈ x 538–645); joelhos na altura y ≈ 1070–1180.',
    sizeRelative: 'Cada joelheira: largura = joelho da base (≈ 105 px); altura ≈ 110 px.',
    cutouts: ['Interior do anel de cada joelheira (buraco central de cada uma)'],
    isPair: true,
    pairTargets: {
      left: { x1: 366, y1: 1062, x2: 497, y2: 1188 },
      right: { x1: 526, y1: 1062, x2: 657, y2: 1188 },
    },
  },
  {
    id: 'M-10',
    slot: 'shoes',
    name: 'Tênis',
    avatarBase: 'masculina',
    box: { x1: 330, x2: 692, y1: 1400, y2: 1532 },
    anchor: 'Solado sob cada pé da base (pé esquerdo ≈ x 337–460 / pé direito ≈ x 565–685); cano alinhado ao tornozelo (y ≈ 1400).',
    sizeRelative: 'Cada tênis: largura = largura do pé (≈ 125 px); altura = solado (y 1530) até cano (y 1400).',
    cutouts: ['Cano superior de cada tênis (abertura de encaixe do pé)'],
    isPair: true,
    pairTargets: {
      left: { x1: 316, y1: 1395, x2: 484, y2: 1537 },
      right: { x1: 540, y1: 1395, x2: 708, y2: 1537 },
    },
  },
];

const FEMININO: PieceSpec[] = [
  {
    id: 'F-01',
    slot: 'top',
    name: 'Camiseta',
    avatarBase: 'feminina',
    box: { x1: 330, x2: 700, y1: 400, y2: 780 },
    anchor: 'Gola alinhada ao pescoço da base (y ≈ 410); ombros da peça nos ombros da base (y ≈ 440–500); barra cobrindo o cós do short da base (y ≈ 725–780).',
    sizeRelative: 'Largura = ombro-a-ombro da base + mangas (≈ 370 px); Altura = pescoço até o cós.',
    cutouts: ['Gola (centro superior)', '2 bocas de manga (esquerda e direita)'],
  },
  {
    id: 'F-02',
    slot: 'top',
    name: 'Top (Sports Bra)',
    avatarBase: 'feminina',
    box: { x1: 340, x2: 685, y1: 450, y2: 640 },
    anchor: 'Alças nos ombros da base (y ≈ 450); barra acima do umbigo (y ≈ 635 — mesma posição do top da própria base).',
    sizeRelative: 'Largura = largura do peito (x ≈ 351–677); Altura = ombros até costelas baixas.',
    cutouts: ['Decote (abertura superior)', '2 cavas laterais (esquerda e direita)', 'Barra inferior aberta'],
  },
  {
    id: 'F-03',
    slot: 'top',
    name: 'Jaqueta',
    avatarBase: 'feminina',
    // Caixa engloba tronco + BRAÇOS: a jaqueta tem mangas longas que descem
    // pelos braços da base (punhos ≈ x 225/803, y 890). Uma caixa só do
    // tronco comprimia as mangas e as deixava paradas no quadril. Ver M-03.
    box: { x1: 236, x2: 788, y1: 415, y2: 872 },
    anchor: 'Gola no pescoço da base; ombros nos ombros; mangas longas descendo pelos braços, punho terminando no pulso (y ≈ 872); barra do tronco no quadril alto.',
    sizeRelative: 'Largura = vão dos braços da base (≈ 560 px); Altura = pescoço até os punhos.',
    cutouts: ['Gola (centro superior)', '2 punhos de manga (extremidades das mangas)', 'Barra inferior aberta'],
  },
  {
    id: 'F-04',
    slot: 'bottom',
    name: 'Short',
    avatarBase: 'feminina',
    box: { x1: 340, x2: 685, y1: 715, y2: 1000 },
    anchor: 'Cós de cintura alta alinhado ao cós do short da base (y ≈ 725); barra das pernas no meio da coxa (y ≈ 1000).',
    sizeRelative: 'Largura = largura do quadril (x ≈ 350–674); Altura = cós até meio da coxa.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna (esquerda e direita)'],
  },
  {
    id: 'F-05',
    slot: 'bottom',
    name: 'Calça / Legging',
    avatarBase: 'feminina',
    // Largura estendida até o vão dos PÉS (x 303–721), não só do quadril: a
    // base feminina fica em "A" (pernas abertas) e as panturrilhas/pés
    // escapam de uma caixa estreita — a arte da legging (pernas afunilando)
    // esticada nesta caixa cobre as pernas inteiras até o tornozelo.
    box: { x1: 305, x2: 720, y1: 705, y2: 1445 },
    anchor: 'Cós de cintura alta cobrindo o cós do short da base (y ≈ 705); barra das pernas no tornozelo (y ≈ 1440), acompanhando a pose de pernas abertas.',
    sizeRelative: 'Largura = vão dos pés da base (≈ 415 px); Altura = cós até tornozelo.',
    cutouts: ['Cintura (abertura superior)', '2 barras de perna nos tornozelos (esquerda e direita)'],
  },
  {
    id: 'F-06',
    slot: 'head_accessory',
    name: 'Boné',
    avatarBase: 'feminina',
    box: { x1: 370, x2: 655, y1: 60, y2: 225 },
    anchor: 'Copa cobre o topo da cabeça (y 60); aba termina na testa, acima das sobrancelhas (y ≈ 225); abertura traseira para o rabo de cavalo (lado direito, x ≈ 594–669).',
    sizeRelative: 'Largura = largura da cabeça (≈ 285 px); Altura = topo da cabeça até a testa.',
    cutouts: ['Abertura inferior circular (encaixe da cabeça)', 'Abertura traseira oval (passagem do rabo de cavalo)'],
  },
  {
    id: 'F-07',
    slot: 'wrist_accessory',
    name: 'Munhequeira',
    avatarBase: 'feminina',
    box: { x1: 248, x2: 775, y1: 785, y2: 875 },
    anchor: 'Uma munhequeira em cada pulso da base (pulso esquerdo ≈ x 248–315 / pulso direito ≈ x 708–775); pulsos na altura y ≈ 785–875.',
    sizeRelative: 'Cada munhequeira: largura = pulso da base (≈ 67 px); altura ≈ 90 px.',
    cutouts: ['Interior do anel de cada munhequeira (buraco central de cada uma)'],
    isPair: true,
    pairTargets: {
      left: { x1: 238, y1: 782, x2: 326, y2: 878 },
      right: { x1: 698, y1: 782, x2: 786, y2: 878 },
    },
  },
  {
    id: 'F-08',
    slot: 'wrist_accessory',
    name: 'Luvas',
    avatarBase: 'feminina',
    box: { x1: 218, x2: 805, y1: 800, y2: 945 },
    anchor: 'Dedos apontados para baixo; encaixe do punho nos pulsos da base (mão esquerda ≈ x 218–310 / mão direita ≈ x 715–805); mãos terminam em y ≈ 935.',
    sizeRelative: 'Cada luva: do punho (y ≈ 800) até a ponta dos dedos (y ≈ 945).',
    cutouts: ['Punho de cada luva (abertura de encaixe no pulso)'],
    isPair: true,
    pairTargets: {
      left: { x1: 208, y1: 798, x2: 320, y2: 948 },
      right: { x1: 704, y1: 798, x2: 816, y2: 948 },
    },
  },
  {
    id: 'F-09',
    slot: 'accessory',
    name: 'Joelheira',
    avatarBase: 'feminina',
    box: { x1: 345, x2: 680, y1: 1090, y2: 1190 },
    anchor: 'Centradas em cada joelho da base (joelho esquerdo ≈ x 345–447 / joelho direito ≈ x 578–680); joelhos na altura y ≈ 1090–1190.',
    sizeRelative: 'Cada joelheira: largura = joelho da base (≈ 100 px); altura ≈ 100 px.',
    cutouts: ['Interior do anel de cada joelheira (buraco central de cada uma)'],
    isPair: true,
    pairTargets: {
      left: { x1: 338, y1: 1085, x2: 454, y2: 1195 },
      right: { x1: 571, y1: 1085, x2: 687, y2: 1195 },
    },
  },
  {
    id: 'F-10',
    slot: 'shoes',
    name: 'Tênis',
    avatarBase: 'feminina',
    box: { x1: 295, x2: 725, y1: 1375, y2: 1532 },
    anchor: 'Solado sob cada pé da base (pé esquerdo ≈ x 303–390 / pé direito ≈ x 635–721); cano alinhado ao tornozelo (y ≈ 1380).',
    sizeRelative: 'Cada tênis: largura = largura do pé (≈ 90 px); altura = solado (y 1530) até cano (y 1380).',
    cutouts: ['Cano superior de cada tênis (abertura de encaixe do pé)'],
    isPair: true,
    pairTargets: {
      left: { x1: 273, y1: 1372, x2: 441, y2: 1537 },
      right: { x1: 583, y1: 1372, x2: 751, y2: 1537 },
    },
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

/** Slot correto para um `piece_spec_id`, ou null se o id não existir. */
export function getSpecSlot(pecaId?: string | null): RenderSlotKey | null {
  return (pecaId && PIECE_SPECS[pecaId]?.slot) || null;
}

/**
 * true quando o slot cadastrado no item conflita com o slot da peça escolhida
 * (ex.: item no slot `top` com "Tipo de peça" = Boné). Usado pelo Admin para
 * avisar antes de salvar um item que apareceria na parte errada do corpo.
 */
export function isSlotMismatched(slot: RenderSlotKey, pecaId?: string | null): boolean {
  const specSlot = getSpecSlot(pecaId);
  return specSlot !== null && specSlot !== slot;
}

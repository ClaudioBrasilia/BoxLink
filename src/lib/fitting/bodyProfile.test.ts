import { describe, it, expect } from 'vitest';
import {
  BODY_PROFILE,
  LIMB_ANCHORS,
  limbCenterX,
  bodySpanAt,
  bodyEnvelope,
  computeConformMaps,
  mapRowX,
  invertRowMap,
  RowSpan,
} from './bodyProfile';
import { getPieceSpec, AvatarBaseId } from './pieceSpecs';

const BASES: AvatarBaseId[] = ['masculina', 'feminina'];

describe('BODY_PROFILE', () => {
  it('has ordered samples inside the reference canvas for both bases', () => {
    for (const base of BASES) {
      const samples = BODY_PROFILE[base];
      expect(samples.length).toBeGreaterThan(20);
      for (let i = 0; i < samples.length; i++) {
        const [y, x1, x2] = samples[i];
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(1536);
        expect(x1).toBeGreaterThan(0);
        expect(x2).toBeLessThan(1024);
        expect(x2).toBeGreaterThan(x1);
        if (i > 0) expect(y).toBeGreaterThan(samples[i - 1][0]);
      }
    }
  });

  it('stops before the feet splay out, so a hem is not flared outwards', () => {
    for (const base of BASES) {
      const samples = BODY_PROFILE[base];
      expect(samples[samples.length - 1][0]).toBeLessThan(1460);
    }
  });

  it('keeps the leg gap inside the outer silhouette, and only below the crotch', () => {
    for (const base of BASES) {
      let seenGap = false;
      for (const sample of BODY_PROFILE[base]) {
        if (sample.length !== 5) {
          // O vão aparece na virilha e não some mais para baixo.
          expect(seenGap).toBe(false);
          continue;
        }
        seenGap = true;
        const [, x1, x2, gapX1, gapX2] = sample;
        expect(gapX1).toBeGreaterThan(x1);
        expect(gapX2).toBeLessThan(x2);
        expect(gapX2).toBeGreaterThan(gapX1);
      }
      expect(seenGap).toBe(true);
    }
  });
});

describe('bodySpanAt', () => {
  it('returns the sampled span exactly on a sample row', () => {
    const [y, x1, x2] = BODY_PROFILE.feminina[10];
    expect(bodySpanAt('feminina', y)).toEqual({ x1, x2 });
  });

  it('interpolates linearly between two samples', () => {
    const [y0, a0, b0] = BODY_PROFILE.feminina[10];
    const [y1, a1, b1] = BODY_PROFILE.feminina[11];
    const mid = bodySpanAt('feminina', (y0 + y1) / 2)!;
    expect(mid.x1).toBeCloseTo((a0 + a1) / 2, 6);
    expect(mid.x2).toBeCloseTo((b0 + b1) / 2, 6);
  });

  it('reports the leg gap below the crotch and none above it', () => {
    expect(bodySpanAt('feminina', 1240)!.gap).toBeDefined();
    expect(bodySpanAt('feminina', 760)!.gap).toBeUndefined();
  });

  it('returns null outside the profile range (head, feet)', () => {
    expect(bodySpanAt('feminina', 100)).toBeNull();
    expect(bodySpanAt('feminina', 1530)).toBeNull();
    expect(bodySpanAt('masculina', 0)).toBeNull();
  });
});

describe('mapRowX', () => {
  it('hits every control point exactly', () => {
    const map = { from: [100, 200, 300, 400], to: [150, 220, 300, 380] };
    map.from.forEach((x, i) => expect(mapRowX(map, x)).toBeCloseTo(map.to[i], 6));
  });

  it('interpolates inside a segment and extrapolates outside the ends', () => {
    const map = { from: [100, 200], to: [200, 400] }; // escala 2
    expect(mapRowX(map, 150)).toBeCloseTo(300, 6);
    expect(mapRowX(map, 50)).toBeCloseTo(100, 6);
    expect(mapRowX(map, 250)).toBeCloseTo(500, 6);
  });

  it('round-trips through invertRowMap', () => {
    const map = { from: [100, 200, 300, 400], to: [150, 220, 300, 380] };
    for (const x of [80, 100, 175, 250, 340, 420]) {
      expect(mapRowX(invertRowMap(map), mapRowX(map, x))).toBeCloseTo(x, 6);
    }
  });
});

describe('body-hugging piece boxes', () => {
  // Regressão: as caixas de short/calça vinham do vão dos PÉS, o que deixava
  // a peça visivelmente mais larga que o corpo no quadril e na coxa.
  it.each(['M-04', 'M-05', 'F-04', 'F-05'])('%s matches the real body envelope', (id) => {
    const spec = getPieceSpec(id);
    expect(spec.conformToBody).toBe(true);

    const env = bodyEnvelope(spec.avatarBase, spec.box.y1, spec.box.y2)!;
    expect(env).not.toBeNull();
    expect(Math.abs(spec.box.x1 - env.x1)).toBeLessThanOrEqual(3);
    expect(Math.abs(spec.box.x2 - env.x2)).toBeLessThanOrEqual(3);
  });

  it.each(['M-01', 'M-02', 'M-03', 'F-01', 'F-02', 'F-03'])('%s (com mangas) is not conformed', (id) => {
    expect(getPieceSpec(id).conformToBody).toBeUndefined();
  });
});

describe('pair targets vs. the real limbs', () => {
  // Regressão: os alvos do tênis eram simétricos entre si, mas mais juntos
  // que os pés — 17 px na base feminina, 7 px na masculina. Os dois tênis
  // apareciam deslocados para dentro, desalinhados com os pés.
  const PAIRS: Array<[string, 'feet' | 'knees']> = [
    ['M-10', 'feet'],
    ['F-10', 'feet'],
    ['M-09', 'knees'],
    ['F-09', 'knees'],
  ];

  it.each(PAIRS)('%s is centred on each %s of the base', (id, limb) => {
    const spec = getPieceSpec(id);
    const anchors = LIMB_ANCHORS[spec.avatarBase][limb];
    const targets = spec.pairTargets!;
    expect(targets).toBeDefined();

    for (const side of ['left', 'right'] as const) {
      const drift = limbCenterX(targets[side]) - limbCenterX(anchors[side]);
      expect(Math.abs(drift)).toBeLessThanOrEqual(3);
    }
  });

  it.each(PAIRS)('%s keeps the same spacing between units as the base %s', (id, limb) => {
    const spec = getPieceSpec(id);
    const anchors = LIMB_ANCHORS[spec.avatarBase][limb];
    const targets = spec.pairTargets!;

    const limbSpacing = limbCenterX(anchors.right) - limbCenterX(anchors.left);
    const targetSpacing = limbCenterX(targets.right) - limbCenterX(targets.left);
    expect(Math.abs(targetSpacing - limbSpacing)).toBeLessThanOrEqual(3);
  });

  it('anchors the shoes by the sole, so they never float above the foot', () => {
    for (const id of ['M-10', 'F-10']) {
      const spec = getPieceSpec(id);
      expect(spec.pairAnchor).toBe('bottom');
      const feet = LIMB_ANCHORS[spec.avatarBase].feet;
      // O fundo do alvo tem de alcançar a sola do pé, senão ancorar embaixo
      // deixaria o tênis parado acima do chão.
      expect(spec.pairTargets!.left.y2).toBeGreaterThanOrEqual(feet.left.y2);
      expect(spec.pairTargets!.right.y2).toBeGreaterThanOrEqual(feet.right.y2);
    }
  });

  it('leaves the other pairs centred, where a floating unit is correct', () => {
    for (const id of ['M-07', 'M-08', 'M-09', 'F-07', 'F-08', 'F-09']) {
      expect(getPieceSpec(id).pairAnchor).toBeUndefined();
    }
  });
});

describe('computeConformMaps', () => {
  const SHARP = { spanSmoothing: 1, transformSmoothing: 1 };

  /** Peça reta de largura `width` centrada em 512, opcionalmente com vão. */
  const piece = (y1: number, y2: number, width: number, gapWidth = 0, rows = 1536): Array<RowSpan | null> =>
    Array.from({ length: rows }, (_, y) => {
      if (y < y1 || y >= y2) return null;
      const span: RowSpan = { x1: 512 - width / 2, x2: 512 + width / 2 };
      if (gapWidth > 0) span.gap = { x1: 512 - gapWidth / 2, x2: 512 + gapWidth / 2 };
      return span;
    });

  it('leaves empty rows and rows outside the profile untouched', () => {
    const maps = computeConformMaps(piece(705, 1445, 360), 'feminina');
    expect(maps[300]).toBeNull(); // sem peça
    expect(maps[1500]).toBeNull(); // fora do perfil (pés)
    expect(maps[1000]).not.toBeNull();
  });

  it('brings the outer edges to the body plus the margin', () => {
    const margin = 3;
    const spans = piece(705, 1445, 360);
    const maps = computeConformMaps(spans, 'feminina', { ...SHARP, margin });

    for (const y of [800, 930, 1080, 1240, 1400]) {
      const span = spans[y]!;
      const body = bodySpanAt('feminina', y)!;
      const map = maps[y]!;
      expect(mapRowX(map, span.x1)).toBeCloseTo(body.x1 - margin, 4);
      expect(mapRowX(map, span.x2)).toBeCloseTo(body.x2 + margin, 4);
    }
  });

  it('narrows a piece wider than the body and widens one narrower than it', () => {
    const wide = piece(705, 1445, 460);
    const narrow = piece(705, 1445, 240);
    const wideMap = computeConformMaps(wide, 'feminina', SHARP)[930]!;
    const narrowMap = computeConformMaps(narrow, 'feminina', SHARP)[930]!;

    const widthOf = (span: RowSpan, map: { from: number[]; to: number[] }) =>
      mapRowX(map, span.x2) - mapRowX(map, span.x1);
    expect(widthOf(wide[930]!, wideMap)).toBeLessThan(wide[930]!.x2 - wide[930]!.x1);
    expect(widthOf(narrow[930]!, narrowMap)).toBeGreaterThan(narrow[930]!.x2 - narrow[930]!.x1);
  });

  it('follows the waist → hip → knee → calf variation instead of one flat width', () => {
    const spans = piece(705, 1445, 360);
    const maps = computeConformMaps(spans, 'feminina', SHARP);
    const width = (y: number) => mapRowX(maps[y]!, spans[y]!.x2) - mapRowX(maps[y]!, spans[y]!.x1);

    expect(width(720)).toBeLessThan(width(930)); // cintura mais estreita que o quadril
    expect(width(1080)).toBeLessThan(width(930)); // joelho mais fino que o quadril
    expect(width(1240)).toBeGreaterThan(width(1080)); // panturrilha aberta
  });

  it('lands each leg on its own leg of the base, not just the outline', () => {
    // Vão da arte (200 px) bem mais largo que o do corpo — sem tratar as
    // bordas internas, sobraria pele entre as pernas.
    const spans = piece(880, 1445, 360, 200);
    const maps = computeConformMaps(spans, 'feminina', { ...SHARP, margin: 3 });

    for (const y of [1000, 1240, 1400]) {
      const gap = spans[y]!.gap!;
      const body = bodySpanAt('feminina', y)!;
      expect(mapRowX(maps[y]!, gap.x1)).toBeCloseTo(body.gap!.x1 + 3, 4);
      expect(mapRowX(maps[y]!, gap.x2)).toBeCloseTo(body.gap!.x2 - 3, 4);
    }
  });

  it('eases the inner edges in, so the crotch does not leave a step across the thigh', () => {
    // Vão da arte muito mais largo que o do corpo: prendê-lo de uma vez na
    // primeira linha abaixo da virilha faria um degrau horizontal visível.
    const spans = piece(705, 1445, 360, 200);
    const maps = computeConformMaps(spans, 'feminina', { ...SHARP, gapBlendRows: 60 });

    const firstGapRow = maps.findIndex((m) => m !== null && m.from.length === 4);
    expect(firstGapRow).toBeGreaterThan(0);

    const innerLeft = (y: number) => mapRowX(maps[y]!, spans[y]!.gap!.x1);
    // Na primeira linha com vão, a borda interna mal se move em relação à
    // linha logo acima (que ainda usa só as bordas externas).
    const above = mapRowX(maps[firstGapRow - 1]!, spans[firstGapRow - 1]!.gap!.x1);
    expect(Math.abs(innerLeft(firstGapRow) - above)).toBeLessThan(2);

    // Já bem abaixo, encosta no vão real do corpo.
    const settled = firstGapRow + 200;
    expect(innerLeft(settled)).toBeCloseTo(bodySpanAt('feminina', settled)!.gap!.x1 + 3, 4);
  });

  it('ignores the piece gap above the crotch, where the body has none', () => {
    const maps = computeConformMaps(piece(705, 1445, 360, 40), 'feminina', SHARP);
    expect(maps[760]!.from).toHaveLength(2); // só as bordas externas
    expect(maps[1240]!.from).toHaveLength(4); // duas pernas
  });

  it('keeps control points strictly increasing, so a row never folds over itself', () => {
    const maps = computeConformMaps(piece(705, 1445, 360, 200), 'feminina');
    for (const map of maps) {
      if (!map) continue;
      for (let i = 1; i < map.from.length; i++) {
        expect(map.from[i]).toBeGreaterThan(map.from[i - 1]);
        expect(map.to[i]).toBeGreaterThan(map.to[i - 1]);
      }
    }
  });

  it('clamps the correction so a badly placed piece is not destroyed', () => {
    const spans = piece(705, 1445, 900);
    const map = computeConformMaps(spans, 'feminina', { ...SHARP, minScale: 0.8, maxScale: 1.2 })[930]!;
    const width = mapRowX(map, spans[930]!.x2) - mapRowX(map, spans[930]!.x1);
    expect(width).toBeCloseTo(900 * 0.8, 4);
  });

  it('is idempotent: conforming an already conformed piece barely moves it', () => {
    const spans = piece(880, 1445, 360, 200);
    const first = computeConformMaps(spans, 'feminina', SHARP);
    const conformed = spans.map((span, y) => {
      const map = first[y];
      if (!span || !map) return span;
      const next: RowSpan = { x1: mapRowX(map, span.x1), x2: mapRowX(map, span.x2) };
      if (span.gap) next.gap = { x1: mapRowX(map, span.gap.x1), x2: mapRowX(map, span.gap.x2) };
      return next;
    });

    const second = computeConformMaps(conformed, 'feminina', SHARP);
    for (const y of [1000, 1240, 1400]) {
      const span = conformed[y]!;
      expect(mapRowX(second[y]!, span.x1)).toBeCloseTo(span.x1, 3);
      expect(mapRowX(second[y]!, span.x2)).toBeCloseTo(span.x2, 3);
    }
  });
});

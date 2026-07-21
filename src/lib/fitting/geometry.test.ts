import { describe, it, expect } from 'vitest';
import { computeFitTransform, applyTransformToBox, validateFit, detectContentBBox, removeBorderConnectedBackground, chooseFitMode, STRETCH_MAX_DISTORTION, STRETCH_MAX_DISTORTION_BODY } from './geometry';
import { PIECE_SPECS, getPieceSpec, listPieceSpecs, boxWidth, boxHeight } from './pieceSpecs';

describe('computeFitTransform', () => {
  it('maps a content box exactly onto the target box in stretch mode', () => {
    const contentBox = { x1: 100, y1: 200, x2: 300, y2: 500 };
    const targetBox = { x1: 280, y1: 320, x2: 740, y2: 720 };

    const t = computeFitTransform(contentBox, targetBox, 'stretch');
    const mapped = applyTransformToBox(contentBox, t);

    expect(mapped.x1).toBeCloseTo(targetBox.x1, 6);
    expect(mapped.y1).toBeCloseTo(targetBox.y1, 6);
    expect(mapped.x2).toBeCloseTo(targetBox.x2, 6);
    expect(mapped.y2).toBeCloseTo(targetBox.y2, 6);
  });

  it('is a no-op-ish identity when content box already equals target box', () => {
    const box = { x1: 280, y1: 320, x2: 740, y2: 720 };
    const t = computeFitTransform(box, box, 'stretch');

    expect(t.scaleX).toBeCloseTo(1, 6);
    expect(t.scaleY).toBeCloseTo(1, 6);
    expect(t.translateX).toBeCloseTo(0, 6);
    expect(t.translateY).toBeCloseTo(0, 6);
  });

  it('contain mode preserves aspect ratio and centers within the target box', () => {
    const contentBox = { x1: 0, y1: 0, x2: 100, y2: 100 }; // square
    const targetBox = { x1: 0, y1: 0, x2: 200, y2: 400 }; // tall rectangle

    const t = computeFitTransform(contentBox, targetBox, 'contain');
    expect(t.scaleX).toBeCloseTo(t.scaleY, 6); // uniform scale
    const mapped = applyTransformToBox(contentBox, t);
    const mappedW = mapped.x2 - mapped.x1;
    const mappedH = mapped.y2 - mapped.y1;

    // scaled content must still be a square (aspect preserved) and fit inside target
    expect(mappedW).toBeCloseTo(mappedH, 6);
    expect(mappedW).toBeLessThanOrEqual(boxWidth(targetBox) + 1e-6);
    expect(mappedH).toBeLessThanOrEqual(boxHeight(targetBox) + 1e-6);

    // horizontally centered inside target box
    const leftGap = mapped.x1 - targetBox.x1;
    const rightGap = targetBox.x2 - mapped.x2;
    expect(leftGap).toBeCloseTo(rightGap, 6);
  });

  it('throws on degenerate (zero-area) boxes', () => {
    const zero = { x1: 10, y1: 10, x2: 10, y2: 10 };
    const target = { x1: 0, y1: 0, x2: 100, y2: 100 };
    expect(() => computeFitTransform(zero, target)).toThrow();
    expect(() => computeFitTransform(target, zero)).toThrow();
  });
});

describe('chooseFitMode', () => {
  it('usa stretch quando a proporção da arte é próxima da caixa', () => {
    expect(chooseFitMode(1.0, 1.0)).toBe('stretch');
    expect(chooseFitMode(1.1, 0.97)).toBe('stretch'); // camiseta um pouco mais alta que a caixa
    expect(chooseFitMode(0.8, 1.0)).toBe('stretch');
  });

  it('cai para contain quando a proporção destoa demais da caixa', () => {
    expect(chooseFitMode(2.0, 1.0)).toBe('contain');
    expect(chooseFitMode(1.0, 1.0 * STRETCH_MAX_DISTORTION + 0.01)).toBe('contain');
  });

  it('é simétrico (arte mais alta ou mais larga que a caixa)', () => {
    expect(chooseFitMode(1.3, 1.0)).toBe(chooseFitMode(1.0, 1.3));
  });

  it('com limite de roupa de corpo, estica artes mais quadradas (caso do top F-02)', () => {
    // Caixa do top F-02: 345x190 → aspecto ≈ 0,551; arte de top solta ≈ 0,9
    expect(chooseFitMode(0.9, 0.551)).toBe('contain'); // limite padrão recusa
    expect(chooseFitMode(0.9, 0.551, STRETCH_MAX_DISTORTION_BODY)).toBe('stretch');
    // caso real: foto de top com fundo removido, aspecto 0,974 → razão 1,77
    expect(chooseFitMode(0.974, 0.551, STRETCH_MAX_DISTORTION_BODY)).toBe('stretch');
    // mas arte absurdamente diferente ainda cai para contain
    expect(chooseFitMode(1.2, 0.551, STRETCH_MAX_DISTORTION_BODY)).toBe('contain');
  });

  it('cai para contain com entradas degeneradas', () => {
    expect(chooseFitMode(0, 1)).toBe('contain');
    expect(chooseFitMode(1, Infinity)).toBe('contain');
    expect(chooseFitMode(NaN, 1)).toBe('contain');
  });
});

describe('validateFit', () => {
  const targetBox = { x1: 280, y1: 320, x2: 740, y2: 720 };

  it('reports within tolerance for a near-identical box', () => {
    const result = validateFit({ x1: 282, y1: 318, x2: 738, y2: 722 }, targetBox, 12);
    expect(result.withinTolerance).toBe(true);
  });

  it('reports out of tolerance for a significantly shifted box', () => {
    const result = validateFit({ x1: 350, y1: 400, x2: 800, y2: 850 }, targetBox, 12);
    expect(result.withinTolerance).toBe(false);
    expect(result.maxDelta).toBeGreaterThan(12);
  });
});

describe('detectContentBBox', () => {
  // Build a 4x4 RGBA buffer where only pixel (1,1)..(2,2) is opaque.
  function buildBuffer(width: number, height: number, opaquePixels: Array<[number, number]>) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (const [x, y] of opaquePixels) {
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    return data;
  }

  it('detects the exact bounding box of opaque pixels', () => {
    const width = 4;
    const height = 4;
    const data = buildBuffer(width, height, [
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 2],
    ]);

    const box = detectContentBBox(data, width, height);
    expect(box).toEqual({ x1: 1, y1: 1, x2: 3, y2: 3 });
  });

  it('returns null for a fully transparent image', () => {
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    const box = detectContentBBox(data, width, height);
    expect(box).toBeNull();
  });

  it('respects the alpha threshold', () => {
    const width = 2;
    const height = 2;
    const data = new Uint8ClampedArray(width * height * 4);
    data[3] = 5; // near-transparent pixel at (0,0)
    expect(detectContentBBox(data, width, height, 10)).toBeNull();
    expect(detectContentBBox(data, width, height, 2)).toEqual({ x1: 0, y1: 0, x2: 1, y2: 1 });
  });
});

describe('removeBorderConnectedBackground', () => {
  /** Monta um buffer RGBA a partir de uma matriz de cores nomeadas. */
  function buildRgba(rows: string[]): Uint8ClampedArray {
    const colors: Record<string, [number, number, number, number]> = {
      W: [255, 255, 255, 255], // fundo branco
      R: [255, 0, 0, 255],     // peça
    };
    const h = rows.length;
    const w = rows[0].length;
    const data = new Uint8ClampedArray(w * h * 4);
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        data.set(colors[ch], (y * w + x) * 4);
      });
    });
    return data;
  }

  it('remove o fundo conectado à borda e preserva a peça', () => {
    const rows = ['WWWW', 'WRRW', 'WRRW', 'WWWW'];
    const data = buildRgba(rows);
    const removed = removeBorderConnectedBackground(data, 4, 4);
    expect(removed).toBe(12); // 16 pixels - 4 da peça
    const box = detectContentBBox(data, 4, 4);
    expect(box).toEqual({ x1: 1, y1: 1, x2: 3, y2: 3 });
  });

  it('não alcança aberturas totalmente fechadas (interior de anel)', () => {
    const rows = ['WWWWW', 'WRRRW', 'WRWRW', 'WRRRW', 'WWWWW'];
    const data = buildRgba(rows);
    removeBorderConnectedBackground(data, 5, 5);
    // centro (2,2) é branco mas cercado pela peça: alpha continua 255
    expect(data[(2 * 5 + 2) * 4 + 3]).toBe(255);
    // borda foi removida
    expect(data[3]).toBe(0);
  });

  it('remove fundo xadrez de "transparência falsa" (dois tons neutros)', () => {
    // Xadrez de cinzas 10/160 (distância 450 > tolerância 100 entre si) com
    // peça vermelha no centro e um pixel de vinhete claro (200) no caminho.
    const D: [number, number, number, number] = [10, 10, 10, 255];
    const L: [number, number, number, number] = [160, 160, 160, 255];
    const V: [number, number, number, number] = [200, 200, 200, 255]; // vinhete
    const R: [number, number, number, number] = [255, 0, 0, 255];
    const grid = [
      [D, L, D, L, D],
      [L, V, L, V, L],
      [D, L, R, L, D],
      [L, D, L, D, L],
    ];
    const data = new Uint8ClampedArray(5 * 4 * 4);
    grid.forEach((row, y) => row.forEach((px, x) => data.set(px, (y * 5 + x) * 4)));

    const removed = removeBorderConnectedBackground(data, 5, 4);
    expect(removed).toBe(19); // tudo menos a peça
    expect(detectContentBBox(data, 5, 4)).toEqual({ x1: 2, y1: 2, x2: 3, y2: 3 });
  });

  it('devolve 0 quando nada se parece com o fundo da borda', () => {
    const rows = ['RR', 'RR'];
    const data = buildRgba(rows);
    // borda toda vermelha → "fundo" é a própria peça; tolerância 0 impede remoção
    expect(removeBorderConnectedBackground(data, 2, 2, -1)).toBe(0);
  });
});

describe('pieceSpecs', () => {
  it('has exactly 20 pieces (10 male + 10 female)', () => {
    expect(Object.keys(PIECE_SPECS)).toHaveLength(20);
  });

  it('exposes every M-01..M-10 and F-01..F-10 id', () => {
    for (let i = 1; i <= 10; i++) {
      const idx = String(i).padStart(2, '0');
      expect(PIECE_SPECS[`M-${idx}`]).toBeDefined();
      expect(PIECE_SPECS[`F-${idx}`]).toBeDefined();
    }
  });

  it('every spec has a valid (non-degenerate) box matching its avatarBase', () => {
    for (const spec of Object.values(PIECE_SPECS)) {
      expect(boxWidth(spec.box)).toBeGreaterThan(0);
      expect(boxHeight(spec.box)).toBeGreaterThan(0);
      expect(spec.id.startsWith('M-') && spec.avatarBase === 'masculina' || spec.id.startsWith('F-') && spec.avatarBase === 'feminina').toBe(true);
    }
  });

  it('getPieceSpec throws for an unknown id', () => {
    expect(() => getPieceSpec('X-99')).toThrow();
  });

  it('listPieceSpecs filters by avatarBase', () => {
    expect(listPieceSpecs('masculina')).toHaveLength(10);
    expect(listPieceSpecs('feminina')).toHaveLength(10);
    expect(listPieceSpecs()).toHaveLength(20);
  });
});

import { describe, it, expect } from 'vitest';
import { resolveRenderSpecId, BOTTOM_PANTS_ASPECT_THRESHOLD } from './slotFallback';
import { PIECE_SPECS } from './pieceSpecs';

describe('resolveRenderSpecId', () => {
  it('prefere sempre a spec explícita do item quando ela existe', () => {
    expect(resolveRenderSpecId('top', 'masculina', 'M-03')).toBe('M-03'); // jaqueta, não camiseta
    expect(resolveRenderSpecId('bottom', 'feminina', 'F-04', 5)).toBe('F-04'); // ignora o aspecto
    expect(resolveRenderSpecId('accessory', 'masculina', 'M-09')).toBe('M-09');
  });

  it('ignora spec explícita inexistente e cai no fallback do slot', () => {
    expect(resolveRenderSpecId('top', 'masculina', 'M-99')).toBe('M-01');
    expect(resolveRenderSpecId('shoes', 'feminina', 'XYZ')).toBe('F-10');
  });

  it('usa o fallback do slot correto para cada base', () => {
    expect(resolveRenderSpecId('top', 'masculina')).toBe('M-01');
    expect(resolveRenderSpecId('top', 'feminina')).toBe('F-01');
    expect(resolveRenderSpecId('shoes', 'masculina')).toBe('M-10');
    expect(resolveRenderSpecId('head_accessory', 'feminina')).toBe('F-06');
    expect(resolveRenderSpecId('wrist_accessory', 'masculina')).toBe('M-07');
  });

  it('desambigua bottom entre short e calça pelo aspecto do conteúdo', () => {
    // Short: conteúdo mais largo que alto
    expect(resolveRenderSpecId('bottom', 'masculina', null, 0.7)).toBe('M-04');
    expect(resolveRenderSpecId('bottom', 'feminina', null, 1.0)).toBe('F-04');
    // Calça: conteúdo bem mais alto que largo
    expect(resolveRenderSpecId('bottom', 'masculina', null, 2.0)).toBe('M-05');
    expect(resolveRenderSpecId('bottom', 'feminina', null, BOTTOM_PANTS_ASPECT_THRESHOLD + 0.01)).toBe('F-05');
  });

  it('não encaixa bottom sem aspecto conhecido nem slots ambíguos', () => {
    expect(resolveRenderSpecId('bottom', 'masculina')).toBeNull();
    expect(resolveRenderSpecId('bottom', 'masculina', null, 0)).toBeNull();
    expect(resolveRenderSpecId('accessory', 'masculina')).toBeNull();
    expect(resolveRenderSpecId('special', 'feminina')).toBeNull();
  });

  it('todo id devolvido existe em PIECE_SPECS', () => {
    const slots = ['top', 'bottom', 'shoes', 'accessory', 'wrist_accessory', 'head_accessory', 'special'] as const;
    for (const base of ['masculina', 'feminina'] as const) {
      for (const slot of slots) {
        for (const aspect of [0.5, 2.5]) {
          const id = resolveRenderSpecId(slot, base, null, aspect);
          if (id !== null) {
            expect(PIECE_SPECS[id]).toBeDefined();
            expect(PIECE_SPECS[id].avatarBase).toBe(base);
          }
        }
      }
    }
  });
});

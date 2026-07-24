// src/lib/duelScore.test.ts
// ============================================================================
// Cobertura do placar justo do duelo (desempenho + esforço).
// Regras principais:
//  • Esforço só pesa quando TODOS os participantes válidos registraram a FC.
//  • Placar = 70% desempenho + 30% esforço.
//  • Desempenho é relativo ao melhor do duelo (100 = melhor).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { computeDuelScore, PERF_WEIGHT, EFFORT_WEIGHT } from './duelScore';

// parser simples: tempo "m:ss" → segundos; senão número puro
const parse = (r: string, timeBased: boolean): number => {
  const s = r.trim();
  if (/^\d+:\d+/.test(s)) {
    const p = s.split(':').map(Number);
    return p[0] * 60 + p[1];
  }
  return parseFloat(s.replace(/[^0-9.]/g, '')) || (timeBased ? 999999 : 0);
};

describe('computeDuelScore', () => {
  it('sem intensidade → decide só pelo desempenho (reps, maior vence)', () => {
    const out = computeDuelScore(
      { a: '150', b: '120' },
      {},
      ['a', 'b'],
      false,
      parse,
    );
    expect(out.usedIntensity).toBe(false);
    expect(out.winnerId).toBe('a');
    expect(out.entries.a.perf).toBe(100);
    expect(out.entries.a.total).toBe(100);
  });

  it('time-based: menor tempo tem desempenho 100', () => {
    const out = computeDuelScore(
      { a: '12:00', b: '10:00' },
      {},
      ['a', 'b'],
      true,
      parse,
    );
    expect(out.winnerId).toBe('b');
    expect(out.entries.b.perf).toBe(100);
    // a levou 20% mais tempo → perf ≈ 83.3
    expect(out.entries.a.perf).toBeCloseTo(83.3, 1);
  });

  it('esforço só entra quando TODOS registram a FC', () => {
    // só "a" tem intensidade → ignora esforço
    const partial = computeDuelScore(
      { a: '100', b: '100' },
      { a: 95, b: null },
      ['a', 'b'],
      false,
      parse,
    );
    expect(partial.usedIntensity).toBe(false);
    // empate de desempenho e sem esforço → sem vencedor
    expect(partial.winnerId).toBe(null);
  });

  it('desempate pelo esforço quando ambos registram a FC', () => {
    // mesmo resultado (perf 100 ambos), mas "a" fez mais esforço
    const out = computeDuelScore(
      { a: '100', b: '100' },
      { a: 92, b: 80 },
      ['a', 'b'],
      false,
      parse,
    );
    expect(out.usedIntensity).toBe(true);
    expect(out.winnerId).toBe('a');
    // total = 0.7*100 + 0.3*92 = 97.6
    expect(out.entries.a.total).toBeCloseTo(PERF_WEIGHT * 100 + EFFORT_WEIGHT * 92, 1);
    expect(out.entries.b.total).toBeCloseTo(PERF_WEIGHT * 100 + EFFORT_WEIGHT * 80, 1);
  });

  it('desempenho pode superar esforço (quem produziu mais vence mesmo com menos FC)', () => {
    // a: melhor resultado mas menos esforço; b: pior resultado e mais esforço
    const out = computeDuelScore(
      { a: '200', b: '100' },
      { a: 70, b: 100 },
      ['a', 'b'],
      false,
      parse,
    );
    // a: 0.7*100 + 0.3*70 = 91 ; b: 0.7*50 + 0.3*100 = 65 → a vence
    expect(out.winnerId).toBe('a');
  });

  it('empate real (mesmo desempenho e mesmo esforço) → null', () => {
    const out = computeDuelScore(
      { a: '100', b: '100' },
      { a: 90, b: 90 },
      ['a', 'b'],
      false,
      parse,
    );
    expect(out.winnerId).toBe(null);
  });

  it('nenhum resultado válido → null e sem esforço', () => {
    const out = computeDuelScore(
      { a: null, b: null },
      { a: 90, b: 90 },
      ['a', 'b'],
      false,
      parse,
    );
    expect(out.winnerId).toBe(null);
    expect(out.usedIntensity).toBe(false);
  });

  it('resultado inválido em time-based é descartado', () => {
    const out = computeDuelScore(
      { a: '10:00', b: 'abc' },
      {},
      ['a', 'b'],
      true,
      parse,
    );
    // b não parseável → só a é válido e vence
    expect(out.winnerId).toBe('a');
    expect(out.entries.b).toBeUndefined();
  });
});

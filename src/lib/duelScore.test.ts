// src/lib/duelScore.test.ts
// ============================================================================
// Cobertura do placar do duelo.
// Regras principais:
//  • Quem vence é o DESEMPENHO — a FC não pontua, só é lida no recap.
//  • Desempenho é relativo ao melhor do duelo (100 = melhor).
//  • `usedIntensity` marca que todos registraram a FC (dá pra comparar esforço).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { computeDuelScore, computeDuelEdge } from './duelScore';

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

  it('FC não desempata: mesmo resultado é empate, mesmo com esforços diferentes', () => {
    const out = computeDuelScore(
      { a: '100', b: '100' },
      { a: 92, b: 80 },
      ['a', 'b'],
      false,
      parse,
    );
    // Os dois registraram → o esforço é comparável e aparece no recap...
    expect(out.usedIntensity).toBe(true);
    expect(out.entries.a.effort).toBe(92);
    expect(out.entries.b.effort).toBe(80);
    // ...mas não vira ponto: mesmo resultado, mesmo placar, sem vencedor.
    expect(out.entries.a.total).toBe(100);
    expect(out.entries.b.total).toBe(100);
    expect(out.winnerId).toBe(null);
  });

  it('FC alta não compra vitória: quem produziu mais vence', () => {
    // b bateu a FC no talo e ainda assim fez menos reps que a.
    const out = computeDuelScore(
      { a: '200', b: '100' },
      { a: 70, b: 100 },
      ['a', 'b'],
      false,
      parse,
    );
    expect(out.winnerId).toBe('a');
    expect(out.entries.a.total).toBe(100);
    expect(out.entries.b.total).toBe(50);
  });

  it('resultado pior não vence por FC mais alta (o caso que a regra antiga invertia)', () => {
    // Com o peso de 30% no esforço, "a" (menos reps, FC alta) vencia por 92.3
    // contra 91 — menos trabalho, mas mais batimento.
    const out = computeDuelScore(
      { a: '140', b: '150' },
      { a: 90, b: 70 },
      ['a', 'b'],
      false,
      parse,
    );
    expect(out.winnerId).toBe('b');
  });

  it('empate real (mesmo desempenho) → null', () => {
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

describe('computeDuelEdge', () => {
  const edgeOf = (results: Record<string, string>, intensity: Record<string, number | null>) =>
    computeDuelEdge(computeDuelScore(results, intensity, ['a', 'b'], false, parse), ['a', 'b']);

  it('sem FC de todos, a vitória é lida só pelo desempenho', () => {
    const edge = edgeOf({ a: '150', b: '120' }, { a: 90, b: null });
    expect(edge?.summary).toBe('Venceu no desempenho.');
    expect(edge?.insights).toHaveLength(1);
  });

  it('venceu gastando menos batimento → leitura de eficiência', () => {
    const edge = edgeOf({ a: '150', b: '120' }, { a: 70, b: 90 });
    expect(edge?.summary).toContain('mais eficiente');
    expect(edge?.insights[1].kind).toBe('efficiency');
  });

  it('venceu com FC acima da média → esforço, não eficiência', () => {
    const edge = edgeOf({ a: '150', b: '120' }, { a: 95, b: 75 });
    expect(edge?.summary).toContain('mais esforço');
    expect(edge?.insights[1].kind).toBe('effort');
  });
});

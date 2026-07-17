// src/lib/heartRate.test.ts
// ============================================================================
// Cobertura dos parsers de FC. Foco na diferença entre o parser ESTRITO
// (0x2A37 padrão) e o TOLERANTE (dispositivos genéricos) — a origem das
// leituras de FC "aleatórias" quando o canal errado é lido com o tolerante.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { parseStandardHeartRate, parseHeartRateFallback } from './heartRate';

function dv(bytes: number[]): DataView {
  return new DataView(new Uint8Array(bytes).buffer);
}

describe('parseStandardHeartRate (0x2A37)', () => {
  it('lê o formato uint8 (flags bit0 = 0)', () => {
    // flags=0x00, bpm=95
    expect(parseStandardHeartRate(dv([0x00, 95]))).toBe(95);
  });

  it('lê o formato uint16 (flags bit0 = 1)', () => {
    // flags=0x01, bpm=95 (LE)
    expect(parseStandardHeartRate(dv([0x01, 0x5f, 0x00]))).toBe(95);
  });

  it('ignora bytes de RR-interval e devolve só o BPM', () => {
    // flags=0x10 (RR presente), bpm=95, RR=0x0320
    expect(parseStandardHeartRate(dv([0x10, 95, 0x20, 0x03]))).toBe(95);
  });

  it('rejeita valores fora da faixa fisiológica', () => {
    expect(parseStandardHeartRate(dv([0x00, 10]))).toBeNull(); // 10 bpm
    expect(parseStandardHeartRate(dv([0x00, 255]))).toBeNull(); // 255 bpm
  });

  it('rejeita um payload proprietário que NÃO é FC (evita BPM aleatório)', () => {
    // Notificação de um canal proprietário "faladeiro": byte1 = 0 → implausível.
    // O parser estrito recusa; é isto que impede o número maluco quando o canal
    // padrão é a fonte autoritativa.
    expect(parseStandardHeartRate(dv([0x5a, 0x00, 0x12, 0x34]))).toBeNull();
  });
});

describe('parseHeartRateFallback vs. estrito', () => {
  it('concorda com o estrito em pacotes 0x2A37 válidos', () => {
    expect(parseHeartRateFallback(dv([0x00, 95]))).toBe(95);
    expect(parseHeartRateFallback(dv([0x10, 95, 0x20, 0x03]))).toBe(95);
  });

  it('inventa um BPM plausível a partir de bytes NÃO-FC — por isso não deve ser usado no canal padrão', () => {
    // Mesmo payload que o estrito rejeitou: o tolerante devolve 90 (uint16 LE),
    // exatamente a leitura "aleatória" que víamos ao latchar no canal errado.
    const garbage = dv([0x5a, 0x00, 0x12, 0x34]);
    expect(parseStandardHeartRate(garbage)).toBeNull();
    expect(parseHeartRateFallback(garbage)).toBe(90);
  });
});

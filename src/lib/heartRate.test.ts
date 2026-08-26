// src/lib/heartRate.test.ts
// ============================================================================
// Cobertura dos parsers de FC. Foco na diferença entre o parser ESTRITO
// (0x2A37 padrão) e o TOLERANTE (dispositivos genéricos) — a origem das
// leituras de FC "aleatórias" quando o canal errado é lido com o tolerante.
// ============================================================================
import { describe, it, expect } from 'vitest';
import {
  parseStandardHeartRate,
  parseHeartRateFallback,
  normalizeUuid,
  isSameUuid,
  isLikelyHRService,
  isLikelyHRCharacteristic,
  HEART_RATE_SERVICE,
  HEART_RATE_MEASUREMENT,
} from './heartRate';

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

// ============================================================================
// Normalização de UUID. O CoreBluetooth (iOS) devolve a forma CURTA para UUIDs
// da Bluetooth SIG ("180D", "2A37") e a longa para proprietários — navegadores
// que expõem Web Bluetooth por cima dele (ex.: Bluefy) repassam isso cru.
// Sem normalizar, o canal padrão de FC fica invisível e o relógio nunca é lido.
// ============================================================================
describe('normalizeUuid', () => {
  it('expande a forma curta de 16 bits para a Base UUID da SIG', () => {
    expect(normalizeUuid('180D')).toBe(HEART_RATE_SERVICE);
    expect(normalizeUuid('2A37')).toBe(HEART_RATE_MEASUREMENT);
  });

  it('expande a forma de 32 bits', () => {
    expect(normalizeUuid('0000180d')).toBe(HEART_RATE_SERVICE);
  });

  it('preserva UUIDs proprietários de 128 bits', () => {
    const garminGfdi = '6a4e2800-667b-11e3-949a-0800200c9a66';
    expect(normalizeUuid(garminGfdi.toUpperCase())).toBe(garminGfdi);
  });

  it('tolera prefixo 0x, espaços e ausência de valor', () => {
    expect(normalizeUuid('0x180D')).toBe(HEART_RATE_SERVICE);
    expect(normalizeUuid('  180d  ')).toBe(HEART_RATE_SERVICE);
    expect(normalizeUuid(null)).toBe('');
    expect(normalizeUuid(undefined)).toBe('');
  });
});

describe('isSameUuid', () => {
  it('casa forma curta com forma longa — o bug do Forerunner', () => {
    expect(isSameUuid('180D', HEART_RATE_SERVICE)).toBe(true);
    expect(isSameUuid('2A37', HEART_RATE_MEASUREMENT)).toBe(true);
  });

  it('não confunde serviços diferentes', () => {
    expect(isSameUuid('1814', HEART_RATE_SERVICE)).toBe(false);
    expect(isSameUuid('6a4e2800-667b-11e3-949a-0800200c9a66', HEART_RATE_SERVICE)).toBe(false);
  });
});

describe('detecção de FC com UUIDs na forma curta', () => {
  it('reconhece o serviço e a characteristic padrão vindos curtos', () => {
    expect(isLikelyHRService('180D')).toBe(true);
    expect(isLikelyHRCharacteristic('2A37')).toBe(true);
  });

  it('não classifica os canais GFDI da Garmin como FC', () => {
    // Protocolo do Garmin Connect — nunca carrega frequência cardíaca.
    expect(isLikelyHRCharacteristic('6a4e2810-667b-11e3-949a-0800200c9a66')).toBe(false);
    expect(isLikelyHRCharacteristic('6a4e2830-667b-11e3-949a-0800200c9a66')).toBe(false);
  });
});

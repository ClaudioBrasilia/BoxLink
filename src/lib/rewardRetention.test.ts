import { describe, it, expect } from 'vitest';
import {
  DEFAULT_KEEP_DAYS,
  MIN_KEEP_DAYS,
  pruneMarkerKey,
  todayStamp,
  shouldPruneToday,
  markPruneDone,
  clampKeepDays,
  keepWindowLabel,
  type RetentionStorage,
} from './rewardRetention';

function fakeStorage(initial: Record<string, string> = {}): RetentionStorage & { dump: () => Record<string, string> } {
  const data = { ...initial };
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => { data[key] = value; },
    dump: () => data,
  };
}

describe('pruneMarkerKey', () => {
  it('separa por atleta', () => {
    expect(pruneMarkerKey('abc')).toBe('boxlink:reward-prune:abc');
    expect(pruneMarkerKey('')).toBe('boxlink:reward-prune:anon');
  });
});

describe('shouldPruneToday', () => {
  const key = pruneMarkerKey('u1');

  it('roda quando nunca rodou', () => {
    expect(shouldPruneToday(fakeStorage(), key, '2026-11-22')).toBe(true);
  });

  it('não roda duas vezes no mesmo dia', () => {
    const storage = fakeStorage();
    markPruneDone(storage, key, '2026-11-22');
    expect(shouldPruneToday(storage, key, '2026-11-22')).toBe(false);
  });

  it('roda de novo no dia seguinte', () => {
    const storage = fakeStorage();
    markPruneDone(storage, key, '2026-11-22');
    expect(shouldPruneToday(storage, key, '2026-11-23')).toBe(true);
  });

  it('roda quando não há storage', () => {
    expect(shouldPruneToday(null, key, '2026-11-22')).toBe(true);
  });

  it('roda quando o storage lança erro', () => {
    const broken: RetentionStorage = {
      getItem: () => { throw new Error('bloqueado'); },
      setItem: () => { throw new Error('bloqueado'); },
    };
    expect(shouldPruneToday(broken, key, '2026-11-22')).toBe(true);
    expect(() => markPruneDone(broken, key, '2026-11-22')).not.toThrow();
  });
});

describe('markPruneDone', () => {
  it('grava a data de hoje', () => {
    const storage = fakeStorage();
    const key = pruneMarkerKey('u2');
    markPruneDone(storage, key, '2026-11-22');
    expect(storage.dump()[key]).toBe('2026-11-22');
  });
});

describe('todayStamp', () => {
  it('usa o formato YYYY-MM-DD', () => {
    expect(todayStamp(new Date('2026-11-22T15:00:00'))).toBe('2026-11-22');
  });
});

describe('clampKeepDays', () => {
  it('mantém janelas válidas', () => {
    expect(clampKeepDays(60)).toBe(60);
    expect(clampKeepDays(90)).toBe(90);
  });

  it('não deixa cair abaixo do mínimo', () => {
    expect(clampKeepDays(5)).toBe(MIN_KEEP_DAYS);
    expect(clampKeepDays(-10)).toBe(MIN_KEEP_DAYS);
  });

  it('usa o padrão quando o valor não é número', () => {
    expect(clampKeepDays(Number.NaN)).toBe(DEFAULT_KEEP_DAYS);
  });

  it('arredonda frações', () => {
    expect(clampKeepDays(45.6)).toBe(46);
  });
});

describe('keepWindowLabel', () => {
  it('mostra meses quando fecha redondo', () => {
    expect(keepWindowLabel(30)).toBe('1 mês');
    expect(keepWindowLabel(60)).toBe('2 meses');
    expect(keepWindowLabel(90)).toBe('3 meses');
  });

  it('mostra dias quando não fecha', () => {
    expect(keepWindowLabel(45)).toBe('45 dias');
  });
});

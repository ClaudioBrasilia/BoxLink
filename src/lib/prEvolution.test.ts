import { describe, it, expect } from 'vitest';
import {
  parsePrValue,
  shortDate,
  exercisesWithHistory,
  buildPrSeries,
  prProgress,
  prUnitLabel,
  formatPrPoint,
  type PrEntry,
} from './prEvolution';

const entry = (id: string, exercise: string, value: string, date: string): PrEntry => ({
  id,
  exercise,
  value,
  date,
});

describe('parsePrValue', () => {
  it('interpreta carga com kg', () => {
    expect(parsePrValue('140kg')).toEqual({ kind: 'weight', value: 140, unit: 'kg', raw: '140kg' });
  });

  it('aceita espaço e vírgula decimal', () => {
    expect(parsePrValue('140,5 kg')?.value).toBe(140.5);
  });

  it('interpreta libras', () => {
    expect(parsePrValue('225 lb')).toEqual({ kind: 'weight', value: 225, unit: 'lb', raw: '225 lb' });
  });

  it('interpreta tempo em min:seg como segundos', () => {
    expect(parsePrValue('3:45')?.value).toBe(225);
    expect(parsePrValue('3:45')?.kind).toBe('time');
  });

  it('interpreta tempo com horas', () => {
    expect(parsePrValue('1:02:30')?.value).toBe(3750);
  });

  it('interpreta repetições', () => {
    expect(parsePrValue('45')?.value).toBe(45);
    expect(parsePrValue('45 reps')?.value).toBe(45);
    expect(parsePrValue('12 un')?.value).toBe(12);
  });

  it('cai no primeiro número quando o texto é livre', () => {
    expect(parsePrValue('12 voltas + 8')?.value).toBe(12);
  });

  it('devolve null sem número', () => {
    expect(parsePrValue('sem marca')).toBeNull();
    expect(parsePrValue('')).toBeNull();
  });
});

describe('shortDate', () => {
  it('formata YYYY-MM-DD', () => {
    expect(shortDate('2026-11-22')).toBe('22/11/26');
  });

  it('devolve como veio quando não é data', () => {
    expect(shortDate('ontem')).toBe('ontem');
  });
});

describe('exercisesWithHistory', () => {
  const entries = [
    entry('1', 'Back Squat', '120kg', '2026-01-10'),
    entry('2', 'Back Squat', '130kg', '2026-03-10'),
    entry('3', 'Fran', '3:45', '2026-02-10'),
    entry('4', 'Clean', '90kg', '2026-05-10'),
  ];

  it('lista só exercícios com duas marcas ou mais', () => {
    expect(exercisesWithHistory(entries)).toEqual(['Back Squat']);
  });

  it('ordena pelo registro mais recente', () => {
    const withTwo = [
      entry('1', 'Clean', '90kg', '2026-05-10'),
      entry('2', 'Clean', '95kg', '2026-06-10'),
      entry('3', 'Fran', '3:45', '2026-02-10'),
      entry('4', 'Fran', '3:30', '2026-07-10'),
    ];
    expect(exercisesWithHistory(withTwo)).toEqual(['Fran', 'Clean']);
  });

  it('ignora exercícios com marcas ilegíveis', () => {
    const messy = [
      entry('1', 'Murph', 'sem tempo', '2026-01-01'),
      entry('2', 'Murph', '—', '2026-02-01'),
    ];
    expect(exercisesWithHistory(messy)).toEqual([]);
  });
});

describe('buildPrSeries', () => {
  const entries = [
    entry('3', 'Back Squat', '140kg', '2026-09-10'),
    entry('1', 'Back Squat', '120kg', '2026-01-10'),
    entry('2', 'Back Squat', '130kg', '2026-03-10'),
    entry('4', 'Fran', '3:45', '2026-02-10'),
  ];

  it('monta a série em ordem cronológica', () => {
    const series = buildPrSeries(entries, 'Back Squat');
    expect(series.map((p) => p.value)).toEqual([120, 130, 140]);
    expect(series[0].label).toBe('10/01/26');
  });

  it('ignora outro exercício', () => {
    expect(buildPrSeries(entries, 'Fran').map((p) => p.value)).toEqual([225]);
  });

  it('mantém só o tipo dominante quando o exercício mistura tipos', () => {
    const mixed = [
      entry('1', 'Fran', '3:45', '2026-02-10'),
      entry('2', 'Fran', '3:30', '2026-03-10'),
      entry('3', 'Fran', '40kg', '2026-04-10'),
    ];
    const series = buildPrSeries(mixed, 'Fran');
    expect(series.every((p) => p.kind === 'time')).toBe(true);
    expect(series).toHaveLength(2);
  });

  it('devolve vazio para exercício desconhecido', () => {
    expect(buildPrSeries(entries, 'Deadlift')).toEqual([]);
  });
});

describe('prProgress', () => {
  it('carga melhorou quando o número subiu', () => {
    const progress = prProgress(buildPrSeries([
      entry('1', 'Back Squat', '120kg', '2026-01-10'),
      entry('2', 'Back Squat', '140kg', '2026-09-10'),
    ], 'Back Squat'));
    expect(progress?.improved).toBe(true);
    expect(progress?.delta).toBe(20);
  });

  it('tempo melhorou quando o número desceu', () => {
    const progress = prProgress(buildPrSeries([
      entry('1', 'Fran', '4:00', '2026-01-10'),
      entry('2', 'Fran', '3:30', '2026-09-10'),
    ], 'Fran'));
    expect(progress?.improved).toBe(true);
    expect(progress?.delta).toBe(-30);
  });

  it('não há progresso com uma marca só', () => {
    expect(prProgress(buildPrSeries([entry('1', 'Clean', '90kg', '2026-01-10')], 'Clean'))).toBeNull();
  });
});

describe('rótulos', () => {
  it('unidade por tipo', () => {
    expect(prUnitLabel('time')).toBe('seg');
    expect(prUnitLabel('weight')).toBe('kg');
    expect(prUnitLabel('reps')).toBe('reps');
  });

  it('tempo volta em min:seg', () => {
    const [point] = buildPrSeries([entry('1', 'Fran', '3:45', '2026-01-10')], 'Fran');
    expect(formatPrPoint(point)).toBe('3:45');
  });
});

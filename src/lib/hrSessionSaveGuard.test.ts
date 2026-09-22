// src/lib/hrSessionSaveGuard.test.ts
// ============================================================================
// A gravação do treino passou a ter DOIS caminhos: o widget, assim que a sessão
// encerra, e a tela de resumo, se o atleta chegar nela. Estes casos garantem os
// dois requisitos disso: o treino nunca entra duplicado, e uma falha de rede
// momentânea não custa o histórico.
// ============================================================================
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const insertMock = vi.fn();

vi.mock('./supabase', () => ({
  supabase: { from: () => ({ insert: insertMock }) },
}));

const { saveHeartRateSession, saveHeartRateSessionOnce, hrSessionKey, resetHrSessionSaveGuard } =
  await import('./heartRateSessions');

const payload = { user_id: 'atleta-1', avg_bpm: 140 } as any;

beforeEach(() => {
  insertMock.mockReset();
  resetHrSessionSaveGuard();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('hrSessionKey', () => {
  it('identifica a sessão por atleta + início', () => {
    expect(hrSessionKey('a', 1000)).toBe(hrSessionKey('a', 1000));
    expect(hrSessionKey('a', 1000)).not.toBe(hrSessionKey('a', 2000));
    expect(hrSessionKey('a', 1000)).not.toBe(hrSessionKey('b', 1000));
  });
});

describe('saveHeartRateSessionOnce', () => {
  it('grava uma única vez quando os dois caminhos oferecem a mesma sessão', async () => {
    insertMock.mockResolvedValue({ error: null });
    const key = hrSessionKey('atleta-1', 1000);

    const primeiro = await saveHeartRateSessionOnce(key, payload);
    const segundo = await saveHeartRateSessionOnce(key, payload);

    expect(primeiro.ok).toBe(true);
    expect(segundo.ok).toBe(true);
    expect(segundo.deduped).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('não duplica quando os dois caminhos disparam ao mesmo tempo', async () => {
    insertMock.mockResolvedValue({ error: null });
    const key = hrSessionKey('atleta-1', 1000);

    await Promise.all([
      saveHeartRateSessionOnce(key, payload),
      saveHeartRateSessionOnce(key, payload),
    ]);

    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('sessões diferentes continuam sendo gravadas', async () => {
    insertMock.mockResolvedValue({ error: null });
    await saveHeartRateSessionOnce(hrSessionKey('atleta-1', 1000), payload);
    await saveHeartRateSessionOnce(hrSessionKey('atleta-1', 2000), payload);
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it('uma falha não marca a sessão como gravada — a próxima tentativa vale', async () => {
    insertMock.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });
    const key = hrSessionKey('atleta-1', 1000);

    const falhou = await saveHeartRateSessionOnce(key, payload);
    expect(falhou.ok).toBe(false);

    insertMock.mockResolvedValue({ error: null });
    const depois = await saveHeartRateSessionOnce(key, payload);
    expect(depois.ok).toBe(true);
  });
});

describe('saveHeartRateSession', () => {
  it('devolve o erro em vez de engolir em silêncio', async () => {
    insertMock.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });
    const result = await saveHeartRateSession(payload);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('permission denied');
  });

  it('não insiste em erro determinístico de permissão', async () => {
    insertMock.mockResolvedValue({ error: { code: '42501', message: 'permission denied' } });
    await saveHeartRateSession(payload);
    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('tenta de novo quando a rede falha e salva o treino', async () => {
    vi.useFakeTimers();
    insertMock
      .mockResolvedValueOnce({ error: { message: 'Failed to fetch' } })
      .mockResolvedValueOnce({ error: null });

    const pending = saveHeartRateSession(payload);
    await vi.advanceTimersByTimeAsync(1500);
    const result = await pending;

    expect(result.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it('reenvia sem os metadados novos quando a coluna ainda não existe', async () => {
    insertMock
      .mockResolvedValueOnce({ error: { code: 'PGRST204', message: "could not find column 'hrv_platform'" } })
      .mockResolvedValueOnce({ error: null });

    const result = await saveHeartRateSession(payload);
    expect(result.ok).toBe(true);
    expect(insertMock).toHaveBeenCalledTimes(2);
  });
});

// src/hooks/useHeartRateSession.ts
// ============================================================================
// Grava a série temporal de BPM enquanto a sessão de FC está ativa.
// Amostra a cada 2s (baseado no último BPM recebido) → série uniforme para o
// gráfico do resumo de treino. Ao encerrar (active=false) os dados permanecem
// para exibição; ao iniciar uma nova sessão (active=true) a série é zerada.
// ============================================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import type { BleForegroundSample } from '../lib/bleForeground';

export interface HrSample {
  /** Segundos desde o início da sessão. */
  t: number;
  bpm: number;
}

export interface HeartRateSessionData {
  samples: HrSample[];
  rrIntervalsMs: number[];
}

const SAMPLE_INTERVAL_MS = 2000;

export function useHeartRateSession(
  bpm: number | null,
  active: boolean,
  rrIntervalsMs: number[] = [],
  nativeSamples: BleForegroundSample[] = [],
) {
  const [samples, setSamples] = useState<HrSample[]>([]);
  const [sessionRrIntervalsMs, setSessionRrIntervalsMs] = useState<number[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null); // ms (epoch) do início
  const bpmRef = useRef<number | null>(bpm);
  bpmRef.current = bpm;

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    setStartedAt(start);
    setSamples([]); // nova sessão
    setSessionRrIntervalsMs([]); // nova sessão

    const id = setInterval(() => {
      const b = bpmRef.current;
      if (b != null) {
        setSamples((prev) => [...prev, { t: Math.round((Date.now() - start) / 1000), bpm: b }]);
      }
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!active || rrIntervalsMs.length === 0) return;
    setSessionRrIntervalsMs(rrIntervalsMs);
  }, [active, rrIntervalsMs]);

  // Quando o Android manteve o serviço ativo enquanto o WebView estava pausado,
  // recupera a série nativa ao retornar. O timestamp impede incluir amostras
  // capturadas antes do início desta sessão visual (caso do WodTimer).
  useEffect(() => {
    if (!active || startedAt == null || nativeSamples.length === 0) return;
    const relevant = nativeSamples.filter((sample) => sample.capturedAtMs >= startedAt);
    if (relevant.length === 0) return;

    setSamples((prev) => {
      const byKey = new Map(prev.map((sample) => [`${sample.t}:${sample.bpm}`, sample]));
      for (const sample of relevant) {
        const t = Math.max(0, Math.round((sample.capturedAtMs - startedAt) / 1000));
        byKey.set(`${t}:${sample.bpm}`, { t, bpm: sample.bpm });
      }
      return Array.from(byKey.values()).sort((a, b) => a.t - b.t);
    });

    const nativeRr = relevant.flatMap((sample) => sample.rrIntervalsMs || []);
    if (nativeRr.length > 0) setSessionRrIntervalsMs(nativeRr);
  }, [active, startedAt, nativeSamples]);

  const reset = useCallback(() => {
    setSamples([]);
    setSessionRrIntervalsMs([]);
    setStartedAt(null);
  }, []);

  return { samples, rrIntervalsMs: sessionRrIntervalsMs, reset, startedAt };
}

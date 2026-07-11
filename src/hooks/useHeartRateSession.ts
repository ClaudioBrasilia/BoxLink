// src/hooks/useHeartRateSession.ts
// ============================================================================
// Grava a série temporal de BPM enquanto a sessão de FC está ativa.
// Amostra a cada 2s (baseado no último BPM recebido) → série uniforme para o
// gráfico do resumo de treino. Ao encerrar (active=false) os dados permanecem
// para exibição; ao iniciar uma nova sessão (active=true) a série é zerada.
// ============================================================================
import { useState, useRef, useEffect, useCallback } from 'react';

export interface HrSample {
  /** Segundos desde o início da sessão. */
  t: number;
  bpm: number;
}

const SAMPLE_INTERVAL_MS = 2000;

export function useHeartRateSession(bpm: number | null, active: boolean) {
  const [samples, setSamples] = useState<HrSample[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null); // ms (epoch) do início
  const bpmRef = useRef<number | null>(bpm);
  bpmRef.current = bpm;

  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    setStartedAt(start);
    setSamples([]); // nova sessão

    const id = setInterval(() => {
      const b = bpmRef.current;
      if (b != null) {
        setSamples((prev) => [...prev, { t: Math.round((Date.now() - start) / 1000), bpm: b }]);
      }
    }, SAMPLE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [active]);

  const reset = useCallback(() => {
    setSamples([]);
    setStartedAt(null);
  }, []);

  return { samples, reset, startedAt };
}

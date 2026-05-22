/**
 * src/hooks/useInactivity.ts
 *
 * Hook centralizado para calcular o estado de inatividade de qualquer atleta.
 *
 * useInactivity()           — para o usuário logado
 * useInactivity(checkins)   — para um atleta com checkins conhecidos
 * useInactivityMap(ids)     — para vários atletas pelo user_id (busca no banco)
 * calcInactivitySync(...)   — versão síncrona (sem fetch)
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { calcInactivity, InactivitySettings, InactivityState } from '../utils/inactivity';
import { useAuth } from '../context/AuthContext';

const DEFAULT_STATE: InactivityState = { inactiveDays: 0, fadePercent: 0, showSleeping: false };

/** Busca as configurações de inatividade do box (cached por sessão) */
let _settingsCache: InactivitySettings | null | undefined = undefined;
async function fetchInactivitySettings(): Promise<InactivitySettings | null> {
  if (_settingsCache !== undefined) return _settingsCache;
  const { data } = await supabase.from('box_settings').select('inactivity').maybeSingle();
  _settingsCache = data?.inactivity ?? null;
  return _settingsCache;
}

/** Para o usuário logado (ou checkins fornecidos manualmente) */
export function useInactivity(checkins?: { date: string }[]): InactivityState {
  const { user } = useAuth();
  const [state, setState] = useState<InactivityState>(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;

    async function calculate() {
      const settings = await fetchInactivitySettings();
      if (cancelled) return;
      if (!settings?.enabled) { setState(DEFAULT_STATE); return; }

      const list = checkins ?? (user?.checkins || []);
      setState(calcInactivity(list, settings));
    }

    calculate();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.checkins, checkins]);

  return state;
}

/** Para vários atletas identificados por user_id — busca checkins no banco */
export function useInactivityMap(
  userIds: string[]
): Record<string, InactivityState> {
  const [map, setMap] = useState<Record<string, InactivityState>>({});
  const prevIdsRef = useRef<string>('');

  useEffect(() => {
    const key = [...userIds].sort().join(',');
    if (key === prevIdsRef.current) return;
    prevIdsRef.current = key;

    if (userIds.length === 0) { setMap({}); return; }

    let cancelled = false;

    async function calculate() {
      const settings = await fetchInactivitySettings();
      if (cancelled) return;

      if (!settings?.enabled) {
        setMap(Object.fromEntries(userIds.map(id => [id, DEFAULT_STATE])));
        return;
      }

      // Busca checkins de todos os ids de uma vez
      const { data: rows } = await supabase
        .from('checkins')
        .select('user_id, date')
        .in('user_id', userIds);

      if (cancelled) return;

      // Agrupa por user_id
      const byUser: Record<string, { date: string }[]> = {};
      (rows || []).forEach((r: any) => {
        if (!byUser[r.user_id]) byUser[r.user_id] = [];
        byUser[r.user_id].push({ date: r.date });
      });

      const result: Record<string, InactivityState> = {};
      userIds.forEach(id => {
        result[id] = calcInactivity(byUser[id] || [], settings);
      });

      setMap(result);
    }

    calculate();
    return () => { cancelled = true; };
  }, [userIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return map;
}

/** Versão síncrona: calcula com settings já carregadas */
export function calcInactivitySync(
  checkins: { date: string }[],
  settings: InactivitySettings | undefined | null
): InactivityState {
  if (!settings?.enabled) return DEFAULT_STATE;
  return calcInactivity(checkins, settings);
}

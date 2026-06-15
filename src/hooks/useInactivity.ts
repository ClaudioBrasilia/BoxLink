import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcInactivity, InactivitySettings, InactivityState } from '../utils/inactivity';

let cachedSettings: InactivitySettings | null = null;
let cacheExpiry = 0;

async function getInactivitySettings(): Promise<InactivitySettings> {
  if (cachedSettings && Date.now() < cacheExpiry) return cachedSettings;
  const { data } = await supabase.from('box_settings').select('inactivity').maybeSingle();
  cachedSettings = data?.inactivity || { enabled: false, mode: 'consecutive', startDays: 5, maxDays: 14 };
  cacheExpiry = Date.now() + 5 * 60 * 1000;
  return cachedSettings!;
}

export function useInactivity(checkins: { date: string }[]): InactivityState {
  const [state, setState] = useState<InactivityState>({ inactiveDays: 0, fadePercent: 0, showSleeping: false });

  useEffect(() => {
    getInactivitySettings().then(settings => {
      setState(calcInactivity(checkins, settings));
    });
  // ✅ CORREÇÃO: Monitora o array completo, não apenas o tamanho
  }, [checkins]); 

  return state;
}

export function useInactivityMap(
  athletes: { id: string; checkins: { date: string }[] }[]
): Record<string, InactivityState> {
  const [map, setMap] = useState<Record<string, InactivityState>>({});

  useEffect(() => {
    if (athletes.length === 0) return;
    getInactivitySettings().then(settings => {
      const result: Record<string, InactivityState> = {};
      athletes.forEach(a => {
        result[a.id] = calcInactivity(a.checkins, settings);
      });
      setMap(result);
    });
  // ✅ CORREÇÃO: Monitora o array de atletas completo
  }, [athletes]);

  return map;
}

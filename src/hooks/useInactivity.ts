// src/hooks/useInactivity.ts
// Hook centralizado para calcular inatividade de um ou múltiplos atletas.
// Busca as configurações do Admin UMA vez e calcula o fade de cada atleta.

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calcInactivity, InactivitySettings, InactivityState } from '../utils/inactivity';

// Cache global das configurações (evita múltiplas chamadas ao banco)
let cachedSettings: InactivitySettings | null = null;
let cacheExpiry = 0;

async function getInactivitySettings(): Promise<InactivitySettings> {
  if (cachedSettings && Date.now() < cacheExpiry) return cachedSettings;
  const { data } = await supabase.from('box_settings').select('inactivity').maybeSingle();
  cachedSettings = data?.inactivity || { enabled: false, mode: 'consecutive', startDays: 5, maxDays: 14 };
  cacheExpiry = Date.now() + 5 * 60 * 1000; // cache por 5 minutos
  return cachedSettings!;
}

// Hook para um único atleta (usa os checkins já carregados no contexto)
export function useInactivity(checkins: { date: string }[]): InactivityState {
  const [state, setState] = useState<InactivityState>({ inactiveDays: 0, fadePercent: 0, showSleeping: false });

  // FIX: usar JSON.stringify para detectar qualquer mudança no conteúdo dos checkins,
  // não apenas na quantidade — evita bug onde o hook não recalcula após novo check-in.
  const checkinsKey = JSON.stringify(checkins.map(c => c.date).sort());

  useEffect(() => {
    getInactivitySettings().then(settings => {
      setState(calcInactivity(checkins, settings));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkinsKey]);

  return state;
}

// Hook para múltiplos atletas (Leaderboard, TV)
// Recebe array de { id, checkins } e retorna um map id → InactivityState
export function useInactivityMap(
  athletes: { id: string; checkins: { date: string }[] }[]
): Record<string, InactivityState> {
  const [map, setMap] = useState<Record<string, InactivityState>>({});

  // FIX: reagir a mudanças de conteúdo, não só de tamanho
  const athletesKey = JSON.stringify(
    athletes.map(a => ({ id: a.id, dates: a.checkins.map(c => c.date).sort() }))
  );

  useEffect(() => {
    if (athletes.length === 0) return;
    getInactivitySettings().then(settings => {
      const result: Record<string, InactivityState> = {};
      athletes.forEach(a => {
        result[a.id] = calcInactivity(a.checkins, settings);
      });
      setMap(result);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athletesKey]);

  return map;
}

// Função utilitária para buscar checkins de múltiplos atletas de uma vez
export async function fetchCheckinsForAthletes(
  userIds: string[],
  windowDays = 30
): Promise<Record<string, { date: string }[]>> {
  if (userIds.length === 0) return {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const cutoffStr = cutoff.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const { data } = await supabase
    .from('checkins')
    .select('user_id, date')
    .in('user_id', userIds)
    .gte('date', cutoffStr);

  const result: Record<string, { date: string }[]> = {};
  userIds.forEach(id => { result[id] = []; });
  (data || []).forEach((c: any) => {
    if (result[c.user_id]) result[c.user_id].push({ date: c.date });
  });
  return result;
}

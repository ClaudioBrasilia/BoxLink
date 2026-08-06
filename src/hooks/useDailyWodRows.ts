import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { dailyWodDate } from '../lib/dailyWods';
import { resolveGenderCode } from '../lib/profileGender';

export interface WodResultRow {
  id: string;
  user_id: string;
  wod_name: string;
  wod_type: string;
  description: string | null;
  result: string | null;
  scaling: 'rx' | 'scaled';
  load_kg: number | null;
  total_reps: number | null;
  hr_avg_pct: number | null;
  effort_index: number | null;
  hr_zone: string | null;
  name: string;
  level: number;
  weight_kg: number | null;
  gender: 'M' | 'F' | null;
  avatar_equipped?: any;
  photo_url?: string | null;
}

/**
 * WODs postados hoje pela comunidade individual, já com o perfil de cada
 * atleta. Usado em dois lugares: o card "Seu WOD" da Início e o Placar de
 * WODs na Liga — daí morar aqui em vez de dentro de um dos dois.
 */
export function useDailyWodRows(refreshSignal?: number) {
  const date = useMemo(() => dailyWodDate(), []);
  const [rows, setRows] = useState<WodResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: resultsData } = await supabase
        .from('daily_wod_results')
        .select('*')
        .eq('wod_date', date);

      const results = resultsData || [];
      const ids = [...new Set(results.map((r: any) => r.user_id))];
      const profilesMap: Record<string, any> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, name, level, avatar_equipped, photo_url, weight_kg, sex')
          .in('id', ids);
        (profs || []).forEach((p: any) => { profilesMap[p.id] = p; });
      }

      setRows(results.map((r: any) => ({
        id: r.id,
        user_id: r.user_id,
        wod_name: r.wod_name ?? 'WOD',
        wod_type: r.wod_type ?? 'FOR TIME',
        description: r.description ?? null,
        result: r.result ?? null,
        scaling: r.scaling ?? 'rx',
        load_kg: r.load_kg ?? null,
        total_reps: r.total_reps ?? null,
        hr_avg_pct: r.hr_avg_pct ?? null,
        effort_index: r.effort_index ?? null,
        hr_zone: r.hr_zone ?? null,
        name: profilesMap[r.user_id]?.name ?? 'Atleta',
        level: profilesMap[r.user_id]?.level ?? 1,
        weight_kg: profilesMap[r.user_id]?.weight_kg ?? null,
        gender: resolveGenderCode(profilesMap[r.user_id]),
        avatar_equipped: profilesMap[r.user_id]?.avatar_equipped,
        photo_url: profilesMap[r.user_id]?.photo_url ?? null,
      })));
    } catch (err) {
      console.error('Error loading placar:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load, refreshSignal]);

  return { rows, loading, reload: load };
}

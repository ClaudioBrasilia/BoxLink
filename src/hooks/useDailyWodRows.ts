import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { dailyWodDate } from '../lib/dailyWods';

export interface WodResultRow {
  id: string;
  user_id: string;
  wod_name: string;
  wod_type: string;
  description: string | null;
  result: string | null;
  scaling: 'rx' | 'scaled';
  load_kg: number | null;
  name: string;
  level: number;
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
          .select('id, name, level, avatar_equipped, photo_url')
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
        name: profilesMap[r.user_id]?.name ?? 'Atleta',
        level: profilesMap[r.user_id]?.level ?? 1,
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

import { supabase } from './supabase';
import { Wod } from '../types';

// Busca o WOD de uma data específica. Tolerante a duplicados: se existir mais
// de um WOD na mesma data, retorna o postado por último (o antigo maybeSingle()
// retornava erro/null nesse caso, e a TV e o app ficavam presos no WOD antigo).
export async function getWodByDate(dateStr: string): Promise<Wod | null> {
  const { data } = await supabase
    .from('wods')
    .select('*')
    .eq('date', dateStr)
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

// Último WOD publicado até a data informada (inclusive). Ignora WODs com data
// futura para o fallback de "hoje" nunca mostrar um treino agendado adiante.
export async function getLatestWod(maxDateStr: string): Promise<Wod | null> {
  const { data } = await supabase
    .from('wods')
    .select('*')
    .lte('date', maxDateStr)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

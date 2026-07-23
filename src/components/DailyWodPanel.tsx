import { useState, useEffect, useMemo, useCallback } from 'react';
import { Flame, Calendar, Timer, Hash, Check, Trophy, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { cn, compareBy } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { addReward, getRewardSettings, registerSoloCheckin } from '../utils/rewards';
import { getDailyWod, dailyWodDate, parseWodResult } from '../lib/dailyWods';
import AvatarPreview from './AvatarPreview';
import AthletePhoto from './AthletePhoto';
import { AvatarSlot } from '../types';

interface WodResultRow {
  id: string;
  user_id: string;
  result: string;
  scaling: 'rx' | 'scaled';
  name: string;
  level: number;
  avatar_equipped?: any;
  photo_url?: string | null;
}

type ScalingFilter = 'todos' | 'rx' | 'scaled';

export default function DailyWodPanel() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const wod = useMemo(() => getDailyWod(), []);
  const date = useMemo(() => dailyWodDate(), []);
  const dateLabel = useMemo(
    () => new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }),
    [date],
  );

  const [rows, setRows] = useState<WodResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<ScalingFilter>('todos');

  const [result, setResult] = useState('');
  const [scaling, setScaling] = useState<'rx' | 'scaled'>('rx');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: resultsData } = await supabase
        .from('daily_wod_results')
        .select('*')
        .eq('wod_date', date);

      const results = resultsData || [];
      const ids = [...new Set(results.map((r: any) => r.user_id))];
      let profilesMap: Record<string, any> = {};
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
        result: r.result,
        scaling: r.scaling ?? 'rx',
        name: profilesMap[r.user_id]?.name ?? 'Atleta',
        level: profilesMap[r.user_id]?.level ?? 1,
        avatar_equipped: profilesMap[r.user_id]?.avatar_equipped,
        photo_url: profilesMap[r.user_id]?.photo_url ?? null,
      })));
    } catch (err) {
      console.error('Error loading daily WOD:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const myRow = rows.find(r => r.user_id === user?.id);

  useEffect(() => {
    if (myRow) { setResult(myRow.result); setScaling(myRow.scaling); }
  }, [myRow?.id]);

  const ranked = useMemo(() => {
    const filtered = rows.filter(r => filter === 'todos' || r.scaling === filter);
    return [...filtered].sort(compareBy<WodResultRow>(
      (a, b) => {
        const va = parseWodResult(a.result, wod.timeBased);
        const vb = parseWodResult(b.result, wod.timeBased);
        return wod.timeBased ? va - vb : vb - va;
      },
      (a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'),
    ));
  }, [rows, filter, wod.timeBased]);

  const handlePost = async () => {
    if (!user || !result.trim()) { toast.warning('Informe seu resultado.'); return; }
    setSaving(true);
    const firstTime = !myRow;
    try {
      const { error } = await supabase.from('daily_wod_results').upsert({
        user_id: user.id,
        wod_date: date,
        wod_name: wod.name,
        wod_type: wod.type,
        result: result.trim(),
        scaling,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,wod_date' });
      if (error) throw error;

      if (firstTime) {
        const settings = await getRewardSettings();
        await addReward(user.id, 'wod', settings?.wod_xp ?? 10, settings?.wod_coins ?? 5, `WOD do Dia — ${wod.name}`);
        const checkin = await registerSoloCheckin(user.id, 'WOD DO DIA');

        const { data: profile } = await supabase.from('profiles').select('xp, coins, level').eq('id', user.id).maybeSingle();
        if (profile) updateUser({ ...user, xp: profile.xp || 0, coins: profile.coins || 0, level: profile.level || 1 });

        confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 }, colors: ['#CAFD00', '#ffffff'] });
        toast.success(
          checkin.weekly?.paid
            ? `Resultado postado! +${(settings?.wod_xp ?? 10) + checkin.xp} XP e bônus semanal 🔥`
            : `Resultado postado no placar! +${(settings?.wod_xp ?? 10) + checkin.xp} XP`,
        );
      } else {
        toast.success('Resultado atualizado!');
      }
      await load();
    } catch (err: any) {
      console.error('Error posting daily WOD:', err);
      toast.error('Erro ao postar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const Avatar = ({ r, size, className }: { r: WodResultRow; size: 'sm' | 'md'; className?: string }) =>
    r.photo_url ? (
      <AthletePhoto photoUrl={r.photo_url} name={r.name} size={size} ringColor="border-outline-variant/20" className={className} />
    ) : (
      <div className={cn('rounded-full overflow-hidden border-2 border-outline-variant/20 bg-surface-container-highest', className)}>
        <AvatarPreview equipped={(r.avatar_equipped || {}) as AvatarSlot} size="sm" className="w-full h-full border-none shadow-none" />
      </div>
    );

  return (
    <div className="mx-6 mb-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-headline font-black italic text-on-surface uppercase tracking-tight">WOD do Dia</h2>
          <p className="text-on-surface-variant text-[10px] font-black uppercase tracking-widest opacity-60 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {dateLabel}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center">
          <Flame className="w-5 h-5 text-secondary" />
        </div>
      </div>

      <div className="bg-surface-container rounded-3xl p-5 border border-outline-variant/10 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          {wod.timeBased ? <Timer className="w-5 h-5 text-primary" /> : <Hash className="w-5 h-5 text-primary" />}
          <div>
            <p className="text-lg font-headline font-black text-on-surface uppercase italic leading-none">{wod.name}</p>
            <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mt-1">
              {wod.type} • {wod.timeBased ? 'menor tempo vence' : 'mais reps/rounds vence'}
            </p>
          </div>
        </div>
        <p className="text-sm text-on-surface font-medium leading-relaxed whitespace-pre-wrap bg-surface-container-highest/40 rounded-2xl px-4 py-3">
          {wod.description}
        </p>
      </div>

      <div className="bg-surface-container rounded-3xl p-5 border border-outline-variant/10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-black text-on-surface uppercase tracking-widest">
            {myRow ? 'Seu resultado' : 'Poste seu resultado'}
          </p>
          {myRow && <span className="text-[10px] font-black text-primary uppercase tracking-widest">✓ no placar</span>}
        </div>
        <div className="flex gap-2">
          {(['rx', 'scaled'] as const).map(s => (
            <button key={s} onClick={() => setScaling(s)}
              className={cn('flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                scaling === s
                  ? s === 'rx' ? 'bg-primary text-background' : 'bg-secondary text-background'
                  : 'bg-surface-container-highest text-on-surface-variant')}>
              {s === 'rx' ? 'RX' : 'Scaled'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={wod.timeBased ? 'Ex: 12:45' : 'Ex: 18 rounds ou 5+12'}
            value={result}
            onChange={e => setResult(e.target.value)}
            className="flex-1 bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-bold text-on-surface outline-none"
          />
          <button
            onClick={handlePost}
            disabled={saving || !result.trim()}
            className="bg-primary text-background px-5 rounded-2xl font-headline font-black text-xs uppercase italic flex items-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all"
          >
            {saving ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
              : myRow ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {myRow ? 'Atualizar' : 'Postar'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 bg-surface-container-highest p-1 rounded-2xl">
        {(['todos', 'rx', 'scaled'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
              filter === f ? 'bg-primary text-background shadow-lg' : 'text-on-surface-variant')}>
            {f === 'todos' ? 'Todos' : f === 'rx' ? 'RX' : 'Scaled'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <h3 className="font-headline font-black text-sm text-on-surface uppercase italic tracking-widest">
            Placar {ranked.length > 0 && `• ${ranked.length}`}
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : ranked.length === 0 ? (
          <div className="bg-surface-container rounded-3xl p-8 flex flex-col items-center text-center gap-3 border border-outline-variant/10">
            <Trophy className="w-12 h-12 text-on-surface-variant/20" />
            <p className="text-on-surface-variant font-headline font-black uppercase italic">Placar vazio</p>
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">
              Seja o primeiro a postar o resultado de hoje
            </p>
          </div>
        ) : (
          ranked.map((r, i) => {
            const isMe = r.user_id === user?.id;
            const medal = i === 0 ? 'text-primary' : i === 1 ? 'text-on-surface' : i === 2 ? 'text-secondary' : 'text-on-surface-variant';
            return (
              <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className={cn('p-3 rounded-2xl border flex items-center justify-between transition-all',
                  isMe ? 'bg-primary/10 border-primary/30' : 'bg-surface-container border-outline-variant/10')}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={cn('w-7 text-center font-headline font-black text-sm italic', medal)}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <Avatar r={r} size="sm" className="w-10 h-10" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface uppercase italic truncate">
                      {r.name}{isMe && ' (você)'}
                    </p>
                    <span className={cn('inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-0.5 border',
                      r.scaling === 'rx' ? 'bg-primary/15 text-primary border-primary/30' : 'bg-secondary/15 text-secondary border-secondary/30')}>
                      {r.scaling === 'rx' ? 'RX' : 'Scaled'} • Nv {r.level}
                    </span>
                  </div>
                </div>
                <span className="text-base font-headline font-black text-primary italic flex-shrink-0 ml-2">{r.result}</span>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

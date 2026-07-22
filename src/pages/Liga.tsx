import { useState, useEffect, useCallback, useMemo } from 'react';
import { Trophy, Zap, Calendar, Crown, Lock, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, compareBy } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import AvatarPreview from '../components/AvatarPreview';
import AthletePhoto from '../components/AthletePhoto';
import { AvatarSlot } from '../types';
import { isPremium } from '../lib/plan';

interface LigaAthlete {
  id: string;
  name: string;
  level: number;
  xp: number;
  monthXp: number;
  createdAt: string;
  avatar_equipped?: any;
  photo_url?: string | null;
}

type Tab = 'xp_total' | 'xp_mes';

// Divisões da Liga do Mês (por XP ganho no mês)
interface Division { key: string; label: string; emoji: string; min: number; cls: string; }
const DIVISIONS: Division[] = [
  { key: 'ouro',   label: 'Ouro',   emoji: '🥇', min: 700, cls: 'bg-primary/15 text-primary border-primary/30' },
  { key: 'prata',  label: 'Prata',  emoji: '🥈', min: 300, cls: 'bg-outline-variant/20 text-on-surface border-outline-variant/30' },
  { key: 'bronze', label: 'Bronze', emoji: '🥉', min: 0,   cls: 'bg-secondary/15 text-secondary border-secondary/30' },
];
const divisionOf = (monthXp: number): Division =>
  DIVISIONS.find(d => monthXp >= d.min) || DIVISIONS[DIVISIONS.length - 1];

const DivisionBadge = ({ xp }: { xp: number }) => {
  const d = divisionOf(xp);
  return (
    <span className={cn('text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border', d.cls)}>
      {d.emoji} {d.label}
    </span>
  );
};

export default function Liga() {
  const { user } = useAuth();
  const premium = isPremium(user);

  const [athletes, setAthletes] = useState<LigaAthlete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('xp_total');

  const monthName = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString().split('T')[0];

      const [{ data: profiles, error: pErr }, { data: rewards }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, level, xp, created_at, avatar_equipped, photo_url')
          .eq('account_type', 'individual')
          .eq('status', 'approved'),
        supabase
          .from('reward_history')
          .select('user_id, xp')
          .gte('created_at', firstDayOfMonth + 'T00:00:00'),
      ]);

      if (pErr) throw pErr;

      const monthXpByUser: Record<string, number> = {};
      (rewards || []).forEach((r: any) => {
        if (r.xp > 0) monthXpByUser[r.user_id] = (monthXpByUser[r.user_id] || 0) + r.xp;
      });

      setAthletes((profiles || []).map((p: any) => ({
        id: p.id,
        name: p.name ?? 'Atleta',
        level: p.level || 1,
        xp: p.xp || 0,
        monthXp: monthXpByUser[p.id] || 0,
        createdAt: p.created_at,
        avatar_equipped: p.avatar_equipped,
        photo_url: p.photo_url ?? null,
      })));
    } catch (err: any) {
      console.error('Error loading liga:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const scoreOf = (a: LigaAthlete) => (activeTab === 'xp_mes' ? a.monthXp : a.xp);

  const ranked = useMemo(() => {
    const byAgeAsc = (a: LigaAthlete, b: LigaAthlete) =>
      new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    const byNameAsc = (a: LigaAthlete, b: LigaAthlete) =>
      (a.name || '').localeCompare(b.name || '', 'pt-BR');
    return [...athletes]
      .filter(a => scoreOf(a) > 0)
      .sort(compareBy<LigaAthlete>(
        (a, b) => scoreOf(b) - scoreOf(a),
        (a, b) => (b.level || 1) - (a.level || 1),
        byAgeAsc, byNameAsc,
      ));
  }, [athletes, activeTab]);

  const myPosition = useMemo(() => {
    const idx = ranked.findIndex(a => a.id === user?.id);
    return idx >= 0 ? idx + 1 : null;
  }, [ranked, user?.id]);

  const top3 = ranked.slice(0, 3);
  const others = ranked.slice(3);

  const AthleteAvatar = ({ a, size, className, ring }: { a: LigaAthlete; size: 'sm' | 'md' | 'lg'; className?: string; ring?: string }) =>
    a.photo_url ? (
      <AthletePhoto photoUrl={a.photo_url} name={a.name} size={size} ringColor={ring || 'border-outline-variant/20'} className={className} />
    ) : (
      <div className={cn('rounded-full overflow-hidden border-2 bg-surface-container-highest', ring || 'border-outline-variant/20', className)}>
        <AvatarPreview equipped={(a.avatar_equipped || {}) as AvatarSlot} size={size} className="w-full h-full border-none shadow-none" />
      </div>
    );

  // ── Liga do Mês é premium ──────────────────────────────────────────────────
  const monthlyLocked = activeTab === 'xp_mes' && !premium;

  if (error) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-error font-headline font-black text-xl italic p-4 text-center">
      <p>ERRO AO CARREGAR</p>
      <button onClick={fetchAll} className="mt-4 bg-primary text-background px-6 py-2 rounded-xl text-sm font-black">TENTAR NOVAMENTE</button>
    </div>
  );
  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center text-primary font-headline font-black text-2xl italic animate-pulse">CARREGANDO...</div>
  );

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background pb-32">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary" /> LIGA
          </h1>
          <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest opacity-60 ml-11">
            Atletas individuais
          </p>
        </div>
        <div className="flex items-center gap-1 text-on-surface-variant text-[10px] font-black uppercase tracking-widest">
          <Calendar className="w-3 h-3" /> {monthName}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10 gap-1">
        {([
          { key: 'xp_total', label: 'XP Total',    premium: false },
          { key: 'xp_mes',   label: 'Liga do Mês', premium: true },
        ] as const).map(({ key, label, premium: isPrem }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={cn('flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-1',
              activeTab === key ? 'bg-primary text-background shadow-lg' : 'text-on-surface-variant hover:text-on-surface')}>
            {label}{isPrem && !premium && <Lock className="w-3 h-3" />}
          </button>
        ))}
      </div>

      <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest -mt-3">
        {activeTab === 'xp_total' ? 'XP acumulado desde o início' : `XP ganho em ${monthName} — reinicia todo mês`}
      </p>

      {/* Legenda de divisões (aba do mês, liberada) */}
      {activeTab === 'xp_mes' && !monthlyLocked && (
        <div className="flex justify-center gap-2 flex-wrap -mt-2">
          {DIVISIONS.map(d => (
            <span key={d.key} className={cn('text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border', d.cls)}>
              {d.emoji} {d.label} {d.min > 0 ? `${d.min}+ XP` : `< ${DIVISIONS[DIVISIONS.length - 2].min} XP`}
            </span>
          ))}
        </div>
      )}

      {/* Minha posição */}
      {myPosition && !monthlyLocked && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">Sua posição</span>
            {activeTab === 'xp_mes' && (
              <DivisionBadge xp={athletes.find(a => a.id === user?.id)?.monthXp || 0} />
            )}
          </div>
          <span className="text-lg font-headline font-black text-primary italic">
            #{myPosition} <span className="text-on-surface-variant text-xs">de {ranked.length}</span>
          </span>
        </div>
      )}

      {/* Liga do Mês bloqueada (premium) */}
      {monthlyLocked ? (
        <div className="bg-surface-container-low rounded-[2rem] border border-secondary/20 p-8 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-secondary/10 flex items-center justify-center">
            <Crown className="w-8 h-8 text-secondary" />
          </div>
          <h2 className="font-headline font-black text-xl text-on-surface uppercase italic">Liga do Mês é Premium</h2>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest leading-relaxed max-w-xs">
            Dispute a competição mensal com reset, suba de divisão e concorra a recompensas. Faça upgrade para participar.
          </p>
          <div className="bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full">
            🔒 Disponível no plano Premium
          </div>
        </div>
      ) : ranked.length === 0 ? (
        <div className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-12 flex flex-col items-center text-center gap-4">
          <Flame className="w-14 h-14 text-on-surface-variant/20" />
          <p className="text-on-surface-variant font-headline font-black uppercase italic">Ninguém pontuou ainda</p>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">
            Registre treinos no Diário para entrar na liga
          </p>
        </div>
      ) : (
        <>
          {/* Pódio */}
          <div className="flex items-end justify-center gap-4 pt-6 pb-2">
            {top3[1] && (
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <AthleteAvatar a={top3[1]} size="md" className="w-16 h-16" ring="border-outline-variant/30" />
                  <div className="absolute -top-2 -right-2 bg-outline-variant/40 text-on-surface text-[10px] font-black px-2 py-0.5 rounded-full">#2</div>
                </div>
                <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate max-w-[80px]">{top3[1].name.split(' ')[0]}</p>
                <p className="text-[10px] text-on-surface-variant font-bold">{scoreOf(top3[1])} XP</p>
                {activeTab === 'xp_mes' && <DivisionBadge xp={top3[1].monthXp} />}
                <div className="w-16 h-20 bg-surface-container-low rounded-t-2xl border-x border-t border-outline-variant/10 flex items-center justify-center">
                  <span className="text-[10px] font-black text-on-surface-variant italic">LVL {top3[1].level}</span>
                </div>
              </div>
            )}
            {top3[0] && (
              <div className="flex flex-col items-center gap-2 -mt-8">
                <div className="relative">
                  <AthleteAvatar a={top3[0]} size="lg" className="w-24 h-24 shadow-[0_0_30px_rgba(202,253,0,0.3)]" ring="border-primary" />
                  <div className="absolute -top-3 -right-3 bg-primary text-background text-xs font-black px-3 py-1 rounded-full shadow-lg">#1</div>
                </div>
                <p className="text-sm font-headline font-black text-primary uppercase italic truncate max-w-[100px]">{top3[0].name.split(' ')[0]}</p>
                <p className="text-xs text-on-surface font-bold">{scoreOf(top3[0])} XP</p>
                {activeTab === 'xp_mes' && <DivisionBadge xp={top3[0].monthXp} />}
                <div className="w-24 h-32 bg-primary/10 rounded-t-3xl border-x border-t border-primary/20 flex items-center justify-center">
                  <span className="text-xs font-black text-primary italic">LVL {top3[0].level}</span>
                </div>
              </div>
            )}
            {top3[2] && (
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <AthleteAvatar a={top3[2]} size="md" className="w-16 h-16" ring="border-secondary/30" />
                  <div className="absolute -top-2 -right-2 bg-secondary/30 text-on-surface text-[10px] font-black px-2 py-0.5 rounded-full">#3</div>
                </div>
                <p className="text-xs font-headline font-black text-on-surface uppercase italic truncate max-w-[80px]">{top3[2].name.split(' ')[0]}</p>
                <p className="text-[10px] text-on-surface-variant font-bold">{scoreOf(top3[2])} XP</p>
                {activeTab === 'xp_mes' && <DivisionBadge xp={top3[2].monthXp} />}
                <div className="w-16 h-16 bg-surface-container-low rounded-t-2xl border-x border-t border-outline-variant/10 flex items-center justify-center">
                  <span className="text-[10px] font-black text-on-surface-variant italic">LVL {top3[2].level}</span>
                </div>
              </div>
            )}
          </div>

          {/* Lista restante */}
          {others.length > 0 && (
            <section className="bg-surface-container-low rounded-[2rem] border border-outline-variant/10 p-5 flex flex-col gap-3">
              {others.map((a, i) => {
                const isMe = a.id === user?.id;
                return (
                  <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className={cn('p-3 rounded-2xl border flex items-center justify-between transition-all',
                      isMe ? 'bg-primary/10 border-primary/30' : 'bg-surface-container-highest/30 border-outline-variant/10')}>
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-on-surface-variant font-headline font-black text-xs italic">#{i + 4}</span>
                      <AthleteAvatar a={a} size="sm" className="w-10 h-10" ring="border-outline-variant/10" />
                      <div>
                        <p className="text-on-surface font-bold uppercase text-sm italic">
                          {a.name}{isMe && ' (você)'}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                            <Zap className="w-3 h-3 text-primary" /> Nível {a.level}
                          </p>
                          {activeTab === 'xp_mes' && <DivisionBadge xp={a.monthXp} />}
                        </div>
                      </div>
                    </div>
                    <p className="text-on-surface font-headline font-black text-sm italic">{scoreOf(a)} XP</p>
                  </motion.div>
                );
              })}
            </section>
          )}
        </>
      )}
    </div>
  );
}

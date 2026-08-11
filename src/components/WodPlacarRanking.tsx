import { useState, useMemo } from 'react';
import { Timer, Hash, Trophy, ChevronDown, ArrowLeftRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, compareBy } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { parseWodResult, isTimeBasedType } from '../lib/dailyWods';
import { computeRepsPerMinute, formatPace, isAmrapType } from '../lib/pace';
import { computeRelativeStrength, formatRelativeStrength } from '../lib/relativeStrength';
import { useDailyWodRows, WodResultRow } from '../hooks/useDailyWodRows';
import WodSpotlightChart from './WodSpotlightChart';
import { WodSpotlightData } from '../lib/wodSpotlight';
import AvatarPreview from './AvatarPreview';
import AthletePhoto from './AthletePhoto';
import { AvatarSlot } from '../types';

interface WodGroup {
  name: string;
  timeBased: boolean;
  description: string | null;
  ranked: WodResultRow[];
}

/** Ritmo da linha. EMOM/TABATA ficam de fora de propósito: o resultado deles
 *  ("12 min completos", "8 rounds") vira um número solto que a conta aceitaria
 *  e transformaria em ritmo sem sentido. */
const paceOf = (r: WodResultRow, timeBased: boolean): number | null =>
  timeBased || isAmrapType(r.wod_type)
    ? computeRepsPerMinute(r.result || '', {
        type: r.wod_type,
        totalReps: r.total_reps,
        repsPerRound: r.reps_per_round,
        timeCapMinutes: r.time_cap_minutes,
      })
    : null;

/**
 * O MESMO gráfico do recap do duelo (e do destaque do Box/TV), agora atleta x
 * atleta dentro do placar: quem estiver na frente vira o destaque e o outro
 * vira o lado da comparação. Cada barra só aparece quando o dado existe dos
 * dois lados — quem não registrou carga ou FC simplesmente não gera a linha.
 */
function buildPairSpotlight(group: WodGroup, mine: WodResultRow, target: WodResultRow) {
  const timeBased = group.timeBased;
  const scoreOf = (r: WodResultRow) => parseWodResult(r.result || '', timeBased);
  const myScore = scoreOf(mine);
  const targetScore = scoreOf(target);
  // Empate mantém você como destaque — sem vantagem nenhuma pra anunciar.
  const meBetter = timeBased ? myScore <= targetScore : myScore >= targetScore;

  const winner = meBetter ? mine : target;
  const other = meBetter ? target : mine;
  const winnerName = meBetter ? 'Você' : winner.name;
  const otherName = meBetter ? other.name : 'Você';

  const data: WodSpotlightData = {
    athlete: { id: winner.user_id, name: winnerName, photoUrl: winner.photo_url ?? null },
    wodName: group.name,
    wodType: winner.wod_type,
    athleteCount: 2,
    timeBased,
    leaderResult: winner.result || '',
    leaderScore: scoreOf(winner),
    avgScore: scoreOf(other),
    leaderPace: paceOf(winner, timeBased),
    avgPace: paceOf(other, timeBased),
    leaderStrength: computeRelativeStrength(winner.load_kg, winner.weight_kg),
    avgStrength: computeRelativeStrength(other.load_kg, other.weight_kg),
    // % da FC máx, igual ao recap do duelo: menos esforço pro mesmo resultado
    // é o lado eficiente da comparação.
    leaderHr: winner.hr_avg_pct,
    avgHr: other.hr_avg_pct,
    hrMeta: {
      label: 'Esforço (FC)',
      unit: '% da FC máx',
      betterWord: 'menos esforço',
      worseWord: 'mais esforço',
    },
  };

  return { data, otherName, badgeLabel: meBetter ? 'Você na frente' : 'Líder do WOD' };
}

/**
 * Destaque do dia: o líder do WOD mais treinado contra a média de quem fez o
 * mesmo WOD — a versão comunitária do destaque que o Box mostra na TV e no
 * ranking. Só faz sentido com dois atletas ou mais: sozinho, a "média" seria
 * o próprio líder e todas as barras dariam 0%.
 */
function buildDayHighlight(groups: WodGroup[]): WodSpotlightData | null {
  // Os grupos já chegam ordenados por quantidade de atletas.
  const group = groups.find(g => g.ranked.length >= 2);
  if (!group) return null;

  const leader = group.ranked[0];
  const avg = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
  const scores = group.ranked.map(r => parseWodResult(r.result || '', group.timeBased));
  const paces = group.ranked.map(r => paceOf(r, group.timeBased)).filter((v): v is number => v != null);
  const strengths = group.ranked
    .map(r => computeRelativeStrength(r.load_kg, r.weight_kg))
    .filter((v): v is number => v != null);
  const hrs = group.ranked.map(r => r.hr_avg_pct).filter((v): v is number => v != null);

  return {
    athlete: { id: leader.user_id, name: leader.name, photoUrl: leader.photo_url ?? null },
    wodName: group.name,
    wodType: leader.wod_type,
    athleteCount: group.ranked.length,
    timeBased: group.timeBased,
    leaderResult: leader.result || '',
    leaderScore: parseWodResult(leader.result || '', group.timeBased),
    avgScore: avg(scores),
    leaderPace: paceOf(leader, group.timeBased),
    avgPace: paces.length ? avg(paces) : null,
    leaderStrength: computeRelativeStrength(leader.load_kg, leader.weight_kg),
    // Mesma regra do Box: com um único registro a "média" é o próprio líder.
    avgStrength: strengths.length >= 2 ? avg(strengths) : null,
    leaderHr: leader.hr_avg_pct,
    avgHr: hrs.length >= 2 ? avg(hrs) : null,
    hrMeta: {
      label: 'Esforço (FC)',
      unit: '% da FC máx',
      betterWord: 'menos esforço',
      worseWord: 'mais esforço',
    },
  };
}

type ScalingFilter = 'todos' | 'rx' | 'scaled';
type GenderFilter = 'todos' | 'M' | 'F';

/**
 * Ranking de quem treinou o mesmo WOD hoje, agrupado por WOD. Vive na Liga
 * (é a aba de ranking do individual); a Início só mostra o WOD do próprio
 * atleta, sem a lista dos outros.
 */
export default function WodPlacarRanking() {
  const { user } = useAuth();
  const { rows, loading } = useDailyWodRows();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [scalingFilter, setScalingFilter] = useState<ScalingFilter>('todos');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('todos');
  // Atleta escolhido pra comparar (e o grupo dele) — o placar vira o gráfico
  // "onde X se separa", o mesmo do duelo.
  const [compare, setCompare] = useState<{ group: WodGroup; target: WodResultRow } | null>(null);

  // Só entra no ranking quem já tem resultado — WOD postado e não treinado
  // ainda não é uma marca comparável.
  const groups = useMemo<WodGroup[]>(() => {
    const trainedRows = rows.filter(r => r.result);
    const map: Record<string, WodResultRow[]> = {};
    trainedRows.forEach(r => {
      const key = (r.wod_name || 'WOD').trim().toLowerCase();
      (map[key] ||= []).push(r);
    });
    return Object.values(map).map(list => {
      const timeBased = isTimeBasedType(list[0].wod_type);
      const ranked = [...list].sort(compareBy<WodResultRow>(
        (a, b) => {
          const va = parseWodResult(a.result!, timeBased);
          const vb = parseWodResult(b.result!, timeBased);
          return timeBased ? va - vb : vb - va;
        },
        (a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'),
      ));
      return { name: list[0].wod_name || 'WOD', timeBased, description: list[0].description, ranked };
    }).sort((a, b) => b.ranked.length - a.ranked.length);
  }, [rows]);

  // Meu resultado em cada WOD — é o outro lado de qualquer comparação, e vem
  // das linhas cruas (não das filtradas): filtrar por gênero/categoria não
  // pode esconder você de você mesmo.
  const myRowByWod = useMemo(() => {
    const map: Record<string, WodResultRow> = {};
    rows.forEach(r => {
      if (r.user_id === user?.id && r.result) map[(r.wod_name || 'WOD').trim().toLowerCase()] = r;
    });
    return map;
  }, [rows, user?.id]);

  // Destaque do dia sai dos grupos inteiros, não dos filtrados: filtrar o
  // placar é um recorte da lista, não uma troca do destaque da comunidade.
  const dayHighlight = useMemo(() => buildDayHighlight(groups), [groups]);

  // Filtros aplicados por cima do ranking já ordenado — grupos que ficam sem
  // ninguém no filtro somem da lista, não aparecem vazios.
  const filteredGroups = useMemo(() => {
    return groups
      .map(g => ({
        ...g,
        ranked: g.ranked.filter(r =>
          (scalingFilter === 'todos' || r.scaling === scalingFilter) &&
          (genderFilter === 'todos' || r.gender === genderFilter)
        ),
      }))
      .filter(g => g.ranked.length > 0);
  }, [groups, scalingFilter, genderFilter]);

  const Avatar = ({ r, className }: { r: WodResultRow; className?: string }) =>
    r.photo_url ? (
      <AthletePhoto photoUrl={r.photo_url} name={r.name} size="sm" ringColor="border-outline-variant/20" className={className} />
    ) : (
      <div className={cn('rounded-full overflow-hidden border-2 border-outline-variant/20 bg-surface-container-highest', className)}>
        <AvatarPreview equipped={(r.avatar_equipped || {}) as AvatarSlot} size="sm" className="w-full h-full border-none shadow-none" />
      </div>
    );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-surface-container rounded-3xl p-8 flex flex-col items-center text-center gap-3 border border-outline-variant/10">
        <Trophy className="w-12 h-12 text-on-surface-variant/20" />
        <p className="text-on-surface-variant font-headline font-black uppercase italic">Placar vazio</p>
        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">
          Seja o primeiro a treinar o WOD de hoje
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Destaque do dia — o mesmo gráfico do Box e da TV, com a média da
          comunidade individual no lugar da média do box. */}
      {dayHighlight && (
        <WodSpotlightChart
          variant="mobile"
          data={dayHighlight}
          comparisonName="Média da comunidade"
          comparisonShortName="MÉDIA"
        />
      )}

      {/* Filtros — mesma dupla do ranking de WOD do Box */}
      <div className="flex gap-2 flex-wrap">
        {(['todos', 'rx', 'scaled'] as ScalingFilter[]).map(f => (
          <button key={f} onClick={() => setScalingFilter(f)}
            className={cn(
              'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all',
              scalingFilter === f
                ? f === 'rx' ? 'bg-primary text-background'
                  : f === 'scaled' ? 'bg-secondary text-background'
                  : 'bg-on-surface text-background'
                : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
            )}>
            {f === 'todos' ? 'Todos' : f === 'rx' ? 'RX' : 'Scaled'}
          </button>
        ))}
        <div className="w-px bg-outline-variant/20 mx-1" />
        {(['todos', 'M', 'F'] as GenderFilter[]).map(g => (
          <button key={g} onClick={() => setGenderFilter(g)}
            className={cn(
              'px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all',
              genderFilter === g ? 'bg-on-surface text-background' : 'bg-surface-container-highest text-on-surface-variant hover:text-on-surface'
            )}>
            {g === 'todos' ? 'Todos' : g === 'M' ? '♂ Masc' : '♀ Fem'}
          </button>
        ))}
      </div>

      {filteredGroups.length === 0 && (
        <div className="bg-surface-container rounded-3xl p-8 flex flex-col items-center text-center gap-3 border border-outline-variant/10">
          <Trophy className="w-12 h-12 text-on-surface-variant/20" />
          <p className="text-on-surface-variant font-headline font-black uppercase italic">Ninguém no filtro</p>
          <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest opacity-60">
            Tente outro filtro
          </p>
        </div>
      )}

      {filteredGroups.map(group => (
        <div key={group.name} className="flex flex-col gap-2">
          <button
            onClick={() => setExpandedGroups(prev => ({ ...prev, [group.name]: !prev[group.name] }))}
            disabled={!group.description}
            className="flex items-center gap-2 text-left disabled:cursor-default"
          >
            {group.timeBased ? <Timer className="w-4 h-4 text-primary flex-shrink-0" /> : <Hash className="w-4 h-4 text-primary flex-shrink-0" />}
            <h3 className="font-headline font-black text-sm text-on-surface uppercase italic tracking-widest">{group.name}</h3>
            <span className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
              • {group.ranked.length} {group.ranked.length === 1 ? 'atleta' : 'atletas'}
            </span>
            {group.description && (
              <ChevronDown className={cn('w-3.5 h-3.5 text-on-surface-variant transition-transform flex-shrink-0 ml-auto',
                expandedGroups[group.name] && 'rotate-180')} />
            )}
          </button>
          {group.description && expandedGroups[group.name] && (
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed whitespace-pre-wrap bg-surface-container-highest/40 rounded-2xl px-4 py-3">
              {group.description}
            </p>
          )}
          {group.ranked.map((r, i) => {
            const isMe = r.user_id === user?.id;
            // Ritmo: FOR TIME sai do total de reps ÷ tempo; AMRAP só sai
            // quando o WOD foi postado com reps por round E duração — sem os
            // dois, o "5+12" do cronômetro não vira reps totais e a conta é
            // omitida em vez de chutada.
            const pace = paceOf(r, group.timeBased);
            const relStrength = computeRelativeStrength(r.load_kg, r.weight_kg);
            // Comparar exige os dois lados: só aparece nos outros atletas, e
            // só quando você também treinou este WOD.
            const canCompare = !isMe && !!myRowByWod[group.name.trim().toLowerCase()];
            return (
              <motion.div key={r.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className={cn('p-3 rounded-2xl border flex items-center justify-between transition-all',
                  isMe ? 'bg-primary/10 border-primary/30' : 'bg-surface-container border-outline-variant/10')}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 text-center font-headline font-black text-sm italic text-on-surface-variant">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </span>
                  <Avatar r={r} className="w-10 h-10" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface uppercase italic truncate">
                      {r.name}{isMe && ' (você)'}
                    </p>
                    <span className={cn('inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full mt-0.5 border',
                      r.scaling === 'rx' ? 'bg-primary/15 text-primary border-primary/30' : 'bg-secondary/15 text-secondary border-secondary/30')}>
                      {r.scaling === 'rx' ? 'RX' : 'Scaled'} • Nv {r.level}
                    </span>
                    {pace != null && (
                      <p className="text-[9px] font-bold text-on-surface-variant/70 tracking-widest mt-0.5">{formatPace(pace)}</p>
                    )}
                    {(r.effort_index != null || r.hr_avg_pct != null) && (
                      <p className="text-[9px] font-bold text-secondary/80 tracking-widest mt-0.5">
                        ❤️ {[
                          r.hr_avg_pct != null ? `${r.hr_avg_pct}% FCmáx` : null,
                          r.effort_index != null ? `Esforço ${r.effort_index}` : null,
                          r.hr_zone,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <div className="text-right">
                    <span className="text-base font-headline font-black text-primary italic block">{r.result}</span>
                    {r.load_kg != null && (
                      <span className="text-[9px] font-bold text-on-surface-variant block">{r.load_kg}kg</span>
                    )}
                    {relStrength != null && (
                      <span className="text-[9px] font-bold text-secondary block">{formatRelativeStrength(relStrength)}</span>
                    )}
                  </div>
                  {canCompare && (
                    <button
                      onClick={() => setCompare({ group, target: r })}
                      className="p-1.5 rounded-full bg-surface-container-highest text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all"
                      aria-label={`Comparar com ${r.name}`}
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ))}

      {/* Comparação atleta x atleta — o mesmo gráfico do recap do duelo. */}
      <AnimatePresence>
        {compare && (() => {
          const mine = myRowByWod[compare.group.name.trim().toLowerCase()];
          if (!mine) return null;
          const { data, otherName, badgeLabel } = buildPairSpotlight(compare.group, mine, compare.target);
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCompare(null)}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm flex flex-col gap-3 my-auto"
              >
                <div className="flex justify-between items-center">
                  <h3 className="font-headline font-black text-on-surface uppercase italic text-sm">Comparar resultado</h3>
                  <button onClick={() => setCompare(null)} aria-label="Fechar">
                    <X className="w-5 h-5 text-on-surface-variant" />
                  </button>
                </div>
                <WodSpotlightChart
                  variant="mobile"
                  data={data}
                  comparisonName={otherName}
                  comparisonShortName={otherName.split(' ')[0].toUpperCase()}
                  badgeLabel={badgeLabel}
                />
                <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest text-center opacity-60">
                  Ritmo, carga e esforço só aparecem quando os dois registraram
                </p>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

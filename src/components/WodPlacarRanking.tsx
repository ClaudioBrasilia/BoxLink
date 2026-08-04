import { useState, useMemo } from 'react';
import { Timer, Hash, Trophy, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn, compareBy } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { parseWodResult, isTimeBasedType } from '../lib/dailyWods';
import { useDailyWodRows, WodResultRow } from '../hooks/useDailyWodRows';
import AvatarPreview from './AvatarPreview';
import AthletePhoto from './AthletePhoto';
import { AvatarSlot } from '../types';

interface WodGroup {
  name: string;
  timeBased: boolean;
  description: string | null;
  ranked: WodResultRow[];
}

/**
 * Ranking de quem treinou o mesmo WOD hoje, agrupado por WOD. Vive na Liga
 * (é a aba de ranking do individual); a Início só mostra o WOD do próprio
 * atleta, sem a lista dos outros.
 */
export default function WodPlacarRanking() {
  const { user } = useAuth();
  const { rows, loading } = useDailyWodRows();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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
    <div className="flex flex-col gap-5">
      {groups.map(group => (
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
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-base font-headline font-black text-primary italic block">{r.result}</span>
                  {r.load_kg != null && (
                    <span className="text-[9px] font-bold text-on-surface-variant">{r.load_kg}kg</span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

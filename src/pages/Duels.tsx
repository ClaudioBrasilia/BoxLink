import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Plus,
  ChevronDown,
  Handshake,
  Sword,
  Zap,
  Check,
  X,
  Search,
  Timer,
  Hash,
  Info,
  Globe,
  Copy,
  Share2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import AvatarPreview from '../components/AvatarPreview';
import AthletePhoto from '../components/AthletePhoto';
import { AvatarSlot } from '../types';
import { addReward } from '../utils/rewards';
import { useToast } from '../context/ToastContext';
import { createNotification } from '../hooks/useNotifications';
import { computeDuelScore, DuelScoreOutcome } from '../lib/duelScore';
import DuelRecapCard from '../components/DuelRecapCard';
import ShareDuelButton from '../components/ShareDuelButton';
import PremiumCTA from '../components/PremiumCTA';
import {
  WodPaceMeta,
  parseTimeToSeconds,
  computeRepsPerMinute,
  isAmrapType,
  amrapResultValue,
  inferRoundWeight,
} from '../lib/pace';
import { isPremium } from '../lib/plan';
import { computeRelativeStrength } from '../lib/relativeStrength';
import WodSpotlightChart from '../components/WodSpotlightChart';
import { WodSpotlightData } from '../lib/wodSpotlight';
import { normalizeFriendCode } from '../lib/friendCode';
import { registerDuelWorkout } from '../lib/duelWorkout';
import TimeInput from '../components/TimeInput';
import AmrapInput from '../components/AmrapInput';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DuelResult {
  [userId: string]: string | null;
}

interface DuelIntensity {
  [userId: string]: number | null;
}

/** Carga (kg) usada por cada participante — vira força relativa no recap. */
interface DuelLoads {
  [userId: string]: number | null;
}

interface Duel {
  id: string;
  challengerId: string;
  opponentIds: string[];
  acceptedBy: string[];
  status: 'pending' | 'active' | 'finished';
  winnerId?: string | null;
  betAmount: number;
  betType: 'xp' | 'coins';
  betReserved: boolean;
  betReservedAt?: string | null;
  betSettledAt?: string | null;
  betCanceledAt?: string | null;
  wodId?: string | null;
  wodName?: string;
  wodType?: string;
  wodRx?: string;
  wodCustom?: boolean;
  // Ritmo (reps/min) de WOD personalizado (individual, Premium) — wod_id é
  // sempre null nesse caso, então os números vivem direto no duelo.
  totalReps?: number | null;
  timeCapMinutes?: number | null;
  /** AMRAP: reps de um round completo — converte "rounds+reps" em total. */
  repsPerRound?: number | null;
  category: string;
  results: DuelResult;
  intensity: DuelIntensity;
  loads: DuelLoads;
  createdAt: string;
}

interface UserProfile {
  id: string;
  name: string;
  xp: number;
  coins: number;
  level: number;
  avatar_equipped?: any;
  photo_url?: string | null;
  weight_kg?: number | null;
}

interface WodOption {
  id: string;
  name: string;
  type: string;
  date: string;
  rx?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parseResultValue = (result: string, isTimeBased: boolean, roundWeight?: number | null): number => {
  if (!result) return isTimeBased ? 999999 : 0;
  const str = result.trim();
  if (/^\d+:\d+/.test(str)) {
    const parts = str.split(':').map(Number);
    return parts.length === 2
      ? parts[0] * 60 + parts[1]
      : parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  // AMRAP em "rounds+reps" vira total de reps — sem isso "5+12" perderia o
  // "+" na limpeza abaixo e viraria 512, esmagando qualquer oponente.
  const amrap = amrapResultValue(str, roundWeight);
  if (amrap != null) return amrap;
  return parseFloat(str.replace(/[^0-9.]/g, '')) || (isTimeBased ? 999999 : 0);
};

// Keywords que indicam "menor tempo vence"
const TIME_BASED_KEYWORDS = ['FOR TIME', 'TIME', 'TEMPO', 'RFT', 'CHIPPER'];
// Keywords que indicam "maior resultado vence"
const REPS_BASED_KEYWORDS = ['AMRAP', 'EMOM', 'REPS', 'MAX'];

/**
 * Determina se o duelo é time-based (menor = melhor) com estratégia em 3 níveis:
 * 1. wod_type com keyword explícita de tempo
 * 2. wod_type com keyword explícita de reps
 * 3. Inferência pelo formato dos resultados submetidos (maioria com ":" → time-based)
 */
const isTimeBasedDuel = (wodType: string | undefined, results: DuelResult): boolean => {
  const upper = (wodType || '').toUpperCase();
  if (TIME_BASED_KEYWORDS.some(k => upper.includes(k))) return true;
  if (REPS_BASED_KEYWORDS.some(k => upper.includes(k))) return false;
  const submitted = Object.values(results).filter(Boolean) as string[];
  if (submitted.length === 0) return false;
  const timeFormatCount = submitted.filter(r => /^\d+:\d+/.test(r.trim())).length;
  return timeFormatCount > submitted.length / 2;
};

// Mantido apenas para display dos cards (ícone + label), sem resultados disponíveis
const isTimeBased = (wodType?: string) =>
  TIME_BASED_KEYWORDS.some(k => (wodType || '').toUpperCase().includes(k));

/** Resultado de AMRAP é "rounds+reps" — o duelo pede os dois campos. */
const isAmrapDuel = (wodType?: string) => isAmrapType(wodType);

const AMRAP_FORMAT = /^\d+\+\d+$/;

const getVisibleResult = (duel: Duel, userId: string): string => {
  if (duel.status === 'finished') return duel.results[userId] || '—';
  const allParticipants = [duel.challengerId, ...duel.opponentIds];
  const allSubmitted = allParticipants.every(id => duel.results[id]);
  if (allSubmitted) return duel.results[userId] || '—';
  return duel.results[userId] ? '✓ Enviado' : 'Aguardando';
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Duels() {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  // Conta individual cria duelo só pelo código de amigo (no Diário) — não vê o
  // formulário de busca que listaria os atletas do box.
  const isIndividual = user?.accountType === 'individual';
  // Recap comparativo do duelo (desempenho/esforço/ritmo/"por que venceu") é
  // Premium no individual. Conta de box sempre vê — comparação é core ali.
  // Para liberar um teste, conceda Premium com validade pelo painel Admin: o
  // acesso expira sozinho (isPremium respeita plan_expires_at) e fica
  // registrado em plan_grants.
  const canSeeComparison = !isIndividual || isPremium(user);

  // Data
  const [duels, setDuels] = useState<Duel[]>([]);
  // Perfis dos participantes dos duelos visíveis — só o necessário pra
  // resolver nome/avatar/peso (getUserName/getUserProfile/getStrengthById),
  // nunca o diretório inteiro da plataforma.
  const [users, setUsers] = useState<UserProfile[]>([]);
  // Colegas do próprio box — usado só pelo picker de "novo desafio" (busca
  // por nome). Separado de `users` de propósito: antes a busca de oponente
  // não filtrava por box_id e qualquer aluno de qualquer box (ou conta
  // individual) aparecia pra qualquer outro. Desafiar alguém de fora agora é
  // um gesto à parte, por código (ver `outsideCode` abaixo).
  const [boxMates, setBoxMates] = useState<UserProfile[]>([]);
  const [wods, setWods] = useState<WodOption[]>([]);
  const [boxSettings, setBoxSettings] = useState<any>(null);
  // Números do WOD (reps totais / duração) por wod_id — usados para o ritmo
  const [wodPaceMeta, setWodPaceMeta] = useState<Record<string, WodPaceMeta>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // UI
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'pending'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  // Submissão de resultado por duelo
  const [submission, setSubmission] = useState<Record<string, string>>({});
  // % da FC máx registrada junto do resultado (opcional, por duelo)
  const [submissionIntensity, setSubmissionIntensity] = useState<Record<string, string>>({});
  // Carga (kg) informada junto do resultado (opcional, por duelo)
  const [submissionLoad, setSubmissionLoad] = useState<Record<string, string>>({});
  // % da FC máx do treino de hoje (usado para pré-preencher o esforço)
  const [todayPct, setTodayPct] = useState<number | null>(null);
  // Meu peso corporal — divide a carga para chegar na força relativa
  const [myWeightKg, setMyWeightKg] = useState<number | null>(null);

  // Criação de duelo
  const [opponentSearch, setOpponentSearch] = useState('');
  const [selectedOpponents, setSelectedOpponents] = useState<string[]>([]);
  // Oponentes adicionados por código (de fora do box) — só pra exibir o
  // selo "DE FORA" no chip; não muda como o duelo é criado.
  const [outsideOpponentIds, setOutsideOpponentIds] = useState<Set<string>>(new Set());
  const [outsideCode, setOutsideCode] = useState('');
  const [searchingOutside, setSearchingOutside] = useState(false);
  const [wodMode, setWodMode] = useState<'existing' | 'custom'>('existing');
  const [selectedWodId, setSelectedWodId] = useState('');
  const [category, setCategory] = useState<'RX' | 'SCALED' | 'BEGINNER'>('RX');
  const [betAmount, setBetAmount] = useState(100);
  const [betType, setBetType] = useState<'xp' | 'coins'>('xp');
  const [betEnabled, setBetEnabled] = useState(false);
  // WOD personalizado
  const [customWodName, setCustomWodName] = useState('');
  const [customWodType, setCustomWodType] = useState<'FOR TIME' | 'AMRAP' | 'EMOM'>('FOR TIME');
  const [customWodDesc, setCustomWodDesc] = useState('');

  // ─── Load ────────────────────────────────────────────────────────────────

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const profileFields = 'id, name, xp, coins, level, avatar_equipped, photo_url, weight_kg';
      const [duelsRes, wodsRes, settingsRes] = await Promise.all([
        supabase.from('duels').select('*').order('created_at', { ascending: false }),
        supabase.from('wods').select('id, name, type, date, rx').order('date', { ascending: false }).limit(30),
        supabase.from('box_settings').select('*').maybeSingle(),
      ]);

      // Colegas do próprio box — só pra montar um duelo novo pelo picker de
      // busca. Quem é de fora entra por código (handleFindOutside), não por
      // aqui, então não precisa (nem deve) aparecer nesta lista.
      if (!isIndividual && user.boxId) {
        const { data: mates } = await supabase
          .from('profiles')
          .select(profileFields)
          .eq('status', 'approved')
          .eq('box_id', user.boxId)
          .neq('id', user.id);
        setBoxMates(mates || []);
      } else {
        setBoxMates([]);
      }

      if (duelsRes.data) {
        const mapped = duelsRes.data.map((d: any) => ({
          id: d.id,
          challengerId: d.challenger_id,
          opponentIds: d.opponent_ids ?? (d.opponent_id ? [d.opponent_id] : []),
          acceptedBy: d.accepted_by ?? [],
          status: d.status ?? 'pending',
          winnerId: d.winner_id,
          betAmount: d.bet_amount ?? d.reward_xp ?? 0,
          betType: d.bet_type ?? 'xp',
          betReserved: d.bet_reserved ?? false,
          betReservedAt: d.bet_reserved_at,
          betSettledAt: d.bet_settled_at,
          betCanceledAt: d.bet_canceled_at,
          wodId: d.wod_id,
          wodName: d.wod_name,
          wodType: d.wod_type,
          wodRx: d.wod_rx,
          wodCustom: d.wod_custom,
          totalReps: d.total_reps,
          timeCapMinutes: d.time_cap_minutes,
          repsPerRound: d.reps_per_round,
          category: d.category ?? 'RX',
          results: d.results ?? {},
          intensity: d.intensity ?? {},
          loads: d.loads ?? {},
          createdAt: d.created_at,
        }));
        // Individual não faz parte de um box: só vê os próprios duelos, nunca
        // o "social feed" de duelos entre atletas do box.
        const visible = isIndividual
          ? mapped.filter(d => d.challengerId === user.id || d.opponentIds.includes(user.id))
          : mapped;
        setDuels(visible);

        // Ritmo (reps/min): busca os números dos WODs usados nos duelos.
        // WOD personalizado (sem wod_id) não tem esses números — fica sem ritmo.
        const wodIds = [...new Set(visible.map(d => d.wodId).filter(Boolean))] as string[];
        if (wodIds.length > 0) {
          const { data: metaRows } = await supabase
            .from('wods')
            .select('id, type, reps_per_round, total_reps, time_cap_minutes')
            .in('id', wodIds);
          const metaMap: Record<string, WodPaceMeta> = {};
          (metaRows || []).forEach((w: any) => {
            metaMap[w.id] = {
              type: w.type,
              repsPerRound: w.reps_per_round,
              totalReps: w.total_reps,
              timeCapMinutes: w.time_cap_minutes,
            };
          });
          setWodPaceMeta(metaMap);
        }

        // Perfis de todo participante dos duelos visíveis (challenger +
        // oponentes), de qualquer box ou conta — é o que getUserName/
        // getUserProfile/getStrengthById usam pra resolver nome/avatar/peso.
        // Busca só quem aparece nos duelos, não o diretório inteiro.
        const participantIds = [...new Set(visible.flatMap(d => [d.challengerId, ...d.opponentIds]))]
          .filter(id => id !== user.id);
        if (participantIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles').select(profileFields).in('id', participantIds);
          if (profilesData) setUsers(profilesData);
        } else {
          setUsers([]);
        }
      }
      if (wodsRes.data) setWods(wodsRes.data);
      if (settingsRes.data) setBoxSettings(settingsRes.data);

      // % da FC máx do treino de hoje → pré-preenche o esforço no duelo
      const today = new Date().toISOString().slice(0, 10);
      const { data: todayLog } = await supabase
        .from('training_logs')
        .select('hr_avg_pct, date')
        .eq('user_id', user.id)
        .eq('date', today)
        .not('hr_avg_pct', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setTodayPct(todayLog?.hr_avg_pct ?? null);

      const { data: me } = await supabase
        .from('profiles').select('weight_kg').eq('id', user.id).maybeSingle();
      setMyWeightKg(me?.weight_kg ?? null);
    } catch (err) {
      console.error('Error loading duels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('duels_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ─── Helpers ─────────────────────────────────────────────────────────────

  // Números para o ritmo (reps/min): duelo de box referencia um WOD real
  // (busca em wodPaceMeta); duelo de WOD personalizado (individual, Premium)
  // guarda os números direto na própria linha do duelo, já que wod_id é null.
  const getPaceMeta = (duel: Duel): WodPaceMeta | undefined =>
    duel.wodId
      ? wodPaceMeta[duel.wodId]
      : (duel.totalReps != null || duel.timeCapMinutes != null || duel.repsPerRound != null)
        ? {
            type: duel.wodType,
            totalReps: duel.totalReps,
            timeCapMinutes: duel.timeCapMinutes,
            repsPerRound: duel.repsPerRound,
          }
        : undefined;

  // Quanto vale um round na hora de comparar resultados AMRAP ("rounds+reps").
  // Usa o reps_per_round do WOD quando existe; senão infere dos próprios
  // resultados do duelo — a ordem (mais rounds vence) sai certa de qualquer jeito.
  const getRoundWeight = (duel: Duel, results: DuelResult = duel.results) =>
    getPaceMeta(duel)?.repsPerRound ?? inferRoundWeight(Object.values(results));

  // Força relativa (carga ÷ peso corporal) de cada participante do duelo.
  // Só existe para quem registrou a carga E tem peso no perfil.
  // `loads` é parametrizável porque na hora de liquidar o duelo a carga que
  // acabou de ser enviada ainda não está em duel.loads.
  const getStrengthById = (duel: Duel, loads: DuelLoads = duel.loads): Record<string, number | null> => {
    const out: Record<string, number | null> = {};
    [duel.challengerId, ...duel.opponentIds].forEach(pid => {
      const weight = pid === user?.id ? myWeightKg : users.find(u => u.id === pid)?.weight_kg ?? null;
      out[pid] = computeRelativeStrength(loads?.[pid], weight);
    });
    return out;
  };

  const getUserName = (id: string) => {
    if (id === user?.id) return 'Você';
    return users.find(u => u.id === id)?.name || 'Atleta';
  };

  const getUserProfile = (id: string): UserProfile | undefined =>
    id === user?.id
      ? { id: user.id, name: user.name, xp: user.xp, coins: user.coins, level: user.level, avatar_equipped: user.avatar?.equipped, photo_url: (user as any).photo_url ?? null }
      : users.find(u => u.id === id);

  const getDuelWinXp = () => boxSettings?.rewards?.duel_win_xp ?? 40;
  const getDuelWinCoins = () => boxSettings?.rewards?.duel_win_coins ?? 10;

  // ─── Desafiar alguém de fora do box (por código, mesmo gesto do Individual) ─

  const handleCopyMyCode = async () => {
    if (!user?.friendCode) return;
    try {
      await navigator.clipboard.writeText(user.friendCode);
      toast.success('Código copiado!');
    } catch {
      toast.warning(`Seu código: ${user.friendCode}`);
    }
  };

  const handleShareMyCode = () => {
    if (!user?.friendCode) return;
    const text = `⚔️ Me desafie para um duelo no BoxLink! Meu código de atleta: ${user.friendCode} — ${window.location.origin}`;
    if (navigator.share) navigator.share({ title: 'BoxLink — Duelo', text }).catch(() => {});
    else handleCopyMyCode();
  };

  const handleFindOutside = async () => {
    if (!user || !outsideCode.trim()) return;
    const code = normalizeFriendCode(outsideCode);
    if (code === user.friendCode) {
      toast.warning('Esse é o seu próprio código!'); return;
    }
    setSearchingOutside(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, xp, coins, level, avatar_equipped, photo_url, weight_kg, friend_code')
        .eq('friend_code', code)
        .maybeSingle();
      if (error) throw error;
      if (!data) { toast.error('Nenhum atleta encontrado com esse código.'); return; }
      if (selectedOpponents.includes(data.id)) { toast.warning('Esse atleta já está no desafio.'); return; }

      setUsers(prev => prev.some(u => u.id === data.id) ? prev : [...prev, data]);
      setSelectedOpponents(prev => [...prev, data.id]);
      setOutsideOpponentIds(prev => new Set(prev).add(data.id));
      setOutsideCode('');
    } catch (err: any) {
      console.error('Error finding outside athlete:', err);
      toast.error('Erro ao buscar atleta.');
    } finally {
      setSearchingOutside(false);
    }
  };

  // ─── Criação de duelo ─────────────────────────────────────────────────────

  const handleCreateDuel = async () => {
    if (!user || selectedOpponents.length === 0) return;

    if (wodMode === 'existing' && !selectedWodId) {
      toast.warning('Selecione um WOD.'); return;
    }
    if (wodMode === 'custom' && (!customWodName || !customWodDesc)) {
      toast.warning('Preencha nome e descrição do WOD personalizado.'); return;
    }

    const myBalance = betType === 'xp' ? user.xp : user.coins;
    if (betEnabled && betAmount > myBalance) {
      toast.error(`Você não tem ${betType.toUpperCase()} suficiente para esta aposta.`); return;
    }
    if (betEnabled) {
      for (const opId of selectedOpponents) {
        const op = getUserProfile(opId);
        const opBalance = betType === 'xp' ? (op?.xp ?? 0) : (op?.coins ?? 0);
        if (opBalance < betAmount) {
          toast.error(`${op?.name || 'Um oponente'} não tem ${betType.toUpperCase()} suficiente.`); return;
        }
      }
    }

    setSaving(true);
    try {
      let wodData: { wodId: string | null; wodName: string; wodType: string; wodRx: string; wodCustom: boolean };

      if (wodMode === 'custom') {
        wodData = {
          wodId: null,
          wodName: customWodName,
          wodType: customWodType,
          wodRx: customWodDesc,
          wodCustom: true,
        };
      } else {
        const found = wods.find(w => w.id === selectedWodId);
        if (!found) return;
        wodData = {
          wodId: found.id,
          wodName: found.name,
          wodType: found.type,
          wodRx: found.rx || '',
          wodCustom: false,
        };
      }

      const allParticipants = [user.id, ...selectedOpponents];
      const initialResults: DuelResult = {};
      allParticipants.forEach(id => { initialResults[id] = null; });

      const { error } = await supabase.from('duels').insert({
        challenger_id: user.id,
        opponent_ids: selectedOpponents,
        accepted_by: [],
        status: 'pending',
        bet_amount: betEnabled ? betAmount : 0,
        bet_type: betType,
        bet_reserved: false,
        wod_id: wodData.wodId,
        wod_name: wodData.wodName,
        wod_type: wodData.wodType,
        wod_rx: wodData.wodRx,
        wod_custom: wodData.wodCustom,
        category,
        results: initialResults,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      for (const opId of selectedOpponents) {
        await createNotification(
          opId,
          'duel_created',
          '⚔️ Novo Duelo!',
          `${user.name || 'Um atleta'} te desafiou para um duelo — ${wodData.wodName}`,
          { challengerId: user.id, wodName: wodData.wodName }
        );
      }

      setSelectedOpponents([]);
      setOutsideOpponentIds(new Set());
      setOutsideCode('');
      setOpponentSearch('');
      setSelectedWodId('');
      setCategory('RX');
      setBetAmount(100);
      setBetEnabled(false);
      setCustomWodName('');
      setCustomWodDesc('');
      setWodMode('existing');
      setShowCreate(false);
      await loadData();
    } catch (err: any) {
      console.error('Error creating duel:', err);
      toast.error('Erro ao criar duelo: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Aceitar duelo ────────────────────────────────────────────────────────

  const handleAccept = async (duelId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const duel = duels.find(d => d.id === duelId);
      if (!duel) return;

      const newAcceptedBy = [...(duel.acceptedBy || []), user.id];
      const allAccepted = newAcceptedBy.length === duel.opponentIds.length;

      const updates: any = {
        accepted_by: newAcceptedBy,
        status: allAccepted ? 'active' : 'pending',
        updated_at: new Date().toISOString(),
      };

      if (allAccepted && !duel.betReserved && duel.betAmount > 0) {
        const allParticipants = [duel.challengerId, ...duel.opponentIds];
        for (const pid of allParticipants) {
          const profile = getUserProfile(pid);
          if (!profile) continue;
          if (duel.betType === 'xp') {
            const newXp = Math.max(0, (profile.xp || 0) - duel.betAmount);
            await supabase.from('profiles').update({ xp: newXp }).eq('id', pid);
            if (pid === user.id) updateUser({ ...user, xp: newXp });
          } else {
            const newCoins = Math.max(0, (profile.coins || 0) - duel.betAmount);
            await supabase.from('profiles').update({ coins: newCoins }).eq('id', pid);
            if (pid === user.id) updateUser({ ...user, coins: newCoins });
          }
        }
        updates.bet_reserved = true;
        updates.bet_reserved_at = new Date().toISOString();
      }

      await supabase.from('duels').update(updates).eq('id', duelId);

      if (duel.challengerId !== user.id) {
        await createNotification(
          duel.challengerId,
          'duel_accepted',
          '✅ Duelo Aceito!',
          `${user.name || 'Um atleta'} aceitou seu duelo — ${duel.wodName || 'duelo'}`,
          { duelId, acceptedBy: user.id }
        );
      }
      if (allAccepted) {
        const allParticipants = [duel.challengerId, ...duel.opponentIds];
        for (const pid of allParticipants) {
          if (pid === user.id) continue;
          await createNotification(
            pid,
            'duel_accepted',
            '🥊 Duelo Ativo!',
            `Todos aceitaram! Submeta seu resultado no duelo — ${duel.wodName || 'duelo'}`,
            { duelId }
          );
        }
      }

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#CAFD00', '#ffffff', '#000000'],
      });

      await loadData();
    } catch (err: any) {
      console.error('Error accepting duel:', err);
      toast.error('Erro ao aceitar duelo.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Cancelar duelo ───────────────────────────────────────────────────────

  const handleCancel = async (duelId: string) => {
    if (!user) return;
    setSaving(true);
    try {
      const duel = duels.find(d => d.id === duelId);
      if (!duel) return;

      if (duel.betReserved && duel.betAmount > 0 && !duel.betSettledAt) {
        const allParticipants = [duel.challengerId, ...duel.opponentIds];
        for (const pid of allParticipants) {
          const profile = getUserProfile(pid);
          if (!profile) continue;
          if (duel.betType === 'xp') {
            const newXp = (profile.xp || 0) + duel.betAmount;
            await supabase.from('profiles').update({ xp: newXp }).eq('id', pid);
            if (pid === user.id) updateUser({ ...user, xp: newXp });
          } else {
            const newCoins = (profile.coins || 0) + duel.betAmount;
            await supabase.from('profiles').update({ coins: newCoins }).eq('id', pid);
            if (pid === user.id) updateUser({ ...user, coins: newCoins });
          }
        }
      }

      await supabase.from('duels').delete().eq('id', duelId);
      setDuels(prev => prev.filter(d => d.id !== duelId));
      if (expandedId === duelId) setExpandedId(null);
      toast.success('Duelo cancelado e removido.');
    } catch (err: any) {
      console.error('Error canceling duel:', err);
      toast.error('Erro ao cancelar duelo.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Submeter resultado ───────────────────────────────────────────────────

  const handleSubmitResult = async (duel: Duel) => {
    if (!user) return;
    const result = submission[duel.id]?.trim();
    if (!result) {
      toast.warning('Preencha seu resultado.'); return;
    }
    // WOD por tempo: exige "mm:ss" — sem isso "333" vira um número solto e o
    // placar (menor vence) compara tempo com o que na real são reps, dando
    // um resultado sem sentido (ex: 12 "esmagando" 333).
    if (isTimeBased(duel.wodType) && parseTimeToSeconds(result) == null) {
      toast.warning('Resultado por tempo precisa ser "mm:ss", ex: 12:45.'); return;
    }
    // AMRAP: o resultado é "rounds+reps" (ex: 5+12) — mesmo formato do placar.
    if (isAmrapDuel(duel.wodType) && !AMRAP_FORMAT.test(result)) {
      toast.warning('Resultado de AMRAP é em rounds + reps, ex: 5+12.'); return;
    }

    // Esforço (% da FC máx) opcional — só entra no cálculo se TODOS registrarem.
    // Se o campo estiver vazio, usa o esforço do treino de hoje (se houver).
    const rawPct = submissionIntensity[duel.id]?.trim();
    const parsedPct = rawPct ? Number(rawPct.replace(/[^0-9.]/g, '')) : (todayPct ?? null);
    const myPct = parsedPct != null && !Number.isNaN(parsedPct)
      ? Math.max(0, Math.min(100, parsedPct))
      : null;

    // Carga (kg) opcional — com o peso corporal do perfil vira força relativa.
    const rawLoad = submissionLoad[duel.id]?.trim();
    const parsedLoad = rawLoad ? parseFloat(rawLoad.replace(',', '.')) : NaN;
    const myLoad = Number.isFinite(parsedLoad) && parsedLoad > 0 ? parsedLoad : null;

    setSaving(true);
    try {
      const newResults: DuelResult = { ...duel.results, [user.id]: result };
      const newIntensity: DuelIntensity = { ...duel.intensity, [user.id]: myPct && myPct > 0 ? myPct : null };
      const newLoads: DuelLoads = { ...duel.loads, [user.id]: myLoad };
      const allParticipants = [duel.challengerId, ...duel.opponentIds];
      const allSubmitted = allParticipants.every(id => newResults[id]);

      if (allSubmitted) {
        const timeBased = isTimeBasedDuel(duel.wodType, newResults);
        const roundWeight = getRoundWeight(duel, newResults);
        const outcome: DuelScoreOutcome = computeDuelScore(
          newResults,
          newIntensity,
          allParticipants,
          timeBased,
          (r, tb) => parseResultValue(r, tb, roundWeight),
          // Desempate por força relativa usa a carga recém-enviada também.
          getStrengthById(duel, newLoads),
        );
        const winnerId = outcome.winnerId;
        const isTie = winnerId === null;

        // ── Audit log ──────────────────────────────────────────────────────
        console.info('[duel_settlement]', {
          duelId: duel.id,
          wodType: duel.wodType,
          results: newResults,
          intensity: newIntensity,
          usedIntensity: outcome.usedIntensity,
          entries: outcome.entries,
          tiebreak: outcome.tiebreak,
          winnerId,
          losers: isTie ? [] : allParticipants.filter(id => id !== winnerId),
          totalPrize: duel.betAmount * allParticipants.length,
          isTie,
        });

        const updates: any = {
          results: newResults,
          intensity: newIntensity,
          loads: newLoads,
          status: 'finished',
          winner_id: winnerId,   // null = empate ou sem resultado válido
          updated_at: new Date().toISOString(),
        };

        // Busca saldos frescos do banco para evitar usar estado React desatualizado
        const { data: freshProfiles } = await supabase
          .from('profiles')
          .select('id, xp, coins')
          .in('id', allParticipants);

        if (duel.betReserved && duel.betAmount > 0 && !duel.betSettledAt) {
          if (isTie) {
            // ── Empate ou resultado inválido: devolver apostas a todos ────
            for (const pid of allParticipants) {
              const fresh = freshProfiles?.find(p => p.id === pid);
              if (!fresh) continue;
              if (duel.betType === 'xp') {
                const newXp = (fresh.xp || 0) + duel.betAmount;
                await supabase.from('profiles').update({ xp: newXp }).eq('id', pid);
                if (pid === user.id) updateUser({ ...user, xp: newXp });
              } else {
                const newCoins = (fresh.coins || 0) + duel.betAmount;
                await supabase.from('profiles').update({ coins: newCoins }).eq('id', pid);
                if (pid === user.id) updateUser({ ...user, coins: newCoins });
              }
            }
          } else {
            // ── Vencedor recebe tudo: sua aposta + a de cada perdedor ─────
            const totalPrize = duel.betAmount * allParticipants.length;
            const fresh = freshProfiles?.find(p => p.id === winnerId);
            if (fresh) {
              if (duel.betType === 'xp') {
                const newXp = (fresh.xp || 0) + totalPrize;
                await supabase.from('profiles').update({ xp: newXp }).eq('id', winnerId);
                if (winnerId === user.id) updateUser({ ...user, xp: newXp });
              } else {
                const newCoins = (fresh.coins || 0) + totalPrize;
                await supabase.from('profiles').update({ coins: newCoins }).eq('id', winnerId);
                if (winnerId === user.id) updateUser({ ...user, coins: newCoins });
              }
            }
          }
          // Sempre marcar aposta como liquidada, mesmo em empate
          updates.bet_settled_at = new Date().toISOString();
        }

        if (isTie) {
          toast.success('🤝 Duelo empatado — apostas devolvidas!');
        } else {
          await addReward(
            winnerId!,
            'duel',
            getDuelWinXp(),
            getDuelWinCoins(),
            `Vitória no duelo — ${duel.wodName || 'duelo'}`,
            duel.id,
          );
          if (winnerId === user.id) {
            confetti({
              particleCount: 200,
              spread: 100,
              origin: { y: 0.5 },
              colors: ['#CAFD00', '#FFFFFF'],
            });
            toast.success(`🏆 Você venceu! +${getDuelWinXp()} XP, +${getDuelWinCoins()} coins`);
          } else {
            toast.success(`Duelo finalizado! Vencedor: ${getUserName(winnerId!)}`);
          }
        }

        await supabase.from('duels').update(updates).eq('id', duel.id);

        for (const pid of allParticipants) {
          const isWinner = pid === winnerId;
          await createNotification(
            pid,
            'duel_finished',
            isTie
              ? '🤝 Duelo Empatado!'
              : isWinner ? '🏆 Você Venceu o Duelo!' : '💪 Duelo Finalizado!',
            isTie
              ? `Empate! Apostas devolvidas — ${duel.wodName || 'duelo'}`
              : isWinner
                ? `Parabéns! Você venceu o duelo — ${duel.wodName || 'duelo'}`
                : `Duelo encerrado. Vencedor: ${getUserName(winnerId!)} — ${duel.wodName || 'duelo'}`,
            { duelId: duel.id, winnerId, isTie }
          );
        }
      } else {
        await supabase.from('duels').update({
          results: newResults,
          intensity: newIntensity,
          loads: newLoads,
          updated_at: new Date().toISOString(),
        }).eq('id', duel.id);

        for (const pid of allParticipants) {
          if (pid === user.id || newResults[pid]) continue;
          await createNotification(
            pid,
            'duel_result',
            '⏳ Resultado Aguardando',
            `${user.name || 'Um atleta'} já submeteu o resultado. Submeta o seu! — ${duel.wodName || 'duelo'}`,
            { duelId: duel.id }
          );
        }
      }

      // O duelo também é treino: registra no diário (e no placar/ranking
      // conforme o tipo de conta). Isolado do fluxo do duelo de propósito —
      // o resultado já está salvo aqui, então uma falha ao registrar não
      // pode derrubar a submissão nem mostrar um erro enganoso.
      try {
        const logged = await registerDuelWorkout({
          userId: user.id,
          duelId: duel.id,
          wodName: duel.wodName || 'Duelo',
          wodType: duel.wodType,
          description: duel.wodRx,
          result,
          isIndividual,
          wodId: duel.wodId,
          category: duel.category,
          hrAvgPct: myPct,
          loadKg: myLoad,
        });
        if (logged.logged && (logged.xp > 0 || logged.coins > 0)) {
          toast.success(`Treino registrado! +${logged.xp} XP, +${logged.coins} coins`);
        } else if (logged.logged) {
          toast.success('Treino registrado no seu diário.');
        }
      } catch (logErr) {
        console.error('Error registering duel workout:', logErr);
      }

      setSubmission(prev => ({ ...prev, [duel.id]: '' }));
      setSubmissionIntensity(prev => ({ ...prev, [duel.id]: '' }));
      setSubmissionLoad(prev => ({ ...prev, [duel.id]: '' }));
      await loadData();
    } catch (err: any) {
      console.error('Error submitting result:', err);
      toast.error('Erro ao submeter resultado: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Derived ──────────────────────────────────────────────────────────────

  const filteredDuels = useMemo(() => duels.filter(d => {
    if (activeTab === 'mine') return d.challengerId === user?.id || d.opponentIds.includes(user?.id || '');
    if (activeTab === 'pending') return d.status === 'pending' && d.opponentIds.includes(user?.id || '') && !d.acceptedBy.includes(user?.id || '');
    return true;
  }), [duels, activeTab, user]);

  const filteredOpponents = boxMates.filter(u =>
    u.name.toLowerCase().includes(opponentSearch.toLowerCase()) &&
    !selectedOpponents.includes(u.id)
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background pb-32">

      {/* Header */}
      <header className="p-6 pt-12 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-headline font-black italic text-on-surface uppercase tracking-tight">
              Duelos
            </h1>
            <p className="text-on-surface-variant text-xs font-medium uppercase tracking-widest opacity-60">
              Desafie e conquiste
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowScoreInfo(s => !s)}
              className={cn(
                'w-12 h-12 rounded-full border flex items-center justify-center transition-all',
                showScoreInfo ? 'bg-secondary/20 border-secondary/30' : 'bg-surface-container-highest border-outline-variant/10'
              )}
              aria-label="Como o placar do duelo é calculado"
            >
              <Info className={cn('w-5 h-5', showScoreInfo ? 'text-secondary' : 'text-on-surface-variant')} />
            </button>
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sword className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>

        {/* Como o placar é calculado */}
        <AnimatePresence>
          {showScoreInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-surface-container-highest/50 rounded-2xl p-4 border border-outline-variant/10 flex flex-col gap-2 overflow-hidden"
            >
              <p className="text-[11px] font-black text-on-surface uppercase tracking-widest">
                Como o vencedor é decidido
              </p>
              <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
                Quem vence é <span className="text-primary font-bold">o desempenho</span> — o resultado do WOD, e só ele.
              </p>
              <ul className="text-[11px] text-on-surface-variant font-medium leading-relaxed list-disc pl-4 flex flex-col gap-1">
                <li><span className="text-on-surface font-bold">Desempenho:</span> seu resultado comparado ao melhor do duelo (o melhor fica em 100).</li>
                <li><span className="text-on-surface font-bold">Esforço (FC):</span> aparece no resumo, mas não pontua. Fazer o mesmo resultado com FC menor mostra quem foi mais eficiente — não quem ganhou.</li>
                <li><span className="text-on-surface font-bold">Comparação só com todos:</span> se alguém não registrou a FC, o esforço não é comparado — ninguém leva vantagem por ter sensor.</li>
                <li><span className="text-on-surface font-bold">Resultado igual:</span> desempata quem gastou menos FC; se não der, quem moveu mais carga por quilo de peso. Sem esses dados, empate e apostas devolvidas.</li>
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <div className="flex gap-2 bg-surface-container-highest p-1 rounded-2xl">
          {(['all', 'mine', 'pending'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                activeTab === tab
                  ? 'bg-primary text-background shadow-lg'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              {tab === 'all' ? 'Todos' : tab === 'mine' ? 'Meus' : 'Pendentes'}
            </button>
          ))}
        </div>
      </header>

      {/* ── Formulário de criação (não disponível para conta individual) ── */}
      <AnimatePresence>
        {showCreate && !isIndividual && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-6 mb-4 bg-surface-container rounded-3xl border border-outline-variant/10 p-6 flex flex-col gap-5"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-headline font-black text-lg text-on-surface uppercase italic">Novo Desafio</h2>
              <button onClick={() => setShowCreate(false)}>
                <X className="w-5 h-5 text-on-surface-variant" />
              </button>
            </div>

            {/* Busca de oponente */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">
                Oponentes
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                <input
                  type="text"
                  placeholder="Buscar atleta pelo nome..."
                  value={opponentSearch}
                  onChange={e => setOpponentSearch(e.target.value)}
                  className="w-full bg-surface-container-highest rounded-2xl pl-9 pr-4 py-3 text-sm font-medium text-on-surface placeholder:text-on-surface-variant/40 outline-none"
                />
              </div>
              {opponentSearch.length > 0 && (
                <div className="bg-surface-container-highest rounded-2xl border border-outline-variant/10 max-h-40 overflow-y-auto">
                  {filteredOpponents.length === 0 ? (
                    <p className="text-center text-on-surface-variant text-xs py-4 font-bold uppercase">Nenhum atleta encontrado</p>
                  ) : filteredOpponents.map(op => (
                    <button
                      key={op.id}
                      onClick={() => { setSelectedOpponents(prev => [...prev, op.id]); setOpponentSearch(''); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/10 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center font-headline font-black text-sm text-on-surface">
                        {op.name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface uppercase italic">{op.name}</p>
                        <p className="text-[10px] text-on-surface-variant font-bold">Nível {op.level} • {op.xp} XP</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedOpponents.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedOpponents.map(id => (
                    <div key={id} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-3 py-1.5 rounded-full">
                      {outsideOpponentIds.has(id) && (
                        <span className="flex items-center gap-0.5 text-[8px] font-black uppercase tracking-widest text-secondary border border-secondary/30 rounded-full px-1.5 py-0.5">
                          <Globe className="w-2.5 h-2.5" /> Fora
                        </span>
                      )}
                      <span className="text-[11px] font-black uppercase">{getUserName(id)}</span>
                      <button onClick={() => {
                        setSelectedOpponents(prev => prev.filter(x => x !== id));
                        setOutsideOpponentIds(prev => { const next = new Set(prev); next.delete(id); return next; });
                      }}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Desafiar alguém de fora do box, por código de atleta */}
            <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-secondary flex-shrink-0" />
                <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Desafiar alguém de fora do box</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Código do atleta (ex: AB2C-3DEF)"
                  value={outsideCode}
                  onChange={e => setOutsideCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-bold text-on-surface placeholder:text-on-surface-variant/40 outline-none tracking-wider"
                />
                <button
                  onClick={handleFindOutside}
                  disabled={searchingOutside || !outsideCode.trim()}
                  className="bg-secondary text-background px-5 rounded-2xl font-headline font-black text-xs uppercase italic disabled:opacity-40 hover:opacity-90 transition-all"
                >
                  {searchingOutside
                    ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                    : 'Buscar'}
                </button>
              </div>
              <div className="flex items-center justify-between bg-surface-container-highest/50 rounded-xl px-3 py-2">
                <div>
                  <p className="text-[8px] text-on-surface-variant font-black uppercase tracking-widest">Seu código</p>
                  <p className="text-sm font-headline font-black text-secondary italic tracking-wider">
                    {user?.friendCode || '— — — —'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={handleCopyMyCode} className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-secondary transition-all">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={handleShareMyCode} className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-secondary transition-all">
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* WOD */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">WOD</label>
                <button
                  onClick={() => setWodMode(m => m === 'existing' ? 'custom' : 'existing')}
                  className="text-[10px] font-black text-primary uppercase tracking-widest"
                >
                  {wodMode === 'existing' ? '+ Criar personalizado' : '← Usar existente'}
                </button>
              </div>

              {wodMode === 'existing' ? (
                <select
                  value={selectedWodId}
                  onChange={e => setSelectedWodId(e.target.value)}
                  className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                >
                  <option value="">Selecione um WOD</option>
                  {wods.map(w => (
                    <option key={w.id} value={w.id}>{w.name} • {w.date} • {w.type}</option>
                  ))}
                </select>
              ) : (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Nome do WOD"
                    value={customWodName}
                    onChange={e => setCustomWodName(e.target.value)}
                    className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                  />
                  <select
                    value={customWodType}
                    onChange={e => setCustomWodType(e.target.value as any)}
                    className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none"
                  >
                    <option value="FOR TIME">For Time</option>
                    <option value="AMRAP">AMRAP</option>
                    <option value="EMOM">EMOM</option>
                  </select>
                  <textarea
                    placeholder="Descrição / Movimentos"
                    value={customWodDesc}
                    onChange={e => setCustomWodDesc(e.target.value)}
                    rows={3}
                    className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-medium text-on-surface outline-none resize-none"
                  />
                </div>
              )}
            </div>

            {/* Categoria */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Categoria</label>
              <div className="flex gap-2">
                {(['RX', 'SCALED', 'BEGINNER'] as const).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={cn(
                      'flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                      category === cat ? 'bg-primary text-background shadow-lg' : 'bg-surface-container-highest text-on-surface-variant'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Aposta */}
            <div className="bg-surface-container-highest/50 rounded-2xl p-4 flex flex-col gap-3 border border-outline-variant/10">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Modo Aposta</label>
                <button
                  onClick={() => setBetEnabled(b => !b)}
                  className={cn(
                    'w-12 h-6 rounded-full transition-all relative',
                    betEnabled ? 'bg-primary' : 'bg-outline-variant/30'
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow',
                    betEnabled ? 'left-6' : 'left-0.5'
                  )} />
                </button>
              </div>
              {betEnabled && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    {(['xp', 'coins'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setBetType(t)}
                        className={cn(
                          'flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                          betType === t ? 'bg-primary text-background' : 'bg-surface-container-highest text-on-surface-variant'
                        )}
                      >
                        {t === 'xp' ? '⚡ XP' : '🪙 Coins'}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                      Valor por participante (seu saldo: {betType === 'xp' ? user?.xp : user?.coins} {betType.toUpperCase()})
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={betType === 'xp' ? user?.xp : user?.coins}
                      value={betAmount}
                      onChange={e => setBetAmount(Math.max(50, Number(e.target.value)))}
                      className="w-full bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-bold text-on-surface outline-none"
                    />
                    <p className="text-[10px] text-on-surface-variant font-bold">
                      Total em risco: {betAmount * (selectedOpponents.length + 1)} {betType.toUpperCase()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Botão criar */}
            <button
              onClick={handleCreateDuel}
              disabled={saving || selectedOpponents.length === 0 || (wodMode === 'existing' && !selectedWodId) || (wodMode === 'custom' && (!customWodName || !customWodDesc))}
              className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-all"
            >
              {saving ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" /> : <Plus className="w-5 h-5" />}
              CRIAR DUELO
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Individual: atalho para criar duelo por código no Diário */}
      {isIndividual && (
        <div className="mx-6 mb-4 bg-surface-container rounded-3xl border border-outline-variant/10 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center flex-shrink-0">
            <Sword className="w-5 h-5 text-secondary" />
          </div>
          <p className="text-[11px] text-on-surface-variant font-bold uppercase tracking-widest leading-snug">
            Para desafiar um amigo, use o <span className="text-secondary">código de atleta</span> na tela do Diário.
          </p>
        </div>
      )}

      {/* ── Lista de duelos ── */}
      <main className="px-6 flex flex-col gap-4">
        {loading && !duels.length ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredDuels.length === 0 ? (
          <div className="bg-surface-container rounded-3xl p-12 flex flex-col items-center text-center gap-4 border border-outline-variant/10">
            <Handshake className="w-16 h-16 text-on-surface-variant/20 mb-2" />
            <p className="text-on-surface-variant font-headline font-black uppercase italic">Nenhum duelo encontrado</p>
          </div>
        ) : (
          filteredDuels.map((duel) => {
            const allParticipants = [duel.challengerId, ...duel.opponentIds];
            const isChallenger = duel.challengerId === user?.id;
            const isOpponent = duel.opponentIds.includes(user?.id || '');
            const isParticipant = isChallenger || isOpponent;
            const needsMyAcceptance = isOpponent && !duel.acceptedBy.includes(user?.id || '') && duel.status === 'pending';
            const isExpanded = expandedId === duel.id;
            const mySubmitted = Boolean(duel.results[user?.id || '']);
            const allSubmitted = allParticipants.every(id => duel.results[id]);
            const timeBased = isTimeBased(duel.wodType);
            const amrap = !timeBased && isAmrapDuel(duel.wodType);

            // Detalhamento do placar (desempenho + leituras) quando finalizado
            const duelTimeBased = isTimeBasedDuel(duel.wodType, duel.results);
            const duelRoundWeight = getRoundWeight(duel);
            const parseDuelResult = (r: string, tb: boolean) => parseResultValue(r, tb, duelRoundWeight);
            const outcome: DuelScoreOutcome | null = duel.status === 'finished' && allSubmitted
              ? computeDuelScore(
                  duel.results,
                  duel.intensity,
                  allParticipants,
                  duelTimeBased,
                  parseDuelResult,
                  getStrengthById(duel),
                )
              : null;

            // Mesmo gráfico de barras do Ranking/TV: vencedor do duelo x o
            // outro lado. Em duelo 1x1, esse outro lado é o oponente; em
            // duelo de grupo (3+ participantes), é a MÉDIA dos demais — o
            // gráfico só compara duas colunas, então não dá pra empilhar um
            // participante por barra.
            const getPhoto = (pid: string) => pid === user?.id ? (user as any).photo_url : users.find(u => u.id === pid)?.photo_url ?? null;
            const avgOf = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
            let duelSpotlight: WodSpotlightData | null = null;
            let duelSpotlightOtherName = '';
            let duelSpotlightOtherShort = '';
            if (outcome?.winnerId) {
              const winnerId = outcome.winnerId;
              const otherIds = allParticipants.filter(id => id !== winnerId);
              if (otherIds.length > 0) {
                const paceMeta = getPaceMeta(duel);
                const strengthById = getStrengthById(duel);
                const isGroup = otherIds.length > 1;

                const otherScores = otherIds.map(id => parseDuelResult(duel.results[id] || '', duelTimeBased));
                const otherPaces = paceMeta
                  ? otherIds.map(id => computeRepsPerMinute(duel.results[id] || '', paceMeta)).filter((p): p is number => p != null)
                  : [];
                const otherStrengths = otherIds.map(id => strengthById[id]).filter((s): s is number => s != null);
                // Esforço só entra se TODOS registraram a FC — mesma regra do
                // placar (outcome.usedIntensity), para não comparar quem tem
                // sensor com quem não tem.
                const otherEfforts = outcome.usedIntensity
                  ? otherIds.map(id => outcome.entries[id]?.effort).filter((e): e is number => e != null)
                  : [];

                duelSpotlightOtherName = isGroup ? 'Média dos Oponentes' : getUserName(otherIds[0]);
                duelSpotlightOtherShort = isGroup ? 'MÉDIA' : getUserName(otherIds[0]).split(' ')[0].toUpperCase();

                duelSpotlight = {
                  athlete: { id: winnerId, name: getUserName(winnerId), photoUrl: getPhoto(winnerId) },
                  wodName: duel.wodName || '',
                  wodType: duel.wodType || '',
                  athleteCount: allParticipants.length,
                  timeBased: duelTimeBased,
                  leaderResult: duel.results[winnerId] || '',
                  leaderScore: parseDuelResult(duel.results[winnerId] || '', duelTimeBased),
                  avgScore: avgOf(otherScores),
                  leaderPace: paceMeta ? computeRepsPerMinute(duel.results[winnerId] || '', paceMeta) : null,
                  avgPace: otherPaces.length ? avgOf(otherPaces) : null,
                  leaderStrength: strengthById[winnerId] ?? null,
                  avgStrength: otherStrengths.length ? avgOf(otherStrengths) : null,
                  leaderHr: outcome.usedIntensity ? outcome.entries[winnerId]?.effort ?? null : null,
                  avgHr: otherEfforts.length ? avgOf(otherEfforts) : null,
                  hrMeta: {
                    label: 'Esforço (FC)',
                    unit: '% da FC máx',
                    betterWord: 'menos esforço',
                    worseWord: 'mais esforço',
                  },
                };
              }
            }

            return (
              <motion.div
                key={duel.id}
                layout
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'bg-surface-container rounded-3xl p-5 border border-outline-variant/10 transition-all flex flex-col gap-4',
                  isExpanded && 'ring-2 ring-primary/20 bg-surface-container-high',
                )}
              >
                {/* Cabeçalho do card */}
                <div className="flex justify-between items-start">
                  <span className={cn(
                    'text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border',
                    duel.status === 'active' ? 'bg-primary/20 text-primary border-primary/30'
                      : duel.status === 'finished' ? 'bg-outline-variant/20 text-on-surface-variant border-outline-variant/30'
                      : 'bg-secondary/20 text-secondary border-secondary/30'
                  )}>
                    {duel.status === 'active' ? 'ATIVO' : duel.status === 'finished' ? 'FINALIZADO' : 'PENDENTE'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setExpandedId(isExpanded ? null : duel.id)}>
                      <ChevronDown className={cn('w-4 h-4 text-on-surface-variant transition-transform', isExpanded && 'rotate-180')} />
                    </button>
                  </div>
                </div>

                {/* WOD info */}
                {duel.wodName && (
                  <div className="bg-surface-container-highest/40 rounded-2xl px-4 py-3 flex items-center gap-3">
                    {timeBased
                      ? <Timer className="w-4 h-4 text-primary flex-shrink-0" />
                      : <Hash className="w-4 h-4 text-primary flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-headline font-black text-on-surface uppercase italic">{duel.wodName}</p>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">
                        {duel.wodType} • {duel.category}
                        {timeBased ? ' • Menor tempo vence' : amrap ? ' • Mais rounds + reps vence' : ' • Maior resultado vence'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Detalhes do WOD expansíveis */}
                <AnimatePresence>
                  {isExpanded && duel.wodRx && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-surface-container-highest/30 rounded-2xl px-4 py-3 border border-outline-variant/10"
                    >
                      <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">{duel.category}</p>
                      <p className="text-sm text-on-surface font-medium leading-relaxed whitespace-pre-wrap">{duel.wodRx}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Avatares VS */}
                <div className="flex items-center justify-between gap-4">
                  {allParticipants.map((pid, i) => {
                    const photoUrl = pid === user?.id ? (user as any).photo_url : users.find(u => u.id === pid)?.photo_url;
                    return (
                    <React.Fragment key={pid}>
                      {i > 0 && (
                        <span className="text-on-surface-variant font-headline font-black text-sm italic opacity-40">VS</span>
                      )}
                      <div className="flex flex-col items-center gap-1">
                        <div className={cn(
                          'w-10 h-10 rounded-full border-2 bg-surface-container-highest flex items-center justify-center font-headline font-black text-base transition-colors overflow-hidden',
                          pid === duel.challengerId ? 'border-secondary' : 'border-primary'
                        )}>
                          {photoUrl ? (
                            <AthletePhoto
                              photoUrl={photoUrl}
                              name={getUserName(pid)}
                              size="sm"
                              ringColor="border-none"
                              className="w-full h-full border-none shadow-none rounded-full"
                            />
                          ) : (
                            <AvatarPreview
                              equipped={(pid === user?.id ? user?.avatar?.equipped : users.find(u => u.id === pid)?.avatar_equipped) || {} as AvatarSlot}
                              size="sm"
                              className="w-full h-full border-none shadow-none"
                            />
                          )}
                        </div>
                        <span className="text-[9px] font-bold text-on-surface uppercase italic truncate max-w-[56px]">
                          {pid === user?.id ? 'VOCÊ' : getUserName(pid).split(' ')[0]}
                        </span>
                      </div>
                    </React.Fragment>
                    );
                  })}
                </div>

                {/* Resultados */}
                {(duel.status === 'active' || duel.status === 'finished') && (
                  <div className="flex flex-col gap-1">
                    {allParticipants.map(pid => {
                      const visible = getVisibleResult(duel, pid);
                      const isWinner = duel.status === 'finished' && duel.winnerId === pid;
                      const isTieFinished = duel.status === 'finished' && duel.winnerId === null;
                      const entry = outcome?.usedIntensity ? outcome.entries[pid] : null;
                      // Ritmo próprio: quem informou os números do WOD vê o
                      // seu reps/min mesmo sem Premium. Comparar o ritmo com o
                      // do adversário continua sendo do recap (Premium no
                      // individual) — aqui cada um só enxerga o de si.
                      const myPace = pid === user?.id && visible !== 'Aguardando'
                        ? computeRepsPerMinute(duel.results[pid] || '', getPaceMeta(duel) || {})
                        : null;
                      return (
                        <div key={pid} className={cn(
                          'px-3 py-2 rounded-xl',
                          isWinner ? 'bg-primary/10 border border-primary/20'
                            : isTieFinished ? 'bg-secondary/10 border border-secondary/20'
                            : 'bg-surface-container-highest/30'
                        )}>
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-on-surface uppercase italic">
                              {getUserName(pid)}
                              {isWinner && ' 🏆'}
                              {isTieFinished && ' 🤝'}
                            </span>
                            <span className={cn(
                              'text-[11px] font-black italic',
                              visible === 'Aguardando' ? 'text-on-surface-variant' : 'text-primary'
                            )}>
                              {visible}
                            </span>
                          </div>
                          {myPace != null && (
                            <p className="text-[9px] font-black uppercase tracking-widest text-on-surface-variant/70 mt-0.5">
                              Seu ritmo: {myPace.toFixed(1)} reps/min
                            </p>
                          )}
                          {entry && (
                            <div className="flex items-center gap-2 mt-1 text-[9px] font-black uppercase tracking-widest text-on-surface-variant/80">
                              <span className="text-secondary">❤️ {entry.effort}% FC máx</span>
                              <span className="ml-auto text-on-surface">Placar {entry.total}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* Desempate aparece pra todo mundo, não só no recap
                        Premium: sem isso o card mostra dois resultados
                        idênticos e um vencedor, sem explicar o porquê. */}
                    {outcome?.tiebreak && (
                      <p className="text-[9px] text-secondary font-black uppercase tracking-widest text-center mt-1 italic">
                        🤝 Mesmo resultado — desempate por {outcome.tiebreak === 'effort' ? 'menor esforço (FC)' : 'força relativa (carga ÷ peso)'}
                      </p>
                    )}
                    {outcome?.usedIntensity && (
                      <p className="text-[9px] text-on-surface-variant/70 font-bold uppercase tracking-widest text-center mt-1 italic">
                        Placar = desempenho. A FC entra como leitura de esforço
                      </p>
                    )}
                    {duel.status === 'active' && !allSubmitted && (
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest text-center mt-1 italic">
                        Resultados revelados quando todos enviarem
                      </p>
                    )}
                    {duel.status === 'finished' && duel.winnerId === null && (
                      <p className="text-[10px] text-secondary font-bold uppercase tracking-widest text-center mt-1 italic">
                        Empate — apostas devolvidas
                      </p>
                    )}
                  </div>
                )}

                {/* Recap pós-duelo: por que o vencedor levou a melhor — Premium no individual */}
                {duel.status === 'finished' && outcome && outcome.winnerId && (
                  canSeeComparison ? (
                    <div className="flex flex-col gap-2">
                      {duelSpotlight && (
                        <WodSpotlightChart
                          variant="mobile"
                          data={duelSpotlight}
                          comparisonName={duelSpotlightOtherName}
                          comparisonShortName={duelSpotlightOtherShort}
                          badgeLabel="Vencedor do Duelo"
                        />
                      )}
                      <DuelRecapCard
                        wodName={duel.wodName}
                        wodType={duel.wodType}
                        outcome={outcome}
                        participants={allParticipants.map(pid => ({ id: pid, name: getUserName(pid) }))}
                        results={duel.results}
                        paceMeta={getPaceMeta(duel)}
                        strengthById={getStrengthById(duel)}
                      />
                      <div className="flex justify-end">
                        <ShareDuelButton
                          wodName={duel.wodName}
                          wodType={duel.wodType}
                          outcome={outcome}
                          participants={allParticipants.map(pid => ({ id: pid, name: getUserName(pid) }))}
                          results={duel.results}
                          paceMeta={getPaceMeta(duel)}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="bg-secondary/5 border border-secondary/20 rounded-2xl px-4 py-3 flex items-center gap-2">
                        <span className="text-sm">🔒</span>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest leading-snug">
                          <span className="text-secondary">Premium:</span> veja o resumo completo — desempenho, esforço, ritmo e por que {duel.winnerId === user?.id ? 'você' : 'ele'} venceu
                        </p>
                      </div>
                      <PremiumCTA />
                    </div>
                  )
                )}

                {/* Aposta */}
                {duel.betAmount > 0 && (
                  <div className="pt-2 border-t border-outline-variant/5 flex justify-between items-center">
                    <div className="flex items-center gap-1 text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                      {duel.betType === 'xp' ? <Zap className="w-3 h-3 text-primary" /> : <span>🪙</span>}
                      Aposta: {duel.betAmount} {duel.betType.toUpperCase()} cada
                    </div>
                    {duel.betCanceledAt && (
                      <span className="text-[10px] text-error font-black uppercase">Devolvido</span>
                    )}
                  </div>
                )}

                {/* Pendente: oponente aceita/recusa */}
                {needsMyAcceptance && (
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => handleAccept(duel.id)}
                      disabled={saving}
                      className="flex-1 bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(202,253,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                      ACEITAR <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleCancel(duel.id)}
                      disabled={saving}
                      className="flex-1 bg-error-container text-on-error-container py-4 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 border-2 border-error/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                      RECUSAR <X className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* Pendente: desafiante aguarda */}
                {duel.status === 'pending' && isChallenger && (
                  <div className="flex flex-col gap-3">
                    <div className="bg-surface-container-highest/30 rounded-2xl p-4 border border-outline-variant/10">
                      <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">Aguardando:</p>
                      <p className="text-center text-xs font-headline font-black text-on-surface uppercase italic">
                        {duel.opponentIds.filter(id => !duel.acceptedBy.includes(id)).map(id => getUserName(id)).join(', ')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCancel(duel.id)}
                      disabled={saving}
                      className="w-full bg-error-container/10 text-error py-3 rounded-2xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2 border-2 border-error/20 hover:bg-error-container/20 transition-all disabled:opacity-50"
                    >
                      CANCELAR DESAFIO <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Ativo: submeter resultado */}
                {duel.status === 'active' && isParticipant && !mySubmitted && (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex gap-2">
                      {timeBased ? (
                        <div className="flex-1">
                          <TimeInput
                            value={submission[duel.id] || ''}
                            onChange={v => setSubmission(prev => ({ ...prev, [duel.id]: v }))}
                          />
                        </div>
                      ) : amrap ? (
                        // AMRAP: rounds + reps, como o atleta lê no whiteboard —
                        // e o mesmo formato do placar/ranking.
                        <div className="flex-1">
                          <AmrapInput
                            compact
                            value={submission[duel.id] || ''}
                            onChange={v => setSubmission(prev => ({ ...prev, [duel.id]: v }))}
                            repsPerRound={getPaceMeta(duel)?.repsPerRound}
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          placeholder="Resultado (ex: 150 reps)"
                          value={submission[duel.id] || ''}
                          onChange={e => setSubmission(prev => ({ ...prev, [duel.id]: e.target.value }))}
                          className="flex-1 bg-surface-container-highest rounded-2xl px-4 py-3 text-sm font-bold text-on-surface outline-none"
                        />
                      )}
                      <button
                        onClick={() => handleSubmitResult(duel)}
                        disabled={
                          saving
                          || !submission[duel.id]?.trim()
                          || (timeBased && parseTimeToSeconds(submission[duel.id]?.trim() || '') == null)
                          || (amrap && !AMRAP_FORMAT.test(submission[duel.id]?.trim() || ''))
                        }
                        className="bg-primary text-background px-5 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center gap-2 disabled:opacity-40 hover:opacity-90 transition-all"
                      >
                        {saving ? <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Esforço opcional: % da FC máx */}
                    <div className="flex items-center gap-2 bg-surface-container-highest/40 rounded-2xl px-4 py-2.5 border border-outline-variant/10">
                      <span className="text-secondary text-sm">❤️</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder={todayPct ? `Esforço hoje: ${Math.round(todayPct)}%` : 'Esforço % FC máx (opcional)'}
                        value={submissionIntensity[duel.id] ?? ''}
                        onChange={e => setSubmissionIntensity(prev => ({ ...prev, [duel.id]: e.target.value }))}
                        className="flex-1 bg-transparent text-sm font-bold text-on-surface outline-none placeholder:text-on-surface-variant/40 placeholder:font-medium placeholder:normal-case"
                      />
                      <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">% FC máx</span>
                    </div>
                    {/* Carga opcional: vira força relativa (carga ÷ peso corporal) */}
                    <div className="flex items-center gap-2 bg-surface-container-highest/40 rounded-2xl px-4 py-2.5 border border-outline-variant/10">
                      <span className="text-secondary text-sm">🏋️</span>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        placeholder="Carga usada (opcional)"
                        value={submissionLoad[duel.id] ?? ''}
                        onChange={e => setSubmissionLoad(prev => ({ ...prev, [duel.id]: e.target.value }))}
                        className="flex-1 bg-transparent text-sm font-bold text-on-surface outline-none placeholder:text-on-surface-variant/40 placeholder:font-medium placeholder:normal-case"
                      />
                      <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest">kg</span>
                    </div>
                    <p className="text-[9px] text-on-surface-variant/70 font-bold uppercase tracking-widest leading-snug px-1">
                      Quem vence é o resultado. A FC e a carga não pontuam: mostram com quanto
                      esforço e com quanto do próprio peso cada um chegou lá.
                    </p>
                  </div>
                )}

                {/* Ativo: já enviou */}
                {duel.status === 'active' && isParticipant && mySubmitted && !allSubmitted && (
                  <p className="text-center text-[10px] text-primary font-black uppercase tracking-widest">
                    ✓ Resultado enviado — aguardando os outros
                  </p>
                )}

                {/* Ativo: cancelar */}
                {duel.status === 'active' && isParticipant && (
                  <button
                    onClick={() => handleCancel(duel.id)}
                    disabled={saving}
                    className="w-full bg-transparent text-on-surface-variant/40 py-3 rounded-xl font-headline font-black text-[10px] uppercase italic flex items-center justify-center gap-2 border border-outline-variant/10 hover:text-error hover:border-error/30 transition-all disabled:opacity-50"
                  >
                    DESISTIR / CANCELAR <X className="w-3 h-3" />
                  </button>
                )}
              </motion.div>
            );
          })
        )}
      </main>

      {/* FAB (conta de box cria duelo aqui; individual cria pelo código no Diário) */}
      {!isIndividual && (
        <button
          onClick={() => setShowCreate(s => !s)}
          className="fixed bottom-28 right-6 w-14 h-14 bg-primary text-background rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
        >
          {showCreate ? <X className="w-6 h-6" strokeWidth={3} /> : <Plus className="w-6 h-6" strokeWidth={3} />}
        </button>
      )}
    </div>
  );
}

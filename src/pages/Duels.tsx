import React, { useState, useEffect, useMemo } from 'react';
import { 
  Swords, 
  Trophy, 
  Plus, 
  ChevronDown, 
  Check, 
  X, 
  Clock, 
  Gamepad2, 
  Flame, 
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import motion from 'motion/react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { createNotification, requestNotificationPermission } from '../hooks/useNotifications';
import AvatarPreview from '../components/AvatarPreview';
import { AvatarSlot } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  name: string;
  xp: number;
  level: number;
  avatar_equipped?: AvatarSlot;
}

interface Duel {
  id: string;
  challengerId: string;
  opponentIds: string[];
  acceptedBy: string[];
  status: 'pending' | 'active' | 'finished';
  type: 'wod' | 'exercise' | 'custom';
  wodId?: string;
  exercise?: string;
  goal?: string;
  betAmount: number;
  winnerId?: string | null;
  createdAt: string;
  betCanceledAt?: string | null;
}

interface Wod {
  id: string;
  name: string;
  date: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Duels() {
  const { user } = useAuth();
  const [duels, setDuels] = useState<Duel[]>([]);
  const [wods, setWods] = useState<Wod[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Form State
  const [duelType, setDuelType] = useState<'wod' | 'exercise' | 'custom'>('wod');
  const [selectedWod, setSelectedWod] = useState('');
  const [exercise, setExercise] = useState('');
  const [goal, setGoal] = useState('');
  const [opponentId, setOpponentId] = useState('');
  const [betAmount, setBetAmount] = useState(10);

  useEffect(() => {
    if (user) {
      loadData();
      requestNotificationPermission();
    }
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const [loadedDuels, loadedWods, profilesRes] = await Promise.all([
        fetchDuelsFromDb(),
        fetchWodsFromDb(),
        supabase.from('profiles').select('id, name, xp, level, avatar_equipped').eq('status', 'approved').neq('id', user?.id),
      ]);
      setDuels(loadedDuels);
      setWods(loadedWods);
      if (profilesRes.data) setUsers(profilesRes.data);
    } catch (error) {
      console.error('Error loading duels data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDuelsFromDb(): Promise<Duel[]> {
    const { data, error } = await supabase
      .from('bets')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map(d => ({
      id: d.id,
      challengerId: d.challenger_id,
      opponentIds: d.opponent_ids || [],
      acceptedBy: d.accepted_by || [],
      status: d.status,
      type: d.bet_type,
      wodId: d.wod_id,
      exercise: d.exercise,
      goal: d.goal,
      betAmount: d.amount,
      winnerId: d.winner_id,
      createdAt: d.created_at,
      betCanceledAt: d.canceled_at
    }));
  }

  async function fetchWodsFromDb(): Promise<Wod[]> {
    const { data, error } = await supabase
      .from('wods')
      .select('id, name, date')
      .order('date', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    return data || [];
  }

  const handleCreateDuel = async () => {
    if (!user || loading) return;
    if (!opponentId) return alert('Selecione um oponente!');
    if (betAmount > (user.brazacoins || 0)) return alert('Você não tem Brazacoins suficientes!');

    try {
      setLoading(true);
      const { data, error } = await supabase.from('bets').insert({
        challenger_id: user.id,
        opponent_ids: [opponentId],
        bet_type: duelType,
        wod_id: duelType === 'wod' ? selectedWod : null,
        exercise: duelType === 'exercise' ? exercise : null,
        goal: duelType === 'custom' ? goal : null,
        amount: betAmount,
        status: 'pending'
      }).select().single();

      if (error) throw error;

      await createNotification(
        opponentId,
        'Novo Desafio!',
        `${user.name} te desafiou para um duelo de ${duelType === 'wod' ? 'WOD' : 'Exercício'} valendo ${betAmount} BC!`,
        'duel'
      );

      setShowCreate(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating duel:', error);
      alert('Erro ao criar desafio.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (duelId: string) => {
    if (!user || loading) return;
    const duel = duels.find(d => d.id === duelId);
    if (!duel) return;

    if (betAmount > (user.brazacoins || 0)) return alert('Você não tem Brazacoins suficientes!');

    try {
      setLoading(true);
      const newAcceptedBy = [...(duel.acceptedBy || []), user.id];
      const isAllAccepted = newAcceptedBy.length >= duel.opponentIds.length;

      const { error } = await supabase.from('bets').update({
        accepted_by: newAcceptedBy,
        status: isAllAccepted ? 'active' : 'pending'
      }).eq('id', duelId);

      if (error) throw error;

      await createNotification(
        duel.challengerId,
        'Desafio Aceito!',
        `${user.name} aceitou seu desafio! O duelo agora está ATIVO.`,
        'duel'
      );

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#CAFD00', '#FFFFFF', '#000000']
      });

      loadData();
    } catch (error) {
      console.error('Error accepting duel:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (duelId: string) => {
    if (!user || loading) return;
    if (!window.confirm('Tem certeza que deseja cancelar este duelo?')) return;

    try {
      setLoading(true);
      const { error } = await supabase.from('bets').update({
        status: 'finished',
        canceled_at: new Date().toISOString()
      }).eq('id', duelId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error canceling duel:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDuelType('wod');
    setSelectedWod('');
    setExercise('');
    setGoal('');
    setOpponentId('');
    setBetAmount(10);
  };

  const getUserName = (id: string | null) => {
    if (!id) return 'Unknown';
    if (id === user?.id) return user.name;
    return users.find(u => u.id === id)?.name || 'Atleta';
  };

  const myDuels = duels.filter(d => 
    d.challengerId === user?.id || d.opponentIds.includes(user?.id || '')
  );

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-2xl font-headline font-black text-on-surface italic tracking-tight uppercase">
            Arena de <span className="text-primary">Duelos</span>
          </h1>
          <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest opacity-60">
            Desafie outros atletas e ganhe Brazacoins
          </p>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="w-12 h-12 rounded-2xl bg-primary text-background flex items-center justify-center shadow-[0_0_20px_rgba(202,253,0,0.3)] active:scale-90 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-container-highest/30 rounded-3xl p-4 border border-outline-variant/10">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black text-on-surface-variant uppercase">Vitórias</span>
          </div>
          <p className="text-2xl font-headline font-black text-on-surface italic">
            {myDuels.filter(d => d.winnerId === user?.id).length}
          </p>
        </div>
        <div className="bg-surface-container-highest/30 rounded-3xl p-4 border border-outline-variant/10">
          <div className="flex items-center gap-2 mb-1">
            <Gamepad2 className="w-4 h-4 text-secondary" />
            <span className="text-[10px] font-black text-on-surface-variant uppercase">Ativos</span>
          </div>
          <p className="text-2xl font-headline font-black text-on-surface italic">
            {myDuels.filter(d => d.status === 'active').length}
          </p>
        </div>
      </div>

      {/* Active & Pending Duels */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black text-on-surface uppercase tracking-widest flex items-center gap-2">
            <Swords className="w-4 h-4 text-primary" /> Meus Desafios
          </h2>
        </div>

        {loading && myDuels.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4 opacity-40">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest">Carregando Arena...</p>
          </div>
        ) : myDuels.length === 0 ? (
          <div className="bg-surface-container-low rounded-3xl p-8 border border-dashed border-outline-variant/30 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-surface-container-highest flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-on-surface-variant" />
            </div>
            <div>
              <p className="text-xs font-headline font-black text-on-surface uppercase italic">Nenhum duelo encontrado</p>
              <p className="text-[9px] text-on-surface-variant font-medium mt-1">Crie um desafio agora e comece a competir!</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {myDuels.map(duel => {
              const isChallenger = duel.challengerId === user?.id;
              const isOpponent = duel.opponentIds.includes(user?.id || '');
              const needsMyAcceptance = isOpponent && !(duel.acceptedBy || []).includes(user?.id || '') && duel.status === 'pending';
              const isExpanded = expandedId === duel.id;

              return (
                <div 
                  key={duel.id}
                  className={cn(
                    "bg-surface-container-low rounded-[32px] border transition-all duration-300",
                    isExpanded ? "border-primary/40 ring-1 ring-primary/10" : "border-outline-variant/10"
                  )}
                >
                  {/* Card Header */}
                  <div className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* VS Circle */}
                      <div className="flex items-center -space-x-3">
                        {[duel.challengerId, ...duel.opponentIds].map((pid, i) => (
                          <React.Fragment key={pid}>
                            {i > 0 && <span className="text-on-surface-variant font-headline font-black text-sm italic opacity-40 z-10 px-1">VS</span>}
                            <div className={cn(
                              'w-10 h-10 rounded-full border-2 bg-surface-container-highest flex items-center justify-center font-headline font-black text-base transition-colors overflow-hidden relative shadow-lg',
                              pid === duel.challengerId ? 'border-secondary' : 'border-primary'
                            )}>
                              <AvatarPreview 
                                equipped={(pid === user?.id ? user?.avatar?.equipped : (users || []).find(u => u.id === pid)?.avatar_equipped) || {} as AvatarSlot}
                                size="sm"
                                className="w-full h-full border-none shadow-none"
                              />
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                      
                      <div className="flex flex-col">
                        <p className="text-xs font-headline font-black text-on-surface uppercase italic tracking-tight">
                          {duel.type === 'wod' ? `WOD: ${wods.find(w => w.id === duel.wodId)?.name || 'Treino'}` : (duel.exercise || duel.goal || 'Duelo Custom')}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3 text-secondary" />
                          <span className="text-[10px] font-black text-secondary uppercase italic">{duel.betAmount} BC EM JOGO</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border',
                        duel.status === 'active' ? 'bg-primary/20 text-primary border-primary/30'
                          : duel.status === 'finished' ? (
                              duel.betCanceledAt ? 'bg-error/20 text-error border-error/30' : 'bg-outline-variant/20 text-on-surface-variant border-outline-variant/30'
                            )
                            : 'bg-secondary/20 text-secondary border-secondary/30'
                      )}>
                        {duel.status === 'active' ? 'ATIVO' : duel.status === 'finished' ? (duel.betCanceledAt ? 'CANCELADO' : 'FINALIZADO') : 'PENDENTE'}
                      </span>
                      <button 
                        onClick={() => setExpandedId(isExpanded ? null : duel.id)}
                        className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center"
                      >
                        <ChevronDown className={cn('w-4 h-4 text-on-surface-variant transition-transform', isExpanded && 'rotate-180')} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="px-5 pb-5 overflow-hidden"
                    >
                      <div className="pt-4 border-t border-outline-variant/5 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">Desafiante</span>
                            <p className="text-xs font-headline font-black text-on-surface italic uppercase">{getUserName(duel.challengerId)}</p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">Oponente</span>
                            <p className="text-xs font-headline font-black text-on-surface italic uppercase">{getUserName(duel.opponentIds[0])}</p>
                          </div>
                        </div>

                        {duel.goal && (
                          <div className="bg-surface-container-highest/20 rounded-2xl p-4 border border-outline-variant/5">
                            <span className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest opacity-60 block mb-1 italic">Objetivo do Duelo</span>
                            <p className="text-xs text-on-surface leading-normal italic font-medium">"{duel.goal}"</p>
                          </div>
                        )}

                        {/* Opponent: accept / refuse */}
                        {needsMyAcceptance && (
                          <div className="flex gap-4 mt-6">
                            <button 
                              onClick={() => handleAccept(duel.id)} 
                              disabled={loading}
                              className="flex-1 bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(202,253,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all outline-none"
                            >
                              ACEITAR <Check className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleCancel(duel.id)} 
                              disabled={loading}
                              className="flex-1 bg-error-container text-on-error-container py-4 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 border-2 border-error/20 hover:scale-[1.02] active:scale-95 transition-all outline-none"
                            >
                              RECUSAR <X className="w-5 h-5" />
                            </button>
                          </div>
                        )}

                        {/* Challenger: waiting + cancel */}
                        {duel.status === 'pending' && isChallenger && !duel.betCanceledAt && (
                          <div className="flex flex-col gap-4 mt-6">
                            <div className="bg-surface-container-highest/30 rounded-2xl p-4 border border-outline-variant/10">
                              <p className="text-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest mb-1">
                                Aguardando Resposta de:
                              </p>
                              <p className="text-center text-xs font-headline font-black text-on-surface uppercase italic">
                                {(duel.opponentIds || []).filter(id => !(duel.acceptedBy || []).includes(id)).map(id => getUserName(id)).join(', ')}
                              </p>
                            </div>
                            <button 
                              onClick={() => handleCancel(duel.id)} 
                              disabled={loading}
                              className="w-full bg-error-container/10 text-error py-4 rounded-2xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2 border-2 border-error/20 hover:bg-error-container/20 transition-all outline-none"
                            >
                              CANCELAR DESAFIO <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {/* Active: cancel */}
                        {duel.status === 'active' && (isChallenger || isOpponent) && (
                          <div className="mt-6 pt-4 border-t border-outline-variant/5">
                            <button 
                              onClick={() => handleCancel(duel.id)} 
                              disabled={loading}
                              className="w-full bg-transparent text-on-surface-variant/40 py-3 rounded-xl font-headline font-black text-[10px] uppercase italic flex items-center justify-center gap-2 border border-outline-variant/10 hover:text-error hover:border-error/30 transition-all outline-none"
                            >
                              DESISTIR / CANCELAR DUELO <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        
                        {/* Finished Status */}
                        {duel.status === 'finished' && (
                          <div className="bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
                            {duel.betCanceledAt ? (
                              <div className="flex items-center gap-3 text-error">
                                <X className="w-5 h-5" />
                                <span className="text-xs font-headline font-black uppercase italic">Duelo Cancelado</span>
                              </div>
                            ) : duel.winnerId ? (
                              <div className="flex items-center gap-3 text-primary">
                                <Trophy className="w-5 h-5" />
                                <span className="text-xs font-headline font-black uppercase italic">
                                  Vencedor: {getUserName(duel.winnerId)}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Duel Creation Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-surface-container-low rounded-[40px] border border-outline-variant/20 p-8 shadow-2xl relative"
          >
            <button 
              onClick={() => setShowCreate(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center"
            >
              <X className="w-5 h-5 text-on-surface-variant" />
            </button>

            <div className="mb-8">
              <h3 className="text-xl font-headline font-black text-on-surface italic uppercase tracking-tight">Criar <span className="text-primary">Duelo</span></h3>
              <p className="text-[10px] text-on-surface-variant font-black uppercase tracking-widest opacity-60">Escolha as regras do combate</p>
            </div>

            <div className="space-y-6">
              {/* Type Selection */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'wod', icon: Clock, label: 'WOD' },
                  { id: 'exercise', icon: Flame, label: 'EXER' },
                  { id: 'custom', icon: Gamepad2, label: 'PERS' }
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => setDuelType(type.id as any)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",
                      duelType === type.id 
                        ? "bg-primary/20 border-primary text-primary" 
                        : "bg-surface-container-highest/20 border-outline-variant/10 text-on-surface-variant"
                    )}
                  >
                    <type.icon className="w-5 h-5" />
                    <span className="text-[8px] font-black uppercase tracking-widest">{type.label}</span>
                  </button>
                ))}
              </div>

              {/* Dynamic Fields */}
              <div className="space-y-4">
                {duelType === 'wod' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Selecionar WOD</label>
                    <select
                      value={selectedWod}
                      onChange={(e) => setSelectedWod(e.target.value)}
                      className="w-full bg-background border border-outline-variant/20 rounded-2xl px-5 py-4 text-xs font-headline font-black uppercase italic outline-none focus:border-primary transition-colors appearance-none"
                    >
                      <option value="">Selecione um Treino</option>
                      {wods.map(wod => (
                        <option key={wod.id} value={wod.id}>{wod.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {duelType === 'exercise' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Exercício (Ex: Burpees)</label>
                    <input
                      type="text"
                      value={exercise}
                      onChange={(e) => setExercise(e.target.value.toUpperCase())}
                      placeholder="NOME DO EXERCÍCIO"
                      className="w-full bg-background border border-outline-variant/20 rounded-2xl px-5 py-4 text-xs font-headline font-black uppercase italic outline-none focus:border-primary transition-colors"
                    />
                  </div>
                )}

                {(duelType === 'exercise' || duelType === 'custom') && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Qual o Objetivo?</label>
                    <input
                      type="text"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value.toUpperCase())}
                      placeholder="EX: MAIS REPS EM 2 MIN"
                      className="w-full bg-background border border-outline-variant/20 rounded-2xl px-5 py-4 text-xs font-headline font-black uppercase italic outline-none focus:border-primary transition-colors"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1">Oponente</label>
                  <select
                    value={opponentId}
                    onChange={(e) => setOpponentId(e.target.value)}
                    className="w-full bg-background border border-outline-variant/20 rounded-2xl px-5 py-4 text-xs font-headline font-black uppercase italic outline-none focus:border-primary transition-colors appearance-none"
                  >
                    <option value="">Desafiar Alguém</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest ml-1 flex justify-between">
                    Aposta: <span>{betAmount} BC</span>
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={betAmount}
                    onChange={(e) => setBetAmount(Number(e.target.value))}
                    className="w-full accent-primary bg-surface-container-highest h-1.5 rounded-full appearance-none outline-none"
                  />
                  <div className="flex justify-between text-[8px] font-black text-on-surface-variant/40 uppercase tracking-tighter">
                    <span>10 BC</span>
                    <span>250 BC</span>
                    <span>500 BC</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateDuel}
                disabled={loading}
                className="w-full bg-primary text-background py-5 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(202,253,0,0.2)] active:scale-95 transition-all mt-4 disabled:opacity-50"
              >
                {loading ? 'DESAFIANDO...' : 'LANÇAR DESAFIO'} <Swords className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

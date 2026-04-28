import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Users, 
  Plus, 
  Search, 
  Filter, 
  ChevronDown, 
  Handshake, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Sword,
  Target,
  Zap,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import AvatarPreview from '../components/AvatarPreview';
import { AvatarSlot } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Duel {
  id: string;
  challengerId: string;
  opponentIds: string[];
  acceptedBy: string[];
  betAmount: number;
  betType: 'xp' | 'coins';
  status: 'pending' | 'active' | 'finished';
  winnerId?: string;
  createdAt: string;
  updatedAt: string;
  betCanceledAt?: string;
}

interface UserProfile {
  id: string;
  name: string;
  xp: number;
  level: number;
  avatar_equipped?: any;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Duels() {
  const { user } = useAuth();
  const [duels, setDuels] = useState<Duel[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'mine' | 'pending'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [duelsRes, usersRes] = await Promise.all([
        supabase.from('duels').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, name, xp, level, avatar_equipped').eq('status', 'approved').neq('id', user.id)
      ]);

      if (duelsRes.data) setDuels(duelsRes.data.map((d: any) => ({
        id: d.id,
        challengerId: d.challenger_id,
        opponentIds: d.opponent_ids ?? [],
        acceptedBy: d.accepted_by ?? [],
        status: d.status,
        exerciseId: d.exercise_id,
        betCoins: d.bet_coins,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        betCanceledAt: d.bet_canceled_at,
      })));
      if (usersRes.data) setUsers(usersRes.data);
    } catch (err) {
      console.error('Error loading duels data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (duelId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const duel = duels.find(d => d.id === duelId);
      if (!duel) return;

      const newAcceptedBy = [...(duel.acceptedBy || []), user.id];
      const isFull = newAcceptedBy.length === duel.opponentIds.length;

      const { error } = await supabase
        .from('duels')
        .update({
          accepted_by: newAcceptedBy,
          status: isFull ? 'active' : 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', duelId);

      if (!error) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#CAFD00', '#ffffff', '#000000']
        });
        loadData();
      }
    } catch (err) {
      console.error('Error accepting duel:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (duelId: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('duels')
        .update({
          status: 'finished',
          bet_canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', duelId);

      if (!error) {
        loadData();
      }
    } catch (err) {
      console.error('Error canceling duel:', err);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (id: string) => {
    if (id === user?.id) return 'Você';
    return users.find(u => u.id === id)?.name || 'Atleta';
  };

  const filteredDuels = duels.filter(d => {
    if (activeTab === 'mine') return d.challengerId === user?.id || d.opponentIds.includes(user?.id || '');
    if (activeTab === 'pending') return d.status === 'pending' && (d.opponentIds.includes(user?.id || '') && !(d.acceptedBy || []).includes(user?.id || ''));
    return true;
  });

  return (
    <div className="min-h-screen bg-background pb-24">
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
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sword className="w-6 h-6 text-primary" />
          </div>
        </div>

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

      {/* Main Content */}
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
            const isChallenger = duel.challengerId === user?.id;
            const isOpponent = duel.opponentIds.includes(user?.id || '');
            const needsMyAcceptance = isOpponent && !(duel.acceptedBy || []).includes(user?.id || '') && duel.status === 'pending';
            const isExpanded = expandedId === duel.id;

            return (
              <div 
                key={duel.id}
                className={cn(
                  "bg-surface-container rounded-3xl p-5 border border-outline-variant/10 transition-all",
                  isExpanded && "ring-2 ring-primary/20 bg-surface-container-high"
                )}
              >
                <div className="flex justify-between items-start mb-4">
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
                  <button onClick={() => setExpandedId(isExpanded ? null : duel.id)}>
                    <ChevronDown className={cn('w-4 h-4 text-on-surface-variant transition-transform', isExpanded && 'rotate-180')} />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-4">
                  {[duel.challengerId, ...duel.opponentIds].map((pid, i) => (
                    <React.Fragment key={pid}>
                      {i > 0 && <span className="text-on-surface-variant font-headline font-black text-sm italic opacity-40">VS</span>}
                      <div className="flex flex-col items-center gap-1">
                        <div className={cn(
                          'w-10 h-10 rounded-full border-2 bg-surface-container-highest flex items-center justify-center font-headline font-black text-base transition-colors overflow-hidden',
                          pid === duel.challengerId ? 'border-secondary' : 'border-primary'
                        )}>
                          <AvatarPreview 
                            equipped={(pid === user?.id ? user?.avatar?.equipped : (users || []).find(u => u.id === pid)?.avatar_equipped) || {} as AvatarSlot}
                            size="sm"
                            className="w-full h-full border-none shadow-none"
                          />
                        </div>
                        <span className="text-[9px] font-bold text-on-surface uppercase italic truncate max-w-[56px]">
                          {pid === user?.id ? 'VOCÊ' : getUserName(pid).split(' ')[0]}
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-outline-variant/5 flex justify-between items-center text-[10px] text-on-surface-variant font-black uppercase tracking-widest">
                  <div className="flex items-center gap-1">
                    <Handshake className="w-3 h-3 text-primary" />
                    <span>Aposta: {duel.betAmount} {duel.betType}</span>
                  </div>
                  <span>{new Date(duel.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Opponent: accept / refuse */}
                {needsMyAcceptance && (
                  <div className="flex gap-4 mt-6">
                    <button 
                      onClick={() => handleAccept(duel.id)} 
                      disabled={loading}
                      className="flex-1 bg-primary text-background py-4 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(202,253,0,0.2)] hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      ACEITAR <Check className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleCancel(duel.id)} 
                      disabled={loading}
                      className="flex-1 bg-error-container text-on-error-container py-4 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 border-2 border-error/20 hover:scale-[1.02] active:scale-95 transition-all"
                    >
                      RECUSAR <X className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* Challenger: waiting + cancel */}
                {duel.status === 'pending' && isChallenger && (
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
                      className="w-full bg-error-container/10 text-error py-4 rounded-2xl font-headline font-black text-xs uppercase italic flex items-center justify-center gap-2 border-2 border-error/20 hover:bg-error-container/20 transition-all"
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
                      className="w-full bg-transparent text-on-surface-variant/40 py-3 rounded-xl font-headline font-black text-[10px] uppercase italic flex items-center justify-center gap-2 border border-outline-variant/10 hover:text-error hover:border-error/30 transition-all"
                    >
                      DESISTIR / CANCELAR DUELO <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      <button className="fixed bottom-28 right-6 w-14 h-14 bg-primary text-background rounded-2xl shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
        <Plus className="w-6 h-6" strokeWidth={3} />
      </button>
    </div>
  );
}

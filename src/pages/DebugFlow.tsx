import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { addReward } from '../utils/rewards';
import { CheckCircle2, XCircle, Play, Loader2 } from 'lucide-react';

export default function DebugFlow() {
  const { user, updateUser } = useAuth();
  const [results, setResults] = useState<{ step: string; status: 'pending' | 'success' | 'error'; message?: string }[]>([
    { step: 'Autenticação', status: 'pending' },
    { step: 'Check-in & Recompensa', status: 'pending' },
    { step: 'Compra na Loja', status: 'pending' },
    { step: 'Criação de Duelo', status: 'pending' },
  ]);
  const [loading, setLoading] = useState(false);

  const updateStep = (index: number, status: 'success' | 'error', message?: string) => {
    setResults(prev => prev.map((r, i) => i === index ? { ...r, status, message } : r));
  };

  const runTest = async () => {
    if (!user) {
      updateStep(0, 'error', 'Usuário não autenticado');
      return;
    }
    setLoading(true);
    updateStep(0, 'success', `Autenticado como: ${user.name}`);

    try {
      // Step 1: Check-in & Reward
      const { error: checkinError } = await supabase.from('checkins').insert({
        user_id: user.id,
        date: new Date().toISOString(),
        location_ok: true
      });
      if (checkinError) throw new Error(`Erro no Check-in: ${checkinError.message}`);

      const rewardResult = await addReward(user.id, 'checkin', 10, 5, 'Teste de Fluxo: Check-in');
      if (!rewardResult) throw new Error('Falha ao processar recompensa');
      updateStep(1, 'success', 'Check-in realizado e +10 XP / +5 BC concedidos');

      // Step 2: Shop Purchase (Simulated)
      // We'll try to find a cheap item or just simulate the deduction
      const { data: items } = await supabase.from('items').select('*').limit(1);
      if (items && items.length > 0) {
        const item = items[0];
        const { error: buyError } = await supabase.from('profiles').update({
          coins: user.coins - 1, // Deduct 1 for test
          avatar_inventory: [...(user.avatar?.inventory || []), item.id]
        }).eq('id', user.id);
        
        if (buyError) throw new Error(`Erro na Compra: ${buyError.message}`);
        updateStep(2, 'success', `Item "${item.name}" adicionado ao inventário (simulado)`);
      } else {
        updateStep(2, 'success', 'Nenhum item na loja para testar, pulando...');
      }

      // Step 3: Duel Creation
      const { error: duelError } = await supabase.from('duels').insert({
        challenger_id: user.id,
        opponent_id: user.id, // Duel with self for test
        type: 'AMRAP',
        reward_xp: 50,
        reward_coins: 20,
        status: 'pending'
      });
      if (duelError) throw new Error(`Erro no Duelo: ${duelError.message}`);
      updateStep(3, 'success', 'Duelo de teste criado com sucesso');

      // Refresh user profile to show persistence
      const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const { data: updatedCheckins } = await supabase.from('checkins').select('*').eq('user_id', user.id);
      if (updatedProfile) {
        updateUser({
          ...updatedProfile,
          avatar: { equipped: updatedProfile.avatar_equipped, inventory: updatedProfile.avatar_inventory },
          checkins: (updatedCheckins || []).map((c: any) => ({ date: c.date, timestamp: c.timestamp, classTime: c.class_time })),
          paidBonuses: updatedProfile.paid_bonuses || []
        });
      }

    } catch (err: any) {
      console.error(err);
      // Find the first pending step and mark it as error
      const firstPending = results.findIndex(r => r.status === 'pending');
      if (firstPending !== -1) updateStep(firstPending, 'error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-headline font-black italic text-primary uppercase">Diagnóstico de Fluxo</h1>
        <p className="text-on-surface-variant text-sm uppercase font-bold tracking-widest">Validação de Persistência Supabase</p>
      </div>

      <div className="bg-surface-container-low rounded-[2.5rem] border border-outline-variant/10 p-8 space-y-6">
        {results.map((res, i) => (
          <div key={i} className="flex items-center justify-between p-4 bg-surface-container-highest/30 rounded-2xl border border-outline-variant/5">
            <div className="flex items-center gap-4">
              {res.status === 'pending' && <div className="w-6 h-6 rounded-full border-2 border-outline-variant/30" />}
              {res.status === 'success' && <CheckCircle2 className="w-6 h-6 text-primary" />}
              {res.status === 'error' && <XCircle className="w-6 h-6 text-error" />}
              <div>
                <p className="font-headline font-bold text-on-surface uppercase italic">{res.step}</p>
                {res.message && <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">{res.message}</p>}
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={runTest}
          disabled={loading}
          className="w-full bg-primary text-background py-6 rounded-3xl font-headline font-black uppercase italic shadow-lg flex items-center justify-center gap-3 hover:scale-[1.02] transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
          {loading ? 'EXECUTANDO TESTES...' : 'INICIAR TESTE DE FLUXO'}
        </button>
      </div>

      <div className="bg-primary/10 p-6 rounded-3xl border border-primary/20">
        <p className="text-[10px] text-primary font-bold uppercase tracking-widest leading-relaxed">
          Nota: Este teste realiza operações reais no banco de dados para validar a persistência. 
          Certifique-se de estar logado antes de iniciar.
        </p>
      </div>
    </div>
  );
}

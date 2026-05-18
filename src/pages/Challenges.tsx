import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Zap, CheckCircle2, History, Trophy, Camera, X, Upload, Calendar, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { Challenge } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { compressImage } from '../utils/image';
import { createNotification } from '../hooks/useNotifications';
import { addReward } from '../utils/rewards';

// Toast inline — sem alert(), sem reload necessário
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'info' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 text-sm font-bold max-w-xs w-full',
        type === 'success' && 'bg-primary text-background',
        type === 'info'    && 'bg-surface-container-highest text-on-surface border border-outline-variant/20',
        type === 'error'   && 'bg-error text-on-error',
      )}
    >
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100"><X className="w-4 h-4" /></button>
    </motion.div>
  );
}

export default function Challenges() {
  const { user, updateUser } = useAuth();
  const [challenges, setChallenges]   = useState<Challenge[]>([]);
  const [history, setHistory]         = useState<any[]>([]);
  const [checkins, setCheckins]       = useState<any[]>([]);
  const [progressData, setProgressData] = useState<any[]>([]); // NOVO: para desafios acumulativos
  const [activeTab, setActiveTab]     = useState<'active' | 'history'>('active');
  const [loading, setLoading]         = useState<string | null>(null);
  const [photoModal, setPhotoModal]   = useState<{ challenge: Challenge } | null>(null);
  const [photoFile, setPhotoFile]     = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [progressModal, setProgressModal] = useState<{ challenge: Challenge } | null>(null); // NOVO
  const [progressValue, setProgressValue] = useState<string>(''); // NOVO
  const [toast, setToast]             = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToast({ message, type });
  }, []);

  const fetchData = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: challengesData } = await supabase.from('challenges').select('*').eq('active', true)
      .or(`end_date.is.null,end_date.gte.${today}`);
    if (challengesData) setChallenges(challengesData);

    if (user) {
      const { data: historyData } = await supabase
        .from('reward_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'challenge')
        .order('created_at', { ascending: false });
      if (historyData) setHistory(historyData);

      const { data: checkinsData } = await supabase
        .from('challenge_checkins')
        .select('*')
        .eq('user_id', user.id);
      if (checkinsData) setCheckins(checkinsData);

      // NOVO: buscar progresso acumulativo
      const { data: progressDataFromDb } = await supabase
        .from('challenge_progress')
        .select('*')
        .eq('user_id', user.id);
      if (progressDataFromDb) setProgressData(progressDataFromDb);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ========== LÓGICA DE CÁLCULO ==========
  const getDaysCompleted = (challengeId: string) =>
    checkins.filter(c => c.challenge_id === challengeId).length;

  const checkedInToday = (challengeId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return checkins.some(c =>
      c.challenge_id === challengeId &&
      (c.checkin_date === today || c.created_at?.startsWith(today))
    );
  };

  const getTotalProgress = (challengeId: string) => {
    return progressData
      .filter(p => p.challenge_id === challengeId)
      .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);
  };

  const getProgressToday = (challengeId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const todayProgress = progressData.find(p =>
      p.challenge_id === challengeId &&
      p.progress_date === today
    );
    return todayProgress?.quantity || 0;
  };

  const isRewardClaimed = (challengeId: string) =>
    history.some(h => h.challenge_id === challengeId);

  // ========== SUBMISSÃO DE DADOS ==========
  const handleDayOk = async (challenge: Challenge) => {
    if (!user || loading) return;
    if (checkedInToday(challenge.id)) {
      showToast('Você já marcou o OK de hoje para este desafio!', 'info');
      return;
    }
    if (challenge.require_photo) {
      setPhotoModal({ challenge });
      return;
    }
    await submitDayOk(challenge, null);
  };

  const submitDayOk = async (challenge: Challenge, photoUrl: string | null) => {
    if (!user) return;
    setLoading(challenge.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('challenge_checkins').insert({
        user_id: user.id,
        challenge_id: challenge.id,
        photo_url: photoUrl,
        checkin_date: today,
      });
      if (error) throw error;

      await fetchData(); // Atualiza tudo

      const daysNow      = getDaysCompleted(challenge.id) + 1;
      const requiredDays = challenge.required_days || 1;

      if (daysNow >= requiredDays && !isRewardClaimed(challenge.id)) {
        await grantReward(challenge);
      } else {
        const remaining = requiredDays - daysNow;
        showToast(
          remaining > 0
            ? `✓ OK marcado! Faltam ${remaining} dia${remaining !== 1 ? 's' : ''} para concluir.`
            : '✓ OK marcado!',
          'info'
        );
      }
    } catch (e: any) {
      console.error(e);
      showToast('Erro ao registrar: ' + (e.message || 'Erro desconhecido'), 'error');
    } finally {
      setLoading(null);
    }
  };

  const submitProgress = async (challenge: Challenge) => {
    if (!user || !progressValue || isNaN(parseFloat(progressValue))) {
      showToast('Digite uma quantidade válida!', 'error');
      return;
    }

    setLoading(challenge.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      const quantity = parseFloat(progressValue);

      const existingProgress = progressData.find(p =>
        p.challenge_id === challenge.id &&
        p.progress_date === today
      );

      if (existingProgress) {
        const { error } = await supabase
          .from('challenge_progress')
          .update({ quantity: Number(existingProgress.quantity) + quantity })
          .eq('id', existingProgress.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('challenge_progress').insert({
          user_id: user.id,
          challenge_id: challenge.id,
          progress_date: today,
          quantity: quantity,
        });
        if (error) throw error;
      }

      await fetchData();

      const newTotal = getTotalProgress(challenge.id) + (existingProgress ? 0 : quantity);
      const targetValue = challenge.target_value || 0;

      if (newTotal >= targetValue && !isRewardClaimed(challenge.id)) {
        await grantReward(challenge);
      } else {
        showToast(`✓ Progresso registrado! ${newTotal}/${targetValue} ${challenge.unit}`, 'success');
      }

      setProgressModal(null);
      setProgressValue('');
    } catch (e: any) {
      console.error(e);
      showToast('Erro ao registrar progresso: ' + (e.message || 'Erro desconhecido'), 'error');
    } finally {
      setLoading(null);
    }
  };

  const grantReward = async (challenge: Challenge) => {
    if (!user) return;
    const rewardResult = await addReward(
      user.id, 'challenge',
      challenge.xp, challenge.coins,
      `Desafio: ${challenge.title}`,
      challenge.id
    );
    if (rewardResult) {
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      updateUser({
        ...user,
        xp:    rewardResult.newXp,
        coins: rewardResult.newCoins,
        level: rewardResult.newLevel,
      });
      await fetchData();
      await createNotification(
        user.id, 'challenge_done',
        '🏆 Desafio concluído!',
        `Você completou "${challenge.title}" e ganhou +${challenge.xp} XP e +${challenge.coins} BC!`,
        { challenge_id: challenge.id }
      );
      showToast(`🏆 Desafio concluído! +${challenge.xp} XP e +${challenge.coins} BC!`, 'success');
    }
  };

  // ========== HANDLERS DE UI ==========
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePhotoSubmit = async () => {
    if (!photoModal || !user) return;
    if (photoModal.challenge.require_photo && !photoFile) {
      showToast('Foto obrigatória!', 'error');
      return;
    }
    setLoading(photoModal.challenge.id);
    let photoUrl: string | null = null;
    if (photoFile) {
      const compressed = await compressImage(photoFile, 1200, 1200, 0.82);
      const path = `challenge-photos/${user.id}/${photoModal.challenge.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('challenge-photos').upload(path, compressed, { contentType: 'image/jpeg' });
      if (uploadError) { showToast('Erro na foto: ' + uploadError.message, 'error'); setLoading(null); return; }
      const { data: urlData } = supabase.storage.from('challenge-photos').getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    }
    const challenge = photoModal.challenge;
    setPhotoModal(null); setPhotoFile(null); setPhotoPreview(null);
    await submitDayOk(challenge, photoUrl);
  };

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <AnimatePresence>{toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}</AnimatePresence>

      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Zap className="w-8 h-8 text-secondary" /> DESAFIOS
        </h1>
      </header>

      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10">
        {(['active', 'history'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={cn("flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all", activeTab === tab ? "bg-secondary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface")}>
            {tab === 'active' ? 'ATIVOS' : 'HISTÓRICO'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'active' && (
          <motion.div key="active" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-4">
            {challenges.filter(c => c.active).map((challenge) => {
              const isAccumulative = challenge.type === 'accumulative';
              const rewardClaimed = isRewardClaimed(challenge.id);
              
              // Lógica de progresso baseada no tipo
              const totalProgress = isAccumulative ? getTotalProgress(challenge.id) : getDaysCompleted(challenge.id);
              const targetValue = isAccumulative ? (challenge.target_value || 0) : (challenge.required_days || 1);
              const isFinished = rewardClaimed || totalProgress >= targetValue;
              const progressPercent = Math.min((totalProgress / targetValue) * 100, 100);

              return (
                <div key={challenge.id} className={cn("bg-surface-container-low p-6 rounded-[2.5rem] border border-outline-variant/10 relative overflow-hidden group transition-all", isFinished && "opacity-60")}>
                  <div className="absolute top-0 right-0 p-6 flex gap-2">
                    <span className="bg-primary/20 text-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-primary/30">+{challenge.xp} XP</span>
                    <span className="bg-secondary/20 text-secondary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-secondary/30">+{challenge.coins} BC</span>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", isFinished ? "bg-primary/30" : "bg-secondary/20")}>
                      {isFinished ? <CheckCircle2 className="w-6 h-6 text-primary" /> : <Trophy className="w-6 h-6 text-secondary" />}
                    </div>
                    <div>
                      <h3 className="text-2xl font-headline font-black text-on-surface uppercase italic tracking-tighter leading-none mb-2">{challenge.title}</h3>
                      <p className="text-on-surface-variant text-sm font-medium leading-tight opacity-80">{challenge.description}</p>
                    </div>
                  </div>

                  {/* Barra de Progresso (Comum a ambos) */}
                  <div className="mt-5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-1">
                        {isAccumulative ? <Trophy className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                        {totalProgress}/{targetValue} {isAccumulative ? challenge.unit : 'dias'}
                      </span>
                      {isFinished && <span className="text-[10px] font-black text-primary uppercase tracking-widest">CONCLUÍDO!</span>}
                    </div>
                    <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                      <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} transition={{ duration: 0.5 }} />
                    </div>
                    
                    {/* Círculos apenas para desafios diários */}
                    {!isAccumulative && targetValue > 1 && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {Array.from({ length: targetValue }).map((_, i) => (
                          <div key={i} className={cn("w-7 h-7 rounded-full flex items-center justify-center border text-[9px] font-black transition-all", i < totalProgress ? "bg-primary border-primary text-background" : "bg-surface-container-highest border-outline-variant/20")}>
                            {i < totalProgress ? '✓' : i + 1}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-outline-variant/10 flex justify-between items-center">
                    <div>
                      {challenge.require_photo && <span className="flex items-center gap-1 text-[10px] text-secondary font-bold uppercase tracking-widest"><Camera className="w-3 h-3" /> Foto obrigatória</span>}
                    </div>
                    {isFinished ? (
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Recompensa recebida</span>
                    ) : (
                      <button
                        onClick={() => isAccumulative ? setProgressModal({ challenge }) : handleDayOk(challenge)}
                        disabled={!!loading || (!isAccumulative && checkedInToday(challenge.id))}
                        className={cn("flex items-center gap-2 px-5 py-3 rounded-2xl font-headline font-black text-xs uppercase tracking-widest transition-all", (!isAccumulative && checkedInToday(challenge.id)) ? "bg-primary/20 text-primary cursor-default" : "bg-secondary text-background hover:scale-105 active:scale-95 disabled:opacity-50")}
                      >
                        {loading === challenge.id ? 'AGUARDE...' : isAccumulative ? <><Plus className="w-4 h-4" /> ADICIONAR PROGRESSO</> : checkedInToday(challenge.id) ? '✓ OK DE HOJE' : 'MARCAR OK HOJE'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-3">
            {history.length > 0 ? history.map((h) => (
              <div key={h.id} className="bg-surface-container-low/50 p-5 rounded-3xl border border-outline-variant/10 flex items-center justify-between opacity-70">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center"><CheckCircle2 className="w-5 h-5 text-primary" /></div>
                  <div>
                    <p className="text-on-surface font-bold text-sm uppercase italic">{h.description}</p>
                    <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">{new Date(h.created_at).toLocaleDateString('pt-BR')} • {new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-primary font-headline font-black text-xs">+{h.xp} XP</p>
                  <p className="text-secondary font-headline font-black text-[10px]">+{h.coins} BC</p>
                </div>
              </div>
            )) : <div className="text-center p-12 opacity-20"><History className="w-12 h-12 mx-auto mb-4" /><p className="font-bold uppercase">Histórico vazio</p></div>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modais */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
      
      <AnimatePresence>
        {photoModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4" onClick={(e) => e.target === e.currentTarget && setPhotoModal(null)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="bg-surface-container-low rounded-[2rem] p-6 w-full max-w-md space-y-5">
              <div className="flex justify-between items-center"><h3 className="font-headline font-black text-lg uppercase italic">Enviar Foto</h3><button onClick={() => setPhotoModal(null)}><X /></button></div>
              <div className="aspect-video bg-surface-container-highest rounded-2xl flex items-center justify-center cursor-pointer overflow-hidden" onClick={() => fileInputRef.current?.click()}>
                {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" /> : <Camera className="opacity-40" />}
              </div>
              <button onClick={handlePhotoSubmit} disabled={!!loading} className="w-full bg-primary text-background py-4 rounded-2xl font-black uppercase italic">{loading ? 'ENVIANDO...' : 'CONFIRMAR'}</button>
            </motion.div>
          </div>
        )}

        {progressModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4" onClick={(e) => e.target === e.currentTarget && setProgressModal(null)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="bg-surface-container-low rounded-[2rem] p-6 w-full max-w-md space-y-5">
              <div className="flex justify-between items-center"><h3 className="font-headline font-black text-lg uppercase italic">Progresso</h3><button onClick={() => setProgressModal(null)}><X /></button></div>
              <p className="text-sm opacity-70">Quantos {progressModal.challenge.unit} você fez hoje?</p>
              <input type="number" value={progressValue} onChange={(e) => setProgressValue(e.target.value)} placeholder="Ex: 500" className="w-full px-4 py-3 rounded-xl bg-surface-container-highest text-on-surface focus:outline-none" autoFocus />
              <button onClick={() => submitProgress(progressModal.challenge)} disabled={!!loading} className="w-full bg-primary text-background py-4 rounded-2xl font-black uppercase italic">{loading ? 'REGISTRANDO...' : 'REGISTRAR'}</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

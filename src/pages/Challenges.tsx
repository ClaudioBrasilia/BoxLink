import { useState, useEffect, useRef } from 'react';
import { Zap, CheckCircle2, History, Trophy, Camera, X, Upload, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { Challenge, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { supabase } from '../lib/supabase';
import { addReward } from '../utils/rewards';

export default function Challenges() {
  const { user, updateUser } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [loading, setLoading] = useState<string | null>(null);
  const [photoModal, setPhotoModal] = useState<{ challenge: Challenge } | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const { data: challengesData } = await supabase.from('challenges').select('*').eq('active', true);
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
    }
  };

  useEffect(() => { fetchData(); }, [user?.id]);

  const getDaysCompleted = (challengeId: string) =>
    checkins.filter(c => c.challenge_id === challengeId).length;

  const checkedInToday = (challengeId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return checkins.some(c => c.challenge_id === challengeId && c.created_at?.startsWith(today));
  };

  const isRewardClaimed = (challengeId: string) =>
    history.some(h => h.challenge_id === challengeId);

  const handleDayOk = async (challenge: Challenge) => {
    if (!user || loading) return;
    if (checkedInToday(challenge.id)) {
      alert('Você já marcou o OK de hoje para este desafio!');
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
      const { error } = await supabase.from('challenge_checkins').insert({
        user_id: user.id,
        challenge_id: challenge.id,
        photo_url: photoUrl,
      });
      if (error) throw error;

      const newCheckins = [...checkins, {
        user_id: user.id,
        challenge_id: challenge.id,
        photo_url: photoUrl,
        created_at: new Date().toISOString()
      }];
      setCheckins(newCheckins);

      const daysNow = newCheckins.filter(c => c.challenge_id === challenge.id).length;
      const requiredDays = challenge.required_days || 1;

      if (daysNow >= requiredDays && !isRewardClaimed(challenge.id)) {
        const rewardResult = await addReward(user.id, 'challenge', challenge.xp, challenge.coins, `Desafio: ${challenge.title}`, challenge.id);
        if (rewardResult && !(rewardResult as any).duplicate) {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
          if ((rewardResult as any).levelUp) {
            setTimeout(() => confetti({ particleCount: 250, spread: 110, origin: { y: 0.5 }, colors: ['#CAFD00', '#FFFFFF'] }), 600);
          }
          const { data: updatedProfile } = await supabase.from('profiles').select('*, checkins(*)').eq('id', user.id).single();
          if (updatedProfile) {
            const mappedUser: User = {
              ...updatedProfile,
              avatar: { equipped: updatedProfile.avatar_equipped, inventory: updatedProfile.avatar_inventory },
              checkins: updatedProfile.checkins || [],
              paidBonuses: updatedProfile.paid_bonuses || []
            };
            updateUser(mappedUser);
          }
          alert(`Desafio concluído! +${challenge.xp} XP e +${challenge.coins} BC!`);
          fetchData();
        }
      } else {
        const remaining = requiredDays - daysNow;
        alert(`OK marcado! Faltam ${remaining} dia${remaining !== 1 ? 's' : ''} para completar o desafio.`);
      }
    } catch (e: any) {
      console.error(e);
      alert('Erro ao registrar OK: ' + (e.message || 'Erro desconhecido'));
    } finally {
      setLoading(null);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePhotoSubmit = async () => {
    if (!photoModal || !user) return;
    setLoading(photoModal.challenge.id);
    let photoUrl: string | null = null;

    if (photoFile) {
      const ext = photoFile.name.split('.').pop();
      const path = `challenge-photos/${user.id}/${photoModal.challenge.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('challenge-photos').upload(path, photoFile);
      if (uploadError) {
        alert('Erro ao enviar foto: ' + uploadError.message);
        setLoading(null);
        return;
      }
      const { data: urlData } = supabase.storage.from('challenge-photos').getPublicUrl(path);
      photoUrl = urlData.publicUrl;
    }

    const challenge = photoModal.challenge;
    setPhotoModal(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    await submitDayOk(challenge, photoUrl);
  };

  return (
    <div className="flex flex-col gap-6 p-4 pt-8 min-h-screen bg-background">
      <header className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-black text-on-surface tracking-tight uppercase italic flex items-center gap-3">
          <Zap className="w-8 h-8 text-secondary" />
          DESAFIOS
        </h1>
      </header>

      <div className="flex bg-surface-container-low p-1 rounded-2xl border border-outline-variant/10">
        {(['active', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-3 rounded-xl font-headline font-bold text-[10px] uppercase tracking-widest transition-all",
              activeTab === tab ? "bg-secondary text-background shadow-lg" : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {tab === 'active' ? 'ATIVOS' : 'HISTÓRICO'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'active' && (
          <motion.div key="active" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-4">
            {challenges.filter(c => c.active).map((challenge) => {
              const requiredDays = challenge.required_days || 1;
              const daysCompleted = getDaysCompleted(challenge.id);
              const todayDone = checkedInToday(challenge.id);
              const rewardClaimed = isRewardClaimed(challenge.id);
              const isFinished = rewardClaimed || daysCompleted >= requiredDays;
              const progress = Math.min(daysCompleted / requiredDays, 1);

              return (
                <div key={challenge.id} className={cn(
                  "bg-surface-container-low p-6 rounded-[2.5rem] border border-outline-variant/10 relative overflow-hidden group transition-all",
                  isFinished && "opacity-60"
                )}>
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

                  {requiredDays > 1 && (
                    <div className="mt-5">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {daysCompleted}/{requiredDays} dias
                        </span>
                        {isFinished && <span className="text-[10px] font-black text-primary uppercase tracking-widest">CONCLUÍDO!</span>}
                      </div>
                      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress * 100}%` }} />
                      </div>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {Array.from({ length: requiredDays }).map((_, i) => (
                          <div key={i} className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center border text-[9px] font-black transition-all",
                            i < daysCompleted
                              ? "bg-primary border-primary text-background"
                              : "bg-surface-container-highest border-outline-variant/20 text-on-surface-variant"
                          )}>
                            {i < daysCompleted ? '✓' : i + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 pt-6 border-t border-outline-variant/10 flex justify-between items-center">
                    <div>
                      {challenge.require_photo && (
                        <span className="flex items-center gap-1 text-[10px] text-secondary font-bold uppercase tracking-widest">
                          <Camera className="w-3 h-3" /> Foto obrigatória
                        </span>
                      )}
                    </div>
                    {isFinished ? (
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Recompensa recebida
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDayOk(challenge)}
                        disabled={!!loading || todayDone}
                        className={cn(
                          "flex items-center gap-2 px-5 py-3 rounded-2xl font-headline font-black text-xs uppercase tracking-widest transition-all",
                          todayDone
                            ? "bg-primary/20 text-primary cursor-default"
                            : "bg-secondary text-background hover:scale-105 active:scale-95 disabled:opacity-50"
                        )}
                      >
                        {loading === challenge.id
                          ? 'AGUARDE...'
                          : todayDone
                            ? '✓ OK DE HOJE MARCADO'
                            : challenge.require_photo
                              ? <><Camera className="w-4 h-4" /> ENVIAR FOTO</>
                              : 'MARCAR OK HOJE'
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {challenges.filter(c => c.active).length === 0 && (
              <div className="bg-surface-container-low p-12 rounded-3xl border border-outline-variant/10 text-center flex flex-col items-center gap-4">
                <Trophy className="w-12 h-12 text-on-surface-variant opacity-20" />
                <p className="text-on-surface-variant font-headline font-bold uppercase italic tracking-widest">Nenhum desafio ativo</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="flex flex-col gap-3">
            {history.length > 0 ? history.map((h) => (
              <div key={h.id} className="bg-surface-container-low/50 p-5 rounded-3xl border border-outline-variant/10 flex items-center justify-between opacity-70">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-on-surface font-bold text-sm uppercase italic">{h.description}</p>
                    <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-widest">
                      {new Date(h.created_at).toLocaleDateString('pt-BR')} • {new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-primary font-headline font-black text-xs">+{h.xp} XP</p>
                  <p className="text-secondary font-headline font-black text-[10px]">+{h.coins} BC</p>
                </div>
              </div>
            )) : (
              <div className="bg-surface-container-low p-12 rounded-3xl border border-outline-variant/10 text-center flex flex-col items-center gap-4">
                <History className="w-12 h-12 text-on-surface-variant opacity-20" />
                <p className="text-on-surface-variant font-headline font-bold uppercase italic tracking-widest">Nenhum histórico encontrado</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Foto */}
      <AnimatePresence>
        {photoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setPhotoModal(null); setPhotoFile(null); setPhotoPreview(null); } }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-surface-container-low rounded-[2rem] p-6 w-full max-w-md space-y-5 border border-outline-variant/10"
            >
              <div className="flex justify-between items-center">
                <h3 className="font-headline font-black text-lg text-on-surface uppercase italic">Enviar Foto</h3>
                <button onClick={() => { setPhotoModal(null); setPhotoFile(null); setPhotoPreview(null); }} className="p-2 rounded-xl bg-surface-container-highest text-on-surface-variant">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-on-surface-variant text-sm">{photoModal.challenge.title}</p>
              <div
                className="relative w-full aspect-video bg-surface-container-highest rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer border-2 border-dashed border-outline-variant/30 hover:border-primary/50 transition-all overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview
                  ? <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  : <>
                      <Camera className="w-10 h-10 text-on-surface-variant opacity-40" />
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Toque para adicionar foto</span>
                    </>
                }
                <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
              </div>
              <button
                onClick={handlePhotoSubmit}
                disabled={!!loading}
                className="w-full bg-primary text-background py-4 rounded-2xl font-headline font-black uppercase italic flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Upload className="w-5 h-5" />
                {loading ? 'ENVIANDO...' : 'CONFIRMAR OK DO DIA'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

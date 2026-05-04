import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Trophy, Users, CheckCircle2, ArrowRight, Swords, Star } from 'lucide-react';
import { cn } from '../lib/utils';

const SLIDES = [
  {
    icon: Star,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10 border-primary/20',
    title: 'Bem-vindo ao BoxLink!',
    subtitle: 'Seu box na palma da mão',
    body: 'Acompanhe treinos, compete com amigos, suba no ranking e ganhe recompensas por cada esforço.',
    cta: 'Vamos lá',
  },
  {
    icon: Zap,
    iconColor: 'text-secondary',
    iconBg: 'bg-secondary/10 border-secondary/20',
    title: 'Ganhe XP e BrazaCoins',
    subtitle: 'Cada treino vale pontos',
    body: 'Faça check-in, complete desafios e vença duelos para acumular XP, subir de nível e ganhar BrazaCoins para gastar na loja do avatar.',
    cta: 'Que demais!',
  },
  {
    icon: Users,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10 border-primary/20',
    title: 'Feed e Desafios',
    subtitle: 'Interaja com a comunidade',
    body: 'Veja os posts da galera no Feed, complete desafios com foto e dispute o topo do Ranking com seus colegas de box.',
    cta: 'Entendi!',
  },
  {
    icon: Trophy,
    iconColor: 'text-secondary',
    iconBg: 'bg-secondary/10 border-secondary/20',
    title: 'Tudo pronto!',
    subtitle: 'Hora de treinar',
    body: 'Explore o WOD de hoje, crie seu avatar personalizado e desafie alguém para um duelo. Bora!',
    cta: 'COMEÇAR',
  },
];

// Mini preview cards mostrados em cada slide
const PREVIEWS: Record<number, React.ReactNode> = {
  0: (
    <div className="flex flex-col gap-2">
      {[
        { icon: CheckCircle2, label: 'Check-in no box',   color: 'text-primary',   bg: 'bg-primary/10'   },
        { icon: Zap,          label: 'WOD de hoje',       color: 'text-secondary', bg: 'bg-secondary/10' },
        { icon: Swords,       label: 'Duelos ativos',     color: 'text-primary',   bg: 'bg-primary/10'   },
        { icon: Trophy,       label: 'Ranking ao vivo',   color: 'text-secondary', bg: 'bg-secondary/10' },
      ].map(({ icon: Icon, label, color, bg }) => (
        <div key={label} className="flex items-center gap-3 bg-surface-container-highest/50 rounded-2xl px-4 py-3 border border-outline-variant/10">
          <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', bg)}>
            <Icon className={cn('w-4 h-4', color)} />
          </div>
          <span className="text-xs font-bold text-on-surface uppercase tracking-widest">{label}</span>
          <ArrowRight className="w-3 h-3 text-on-surface-variant ml-auto" />
        </div>
      ))}
    </div>
  ),
  1: (
    <div className="flex flex-col gap-3">
      <div className="bg-surface-container-highest/50 rounded-2xl p-4 border border-outline-variant/10">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Seu progresso</span>
          <span className="text-[10px] font-black text-primary">NÍVEL 3</span>
        </div>
        <div className="w-full h-2 bg-surface-container-low rounded-full overflow-hidden mb-3">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '65%' }}
            transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-primary rounded-full"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-primary/10 rounded-xl p-3 border border-primary/20 text-center">
            <p className="text-lg font-black text-primary">1.240</p>
            <p className="text-[9px] text-primary/70 font-bold uppercase tracking-widest">XP total</p>
          </div>
          <div className="flex-1 bg-secondary/10 rounded-xl p-3 border border-secondary/20 text-center">
            <p className="text-lg font-black text-secondary">380</p>
            <p className="text-[9px] text-secondary/70 font-bold uppercase tracking-widest">BrazaCoins</p>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        {['+50 XP check-in', '+100 XP desafio', '+200 XP duelo'].map(t => (
          <span key={t} className="flex-1 text-center text-[9px] font-black bg-surface-container-highest/50 rounded-xl py-2 px-1 border border-outline-variant/10 text-on-surface-variant uppercase">
            {t}
          </span>
        ))}
      </div>
    </div>
  ),
  2: (
    <div className="flex flex-col gap-2">
      {/* Mini feed card */}
      <div className="bg-surface-container-highest/50 rounded-2xl p-3 border border-outline-variant/10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">JC</div>
          <div>
            <p className="text-[10px] font-black text-on-surface uppercase">João Costa</p>
            <p className="text-[9px] text-on-surface-variant">Desafio 30 dias · +50 XP</p>
          </div>
        </div>
        <div className="h-16 rounded-xl bg-surface-container-low flex items-center justify-center border border-outline-variant/10">
          <span className="text-[9px] text-on-surface-variant font-bold uppercase">📸 Foto do desafio</span>
        </div>
        <div className="flex gap-3 mt-2">
          <span className="text-[9px] text-on-surface-variant">❤️ 12</span>
          <span className="text-[9px] text-on-surface-variant">💬 3</span>
        </div>
      </div>
      {/* Mini ranking */}
      <div className="bg-surface-container-highest/50 rounded-2xl p-3 border border-outline-variant/10 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-primary" />
        <div className="flex-1">
          <p className="text-[10px] font-black text-on-surface uppercase">Ranking do mês</p>
          <div className="flex gap-1 mt-1">
            {['🥇 Ana', '🥈 Pedro', '🥉 Você'].map(n => (
              <span key={n} className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">{n}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
  3: (
    <div className="flex flex-col gap-3 items-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
        className="w-24 h-24 rounded-full bg-primary/10 border-4 border-primary/30 flex items-center justify-center"
      >
        <Trophy className="w-12 h-12 text-primary" />
      </motion.div>
      <div className="flex gap-2">
        {['WOD', 'Feed', 'Duelos', 'Ranking', 'Avatar', 'Loja'].map((label, i) => (
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            className="text-[9px] font-black bg-surface-container-highest/50 text-on-surface-variant px-2 py-1 rounded-full border border-outline-variant/10 uppercase"
          >
            {label}
          </motion.span>
        ))}
      </div>
      <p className="text-[10px] text-on-surface-variant text-center font-bold uppercase tracking-widest">
        Tudo ao alcance de um toque
      </p>
    </div>
  ),
};

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep]         = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

  const slide = SLIDES[step];
  const Icon  = slide.icon;
  const isLast = step === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      onComplete();
      return;
    }
    setDirection(1);
    setStep(s => s + 1);
  };

  const goBack = () => {
    if (step === 0) return;
    setDirection(-1);
    setStep(s => s - 1);
  };

  const goTo = (i: number) => {
    setDirection(i > step ? 1 : -1);
    setStep(i);
  };

  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-background flex flex-col"
    >
      {/* Skip */}
      <div className="flex justify-end p-4 pt-6">
        <button
          onClick={onComplete}
          className="text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:text-on-surface transition-colors"
        >
          Pular
        </button>
      </div>

      {/* Slide content */}
      <div className="flex-1 flex flex-col px-6 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="flex flex-col gap-6 h-full"
          >
            {/* Icon */}
            <div className="flex justify-center pt-2">
              <div className={cn('w-20 h-20 rounded-3xl border-2 flex items-center justify-center', slide.iconBg)}>
                <Icon className={cn('w-10 h-10', slide.iconColor)} />
              </div>
            </div>

            {/* Text */}
            <div className="text-center">
              <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-[0.2em] mb-2">
                {slide.subtitle}
              </p>
              <h2 className="text-2xl font-headline font-black text-on-surface uppercase italic leading-tight mb-3">
                {slide.title}
              </h2>
              <p className="text-sm text-on-surface-variant leading-relaxed max-w-xs mx-auto">
                {slide.body}
              </p>
            </div>

            {/* Preview card */}
            <div className="flex-1 flex flex-col justify-center">
              {PREVIEWS[step]}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-6 flex flex-col gap-5">
        {/* Dots */}
        <div className="flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-outline-variant/40'
              )}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={goBack}
              className="flex-1 py-4 rounded-2xl border border-outline-variant/20 text-on-surface-variant font-headline font-black text-sm uppercase italic hover:border-primary/30 transition-all"
            >
              Voltar
            </button>
          )}
          <button
            onClick={goNext}
            className={cn(
              'py-4 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 transition-all',
              isLast
                ? 'flex-1 bg-primary text-background shadow-[0_0_30px_rgba(202,253,0,0.3)] hover:scale-[1.02] active:scale-[0.98]'
                : 'flex-1 bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
            )}
          >
            {slide.cta}
            {!isLast && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

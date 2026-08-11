import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Trophy, Users, CheckCircle2, ArrowRight, Swords, Star, Flame, Dumbbell, Send, ShoppingBag } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';
import { isIndividualApp } from '../lib/appMode';

interface Slide {
  icon: typeof Star;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  body: string;
  cta: string;
  preview: React.ReactNode;
}

/** Linha de item usada nos previews de "o que tem no app". */
const PreviewRow = ({ icon: Icon, label, color, bg }: { icon: typeof Star; label: string; color: string; bg: string }) => (
  <div className="flex items-center gap-3 bg-surface-container-highest/50 rounded-2xl px-4 py-3 border border-outline-variant/10">
    <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', bg)}>
      <Icon className={cn('w-4 h-4', color)} />
    </div>
    <span className="text-xs font-bold text-on-surface uppercase tracking-widest">{label}</span>
    <ArrowRight className="w-3 h-3 text-on-surface-variant ml-auto" />
  </div>
);

const BOX_SLIDES: Slide[] = [
  {
    icon: Star,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10 border-primary/20',
    title: 'Bem-vindo ao BoxLink!',
    subtitle: 'Seu box na palma da mão',
    body: 'Acompanhe treinos, compete com amigos, suba no ranking e ganhe recompensas por cada esforço.',
    cta: 'Vamos lá',
    preview: (
      <div className="flex flex-col gap-2">
        <PreviewRow icon={CheckCircle2} label="Check-in no box"  color="text-primary"   bg="bg-primary/10" />
        <PreviewRow icon={Zap}          label="WOD de hoje"      color="text-secondary" bg="bg-secondary/10" />
        <PreviewRow icon={Swords}       label="Duelos ativos"    color="text-primary"   bg="bg-primary/10" />
        <PreviewRow icon={Trophy}       label="Ranking ao vivo"  color="text-secondary" bg="bg-secondary/10" />
      </div>
    ),
  },
  {
    icon: Zap,
    iconColor: 'text-secondary',
    iconBg: 'bg-secondary/10 border-secondary/20',
    title: 'Ganhe XP e BrazaCoins',
    subtitle: 'Cada treino vale pontos',
    body: 'Faça check-in, complete desafios e vença duelos para acumular XP, subir de nível e ganhar BrazaCoins para gastar na loja do avatar.',
    cta: 'Que demais!',
    preview: (
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
  },
  {
    icon: Users,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10 border-primary/20',
    title: 'Feed e Desafios',
    subtitle: 'Interaja com a comunidade',
    body: 'Veja os posts da galera no Feed, complete desafios com foto e dispute o topo do Ranking com seus colegas de box.',
    cta: 'Entendi!',
    preview: (
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
  },
  {
    icon: Trophy,
    iconColor: 'text-secondary',
    iconBg: 'bg-secondary/10 border-secondary/20',
    title: 'Tudo pronto!',
    subtitle: 'Hora de treinar',
    body: 'Explore o WOD de hoje, crie seu avatar personalizado e desafie alguém para um duelo. Bora!',
    cta: 'COMEÇAR',
    preview: (
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
  },
];

/**
 * Onboarding do atleta individual (BoxLeague).
 *
 * O do box não serve aqui: ele fala de check-in na academia, Feed e ranking
 * "dos colegas de box" — coisas que não existem neste app. O individual
 * precisa aprender outra mecânica, e principalmente a que não é óbvia: quem
 * dá o check-in do dia é o treino registrado, não um botão de presença.
 */
const INDIVIDUAL_SLIDES: Slide[] = [
  {
    icon: Star,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10 border-primary/20',
    title: 'Bem-vindo ao BoxLeague!',
    subtitle: 'Seu treino, suas regras',
    body: 'Sem grade de aula e sem depender de academia: você registra o que treinou, ganha pontos por consistência e compete com quem quiser.',
    cta: 'Vamos lá',
    preview: (
      <div className="flex flex-col gap-2">
        <PreviewRow icon={Send}   label="Postar o WOD"      color="text-primary"   bg="bg-primary/10" />
        <PreviewRow icon={Flame}  label="Check-in solo"     color="text-secondary" bg="bg-secondary/10" />
        <PreviewRow icon={Swords} label="Duelo por código"  color="text-primary"   bg="bg-primary/10" />
        <PreviewRow icon={Trophy} label="Liga do mês"       color="text-secondary" bg="bg-secondary/10" />
      </div>
    ),
  },
  {
    icon: Send,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10 border-primary/20',
    title: 'Registrar o treino é o check-in',
    subtitle: 'O botão POSTAR WOD',
    body: 'O primeiro treino que você registrar no dia vale seu check-in: +XP e +BrazaCoins na hora, com bônus ao fechar 3, 4, 5 ou 6 treinos na semana.',
    cta: 'Entendi!',
    preview: (
      <div className="flex flex-col gap-3">
        <div className="bg-primary text-background rounded-2xl py-4 flex items-center justify-center gap-2 font-headline font-black uppercase italic text-sm">
          Postar WOD <Send className="w-4 h-4" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-surface-container-highest/50 rounded-2xl p-3 border border-outline-variant/10 flex items-center gap-2">
            <Flame className="w-5 h-5 text-secondary" />
            <div>
              <p className="text-lg font-black text-on-surface italic leading-none">5</p>
              <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">Dias seguidos</p>
            </div>
          </div>
          <div className="flex-1 bg-surface-container-highest/50 rounded-2xl p-3 border border-outline-variant/10 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xs font-black text-on-surface italic uppercase leading-tight">Treino feito</p>
              <p className="text-[9px] text-on-surface-variant font-black uppercase tracking-widest">Hoje</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {['+50 XP treino', '+bônus semanal', '🔥 streak'].map(t => (
            <span key={t} className="flex-1 text-center text-[9px] font-black bg-surface-container-highest/50 rounded-xl py-2 px-1 border border-outline-variant/10 text-on-surface-variant uppercase">
              {t}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: Swords,
    iconColor: 'text-secondary',
    iconBg: 'bg-secondary/10 border-secondary/20',
    title: 'Desafie pelo seu código',
    subtitle: 'Duelo à distância',
    body: 'Você tem um código de atleta só seu. Mande para um amigo e duelem mesmo treinando em cidades e horários diferentes: cada um registra o resultado quando treinar.',
    cta: 'Boa!',
    preview: (
      <div className="flex flex-col gap-3">
        <div className="bg-surface-container-highest/50 rounded-2xl p-4 border border-outline-variant/10 text-center">
          <p className="text-[9px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Seu código de atleta</p>
          <p className="text-xl font-headline font-black text-primary italic tracking-[0.2em]">KX3M-9RUV</p>
          <p className="text-[9px] text-on-surface-variant mt-1">Compartilhe no WhatsApp</p>
        </div>
        <div className="bg-surface-container-highest/50 rounded-2xl p-3 border border-outline-variant/10 flex items-center gap-3">
          <Swords className="w-4 h-4 text-secondary shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] font-black text-on-surface uppercase">Fran · Você × Ana</p>
            <p className="text-[9px] text-on-surface-variant">Ela treina de manhã, você à noite</p>
          </div>
          <span className="text-[9px] font-black text-primary uppercase">Em andamento</span>
        </div>
      </div>
    ),
  },
  {
    icon: Trophy,
    iconColor: 'text-secondary',
    iconBg: 'bg-secondary/10 border-secondary/20',
    title: 'Liga, PRs e avatar',
    subtitle: 'Para onde vão seus pontos',
    body: 'Bateu a carga máxima em Força? O app registra o PR sozinho. O XP do mês te posiciona na Liga, e as BrazaCoins compram peças do seu avatar na loja.',
    cta: 'Show!',
    preview: (
      <div className="flex flex-col gap-2">
        <div className="bg-surface-container-highest/50 rounded-2xl p-3 border border-outline-variant/10 flex items-center gap-3">
          <Dumbbell className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] font-black text-on-surface uppercase">Novo PR · Back Squat</p>
            <p className="text-[9px] text-on-surface-variant">120 kg — registrado automaticamente</p>
          </div>
        </div>
        <div className="bg-surface-container-highest/50 rounded-2xl p-3 border border-outline-variant/10 flex items-center gap-3">
          <Trophy className="w-4 h-4 text-secondary shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] font-black text-on-surface uppercase">Liga do mês</p>
            <p className="text-[9px] text-on-surface-variant">Quanto mais XP no mês, melhor sua posição</p>
          </div>
        </div>
        <div className="bg-surface-container-highest/50 rounded-2xl p-3 border border-outline-variant/10 flex items-center gap-3">
          <ShoppingBag className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] font-black text-on-surface uppercase">Loja do avatar</p>
            <p className="text-[9px] text-on-surface-variant">Gaste suas BrazaCoins em roupas e itens</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: CheckCircle2,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10 border-primary/20',
    title: 'Comece pelos primeiros passos',
    subtitle: 'Tudo pronto',
    body: 'Na tela Início ficou um checklist com os 4 primeiros passos. Faça o primeiro agora: toque em POSTAR WOD e registre o treino de hoje.',
    cta: 'COMEÇAR',
    preview: (
      <div className="flex flex-col gap-2">
        {[
          'Registre seu primeiro treino',
          'Monte seu avatar',
          'Chame um amigo pro duelo',
          'Entre na Liga do mês',
        ].map((label, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="flex items-center gap-3 bg-surface-container-highest/50 rounded-2xl px-4 py-3 border border-outline-variant/10"
          >
            <div className="w-5 h-5 rounded-full border-2 border-outline-variant/40 shrink-0" />
            <span className="text-[10px] font-black text-on-surface uppercase tracking-widest">{label}</span>
          </motion.div>
        ))}
      </div>
    ),
  },
];

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useAuth();
  const [step, setStep]         = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

  // No build do individual o menu já é sempre o dele; a conta só confirma o
  // caso de um individual abrindo o app do box.
  const slides = isIndividualApp || user?.accountType === 'individual' ? INDIVIDUAL_SLIDES : BOX_SLIDES;

  const slide = slides[step];
  const Icon  = slide.icon;
  const isLast = step === slides.length - 1;

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
              {slide.preview}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-6 flex flex-col gap-5">
        {/* Dots */}
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
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

import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Send, Shirt, Swords, Trophy, X, Compass } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';

/**
 * Checklist dos primeiros passos do atleta individual.
 *
 * O onboarding em slides passa uma vez e some; quem entra pela primeira vez
 * ainda cai numa Início cheia de coisa sem saber por onde começar. Este card
 * fica na tela guiando as quatro ações que ensinam a mecânica do app na
 * prática — registrar treino (que é o check-in), montar o avatar (para onde
 * vão as moedas), chamar um amigo (o duelo por código) e entrar na Liga.
 *
 * Cada passo é lido do dado real, nunca de um "já cliquei": quem já registrou
 * treino em outro aparelho abre o app com o passo concluído. Some sozinho
 * quando os quatro estão feitos.
 */

interface FirstStepsProps {
  /** Já registrou pelo menos um treino no diário. */
  hasFirstLog: boolean;
  /** Já equipou alguma peça no avatar (além do visual inicial). */
  hasAvatar: boolean;
  /** Já tem amigo salvo ou duelo em aberto. */
  hasFriend: boolean;
  /** Já pontuou no mês e por isso aparece na Liga. */
  inLeague: boolean;
  /** Abre o formulário de registro do WOD (mesma ação do botão POSTAR WOD). */
  onPostWod: () => void;
  /** Abre a área de duelo por código de amigo. */
  onOpenFriends: () => void;
}

const DISMISS_KEY = 'boxleague_first_steps_dismissed';

/** Se o atleta fechou o card na mão. Some sozinho quando tudo é concluído, então
 *  guardar só no aparelho é suficiente — no máximo ele reaparece uma vez em um
 *  celular novo, e nesse caso já vai estar quase todo preenchido. */
const wasDismissed = () => {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

export default function FirstSteps({
  hasFirstLog, hasAvatar, hasFriend, inLeague, onPostWod, onOpenFriends,
}: FirstStepsProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(wasDismissed);

  const steps = [
    {
      id: 'log',
      icon: Send,
      label: 'Registre seu primeiro treino',
      hint: 'É ele que vale o check-in do dia: +XP e +BrazaCoins na hora.',
      done: hasFirstLog,
      action: 'Postar WOD',
      onAction: onPostWod,
    },
    {
      id: 'avatar',
      icon: Shirt,
      label: 'Monte seu avatar',
      hint: 'As BrazaCoins que você ganha treinando compram roupas e itens.',
      done: hasAvatar,
      action: 'Abrir avatar',
      onAction: () => navigate('/avatar'),
    },
    {
      id: 'friend',
      icon: Swords,
      label: 'Chame um amigo pro duelo',
      hint: 'Mande seu código de atleta: dá pra duelar treinando em horários diferentes.',
      done: hasFriend,
      action: 'Ver meu código',
      onAction: onOpenFriends,
    },
    {
      id: 'liga',
      icon: Trophy,
      label: 'Entre na Liga do mês',
      hint: 'O XP que você ganha no mês define sua posição entre os atletas.',
      done: inLeague,
      action: 'Ver a Liga',
      onAction: () => navigate('/liga'),
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  // Concluiu tudo (ou fechou na mão): o card já cumpriu o papel dele.
  if (doneCount === steps.length || dismissed) return null;

  const nextStep = steps.find(s => !s.done)!;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* modo privado: só não lembra */ }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-container-low rounded-3xl border border-primary/20 overflow-hidden"
    >
      <div className="p-4 pb-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
          <Compass className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[11px] font-black text-on-surface uppercase tracking-widest italic">Primeiros passos</h3>
          <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-widest">
            {doneCount} de {steps.length} concluídos
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="p-2 -mr-1 text-on-surface-variant hover:text-on-surface transition-colors"
          aria-label="Dispensar os primeiros passos"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progresso */}
      <div className="px-4">
        <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(doneCount / steps.length) * 100}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-primary rounded-full"
          />
        </div>
      </div>

      <div className="p-4 pt-3 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {steps.map(step => {
            const Icon = step.icon;
            const isNext = step.id === nextStep.id;
            return (
              <motion.button
                key={step.id}
                layout
                onClick={step.done ? undefined : step.onAction}
                disabled={step.done}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-3 border text-left transition-all',
                  step.done
                    ? 'bg-surface-container-highest/30 border-outline-variant/10 opacity-60'
                    : isNext
                      ? 'bg-primary/10 border-primary/30 hover:border-primary/60'
                      : 'bg-surface-container-highest/50 border-outline-variant/10 hover:border-primary/30'
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2',
                  step.done ? 'bg-primary border-primary' : 'border-outline-variant/40'
                )}>
                  {step.done
                    ? <Check className="w-4 h-4 text-background" />
                    : <Icon className={cn('w-3.5 h-3.5', isNext ? 'text-primary' : 'text-on-surface-variant')} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'text-[10px] font-black uppercase tracking-widest leading-tight',
                    step.done ? 'text-on-surface-variant line-through' : 'text-on-surface'
                  )}>
                    {step.label}
                  </p>
                  {!step.done && (
                    <p className="text-[9px] text-on-surface-variant leading-snug mt-0.5">{step.hint}</p>
                  )}
                </div>
                {!step.done && (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={cn(
                      'text-[9px] font-black uppercase tracking-widest',
                      isNext ? 'text-primary' : 'text-on-surface-variant'
                    )}>
                      {step.action}
                    </span>
                    <ChevronRight className={cn('w-3 h-3', isNext ? 'text-primary' : 'text-on-surface-variant')} />
                  </div>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

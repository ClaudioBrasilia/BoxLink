import type { ReadinessReasonCode, ReadinessStatus } from './readiness';
import type { CrossFitWorkoutFamily } from './crossfitReadiness';

export type CrossFitSuggestionKind = 'pace' | 'scale' | 'technique' | 'mobility' | 'recovery';

export interface CrossFitSuggestionInput {
  status: ReadinessStatus;
  reasons: ReadinessReasonCode[];
  family?: CrossFitWorkoutFamily | null;
}

export interface CrossFitSuggestion {
  kind: CrossFitSuggestionKind;
  title: string;
  message: string;
  actions: string[];
}

export function buildCrossFitSuggestion(input: CrossFitSuggestionInput): CrossFitSuggestion {
  const family = input.family ?? 'unknown';
  const hasPain = input.reasons.includes('pain');

  if (input.status === 'recovery') {
    if (hasPain) {
      return {
        kind: 'recovery',
        title: 'Priorize segurança',
        message: 'Converse com o coach antes de repetir movimentos que provoquem dor.',
        actions: ['Evite treinar sobre a dor', 'Considere mobilidade ou recuperação ativa'],
      };
    }

    if (family === 'strength') {
      return {
        kind: 'recovery',
        title: 'Reduza a exigência',
        message: 'Priorize técnica e controle; evite buscar carga máxima hoje.',
        actions: ['Reduza a carga', 'Mantenha repetições com boa técnica'],
      };
    }

    return {
      kind: 'recovery',
      title: 'Recupere antes de forçar',
      message: 'Faça uma versão leve do treino ou priorize mobilidade e recuperação ativa.',
      actions: ['Reduza volume e ritmo', 'Converse com o coach sobre uma escala regenerativa'],
    };
  }

  if (input.status === 'control') {
    if (family === 'strength') {
      return {
        kind: 'scale',
        title: 'Controle a carga',
        message: 'Mantenha o foco na técnica e use uma carga moderada, sem buscar recorde.',
        actions: ['Reduza a carga se a técnica cair', 'Deixe repetições na reserva'],
      };
    }

    if (family === 'skill' || family === 'mobility') {
      return {
        kind: 'technique',
        title: 'Priorize qualidade',
        message: 'Use a sessão para praticar controle e amplitude, sem aumentar a intensidade.',
        actions: ['Reduza a complexidade se necessário', 'Faça pausas maiores entre as tentativas'],
      };
    }

    return {
      kind: 'pace',
      title: 'Ajuste o ritmo',
      message: 'Treine com controle e considere reduzir o volume ou usar uma escala moderada.',
      actions: ['Comece em ritmo sustentável', 'Reduza rounds, carga ou repetições se necessário'],
    };
  }

  if (family === 'strength') {
    return {
      kind: 'technique',
      title: 'Siga o plano com técnica',
      message: 'Você pode seguir a sessão planejada, mantendo consistência e execução sólida.',
      actions: ['Aumente a carga somente se a técnica estiver estável'],
    };
  }

  if (family === 'skill' || family === 'mobility') {
    return {
      kind: 'technique',
      title: 'Aproveite a sessão',
      message: 'Use a boa prontidão para consolidar técnica, amplitude e controle.',
      actions: ['Progrida apenas se o movimento permanecer confortável'],
    };
  }

  return {
    kind: 'pace',
    title: 'Siga o treino planejado',
    message: 'Você pode treinar normalmente; mantenha atenção ao ritmo e à resposta do corpo.',
    actions: ['Ajuste a escala se os sinais mudarem durante o WOD'],
  };
}

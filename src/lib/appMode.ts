// Qual dos dois aplicativos este build é.
//
// O modo Individual e o modo Box compartilham o MESMO backend (Supabase) de
// propósito: é isso que permite um atleta individual entrar num box levando
// XP, PRs e diário — se fossem bancos separados, "entrar no box" viraria uma
// migração de dados entre sistemas. O que muda entre os dois é só a casca:
// quais rotas existem, o menu, o cadastro e a identidade do PWA.
//
// Padrão é 'box' para não alterar o app que já está publicado; o build do
// individual liga o modo com VITE_APP_MODE=individual.

export type AppMode = 'box' | 'individual';

export const APP_MODE: AppMode =
  (import.meta.env.VITE_APP_MODE as AppMode) === 'individual' ? 'individual' : 'box';

/** Build do app do atleta individual (sem as telas do box). */
export const isIndividualApp = APP_MODE === 'individual';

/** Build do app do box (o BoxLink completo, com admin, TV, turmas). */
export const isBoxApp = APP_MODE === 'box';

export const APP_NAME = isIndividualApp ? 'BoxLink Solo' : 'BoxLink';

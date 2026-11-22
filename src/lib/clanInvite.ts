// src/lib/clanInvite.ts
// Convites de time: normalização da busca, link/código e leitura do vínculo.
//
// A busca por atleta é a parte que mais confunde: `ilike` no Postgres não
// ignora acento, então "joao" nunca achava "João". A coluna gerada
// `profiles.search_name` (migration 20261122) resolve isso no banco; aqui fica
// o mesmo tratamento em JS, para o termo digitado chegar no formato dela.
//
// Nada aqui fala com o Supabase: são funções puras, testadas em
// `clanInvite.test.ts`.

/** Sem acento, minúsculo — o mesmo tratamento da coluna `profiles.search_name`. */
export function normalizeSearchTerm(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Limpa o termo antes de mandar para o banco: vírgula e parênteses quebram a
 * sintaxe de `or` do PostgREST, e curinga digitado pelo atleta não deve virar
 * filtro. O resto do texto passa como está.
 */
export function sanitizeSearchTerm(value: string): string {
  return (value || '')
    .replace(/[%_,()*\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/** Código do convite sempre em maiúsculas e sem separador. */
export function normalizeInviteCode(code?: string | null): string {
  return (code || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 12);
}

/** Link que o capitão compartilha para o atleta entrar sozinho. */
export function clanInviteLink(code: string | null | undefined, origin: string): string {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return '';
  const base = (origin || '').replace(/\/+$/, '');
  return `${base}/clans?convite=${normalized}`;
}

/** Linha de `clan_memberships` que interessa para decidir se dá para convidar. */
export interface ClanMembershipLike {
  clan_id: string;
  user_id: string;
  status: string;
}

export type InviteCandidateState =
  | 'free'
  | 'in-team'
  | 'invited-here'
  | 'pending-here'
  | 'other-team'
  | 'invited-elsewhere';

/**
 * Por que este atleta pode (ou não) receber o convite.
 *
 * Antes ele simplesmente desaparecia da busca, sem explicação — daí a
 * sensação de que a pessoa "não existe no app".
 */
export function inviteCandidateState(
  userId: string,
  clanId: string,
  memberships: ClanMembershipLike[],
): InviteCandidateState {
  const mine = memberships.filter((m) => m.user_id === userId);
  const here = mine.find((m) => m.clan_id === clanId);

  if (here?.status === 'approved') return 'in-team';
  if (here?.status === 'invited') return 'invited-here';
  if (here?.status === 'pending') return 'pending-here';
  if (mine.some((m) => m.status === 'approved')) return 'other-team';
  // Convite de outro time não impede um convite daqui: dá para ter vários e
  // aceitar um só (a trava do banco é por time + atleta).
  if (mine.some((m) => m.status === 'invited')) return 'invited-elsewhere';
  return 'free';
}

/** Texto curto exibido ao lado do nome na busca. */
export function inviteCandidateLabel(state: InviteCandidateState): string {
  switch (state) {
    case 'in-team':          return 'Já está no seu time';
    case 'invited-here':     return 'Convite já enviado';
    case 'pending-here':     return 'Pediu para entrar';
    case 'other-team':       return 'Já está em outro time';
    case 'invited-elsewhere': return 'Tem convite de outro time';
    case 'free':
    default:                 return '';
  }
}

/** Só quem está livre (ou com convite de outro time) pode receber convite. */
export function canInviteCandidate(state: InviteCandidateState): boolean {
  return state === 'free' || state === 'invited-elsewhere';
}

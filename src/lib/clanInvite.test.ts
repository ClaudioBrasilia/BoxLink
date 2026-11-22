import { describe, it, expect } from 'vitest';
import {
  normalizeSearchTerm,
  sanitizeSearchTerm,
  normalizeInviteCode,
  clanInviteLink,
  inviteCandidateState,
  inviteCandidateLabel,
  canInviteCandidate,
  type ClanMembershipLike,
} from './clanInvite';

const membership = (
  userId: string,
  clanId: string,
  status: string,
): ClanMembershipLike => ({ user_id: userId, clan_id: clanId, status });

describe('normalizeSearchTerm', () => {
  it('tira acento e caixa alta — "João" vira "joao"', () => {
    expect(normalizeSearchTerm('João')).toBe('joao');
    expect(normalizeSearchTerm('  CONCEIÇÃO ')).toBe('conceicao');
    expect(normalizeSearchTerm('Ándre')).toBe('andre');
  });

  it('mantém e-mail utilizável', () => {
    expect(normalizeSearchTerm('Fulano@Gmail.com')).toBe('fulano@gmail.com');
  });

  it('aguenta vazio', () => {
    expect(normalizeSearchTerm('')).toBe('');
  });
});

describe('sanitizeSearchTerm', () => {
  it('remove o que quebra a sintaxe do filtro', () => {
    expect(sanitizeSearchTerm('ana, (maria)')).toBe('ana maria');
    expect(sanitizeSearchTerm('100%_teste')).toBe('100 teste');
  });

  it('normaliza espaços e corta termo gigante', () => {
    expect(sanitizeSearchTerm('  joao   silva  ')).toBe('joao silva');
    expect(sanitizeSearchTerm('a'.repeat(200))).toHaveLength(60);
  });
});

describe('normalizeInviteCode', () => {
  it('sobe para maiúsculas e remove separador', () => {
    expect(normalizeInviteCode('a1b-2c3')).toBe('A1B2C3');
    expect(normalizeInviteCode(' abc123 ')).toBe('ABC123');
  });

  it('aguenta vazio', () => {
    expect(normalizeInviteCode(null)).toBe('');
    expect(normalizeInviteCode(undefined)).toBe('');
  });
});

describe('clanInviteLink', () => {
  it('monta o link com o código normalizado', () => {
    expect(clanInviteLink('a1b2c3', 'https://boxlink.app')).toBe('https://boxlink.app/clans?convite=A1B2C3');
  });

  it('não deixa barra duplicada na origem', () => {
    expect(clanInviteLink('ABC123', 'https://boxlink.app/')).toBe('https://boxlink.app/clans?convite=ABC123');
  });

  it('sem código não existe link', () => {
    expect(clanInviteLink(null, 'https://boxlink.app')).toBe('');
    expect(clanInviteLink('', 'https://boxlink.app')).toBe('');
  });
});

describe('inviteCandidateState', () => {
  const memberships = [
    membership('ana', 'time-a', 'approved'),
    membership('bruno', 'time-a', 'invited'),
    membership('caio', 'time-a', 'pending'),
    membership('duda', 'time-b', 'approved'),
    membership('edu', 'time-b', 'invited'),
    membership('fabi', 'time-a', 'rejected'),
  ];

  it('reconhece cada vínculo com o time do convite', () => {
    expect(inviteCandidateState('ana', 'time-a', memberships)).toBe('in-team');
    expect(inviteCandidateState('bruno', 'time-a', memberships)).toBe('invited-here');
    expect(inviteCandidateState('caio', 'time-a', memberships)).toBe('pending-here');
  });

  it('reconhece vínculo com outro time', () => {
    expect(inviteCandidateState('duda', 'time-a', memberships)).toBe('other-team');
    expect(inviteCandidateState('edu', 'time-a', memberships)).toBe('invited-elsewhere');
  });

  it('quem não tem vínculo nenhum está livre', () => {
    expect(inviteCandidateState('ze', 'time-a', memberships)).toBe('free');
  });

  it('registro recusado não bloqueia um novo convite', () => {
    expect(inviteCandidateState('fabi', 'time-a', memberships)).toBe('free');
  });

  it('lista vazia não quebra', () => {
    expect(inviteCandidateState('ze', 'time-a', [])).toBe('free');
  });
});

describe('inviteCandidateLabel', () => {
  it('explica o motivo em vez de esconder o atleta', () => {
    expect(inviteCandidateLabel('in-team')).toBe('Já está no seu time');
    expect(inviteCandidateLabel('invited-here')).toBe('Convite já enviado');
    expect(inviteCandidateLabel('pending-here')).toBe('Pediu para entrar');
    expect(inviteCandidateLabel('other-team')).toBe('Já está em outro time');
    expect(inviteCandidateLabel('invited-elsewhere')).toBe('Tem convite de outro time');
    expect(inviteCandidateLabel('free')).toBe('');
  });
});

describe('canInviteCandidate', () => {
  it('libera só quem está livre ou com convite de outro time', () => {
    expect(canInviteCandidate('free')).toBe(true);
    expect(canInviteCandidate('invited-elsewhere')).toBe(true);
    expect(canInviteCandidate('in-team')).toBe(false);
    expect(canInviteCandidate('invited-here')).toBe(false);
    expect(canInviteCandidate('pending-here')).toBe(false);
    expect(canInviteCandidate('other-team')).toBe(false);
  });
});

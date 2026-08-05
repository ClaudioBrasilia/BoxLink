// src/lib/friendCode.ts
// Código de atleta (profiles.friend_code) — usado para desafiar alguém
// direto, sem precisar buscar por nome. Todo perfil tem um (trigger
// set_friend_code em 20260722_boxlink_individual.sql), independente de
// conta box ou individual.

/** Normaliza pro formato "AB2C-3DEF" — aceita colado com ou sem hífen. */
export const normalizeFriendCode = (raw: string): string => {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 8) return raw.toUpperCase().trim();
  return `${clean.slice(0, 4)}-${clean.slice(4)}`;
};

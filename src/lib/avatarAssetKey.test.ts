// src/lib/avatarAssetKey.test.ts
// ============================================================================
// Garante que a chave de storage derivada do ID do item é sempre aceita pelo
// Supabase Storage e que upload e leitura chegam à MESMA chave — a causa do
// "Erro no upload: Invalid key: Tênis masculino.png".
// ============================================================================
import { describe, it, expect } from 'vitest';
import { avatarAssetKey } from './avatarAssetKey';

// Mesmo conjunto que o Supabase Storage valida no servidor (S3-safe).
const SUPABASE_VALID_KEY = /^(\w|\/|!|-|\.|\*|'|\(|\)| |&|\$|@|=|;|:|\+|,|\?)*$/;

describe('avatarAssetKey', () => {
  it('remove acentos em vez de rejeitar o ID ("Tênis masculino")', () => {
    expect(avatarAssetKey('Tênis masculino')).toBe('Tenis masculino');
    expect(avatarAssetKey('Calça João ção')).toBe('Calca Joao cao');
  });

  it('mantém intactos IDs que já são válidos (assets existentes no bucket)', () => {
    for (const id of ['M-01', 'F-10', 'base masculina', 'base feminina', 'top_azul.v2']) {
      expect(avatarAssetKey(id)).toBe(id);
    }
  });

  it('substitui caracteres fora do conjunto do Storage (inclui "/")', () => {
    expect(avatarAssetKey('a/b')).toBe('a_b');
    expect(avatarAssetKey('item#1%')).toBe('item_1_');
  });

  it('sempre produz uma chave que o Storage aceita', () => {
    for (const id of ['Tênis masculino', 'çãõê ÁÉÍ', 'a/b\\c', '#?%"<>|', 'emoji 🏋️ id']) {
      expect(`${avatarAssetKey(id)}.png`).toMatch(SUPABASE_VALID_KEY);
    }
  });
});

// `profiles.sex` ('male' | 'female', preenchido na Biometria do Perfil) é a
// fonte real do gênero do atleta. Quando ainda não preenchido, cai no
// heurístico antigo baseado no avatar equipado.
export function resolveGenderCode(profile?: { sex?: string | null; avatar_equipped?: any } | null): 'M' | 'F' {
  if (profile?.sex === 'female') return 'F';
  if (profile?.sex === 'male') return 'M';
  return profile?.avatar_equipped?.base_outfit === 'base_feminina' ? 'F' : 'M';
}

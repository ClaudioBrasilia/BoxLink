// src/lib/relativeStrength.ts
// Força relativa: quanto do próprio peso corporal o atleta moveu no WOD.
//
// Num WOD RX a carga prescrita é a mesma para todos, então comparar carga bruta
// não separa ninguém. Dividir pelo peso corporal, sim: 43kg de thruster são
// 0.74x o peso de uma atleta de 58kg e 0.45x o de um atleta de 95kg — a mesma
// barra é um treino proporcionalmente muito mais pesado para ela.
//
// É a leitura do "work-to-body-mass ratio" das análises do CrossFit Games,
// na versão que os dados do app suportam de fato (o J/kg deles exigiria
// repetições × distância × gravidade, que não registramos).
//
// Mesma fórmula já usada em benchmarkCompare.ts para os PRs de carga.

/** Carga ÷ peso corporal. null quando falta algum dos dois. */
export function computeRelativeStrength(
  loadKg: number | null | undefined,
  bodyWeightKg: number | null | undefined,
): number | null {
  if (!loadKg || loadKg <= 0) return null;
  if (!bodyWeightKg || bodyWeightKg <= 0) return null;
  return Math.round((loadKg / bodyWeightKg) * 100) / 100;
}

/** "0.74x o peso" — ou null, para a UI omitir. */
export function formatRelativeStrength(ratio: number | null): string | null {
  return ratio == null ? null : `${ratio.toFixed(2)}x`;
}

// src/hooks/useUserBiometrics.ts
// Busca a biometria do atleta (peso, altura, nascimento, sexo) usada para
// estimar calorias e % da FC máxima no resumo de treino.
// Falha graciosamente: se as colunas não existirem ou não houver dados,
// retorna um objeto vazio (o resumo apenas oculta as métricas dependentes).
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Biometrics, Sex } from '../lib/heartRate';

export function useUserBiometrics(userId: string | undefined): Biometrics {
  const [bio, setBio] = useState<Biometrics>({});

  useEffect(() => {
    if (!userId) {
      setBio({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('weight_kg, height_cm, birth_date, sex')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setBio({
        weightKg: data.weight_kg ?? null,
        heightCm: data.height_cm ?? null,
        birthDate: data.birth_date ?? null,
        sex: (data.sex as Sex) ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return bio;
}

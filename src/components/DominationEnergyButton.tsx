import React, { useState } from 'react';
import { Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

interface DominationEnergyButtonProps {
  userId: string;
  clan_id?: string; // Mantendo compatibilidade com possíveis nomes de props
  clanId?: string;
  activityId: string;
  activityType: string;
  energy: number;
  participationValid: boolean;
  onSuccess?: () => void;
}

export const DominationEnergyButton: React.FC<DominationEnergyButtonProps> = ({
  userId,
  clanId,
  clan_id,
  activityId,
  activityType,
  energy,
  participationValid,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const targetClanId = clanId || clan_id;

  const handleContribute = async () => {
    if (!participationValid || !targetClanId || loading) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('domination_events').insert({
        user_id: userId,
        clan_id: targetClanId,
        territory_id: activityId.split(':')[1] || activityId, // Tenta extrair ID se for formato string
        energy: energy
      });

      if (error) throw error;

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error contributing energy:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={handleContribute}
      disabled={!participationValid || loading}
      className={`w-full py-4 rounded-2xl font-headline font-black text-sm uppercase italic flex items-center justify-center gap-2 transition-all ${
        participationValid 
          ? 'bg-primary text-black shadow-lg shadow-primary/20' 
          : 'bg-surface-container-highest text-on-surface-variant opacity-50 cursor-not-allowed'
      }`}
    >
      <Zap className={`w-4 h-4 ${loading ? 'animate-pulse' : 'fill-current'}`} />
      {loading ? 'ENVIANDO...' : `CONTRIBUIR +${energy} ENERGIA`}
    </motion.button>
  );
};

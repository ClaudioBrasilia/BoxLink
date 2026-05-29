// src/components/HeartRateDisplay.tsx
import React from 'react';
import { Heart } from 'lucide-react';

interface HeartRateDisplayProps {
  bpm: number | null;
  deviceName?: string;
  showLabel?: boolean;
}

export default function HeartRateDisplay({ bpm, deviceName, showLabel = true }: HeartRateDisplayProps) {
  if (!bpm) {
    return null;
  }

  // Determinar zona de frequência cardíaca
  const getHeartRateZone = (bpm: number) => {
    if (bpm < 100) return { name: 'Repouso', color: 'text-blue-400', bgColor: 'bg-blue-500/10' };
    if (bpm < 130) return { name: 'Zona 2', color: 'text-green-400', bgColor: 'bg-green-500/10' };
    if (bpm < 160) return { name: 'Zona 3', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' };
    if (bpm < 180) return { name: 'Zona 4', color: 'text-orange-400', bgColor: 'bg-orange-500/10' };
    return { name: 'Zona 5', color: 'text-red-400', bgColor: 'bg-red-500/10' };
  };

  const zone = getHeartRateZone(bpm);

  return (
    <div className={`${zone.bgColor} border border-white/10 rounded-2xl p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className={`w-5 h-5 ${zone.color} animate-pulse`} />
          {showLabel && <span className="text-xs font-bold text-white uppercase">Frequência Cardíaca</span>}
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${zone.bgColor} ${zone.color}`}>
          {zone.name}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <div className={`text-4xl font-bold ${zone.color}`}>{bpm}</div>
        <div className="text-sm font-bold text-gray-400">BPM</div>
      </div>

      {deviceName && <div className="text-xs text-gray-500">Dispositivo: {deviceName}</div>}
    </div>
  );
}

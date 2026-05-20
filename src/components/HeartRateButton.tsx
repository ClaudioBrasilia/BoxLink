import React from 'react';
import { Heart, Bluetooth } from 'lucide-react';
import { useHeartRate } from '../hooks/useHeartRate';
import { cn } from '../lib/utils';

export default function HeartRateButton() {
  const { bpm, isConnected, connectHeartRateMonitor, disconnect } = useHeartRate();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <button
        onClick={isConnected ? disconnect : connectHeartRateMonitor}
        className={cn(
          "flex items-center gap-3 px-6 py-4 rounded-3xl font-black text-base shadow-2xl transition-all active:scale-95 border",
          isConnected 
            ? "bg-red-600 hover:bg-red-700 text-white border-red-700" 
            : "bg-primary hover:bg-primary/90 text-black border-primary"
        )}
      >
        {isConnected ? (
          <>
            <Heart className="w-6 h-6 fill-white" />
            <div className="text-left">
              <div className="text-xl tabular-nums">{bpm || '--'} BPM</div>
              <div className="text-xs opacity-75 -mt-1">CONECTADO</div>
            </div>
          </>
        ) : (
          <>
            <Bluetooth className="w-6 h-6" />
            <span>CONECTAR RELÓGIO</span>
          </>
        )}
      </button>

      {isConnected && bpm && (
        <div className="mt-3 px-5 py-2 bg-black/80 text-red-400 text-sm font-black rounded-2xl border border-red-500/30">
          ATUAL: {bpm} BPM
        </div>
      )}
    </div>
  );
}

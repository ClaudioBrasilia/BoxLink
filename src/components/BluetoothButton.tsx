// src/components/BluetoothButton.tsx
import React from 'react';
import { Bluetooth, Loader } from 'lucide-react';

interface BluetoothButtonProps {
  isScanning: boolean;
  connectedCount: number;
  onClick: () => void;
  disabled?: boolean;
}

export default function BluetoothButton({ isScanning, connectedCount, onClick, disabled = false }: BluetoothButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isScanning}
      className="relative inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all"
      style={{
        backgroundColor: connectedCount > 0 ? 'rgb(34, 197, 94)' : 'rgb(59, 130, 246)',
        color: 'white',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {isScanning ? (
        <>
          <Loader className="w-4 h-4 animate-spin" />
          <span>Procurando...</span>
        </>
      ) : (
        <>
          <Bluetooth className="w-4 h-4" />
          <span>
            {connectedCount > 0
              ? `${connectedCount} Dispositivo${connectedCount !== 1 ? 's' : ''} Conectado${connectedCount !== 1 ? 's' : ''}`
              : 'Conectar Bluetooth'}
          </span>
        </>
      )}
    </button>
  );
}

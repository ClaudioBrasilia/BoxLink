// src/components/BluetoothScanner.tsx
import React, { useState } from 'react';
import { Bluetooth, Heart, Battery, Loader, AlertCircle, X } from 'lucide-react';
import { useBluetooth } from '../hooks/useBluetooth';

interface BluetoothScannerProps {
  userId: string | undefined;
}

export default function BluetoothScanner({ userId }: BluetoothScannerProps) {
  const { devices, status, errorMessage, isNative, startScanning, stopScanning, connectDevice, disconnectDevice } =
    useBluetooth(userId);
  const [showDetails, setShowDetails] = useState(false);

  if (!isNative) {
    return null;
  }

  const connectedDevices = devices.filter((d) => d.status === 'connected');
  const availableDevices = devices.filter((d) => d.status === 'disconnected');

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bluetooth className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-bold text-white">DISPOSITIVOS BLUETOOTH</h3>
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">
          {connectedDevices.length} conectado{connectedDevices.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Dispositivos Conectados */}
      {connectedDevices.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold text-green-400 uppercase">Conectados</h4>
          {connectedDevices.map((device) => (
            <div key={device.id} className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-400 animate-pulse" />
                  <span className="text-sm font-bold text-white">{device.name}</span>
                </div>
                <button
                  onClick={() => disconnectDevice(device.id)}
                  className="p-1 hover:bg-red-500/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-red-400" />
                </button>
              </div>

              {device.bpm && (
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-bold text-primary">{device.bpm}</div>
                  <div className="text-xs font-bold text-gray-400">BPM</div>
                </div>
              )}

              {device.battery !== null && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Battery className="w-3 h-3" />
                  <span>{device.battery}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Controles */}
      <div className="flex gap-2">
        {status !== 'scanning' ? (
          <button
            onClick={startScanning}
            className="flex-1 bg-primary text-black px-3 py-2 rounded-lg font-bold text-xs hover:scale-105 transition-transform"
          >
            ESCANEAR DISPOSITIVOS
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="flex-1 bg-red-500 text-white px-3 py-2 rounded-lg font-bold text-xs hover:scale-105 transition-transform flex items-center justify-center gap-2"
          >
            <Loader className="w-3 h-3 animate-spin" />
            PARANDO...
          </button>
        )}
      </div>

      {/* Dispositivos Disponíveis */}
      {status === 'scanning' && availableDevices.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold text-yellow-400 uppercase">Disponíveis ({availableDevices.length})</h4>
          <div className="max-h-48 overflow-y-auto flex flex-col gap-2">
            {availableDevices.map((device) => (
              <button
                key={device.id}
                onClick={() => connectDevice(device.id)}
                className="bg-yellow-500/10 border border-yellow-500/30 hover:bg-yellow-500/20 rounded-lg p-2 text-left transition-colors"
              >
                <div className="text-xs font-bold text-white">{device.name}</div>
                <div className="text-[10px] text-gray-400 mt-1">{device.id.substring(0, 16)}...</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Erro */}
      {errorMessage && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-400">{errorMessage}</p>
        </div>
      )}

      {/* Status */}
      {status === 'scanning' && availableDevices.length === 0 && (
        <div className="flex items-center gap-2 text-yellow-500">
          <Loader className="w-4 h-4 animate-spin" />
          <p className="text-xs">Procurando dispositivos...</p>
        </div>
      )}
    </div>
  );
}

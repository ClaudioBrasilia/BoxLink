import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export type BleForegroundStatus =
  | 'connecting'
  | 'discovering'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export interface BleForegroundStartOptions {
  deviceId: string;
  deviceName?: string;
  sessionId: string;
}

export interface BleForegroundQuality {
  rrTotal: number;
  rrInvalid: number;
  rrAdvertised: boolean;
  rrPayloadTruncated: boolean;
}

export interface BleForegroundSample {
  sessionId: string;
  capturedAtMs: number;
  bpm: number;
  rrIntervalsMs: number[];
  sourceId?: string;
  sourceName?: string;
  quality: BleForegroundQuality;
}

export interface BleForegroundStatusEvent {
  sessionId?: string | null;
  status: BleForegroundStatus;
  reason?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
}

export interface BleForegroundDiagnosticEvent {
  sessionId?: string | null;
  code: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error';
  /** Contexto extra (UUIDs descobertos, causa da reconexão, código GATT). */
  detail?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
}

export interface BleForegroundSession {
  active: boolean;
  sessionId?: string;
  deviceId?: string;
  deviceName?: string | null;
  startedAtMs?: number;
  endedAtMs?: number | null;
  lastBpm?: number | null;
  lastSampleMs?: number | null;
  sampleCount: number;
}

export interface BleForegroundSnapshot extends BleForegroundSession {}

export interface BleForegroundPlugin {
  startSession(options: BleForegroundStartOptions): Promise<void>;
  stopSession(options?: { sessionId?: string }): Promise<void>;
  getActiveSession(): Promise<BleForegroundSession>;
  getSnapshot(options: { sessionId: string }): Promise<BleForegroundSnapshot>;
  listSamples(options: { sessionId: string; afterMs?: number }): Promise<{ samples: BleForegroundSample[] }>;
  addListener(
    eventName: 'heartRate',
    listenerFunc: (event: BleForegroundSample) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'status',
    listenerFunc: (event: BleForegroundStatusEvent) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'diagnostic',
    listenerFunc: (event: BleForegroundDiagnosticEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export const BleForeground = registerPlugin<BleForegroundPlugin>('BleForeground');

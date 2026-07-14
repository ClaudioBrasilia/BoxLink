// src/lib/heartRate.ts
// ============================================================================
// Catálogo central de perfis de Frequência Cardíaca (Bluetooth LE)
// Fonte única de verdade para UUIDs, parsers e heurísticas usadas pelos hooks.
// ----------------------------------------------------------------------------
// Muitos smartwatches (Huawei, Xiaomi, genéricos JL/Telink/Realtek) NÃO usam o
// serviço padrão da Bluetooth SIG (0x180D). Este módulo reúne os UUIDs padrão
// + os proprietários mais comuns e um parser tolerante a formatos não padrão.
// ============================================================================

// ─── Serviços padrão (Bluetooth SIG) ─────────────────────────────────────────
export const HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
export const HEART_RATE_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
export const HEART_RATE_CONTROL_POINT = '00002a39-0000-1000-8000-00805f9b34fb';
export const BODY_SENSOR_LOCATION = '00002a38-0000-1000-8000-00805f9b34fb';
export const BATTERY_SERVICE = '0000180f-0000-1000-8000-00805f9b34fb';
export const DEVICE_INFO_SERVICE = '0000180a-0000-1000-8000-00805f9b34fb';
export const CYCLING_CADENCE_SERVICE = '00001816-0000-1000-8000-00805f9b34fb';
export const RUNNING_SPEED_SERVICE = '00001814-0000-1000-8000-00805f9b34fb';
export const FITNESS_MACHINE_SERVICE = '00001826-0000-1000-8000-00805f9b34fb';

// ─── Serviços proprietários conhecidos ───────────────────────────────────────
export const POLAR_PMD_SERVICE = 'fb005c80-02e7-f387-1cad-8acd2d8df0c8';
export const POLAR_PMD_DATA = 'fb005c81-02e7-f387-1cad-8acd2d8df0c8';
export const WAHOO_SERVICE = 'a026ee0b-0a7d-4ab3-97fa-f1500f9feb8b';

// Serviço proprietário 0x3802 — usado por MUITOS relógios Huawei/Xiaomi/genéricos
// (reportado como o UUID que expõe FC nesses dispositivos).
export const PROPRIETARY_3802_SERVICE = '00003802-0000-1000-8000-00805f9b34fb';
export const PROPRIETARY_3802_CHAR = '00004a02-0000-1000-8000-00805f9b34fb';

// ─── Serviços de fabricantes chineses / SoCs genéricos ───────────────────────
export const GENERIC_SERVICES = [
  PROPRIETARY_3802_SERVICE,               // Huawei / Xiaomi / genéricos (0x3802)
  '0000fee0-0000-1000-8000-00805f9b34fb', // Xiaomi/Huami (Mi Band)
  '0000fee1-0000-1000-8000-00805f9b34fb', // Xiaomi/Huami auth
  '0000fee7-0000-1000-8000-00805f9b34fb', // Huawei
  '0000fff0-0000-1000-8000-00805f9b34fb', // genérico (fff0)
  '0000fff1-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb', // genérico (ffe0 / HM-10)
  '0000fef0-0000-1000-8000-00805f9b34fb',
  '0000fef5-0000-1000-8000-00805f9b34fb', // Dialog OTA (muitos genéricos)
  '0000feea-0000-1000-8000-00805f9b34fb', // Senssun / genéricos
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip/ISSC transparent (JL/Telink)
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '0783b03e-8535-b5a0-7140-a304d2495cb7', // Goodix
  '00001530-0000-1000-8000-00805f9b34fb', // Realtek OTA
  'f000ffc0-0451-4000-b000-000000000000', // TI CC254x OAD
  'be940000-7333-be46-b7ae-689e71722bd5', // genéricos DaFit/DT
  '0000fcd0-0000-1000-8000-00805f9b34fb', // FCD0 (genéricos)
];

// ─── Características que podem conter a leitura de FC ──────────────────────────
export const HR_CHARACTERISTIC_UUIDS = [
  HEART_RATE_MEASUREMENT,
  POLAR_PMD_DATA,
  PROPRIETARY_3802_CHAR,
  '0000fff1-0000-1000-8000-00805f9b34fb',
  '0000fff4-0000-1000-8000-00805f9b34fb',
  '0000fff6-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '0000fef6-0000-1000-8000-00805f9b34fb',
  '6e400003-b5a3-f393-e0a9-e50e24dcca9e', // NUS TX (notify)
];

// ─── Padrões (regex) de serviços que provavelmente carregam FC ───────────────
export const HR_SERVICE_PATTERNS: RegExp[] = [
  /0000180d/i,     // padrão HR
  /heart.?rate/i,
  /hr.?monitor/i,
  /0000?3802/i,    // proprietário Huawei/Xiaomi
  /pmd/i,          // Polar
  /fee[071]/i,     // Xiaomi/Huawei
  /fff[0-9a-f]/i,  // genérico
  /ffe[0-9a-f]/i,  // genérico
  /fef[05-9a-f]/i, // genérico
];

// Todas as services opcionais para o Web Bluetooth (precisam ser declaradas)
export const OPTIONAL_SERVICES: (string | number)[] = [
  HEART_RATE_SERVICE,
  BATTERY_SERVICE,
  DEVICE_INFO_SERVICE,
  CYCLING_CADENCE_SERVICE,
  RUNNING_SPEED_SERVICE,
  FITNESS_MACHINE_SERVICE,
  POLAR_PMD_SERVICE,
  WAHOO_SERVICE,
  ...GENERIC_SERVICES,
];

// ─── Prefixos de nome (para filtros Web Bluetooth e ranqueamento) ────────────
export const NAME_PREFIXES = [
  // Cintas peitorais
  'Polar', 'H10', 'H9', 'H7', 'OH1', 'Verity',
  'Wahoo', 'TICKR',
  'HRM', 'HRM-Dual', 'HRM-Pro', 'HRM-Run', 'HRM-Tri',
  'CooSpo', 'Coospo', 'Magene', 'Moofit', 'BerryMed', 'Scosche', 'Rhythm',
  'Decathlon', 'Kalenji', 'Geonaute', 'Stryd', 'Suunto',
  // Garmin
  'Garmin', 'Forerunner', 'Fenix', 'Venu', 'Vivoactive', 'Vivosmart', 'Vivofit', 'Edge', 'Instinct', 'Epix', 'Enduro',
  // Xiaomi / Amazfit
  'Mi', 'Mi Band', 'Mi Watch', 'Xiaomi', 'Redmi', 'Amazfit', 'Bip', 'Stratos', 'GTS', 'GTR', 'T-Rex', 'Verge', 'Cor',
  // Huawei / Honor
  'Huawei', 'Honor', 'Band', 'Watch GT', 'TalkBand',
  // Samsung
  'Galaxy', 'Galaxy Watch', 'Galaxy Fit', 'Gear', 'SM-R',
  // Apple / Fitbit / Withings
  'Apple Watch', 'Fitbit', 'Charge', 'Versa', 'Sense', 'Inspire', 'Luxe', 'Withings',
  // Genéricos chineses
  'Haylou', 'LS01', 'LS02', 'Realme', 'Oppo', 'Lenovo', 'HW01', 'HX03',
  'Zeblaze', 'Diggro', 'ID208', 'ID205', 'IWO', 'DT28', 'DT100', 'DT',
  'ZeFit', 'Lefun', 'ID115', 'ID130', 'M4', 'M5', 'M6', 'Y68', 'D13', 'D20',
  'Watch', 'Smart', 'Fit', 'Pulse', 'Cardio', 'Health', 'Sport', 'Tracker', 'Bracelet',
];

// ─── Validação de faixa fisiológica ──────────────────────────────────────────
export const MIN_BPM = 30;
export const MAX_BPM = 250;

export function isPlausibleBpm(bpm: number): boolean {
  return Number.isFinite(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM;
}

// ============================================================================
// Parsers
// ============================================================================

/**
 * Parser do formato PADRÃO Heart Rate Measurement (0x2A37 / Bluetooth SIG).
 * flags bit0 = formato do valor (0 = uint8, 1 = uint16).
 */
export function parseStandardHeartRate(value: DataView): number | null {
  if (value.byteLength < 2) return null;
  const flags = value.getUint8(0);
  const is16bit = (flags & 0x01) !== 0;

  let bpm: number;
  if (is16bit) {
    if (value.byteLength < 3) return null;
    bpm = value.getUint16(1, true);
  } else {
    bpm = value.getUint8(1);
  }
  return isPlausibleBpm(bpm) ? bpm : null;
}

/**
 * Parser tolerante — tenta o formato padrão e, se falhar, aplica heurísticas
 * para dispositivos genéricos que enviam o BPM em formatos não padronizados.
 */
export function parseHeartRateFallback(value: DataView): number | null {
  // 1. Formato padrão
  const standard = parseStandardHeartRate(value);
  if (standard !== null) return standard;

  // 2. uint16 LE sem flags (comum em genéricos)
  if (value.byteLength >= 2) {
    const raw = value.getUint16(0, true);
    if (isPlausibleBpm(raw)) return raw;
  }

  // 3. uint8 único
  if (value.byteLength >= 1) {
    const raw = value.getUint8(0);
    if (isPlausibleBpm(raw)) return raw;
  }

  // 4. Varre o buffer procurando um byte com valor fisiologicamente plausível.
  //    Evita bytes de flags (posição 0) quando há mais dados.
  const start = value.byteLength > 1 ? 1 : 0;
  for (let i = start; i < value.byteLength; i++) {
    const v = value.getUint8(i);
    if (v > 40 && v < 220) return v;
  }

  return null;
}

// ============================================================================
// Heurísticas
// ============================================================================

export function isLikelyHRDeviceName(name: string | undefined | null): boolean {
  if (!name) return false;
  return /watch|band|hr|pulse|cardio|fit|polar|garmin|wahoo|tickr|amazfit|fitbit|mi |huawei|honor|galaxy|forerunner|fenix|venu|haylou|realme|oppo|lenovo|id\d|ze.?fit|lefun|m[4-6]\b|y68|d13|d20|iwatch|bracelet|tracker|coospo|magene|suunto|withings/i.test(
    name
  );
}

export function isLikelyHRService(uuid: string): boolean {
  const lower = uuid.toLowerCase();
  if (lower === HEART_RATE_SERVICE) return true;
  return HR_SERVICE_PATTERNS.some((p) => p.test(lower));
}

export function isLikelyHRCharacteristic(uuid: string): boolean {
  const lower = uuid.toLowerCase();
  if (HR_CHARACTERISTIC_UUIDS.some((k) => k.toLowerCase() === lower)) return true;
  if (/fff[1-9a-f]/i.test(lower)) return true;
  if (/ffe[1-9a-f]/i.test(lower)) return true;
  if (/fef[5-9a-f]/i.test(lower)) return true;
  if (/4a02/i.test(lower)) return true; // char do serviço 0x3802
  return false;
}

// ============================================================================
// Zonas de treino
// ============================================================================
export interface HeartRateZone {
  label: string;
  color: string;
  bg: string;
  border: string;
  bar: string;
}

export function getHeartRateZone(bpm: number): HeartRateZone {
  if (bpm < 100) return { label: 'REPOUSO',     color: 'text-blue-400',   bg: 'bg-blue-400/10',   border: 'border-blue-400/30',   bar: 'bg-blue-400' };
  if (bpm < 120) return { label: 'AQUECIMENTO', color: 'text-green-400',  bg: 'bg-green-400/10',  border: 'border-green-400/30',  bar: 'bg-green-400' };
  if (bpm < 140) return { label: 'AERÓBICO',    color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', bar: 'bg-yellow-400' };
  if (bpm < 160) return { label: 'ANAERÓBICO',  color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', bar: 'bg-orange-400' };
  return               { label: 'MÁXIMO ⚡',     color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30',    bar: 'bg-red-400' };
}

export function intensityPct(bpm: number): number {
  return Math.min(100, Math.max(0, ((bpm - 50) / 150) * 100));
}

// ============================================================================
// Biometria e métricas derivadas (calorias, %FCmáx)
// ============================================================================
export type Sex = 'male' | 'female';

export interface Biometrics {
  weightKg?: number | null;
  heightCm?: number | null;
  birthDate?: string | null; // ISO (YYYY-MM-DD)
  sex?: Sex | null;
}

/** Idade em anos a partir da data de nascimento (ISO). null se ausente/ inválida. */
export function ageFromBirthDate(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 5 && age <= 120 ? age : null;
}

/** FC máxima teórica (fórmula clássica 220 − idade). */
export function theoreticalMaxHr(age: number | null): number | null {
  if (age == null) return null;
  return 220 - age;
}

/** % da FC máxima teórica para um dado BPM. */
export function maxHrPercent(bpm: number, age: number | null): number | null {
  const max = theoreticalMaxHr(age);
  if (!max) return null;
  return Math.round((bpm / max) * 100);
}

/**
 * Estimativa de calorias (kcal) — fórmula de Keytel et al. (2005), baseada em
 * FC média, peso, idade e sexo. Retorna null se faltar algum dado essencial.
 */
export function estimateCalories(
  avgHr: number,
  durationMin: number,
  bio: Biometrics
): number | null {
  const age = ageFromBirthDate(bio.birthDate);
  const weight = bio.weightKg;
  const sex = bio.sex;
  if (!weight || !age || !sex || durationMin <= 0) return null;

  const perMin =
    sex === 'male'
      ? (-55.0969 + 0.6309 * avgHr + 0.1988 * weight + 0.2017 * age) / 4.184
      : (-20.4022 + 0.4472 * avgHr - 0.1263 * weight + 0.074 * age) / 4.184;

  const total = perMin * durationMin;
  return total > 0 ? Math.round(total) : null;
}

/** Verdadeiro quando há dados suficientes para calorias (+ %FCmáx). */
export function hasCalorieData(bio: Biometrics): boolean {
  return !!(bio.weightKg && bio.sex && ageFromBirthDate(bio.birthDate) != null);
}

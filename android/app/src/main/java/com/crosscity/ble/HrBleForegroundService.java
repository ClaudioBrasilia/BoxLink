package com.crosscity.ble;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Dono nativo da conexão BLE durante uma sessão de treino.
 *
 * O serviço grava as notificações antes de emitir eventos para o WebView. Assim,
 * a captura de FC/RR não depende de timers JavaScript enquanto o app está em
 * segundo plano.
 */
@SuppressLint("MissingPermission")
public final class HrBleForegroundService extends Service {
    public static final String ACTION_START = "com.crosscity.ble.START";
    public static final String ACTION_STOP = "com.crosscity.ble.STOP";
    public static final String EXTRA_DEVICE_ID = "device_id";
    public static final String EXTRA_DEVICE_NAME = "device_name";
    public static final String EXTRA_SESSION_ID = "session_id";

    private static final String CHANNEL_ID = "heart_rate_session";
    private static final int NOTIFICATION_ID = 4101;
    private static final long[] RECONNECT_DELAYS_MS = {1000L, 2000L, 4000L};
    private static final long STALE_TIMEOUT_MS = 10000L;
    private static final long STALE_CHECK_MS = 2000L;
    // O wake lock expira sozinho: uma sessão que parou de produzir leituras
    // devolve a CPU em meia hora, mesmo que o serviço continue tentando
    // reconectar. Enquanto houver batimentos chegando, o prazo é renovado.
    private static final long WAKE_LOCK_TIMEOUT_MS = 30L * 60L * 1000L;
    private static final long WAKE_LOCK_REFRESH_MS = 5L * 60L * 1000L;

    private static final UUID HR_SERVICE = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb");
    private static final UUID HR_MEASUREMENT = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb");
    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private static final Set<UUID> KNOWN_SERVICES = unmodifiableUuidSet(
        "fb005c80-02e7-f387-1cad-8acd2d8df0c8",
        "a026ee0b-0a7d-4ab3-97fa-f1500f9feb8b",
        "00003802-0000-1000-8000-00805f9b34fb",
        "0000fee0-0000-1000-8000-00805f9b34fb",
        "0000fee1-0000-1000-8000-00805f9b34fb",
        "0000fee7-0000-1000-8000-00805f9b34fb",
        "0000fff0-0000-1000-8000-00805f9b34fb",
        "0000fff1-0000-1000-8000-00805f9b34fb",
        "0000ffe0-0000-1000-8000-00805f9b34fb",
        "0000fef0-0000-1000-8000-00805f9b34fb",
        "0000fef5-0000-1000-8000-00805f9b34fb",
        "0000feea-0000-1000-8000-00805f9b34fb",
        "49535343-fe7d-4ae5-8fa9-9fafd205e455",
        "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
        "0783b03e-8535-b5a0-7140-a304d2495cb7",
        "00001530-0000-1000-8000-00805f9b34fb",
        "f000ffc0-0451-4000-b000-000000000000",
        "be940000-7333-be46-b7ae-689e71722bd5",
        "0000fcd0-0000-1000-8000-00805f9b34fb"
    );

    private static final Set<UUID> KNOWN_CHARACTERISTICS = unmodifiableUuidSet(
        "00002a37-0000-1000-8000-00805f9b34fb",
        "fb005c81-02e7-f387-1cad-8acd2d8df0c8",
        "00004a02-0000-1000-8000-00805f9b34fb",
        "0000fff1-0000-1000-8000-00805f9b34fb",
        "0000fff4-0000-1000-8000-00805f9b34fb",
        "0000fff6-0000-1000-8000-00805f9b34fb",
        "0000ffe1-0000-1000-8000-00805f9b34fb",
        "0000fef6-0000-1000-8000-00805f9b34fb",
        "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
    );

    private final Handler handler = new Handler(Looper.getMainLooper());
    private HrSessionStore store;
    private BluetoothGatt gatt;
    private BluetoothGattCharacteristic activeCharacteristic;
    private String sessionId;
    private String deviceId;
    private String deviceName;
    private boolean stopping;
    private boolean subscribed;
    private int reconnectAttempt;
    private long lastSampleAtMs;
    private Runnable reconnectRunnable;
    private Runnable staleRunnable;
    private PowerManager.WakeLock wakeLock;
    private long wakeLockRefreshedAtMs;

    private static Set<UUID> unmodifiableUuidSet(String... values) {
        Set<UUID> result = new HashSet<>();
        for (String value : values) result.add(UUID.fromString(value));
        return Collections.unmodifiableSet(result);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        store = new HrSessionStore(this);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSession("user");
            return START_NOT_STICKY;
        }

        if (intent != null && ACTION_START.equals(intent.getAction())) {
            String requestedSession = intent.getStringExtra(EXTRA_SESSION_ID);
            String requestedDevice = intent.getStringExtra(EXTRA_DEVICE_ID);
            String requestedName = intent.getStringExtra(EXTRA_DEVICE_NAME);
            startOrResume(requestedSession, requestedDevice, requestedName);
            return START_STICKY;
        }

        HrSessionStore.SessionRecord active = store.getActiveSession();
        if (active != null) {
            sessionId = active.sessionId;
            deviceId = active.deviceId;
            deviceName = active.deviceName;
            if (startAsForeground(deviceName == null ? "Monitor cardíaco" : deviceName)) connectIfNeeded();
            return START_STICKY;
        }
        stopSelf();
        return START_NOT_STICKY;
    }

    private void startOrResume(@Nullable String requestedSession, @Nullable String requestedDevice, @Nullable String requestedName) {
        if (requestedSession == null || requestedSession.trim().isEmpty() || requestedDevice == null || requestedDevice.trim().isEmpty()) {
            emitError("invalid_session", "Sessão BLE sem identificador ou dispositivo.");
            stopSelf();
            return;
        }

        HrSessionStore.SessionRecord existing = store.getActiveSession();
        boolean sameSession = existing != null && requestedSession.equals(existing.sessionId);
        sessionId = requestedSession;
        deviceId = requestedDevice;
        deviceName = requestedName == null || requestedName.trim().isEmpty()
            ? (sameSession ? existing.deviceName : "Monitor cardíaco")
            : requestedName;
        stopping = false;
        reconnectAttempt = 0;
        subscribed = false;

        if (!sameSession) {
            closeGatt();
            store.startSession(sessionId, deviceId, deviceName, System.currentTimeMillis());
        }

        if (!startAsForeground(deviceName)) return;
        emitStatus("connecting", null);
        connectIfNeeded();
    }

    private boolean startAsForeground(String monitorName) {
        Notification notification = buildNotification(monitorName);
        int type = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            type = ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE;
        }
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);
        } catch (SecurityException error) {
            emitError("foreground_permission", "Permissão para manter a conexão BLE em segundo plano não foi concedida.");
            stopSession("foreground_permission");
            return false;
        } catch (RuntimeException error) {
            // Android 12+ lança ForegroundServiceStartNotAllowedException e o 14+
            // Invalid/MissingForegroundServiceTypeException — todas descendem de
            // IllegalStateException, não de SecurityException. Sem este catch, o
            // reinício via START_STICKY com o app em segundo plano derruba o processo.
            emitError("foreground_start_blocked", "O Android bloqueou o início da sessão BLE em segundo plano.");
            stopSession("foreground_start_blocked");
            return false;
        }
        // Fora do try: uma falha ao segurar a CPU não é uma falha de foreground.
        acquireWakeLock();
        return true;
    }

    private Notification buildNotification(String monitorName) {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open == null) open = new Intent();
        PendingIntent openPending = PendingIntent.getActivity(
            this, 1, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stop = new Intent(this, HrBleForegroundService.class).setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
            this, 2, stop,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        int iconId = getResources().getIdentifier("ic_stat_heart_rate", "drawable", getPackageName());
        if (iconId == 0) iconId = getApplicationInfo().icon;

        int appNameId = getResources().getIdentifier("app_name", "string", getPackageName());
        String appLabel = appNameId == 0
            ? String.valueOf(getApplicationInfo().loadLabel(getPackageManager()))
            : getString(appNameId);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(iconId)
            .setContentTitle(appLabel + " — treino ativo")
            .setContentText("Lendo FC de " + monitorName)
            .setContentIntent(openPending)
            .addAction(0, "Finalizar conexão", stopPending)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @SuppressLint("MissingPermission")
    private void connectIfNeeded() {
        if (stopping || deviceId == null || sessionId == null) return;
        if (gatt != null && subscribed) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            emitError("bluetooth_permission", "Permissão de dispositivos por perto não foi concedida.");
            emitStatus("error", "bluetooth_permission");
            return;
        }

        BluetoothManager manager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            emitError("bluetooth_off", "O Bluetooth está desligado.");
            emitStatus("error", "bluetooth_off");
            scheduleReconnect();
            return;
        }

        try {
            BluetoothDevice device = adapter.getRemoteDevice(deviceId);
            closeGatt();
            subscribed = false;
            emitStatus(reconnectAttempt == 0 ? "connecting" : "reconnecting", null);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                gatt = device.connectGatt(this, false, callback, BluetoothDevice.TRANSPORT_LE);
            } else {
                gatt = device.connectGatt(this, false, callback);
            }
        } catch (IllegalArgumentException error) {
            emitError("invalid_device", "Identificador BLE inválido para este Android.");
            emitStatus("error", "invalid_device");
        } catch (SecurityException error) {
            emitError("bluetooth_permission", "O Android recusou o acesso ao dispositivo Bluetooth.");
            emitStatus("error", "bluetooth_permission");
        }
    }

    private final BluetoothGattCallback callback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt bluetoothGatt, int status, int newState) {
            if (bluetoothGatt != gatt || stopping) return;
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                reconnectAttempt = 0;
                emitStatus("discovering", null);
                boolean started = bluetoothGatt.discoverServices();
                if (!started) scheduleReconnect();
                return;
            }
            subscribed = false;
            activeCharacteristic = null;
            if (!stopping) {
                emitStatus("reconnecting", "gatt_disconnected");
                scheduleReconnect();
            }
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt bluetoothGatt, int status) {
            if (bluetoothGatt != gatt || stopping) return;
            if (status != BluetoothGatt.GATT_SUCCESS) {
                emitError("service_discovery", "Não foi possível descobrir os serviços do monitor.");
                scheduleReconnect();
                return;
            }
            BluetoothGattCharacteristic characteristic = chooseCharacteristic(bluetoothGatt.getServices());
            if (characteristic == null) {
                emitError("hr_characteristic_missing", "Nenhum canal notificável de frequência cardíaca foi encontrado.");
                scheduleReconnect();
                return;
            }
            activeCharacteristic = characteristic;
            enableNotifications(bluetoothGatt, characteristic);
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt bluetoothGatt, BluetoothGattDescriptor descriptor, int status) {
            if (bluetoothGatt != gatt || activeCharacteristic == null || descriptor == null) return;
            if (!CCCD.equals(descriptor.getUuid())) return;
            if (status == BluetoothGatt.GATT_SUCCESS) {
                subscribed = true;
                lastSampleAtMs = System.currentTimeMillis();
                emitStatus("connected", null);
                scheduleStaleCheck();
            } else {
                emitError("notification_descriptor", "O monitor recusou a ativação das notificações BLE.");
                scheduleReconnect();
            }
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt bluetoothGatt, BluetoothGattCharacteristic characteristic) {
            handleCharacteristicValue(bluetoothGatt, characteristic, characteristic.getValue());
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt bluetoothGatt, BluetoothGattCharacteristic characteristic, byte[] value) {
            handleCharacteristicValue(bluetoothGatt, characteristic, value);
        }
    };

    private BluetoothGattCharacteristic chooseCharacteristic(List<BluetoothGattService> services) {
        List<BluetoothGattCharacteristic> candidates = new ArrayList<>();
        for (BluetoothGattService service : services) {
            for (BluetoothGattCharacteristic characteristic : service.getCharacteristics()) {
                if (!supportsNotify(characteristic)) continue;
                if (HR_MEASUREMENT.equals(characteristic.getUuid())) return characteristic;
                if (KNOWN_CHARACTERISTICS.contains(characteristic.getUuid())) candidates.add(characteristic);
            }
        }
        if (!candidates.isEmpty()) return candidates.get(0);

        // Fallback conservador: só aceita características notificáveis em serviços
        // conhecidos, evitando interpretar bytes de serviços aleatórios como BPM.
        for (BluetoothGattService service : services) {
            if (!isLikelyHeartRateService(service.getUuid())) continue;
            for (BluetoothGattCharacteristic characteristic : service.getCharacteristics()) {
                if (supportsNotify(characteristic)) return characteristic;
            }
        }
        return null;
    }

    private boolean supportsNotify(BluetoothGattCharacteristic characteristic) {
        int properties = characteristic.getProperties();
        return (properties & BluetoothGattCharacteristic.PROPERTY_NOTIFY) != 0 ||
            (properties & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0;
    }

    private boolean isLikelyHeartRateService(UUID uuid) {
        if (HR_SERVICE.equals(uuid) || KNOWN_SERVICES.contains(uuid)) return true;
        String value = uuid.toString().toLowerCase(Locale.US);
        return value.contains("180d") || value.contains("pmd") || value.contains("3802") ||
            value.matches(".*(fee[071]|fff[0-9a-f]|ffe[0-9a-f]|fef[05-9a-f]).*");
    }

    private void enableNotifications(BluetoothGatt bluetoothGatt, BluetoothGattCharacteristic characteristic) {
        boolean enabled = bluetoothGatt.setCharacteristicNotification(characteristic, true);
        if (!enabled) {
            emitError("notification_enable", "Não foi possível assinar o canal de frequência cardíaca.");
            scheduleReconnect();
            return;
        }

        BluetoothGattDescriptor descriptor = characteristic.getDescriptor(CCCD);
        if (descriptor == null) {
            // Alguns dispositivos notificam sem expor o CCCD no discovery.
            subscribed = true;
            emitStatus("connected", null);
            scheduleStaleCheck();
            return;
        }

        byte[] value = (characteristic.getProperties() & BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0
            ? BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
            : BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            bluetoothGatt.writeDescriptor(descriptor, value);
        } else {
            descriptor.setValue(value);
            bluetoothGatt.writeDescriptor(descriptor);
        }
    }

    private void handleCharacteristicValue(BluetoothGatt bluetoothGatt, BluetoothGattCharacteristic characteristic, byte[] value) {
        if (bluetoothGatt != gatt || stopping || !subscribed || value == null || value.length == 0) return;
        ParsedMeasurement measurement = HR_MEASUREMENT.equals(characteristic.getUuid())
            ? parseStandard(value)
            : parseFallback(value);
        if (measurement.bpm == null) return;

        long capturedAt = System.currentTimeMillis();
        lastSampleAtMs = capturedAt;
        refreshWakeLock(capturedAt);
        try {
            store.addSample(
                sessionId,
                capturedAt,
                measurement.bpm,
                measurement.rrIntervalsJson,
                measurement.rrTotal,
                measurement.rrInvalid,
                measurement.rrAdvertised,
                measurement.rrPayloadTruncated
            );
        } catch (RuntimeException error) {
            emitError("sample_persist", "Não foi possível salvar uma amostra local de FC.");
        }

        JSBridgeSample.emit(sessionId, capturedAt, deviceId, deviceName, measurement);
    }

    private ParsedMeasurement parseStandard(byte[] value) {
        if (value.length < 2) return ParsedMeasurement.empty(true);
        int flags = value[0] & 0xff;
        boolean bpm16 = (flags & 0x01) != 0;
        boolean energy = (flags & 0x08) != 0;
        boolean rrPresent = (flags & 0x10) != 0;
        int offset = 1;
        Integer bpm = null;
        if (bpm16) {
            if (value.length < offset + 2) return ParsedMeasurement.empty(rrPresent);
            bpm = uint16(value, offset);
            offset += 2;
        } else {
            bpm = value[offset] & 0xff;
            offset += 1;
        }
        if (energy) {
            if (value.length < offset + 2) {
                return new ParsedMeasurement(plausibleBpm(bpm) ? bpm : null, "[]", 0, 0, rrPresent, true);
            }
            offset += 2;
        }
        if (!rrPresent || offset >= value.length) {
            return new ParsedMeasurement(plausibleBpm(bpm) ? bpm : null, "[]", 0, 0, rrPresent, false);
        }
        return parseRr(value, offset, bpm, rrPresent);
    }

    private ParsedMeasurement parseFallback(byte[] value) {
        Integer standardBpm = value.length >= 2 ? (parseStandard(value).bpm) : null;
        if (standardBpm != null) return parseStandard(value);
        if (value.length >= 2) {
            int raw = uint16(value, 0);
            if (plausibleBpm(raw)) return new ParsedMeasurement(raw, "[]", 0, 0, false, false);
        }
        int first = value[0] & 0xff;
        if (plausibleBpm(first)) return new ParsedMeasurement(first, "[]", 0, 0, false, false);
        for (int i = value.length > 1 ? 1 : 0; i < value.length; i++) {
            int candidate = value[i] & 0xff;
            if (candidate > 40 && candidate < 220) return new ParsedMeasurement(candidate, "[]", 0, 0, false, false);
        }
        return ParsedMeasurement.empty(false);
    }

    private ParsedMeasurement parseRr(byte[] value, int offset, Integer bpm, boolean rrPresent) {
        JSONArray rr = new JSONArray();
        int total = 0;
        int invalid = 0;
        int cursor = offset;
        while (cursor + 1 < value.length) {
            int raw = uint16(value, cursor);
            double ms = raw * 1000.0 / 1024.0;
            total++;
            if (ms >= 250.0 && ms <= 3000.0) {
                try { rr.put(ms); } catch (JSONException ignored) {}
            } else {
                invalid++;
            }
            cursor += 2;
        }
        boolean truncated = cursor < value.length;
        if (truncated) invalid++;
        return new ParsedMeasurement(plausibleBpm(bpm) ? bpm : null, rr.toString(), total, invalid, rrPresent, truncated);
    }

    private int uint16(byte[] value, int offset) {
        return (value[offset] & 0xff) | ((value[offset + 1] & 0xff) << 8);
    }

    private boolean plausibleBpm(@Nullable Integer bpm) {
        return bpm != null && bpm >= 30 && bpm <= 250;
    }

    private void scheduleStaleCheck() {
        if (staleRunnable != null) handler.removeCallbacks(staleRunnable);
        staleRunnable = new Runnable() {
            @Override
            public void run() {
                if (stopping || !subscribed) return;
                if (lastSampleAtMs > 0 && System.currentTimeMillis() - lastSampleAtMs > STALE_TIMEOUT_MS) {
                    subscribed = false;
                    emitStatus("reconnecting", "heart_rate_stale");
                    closeGatt();
                    scheduleReconnect();
                    return;
                }
                handler.postDelayed(this, STALE_CHECK_MS);
            }
        };
        handler.postDelayed(staleRunnable, STALE_CHECK_MS);
    }

    private void scheduleReconnect() {
        if (stopping || deviceId == null) return;
        if (reconnectRunnable != null) handler.removeCallbacks(reconnectRunnable);
        int index = Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1);
        long delay = RECONNECT_DELAYS_MS[index];
        reconnectAttempt = Math.min(reconnectAttempt + 1, RECONNECT_DELAYS_MS.length - 1);
        emitStatus("reconnecting", null);
        reconnectRunnable = () -> {
            reconnectRunnable = null;
            if (!stopping) connectIfNeeded();
        };
        handler.postDelayed(reconnectRunnable, delay);
    }

    /**
     * Um Foreground Service mantém o processo vivo, mas não impede o aparelho de
     * suspender a CPU. Sem o wake lock parcial, com a tela apagada e o celular
     * parado, os {@link Handler#postDelayed} do watchdog de silêncio e do backoff
     * de reconexão deixam de contar — as notificações BLE ainda acordam o rádio e
     * são gravadas, mas a recuperação de uma queda de sinal fica lenta.
     */
    private void acquireWakeLock() {
        if (wakeLock == null) {
            PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
            if (power == null) return;
            wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, getPackageName() + ":heart-rate-session");
            // Sem contagem de referências, adquirir de novo apenas renova o
            // prazo e liberar uma vez basta — não há como ficar desbalanceado.
            wakeLock.setReferenceCounted(false);
        }
        try {
            wakeLock.acquire(WAKE_LOCK_TIMEOUT_MS);
            wakeLockRefreshedAtMs = System.currentTimeMillis();
        } catch (RuntimeException ignored) {
            // Sem wake lock a captura continua; só a reconexão fica mais lenta.
        }
    }

    private void refreshWakeLock(long nowMs) {
        if (wakeLock == null) return;
        if (nowMs - wakeLockRefreshedAtMs < WAKE_LOCK_REFRESH_MS) return;
        acquireWakeLock();
    }

    private void releaseWakeLock() {
        if (wakeLock == null) return;
        try {
            if (wakeLock.isHeld()) wakeLock.release();
        } catch (RuntimeException ignored) {}
    }

    private void closeGatt() {
        if (gatt == null) return;
        try { gatt.disconnect(); } catch (RuntimeException ignored) {}
        try { gatt.close(); } catch (RuntimeException ignored) {}
        gatt = null;
        activeCharacteristic = null;
        subscribed = false;
    }

    private void stopSession(String reason) {
        if (stopping) return;
        stopping = true;
        if (reconnectRunnable != null) handler.removeCallbacks(reconnectRunnable);
        if (staleRunnable != null) handler.removeCallbacks(staleRunnable);
        closeGatt();
        // ACTION_STOP pode chegar a uma instância recém-criada (a notificação
        // sobreviveu ao processo, ou o app está limpando uma sessão órfã). Sem
        // resolver o registro ativo aqui, a linha ficaria active=1 para sempre e
        // o app voltaria a exibir uma sessão que ninguém está alimentando.
        if (store != null) {
            if (sessionId == null) {
                HrSessionStore.SessionRecord active = store.getActiveSession();
                if (active != null) {
                    sessionId = active.sessionId;
                    if (deviceId == null) deviceId = active.deviceId;
                    if (deviceName == null) deviceName = active.deviceName;
                }
            }
            if (sessionId != null) store.markEnded(sessionId, System.currentTimeMillis());
        }
        emitStatus("disconnected", reason);
        releaseWakeLock();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Sessão de frequência cardíaca",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Mantém a leitura BLE de FC durante o treino.");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void emitStatus(String status, @Nullable String reason) {
        JSBridgeSample.emitStatus(sessionId, status, reason, deviceId, deviceName);
    }

    private void emitError(String code, String message) {
        JSBridgeSample.emitDiagnostic(sessionId, code, message, deviceId, deviceName);
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // A sessão continua viva quando o usuário remove apenas a Activity da
        // lista de recentes; o encerramento é explícito pelo app/notificação.
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        if (!stopping) {
            closeGatt();
            if (staleRunnable != null) handler.removeCallbacks(staleRunnable);
            if (reconnectRunnable != null) handler.removeCallbacks(reconnectRunnable);
        }
        // Rede de segurança: o processo pode ser encerrado sem passar por
        // stopSession (memória baixa, kill do fabricante).
        releaseWakeLock();
        if (store != null) store.close();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private static final class ParsedMeasurement {
        final Integer bpm;
        final String rrIntervalsJson;
        final int rrTotal;
        final int rrInvalid;
        final boolean rrAdvertised;
        final boolean rrPayloadTruncated;

        ParsedMeasurement(Integer bpm, String rrIntervalsJson, int rrTotal, int rrInvalid,
                          boolean rrAdvertised, boolean rrPayloadTruncated) {
            this.bpm = bpm;
            this.rrIntervalsJson = rrIntervalsJson;
            this.rrTotal = rrTotal;
            this.rrInvalid = rrInvalid;
            this.rrAdvertised = rrAdvertised;
            this.rrPayloadTruncated = rrPayloadTruncated;
        }

        static ParsedMeasurement empty(boolean rrAdvertised) {
            return new ParsedMeasurement(null, "[]", 0, 0, rrAdvertised, true);
        }
    }

    /** Adaptador pequeno para que o serviço não dependa do ciclo de vida do Plugin. */
    static final class JSBridgeSample {
        static void emit(String sessionId, long capturedAtMs, String deviceId, String deviceName, ParsedMeasurement measurement) {
            try {
                JSONObject data = new JSONObject();
                data.put("sessionId", sessionId);
                data.put("capturedAtMs", capturedAtMs);
                data.put("bpm", measurement.bpm);
                data.put("rrIntervalsMs", new JSONArray(measurement.rrIntervalsJson));
                data.put("sourceId", deviceId);
                data.put("sourceName", deviceName);
                JSONObject quality = new JSONObject();
                quality.put("rrTotal", measurement.rrTotal);
                quality.put("rrInvalid", measurement.rrInvalid);
                quality.put("rrAdvertised", measurement.rrAdvertised);
                quality.put("rrPayloadTruncated", measurement.rrPayloadTruncated);
                data.put("quality", quality);
                BleForegroundPlugin.emitEvent("heartRate", data);
            } catch (JSONException ignored) {
                // A amostra já foi persistida; uma falha de evento será recuperada
                // pelo snapshot quando o WebView voltar ao primeiro plano.
            }
        }

        static void emitStatus(String sessionId, String status, @Nullable String reason, String deviceId, String deviceName) {
            try {
                JSONObject data = new JSONObject();
                data.put("sessionId", sessionId);
                data.put("status", status);
                data.put("deviceId", deviceId);
                data.put("deviceName", deviceName);
                if (reason != null) data.put("reason", reason);
                BleForegroundPlugin.emitEvent("status", data);
            } catch (JSONException ignored) {}
        }

        static void emitDiagnostic(String sessionId, String code, String message, String deviceId, String deviceName) {
            try {
                JSONObject data = new JSONObject();
                data.put("sessionId", sessionId);
                data.put("code", code);
                data.put("message", message);
                data.put("level", "warning");
                data.put("deviceId", deviceId);
                data.put("deviceName", deviceName);
                BleForegroundPlugin.emitEvent("diagnostic", data);
            } catch (JSONException ignored) {}
        }
    }
}

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
    private static final long[] RECONNECT_DELAYS_MS = {1000L, 2000L, 4000L, 8000L, 15000L};
    private static final long STALE_TIMEOUT_MS = 10000L;
    private static final long STALE_CHECK_MS = 2000L;
    // Timeout do connectGatt. Sem ele, uma tentativa que nunca recebe callback
    // (relógio fora de alcance, ou autoConnect esperando o próximo anúncio)
    // deixa o serviço parado em "reconectando" para sempre.
    private static final long DIRECT_CONNECT_TIMEOUT_MS = 12000L;
    private static final long AUTO_CONNECT_TIMEOUT_MS = 25000L;
    // O Android falha a descoberta de serviços com frequência quando ela é
    // disparada no mesmo instante do callback de conexão — sintoma clássico em
    // aparelhos Samsung e em relógios Wear OS.
    private static final long DISCOVERY_DELAY_MS = 600L;
    // Nunca chegou a assinar o canal de FC nesta sessão: insistir para sempre só
    // mantém o usuário olhando um spinner. Falha determinística vira mensagem.
    private static final int MAX_COLD_ATTEMPTS = 5;
    // Já recebeu FC: a queda é de sinal e vale insistir bem mais antes de parar.
    private static final int MAX_WARM_ATTEMPTS = 20;
    // A partir da 3ª tentativa usamos autoConnect: o próprio stack do Android
    // passa a esperar o dispositivo reaparecer, contornando o status 133 crônico
    // de relógios que anunciam de forma intermitente (Galaxy Watch).
    private static final int AUTO_CONNECT_FROM_ATTEMPT = 2;
    // Janela para o usuário confirmar o pareamento antes de reabrir o GATT.
    private static final long BOND_WAIT_MS = 12000L;

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
    /** Já assinou o canal de FC ao menos uma vez nesta sessão (queda ≠ falha inicial). */
    private boolean everSubscribed;
    /** Evita repetir o diagnóstico de "primeira leitura" a cada notificação. */
    private boolean firstSampleLogged;
    /** Pareamento já solicitado nesta sessão — não insiste a cada tentativa. */
    private boolean bondRequested;
    /** Quantas vezes o discovery terminou sem canal de FC (cache velho vs. real). */
    private int missingChannelCount;
    private int reconnectAttempt;
    private long lastSampleAtMs;
    private Runnable reconnectRunnable;
    private Runnable staleRunnable;
    private Runnable connectTimeoutRunnable;

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
        firstSampleLogged = false;
        bondRequested = false;
        missingChannelCount = 0;
        if (!sameSession) everSubscribed = false;

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
            stopSelf();
            return false;
        }
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
            String message = "Permissão de \u201cDispositivos por perto\u201d não concedida. "
                + "Autorize-a em Configurações → Apps → Permissões e conecte novamente.";
            emitError("bluetooth_permission", message);
            emitStatus("error", message);
            return;
        }

        BluetoothManager manager = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            emitError("bluetooth_off", "O Bluetooth está desligado. Ative-o para retomar a leitura de FC.");
            scheduleReconnect("bluetooth_off");
            return;
        }

        try {
            BluetoothDevice device = adapter.getRemoteDevice(deviceId);
            closeGatt();
            subscribed = false;
            firstSampleLogged = false;
            emitStatus(reconnectAttempt == 0 ? "connecting" : "reconnecting", null);

            // autoConnect só a partir da 3ª tentativa: direto é mais rápido
            // quando o relógio está anunciando; autoConnect é o que resolve o
            // caso em que ele anuncia de forma intermitente (status 133 em loop).
            boolean autoConnect = reconnectAttempt >= AUTO_CONNECT_FROM_ATTEMPT;
            emitDiagnostic(
                "gatt_connecting",
                autoConnect
                    ? "Aguardando o dispositivo anunciar para conectar (tentativa " + (reconnectAttempt + 1) + ")."
                    : "Abrindo conexão GATT com " + safeDeviceName() + " (tentativa " + (reconnectAttempt + 1) + ").",
                "info"
            );
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                gatt = device.connectGatt(this, autoConnect, callback, BluetoothDevice.TRANSPORT_LE);
            } else {
                gatt = device.connectGatt(this, autoConnect, callback);
            }
            scheduleConnectTimeout(autoConnect);
        } catch (IllegalArgumentException error) {
            String message = "Identificador BLE inválido para este Android. Refaça a busca por dispositivos.";
            emitError("invalid_device", message);
            emitStatus("error", message);
        } catch (SecurityException error) {
            String message = "O Android recusou o acesso ao dispositivo Bluetooth. "
                + "Verifique a permissão de \u201cDispositivos por perto\u201d do app.";
            emitError("bluetooth_permission", message);
            emitStatus("error", message);
        }
    }

    private final BluetoothGattCallback callback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt bluetoothGatt, int status, int newState) {
            if (bluetoothGatt != gatt || stopping) return;
            if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                cancelConnectTimeout();
                // reconnectAttempt NÃO é zerado aqui: um relógio que conecta e
                // cai em seguida (padrão comum no Galaxy Watch) manteria o loop
                // infinito. O contador só zera quando a assinatura dá certo.
                emitDiagnostic("gatt_connected", "Conectado ao GATT de " + safeDeviceName() + ".", "success");
                emitStatus("discovering", null);
                handler.postDelayed(() -> {
                    if (stopping || bluetoothGatt != gatt) return;
                    if (!bluetoothGatt.discoverServices()) {
                        emitDiagnostic("service_discovery", "O Android recusou a descoberta de serviços do monitor.", "error");
                        scheduleReconnect("service_discovery");
                    }
                }, DISCOVERY_DELAY_MS);
                return;
            }
            subscribed = false;
            activeCharacteristic = null;
            if (stopping) return;
            cancelConnectTimeout();
            // Fecha já: cada BluetoothGatt aberto consome um "client interface"
            // do Android (limite baixo). Vazá-los faz TODA tentativa seguinte
            // falhar com status 133, mesmo com o relógio ao alcance.
            closeGatt();
            emitDiagnostic(
                "gatt_disconnected",
                "A conexão BLE caiu " + gattStatusLabel(status) + ".",
                status == BluetoothGatt.GATT_SUCCESS ? "info" : "warning"
            );
            scheduleReconnect("gatt_disconnected");
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt bluetoothGatt, int status) {
            if (bluetoothGatt != gatt || stopping) return;
            if (status != BluetoothGatt.GATT_SUCCESS) {
                emitDiagnostic("service_discovery", "Não foi possível descobrir os serviços do monitor " + gattStatusLabel(status) + ".", "error");
                scheduleReconnect("service_discovery");
                return;
            }
            List<BluetoothGattService> services = bluetoothGatt.getServices();
            emitDiagnostic(
                "services_discovered",
                services.size() + " serviço(s) BLE descoberto(s).",
                "info",
                describeServices(services)
            );
            BluetoothGattCharacteristic characteristic = chooseCharacteristic(services);
            if (characteristic == null) {
                missingChannelCount++;
                if (missingChannelCount < 2) {
                    // O Android às vezes entrega um cache antigo de serviços na
                    // primeira descoberta. Uma reconexão limpa refaz a leitura.
                    emitDiagnostic(
                        "hr_characteristic_missing",
                        "Nenhum canal de FC nos serviços lidos — refazendo a descoberta.",
                        "warning",
                        describeServices(services)
                    );
                    scheduleReconnect("hr_characteristic_missing");
                    return;
                }
                // Determinístico: o link está de pé e os serviços foram lidos
                // duas vezes — o relógio não expõe FC por BLE. Reconectar em
                // loop nunca muda esse resultado; vira mensagem acionável.
                failTerminal("hr_characteristic_missing", noHeartRateAdvice(), describeServices(services));
                return;
            }
            missingChannelCount = 0;
            activeCharacteristic = characteristic;
            emitDiagnostic("notification_subscribe", "Assinando o canal " + characteristic.getUuid() + ".", "info");
            enableNotifications(bluetoothGatt, characteristic);
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt bluetoothGatt, BluetoothGattDescriptor descriptor, int status) {
            if (bluetoothGatt != gatt || activeCharacteristic == null || descriptor == null) return;
            if (!CCCD.equals(descriptor.getUuid())) return;
            if (status == BluetoothGatt.GATT_SUCCESS) {
                markSubscribed();
                return;
            }
            // 5/15/137 = a característica exige vínculo criptografado. Relógios
            // Samsung costumam devolver isso quando o app não está pareado com
            // eles — pedir o bond é o que destrava, não repetir a conexão.
            if ((status == 5 || status == 15 || status == 137) && requestBondIfPossible()) {
                scheduleReconnect("bonding_required");
                return;
            }
            emitDiagnostic("notification_descriptor", "O monitor recusou a ativação das notificações BLE " + gattStatusLabel(status) + ".", "error");
            scheduleReconnect("notification_descriptor");
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
            emitDiagnostic("notification_enable", "Não foi possível assinar o canal de frequência cardíaca.", "error");
            scheduleReconnect("notification_enable");
            return;
        }

        BluetoothGattDescriptor descriptor = characteristic.getDescriptor(CCCD);
        if (descriptor == null) {
            // Alguns dispositivos notificam sem expor o CCCD no discovery.
            markSubscribed();
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
        if (!firstSampleLogged) {
            firstSampleLogged = true;
            emitDiagnostic("heart_rate_received", "Leitura válida recebida: " + measurement.bpm + " BPM.", "success");
        }
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
                    emitDiagnostic("heart_rate_stale", "O canal ficou em silêncio por mais de " + (STALE_TIMEOUT_MS / 1000) + "s — reassinando.", "warning");
                    closeGatt();
                    scheduleReconnect("heart_rate_stale");
                    return;
                }
                handler.postDelayed(this, STALE_CHECK_MS);
            }
        };
        handler.postDelayed(staleRunnable, STALE_CHECK_MS);
    }

    private void markSubscribed() {
        cancelConnectTimeout();
        subscribed = true;
        everSubscribed = true;
        bondRequested = false;
        // Só aqui o contador zera: uma conexão que não chega a assinar o canal
        // continua consumindo o orçamento de tentativas.
        reconnectAttempt = 0;
        lastSampleAtMs = System.currentTimeMillis();
        emitDiagnostic("notification_ready", "Canal de FC assinado — aguardando leituras.", "success");
        emitStatus("connected", null);
        scheduleStaleCheck();
    }

    private void scheduleConnectTimeout(boolean autoConnect) {
        cancelConnectTimeout();
        long timeout = autoConnect ? AUTO_CONNECT_TIMEOUT_MS : DIRECT_CONNECT_TIMEOUT_MS;
        connectTimeoutRunnable = () -> {
            connectTimeoutRunnable = null;
            if (stopping || subscribed) return;
            emitDiagnostic(
                "connect_timeout",
                "O dispositivo não respondeu em " + (timeout / 1000) + "s.",
                "warning"
            );
            // Sem fechar o GATT pendente, a conexão continua em andamento em
            // segundo plano e a próxima tentativa encontra o rádio ocupado.
            closeGatt();
            scheduleReconnect("connect_timeout");
        };
        handler.postDelayed(connectTimeoutRunnable, timeout);
    }

    private void cancelConnectTimeout() {
        if (connectTimeoutRunnable != null) handler.removeCallbacks(connectTimeoutRunnable);
        connectTimeoutRunnable = null;
    }

    private void scheduleReconnect() {
        scheduleReconnect(null);
    }

    private void scheduleReconnect(@Nullable String cause) {
        if (stopping || deviceId == null) return;
        if (reconnectRunnable != null) handler.removeCallbacks(reconnectRunnable);
        cancelConnectTimeout();

        int maxAttempts = everSubscribed ? MAX_WARM_ATTEMPTS : MAX_COLD_ATTEMPTS;
        if (reconnectAttempt >= maxAttempts) {
            failTerminal(
                everSubscribed ? "reconnect_exhausted" : "connection_failed",
                everSubscribed ? signalLostAdvice() : linkFailureAdvice(),
                cause
            );
            return;
        }

        long delay = "bonding_required".equals(cause)
            ? BOND_WAIT_MS
            : RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
        reconnectAttempt++;
        emitDiagnostic(
            "reconnect_scheduled",
            "Nova tentativa em " + Math.round(delay / 1000.0) + "s (" + reconnectAttempt + "/" + maxAttempts + ").",
            "info",
            cause
        );
        emitStatus("reconnecting", cause);
        reconnectRunnable = () -> {
            reconnectRunnable = null;
            if (!stopping) connectIfNeeded();
        };
        handler.postDelayed(reconnectRunnable, delay);
    }

    /**
     * Encerra a sessão com uma mensagem acionável em vez de reconectar sem fim.
     * O WebView recebe o texto em `reason` e o exibe (com a dica da marca) na
     * tela de dispositivos — o que o loop silencioso nunca fazia.
     */
    private void failTerminal(String code, String message, @Nullable String detail) {
        if (stopping) return;
        if (reconnectRunnable != null) handler.removeCallbacks(reconnectRunnable);
        reconnectRunnable = null;
        cancelConnectTimeout();
        emitDiagnostic(code, message, "error", detail);
        emitStatus("error", message);
        closeGatt();
        // stopForeground/stopSelf a partir da main thread: failTerminal é
        // chamado de callbacks do GATT, que rodam em thread do binder.
        handler.post(() -> stopSession(code));
    }

    /** Pede o pareamento quando o relógio exige vínculo criptografado. */
    private boolean requestBondIfPossible() {
        if (bondRequested || gatt == null) return false;
        BluetoothDevice device = gatt.getDevice();
        if (device == null || device.getBondState() != BluetoothDevice.BOND_NONE) return false;
        bondRequested = true;
        boolean started = device.createBond();
        emitDiagnostic(
            "bonding_required",
            started
                ? "O dispositivo exige pareamento. Confirme o pedido que aparecer na tela do celular ou do relógio."
                : "O dispositivo exige pareamento, mas o Android recusou o pedido. Pareie-o em Configurações → Bluetooth.",
            "warning"
        );
        return started;
    }

    private String safeDeviceName() {
        return deviceName == null || deviceName.trim().isEmpty() ? "dispositivo" : deviceName;
    }

    private boolean isSamsungDevice() {
        return deviceName != null &&
            deviceName.toLowerCase(Locale.US).matches(".*(galaxy|samsung|gear|sm-r).*");
    }

    private boolean isGarminDevice() {
        return deviceName != null &&
            deviceName.toLowerCase(Locale.US).matches(".*(garmin|forerunner|fenix|f\u00e9nix|venu|vivoactive|vivosmart|instinct|epix|enduro).*");
    }

    /** Conectou e leu os serviços, mas nenhum canal de FC — orientação por marca. */
    private String noHeartRateAdvice() {
        if (isSamsungDevice()) {
            return "O Galaxy Watch conectou, mas não expõe frequência cardíaca por Bluetooth. "
                + "Relógios Samsung só transmitem FC por BLE com um app transmissor instalado no relógio; "
                + "sem ele, sincronize pelo Health Connect / Samsung Health.";
        }
        if (isGarminDevice()) {
            return "Garmin conectado, mas sem FC. No relógio, ative \u201cTransmitir FC\u201d, inicie uma atividade "
                + "e feche o Garmin Connect antes de tentar novamente.";
        }
        return "O dispositivo conectou, mas não expõe um canal de frequência cardíaca por BLE. "
            + "Ative a transmissão de FC ou inicie um treino nele e tente de novo.";
    }

    /** Nunca conseguiu subir o link GATT. */
    private String linkFailureAdvice() {
        if (isSamsungDevice()) {
            return "Não foi possível conectar ao " + safeDeviceName() + ". Relógios Samsung recusam novas conexões BLE "
                + "enquanto estão ocupados: deixe o relógio no pulso e desbloqueado, feche o Galaxy Wearable/Samsung Health, "
                + "aproxime-o do celular e tente de novo. Se persistir, sincronize pelo Health Connect.";
        }
        return "Não foi possível conectar ao " + safeDeviceName() + ". Aproxime o dispositivo, verifique se ele não está "
            + "conectado a outro app e tente novamente.";
    }

    /** Estava lendo FC e o sinal caiu de vez. */
    private String signalLostAdvice() {
        return "O sinal de " + safeDeviceName() + " foi perdido e não voltou. Aproxime o dispositivo do celular e "
            + "conecte novamente para seguir com o treino.";
    }

    private String describeServices(List<BluetoothGattService> services) {
        StringBuilder builder = new StringBuilder();
        for (BluetoothGattService service : services) {
            if (builder.length() > 0) builder.append(", ");
            builder.append(service.getUuid());
        }
        return builder.length() == 0 ? "nenhum serviço exposto" : builder.toString();
    }

    private String gattStatusLabel(int status) {
        switch (status) {
            case BluetoothGatt.GATT_SUCCESS: return "(encerrada normalmente)";
            case 8: return "(código 8 — o dispositivo saiu de alcance ou desligou o rádio)";
            case 19: return "(código 19 — o próprio dispositivo encerrou a conexão)";
            case 22: return "(código 22 — falha de sincronia do link)";
            case 133: return "(código 133 — o dispositivo não aceitou a conexão; costuma ser rádio ocupado ou anúncio intermitente)";
            default: return "(código " + status + ")";
        }
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
        cancelConnectTimeout();
        closeGatt();
        if (sessionId != null && store != null) store.markEnded(sessionId, System.currentTimeMillis());
        emitStatus("disconnected", reason);
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
        emitDiagnostic(code, message, "error");
    }

    private void emitDiagnostic(String code, String message, String level) {
        emitDiagnostic(code, message, level, null);
    }

    private void emitDiagnostic(String code, String message, String level, @Nullable String detail) {
        JSBridgeSample.emitDiagnostic(sessionId, code, message, level, detail, deviceId, deviceName);
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
            cancelConnectTimeout();
        }
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

        static void emitDiagnostic(String sessionId, String code, String message, String level,
                                   @Nullable String detail, String deviceId, String deviceName) {
            try {
                JSONObject data = new JSONObject();
                data.put("sessionId", sessionId);
                data.put("code", code);
                data.put("message", message);
                data.put("level", level);
                if (detail != null) data.put("detail", detail);
                data.put("deviceId", deviceId);
                data.put("deviceName", deviceName);
                BleForegroundPlugin.emitEvent("diagnostic", data);
            } catch (JSONException ignored) {}
        }
    }
}

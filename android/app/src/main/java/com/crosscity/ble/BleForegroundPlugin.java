package com.crosscity.ble;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;
import org.json.JSONObject;

import java.lang.ref.WeakReference;
import java.util.List;

@CapacitorPlugin(
    name = "BleForeground",
    permissions = {
        @Permission(
            alias = "bluetoothConnect",
            strings = { "android.permission.BLUETOOTH_CONNECT" }
        ),
        @Permission(
            alias = "notifications",
            strings = { "android.permission.POST_NOTIFICATIONS" }
        )
    }
)
public final class BleForegroundPlugin extends Plugin {
    private static volatile WeakReference<BleForegroundPlugin> instance = new WeakReference<>(null);

    @Override
    public void load() {
        instance = new WeakReference<>(this);
    }

    @PluginMethod
    public void startSession(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetoothConnect", call, "permissionsForStart");
            return;
        }
        requestNotificationIfNeeded(call);
    }

    @PermissionCallback
    private void permissionsForStart(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
            call.reject("Permissão BLUETOOTH_CONNECT não concedida.");
            return;
        }
        requestNotificationIfNeeded(call);
    }

    private void requestNotificationIfNeeded(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "notificationForStart");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void notificationForStart(PluginCall call) {
        // A notificação é importante para transparência, mas uma recusa não
        // deve impedir a leitura BLE iniciada pelo usuário.
        startService(call);
    }

    private void startService(PluginCall call) {
        String deviceId = call.getString("deviceId");
        String deviceName = call.getString("deviceName", "Monitor cardíaco");
        String sessionId = call.getString("sessionId");
        if (deviceId == null || deviceId.trim().isEmpty() || sessionId == null || sessionId.trim().isEmpty()) {
            call.reject("deviceId e sessionId são obrigatórios.");
            return;
        }

        Intent intent = new Intent(getContext(), HrBleForegroundService.class)
            .setAction(HrBleForegroundService.ACTION_START)
            .putExtra(HrBleForegroundService.EXTRA_DEVICE_ID, deviceId)
            .putExtra(HrBleForegroundService.EXTRA_DEVICE_NAME, deviceName)
            .putExtra(HrBleForegroundService.EXTRA_SESSION_ID, sessionId);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(getContext(), intent);
            } else {
                getContext().startService(intent);
            }
            call.resolve();
        } catch (SecurityException error) {
            call.reject("O Android recusou o início da sessão BLE em segundo plano.", error);
        } catch (RuntimeException error) {
            call.reject("Não foi possível iniciar a sessão BLE.", error);
        }
    }

    @PluginMethod
    public void stopSession(PluginCall call) {
        Intent intent = new Intent(getContext(), HrBleForegroundService.class)
            .setAction(HrBleForegroundService.ACTION_STOP);
        try {
            getContext().startService(intent);
            call.resolve();
        } catch (RuntimeException error) {
            call.reject("Não foi possível encerrar a sessão BLE.", error);
        }
    }

    @PluginMethod
    public void getActiveSession(PluginCall call) {
        HrSessionStore store = new HrSessionStore(getContext());
        try {
            HrSessionStore.SessionRecord session = store.getActiveSession();
            call.resolve(sessionToJson(session));
        } finally {
            store.close();
        }
    }

    @PluginMethod
    public void getSnapshot(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (sessionId == null || sessionId.trim().isEmpty()) {
            call.reject("sessionId é obrigatório.");
            return;
        }
        HrSessionStore store = new HrSessionStore(getContext());
        try {
            HrSessionStore.SessionRecord session = store.getSession(sessionId);
            if (session == null) {
                call.resolve(new JSObject().put("active", false).put("sampleCount", 0));
                return;
            }
            call.resolve(sessionToJson(session));
        } finally {
            store.close();
        }
    }

    @PluginMethod
    public void listSamples(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (sessionId == null || sessionId.trim().isEmpty()) {
            call.reject("sessionId é obrigatório.");
            return;
        }
        Long after = call.getLong("afterMs");
        long afterMs = after == null ? 0L : Math.max(0L, after);
        HrSessionStore store = new HrSessionStore(getContext());
        try {
            List<HrSessionStore.SampleRecord> records = store.listSamples(sessionId, afterMs);
            JSArray samples = new JSArray();
            for (HrSessionStore.SampleRecord record : records) {
                samples.put(sampleToJson(record));
            }
            call.resolve(new JSObject().put("samples", samples));
        } finally {
            store.close();
        }
    }

    private JSObject sessionToJson(HrSessionStore.SessionRecord session) {
        JSObject result = new JSObject();
        if (session == null) {
            result.put("active", false);
            result.put("sampleCount", 0);
            return result;
        }
        result.put("active", session.active);
        result.put("sessionId", session.sessionId);
        result.put("deviceId", session.deviceId);
        result.put("deviceName", session.deviceName);
        result.put("startedAtMs", session.startedAtMs);
        result.put("endedAtMs", session.endedAtMs);
        result.put("lastBpm", session.lastBpm);
        result.put("lastSampleMs", session.lastSampleMs);
        result.put("sampleCount", session.sampleCount);
        return result;
    }

    private JSObject sampleToJson(HrSessionStore.SampleRecord sample) {
        JSObject result = new JSObject();
        result.put("capturedAtMs", sample.capturedAtMs);
        result.put("bpm", sample.bpm);
        try {
            result.put("rrIntervalsMs", new JSArray(sample.rrIntervalsJson));
        } catch (JSONException error) {
            result.put("rrIntervalsMs", new JSArray());
        }
        JSObject quality = new JSObject();
        quality.put("rrTotal", sample.rrTotal);
        quality.put("rrInvalid", sample.rrInvalid);
        quality.put("rrAdvertised", sample.rrAdvertised);
        quality.put("rrPayloadTruncated", sample.rrPayloadTruncated);
        result.put("quality", quality);
        return result;
    }

    static void emitEvent(String eventName, JSONObject data) {
        BleForegroundPlugin plugin = instance.get();
        if (plugin == null || plugin.getActivity() == null) return;
        final JSObject payload;
        try {
            payload = JSObject.fromJSONObject(data);
        } catch (JSONException error) {
            return;
        }
        plugin.getActivity().runOnUiThread(() -> plugin.notifyListeners(eventName, payload, false));
    }

    @Override
    protected void handleOnDestroy() {
        instance.clear();
        super.handleOnDestroy();
    }
}

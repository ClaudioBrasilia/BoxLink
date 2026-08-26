package com.crosscity.ble;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import androidx.annotation.Nullable;

import java.util.ArrayList;
import java.util.List;

/**
 * Armazenamento local da sessão de FC. A captura não depende da ponte JavaScript:
 * o serviço grava antes de notificar o WebView.
 */
public final class HrSessionStore extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "boxlink_hr_sessions.db";
    private static final int DATABASE_VERSION = 1;

    public HrSessionStore(Context context) {
        super(context.getApplicationContext(), DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE IF NOT EXISTS hr_sessions (" +
            "session_id TEXT PRIMARY KEY," +
            "device_id TEXT NOT NULL," +
            "device_name TEXT," +
            "started_at_ms INTEGER NOT NULL," +
            "ended_at_ms INTEGER," +
            "active INTEGER NOT NULL DEFAULT 1," +
            "last_bpm INTEGER," +
            "last_sample_ms INTEGER," +
            "sample_count INTEGER NOT NULL DEFAULT 0" +
            ")");
        db.execSQL("CREATE TABLE IF NOT EXISTS hr_samples (" +
            "id INTEGER PRIMARY KEY AUTOINCREMENT," +
            "session_id TEXT NOT NULL," +
            "captured_at_ms INTEGER NOT NULL," +
            "bpm INTEGER NOT NULL," +
            "rr_intervals_json TEXT NOT NULL," +
            "rr_total INTEGER NOT NULL DEFAULT 0," +
            "rr_invalid INTEGER NOT NULL DEFAULT 0," +
            "rr_advertised INTEGER NOT NULL DEFAULT 0," +
            "rr_payload_truncated INTEGER NOT NULL DEFAULT 0" +
            ")");
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_hr_samples_session_time " +
            "ON hr_samples(session_id, captured_at_ms)");
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        // Reservado para migrações futuras; nunca apagar histórico de FC.
    }

    public synchronized void startSession(String sessionId, String deviceId, @Nullable String deviceName, long startedAtMs) {
        SQLiteDatabase db = getWritableDatabase();
        db.execSQL("UPDATE hr_sessions SET active=0, ended_at_ms=? WHERE active=1 AND session_id<>?",
            new Object[]{startedAtMs, sessionId});
        db.execSQL("INSERT OR REPLACE INTO hr_sessions(session_id, device_id, device_name, started_at_ms, ended_at_ms, active, last_bpm, last_sample_ms, sample_count) " +
                "VALUES(?,?,?,?,?,?,?,?,?)",
            new Object[]{sessionId, deviceId, deviceName, startedAtMs, null, 1, null, null, 0});
    }

    public synchronized void markEnded(String sessionId, long endedAtMs) {
        getWritableDatabase().execSQL("UPDATE hr_sessions SET active=0, ended_at_ms=? WHERE session_id=?",
            new Object[]{endedAtMs, sessionId});
    }

    public synchronized void addSample(String sessionId, long capturedAtMs, int bpm, String rrIntervalsJson,
                                        int rrTotal, int rrInvalid, boolean rrAdvertised, boolean rrPayloadTruncated) {
        SQLiteDatabase db = getWritableDatabase();
        db.execSQL("INSERT INTO hr_samples(session_id, captured_at_ms, bpm, rr_intervals_json, rr_total, rr_invalid, rr_advertised, rr_payload_truncated) " +
                "VALUES(?,?,?,?,?,?,?,?)",
            new Object[]{sessionId, capturedAtMs, bpm, rrIntervalsJson, rrTotal, rrInvalid, rrAdvertised ? 1 : 0, rrPayloadTruncated ? 1 : 0});
        db.execSQL("UPDATE hr_sessions SET last_bpm=?, last_sample_ms=?, sample_count=sample_count+1 WHERE session_id=?",
            new Object[]{bpm, capturedAtMs, sessionId});
    }

    @Nullable
    public synchronized SessionRecord getActiveSession() {
        try (Cursor cursor = getReadableDatabase().query(
            "hr_sessions", null, "active=1", null, null, null, "started_at_ms DESC", "1")) {
            if (!cursor.moveToFirst()) return null;
            return readSession(cursor);
        }
    }

    @Nullable
    public synchronized SessionRecord getSession(String sessionId) {
        try (Cursor cursor = getReadableDatabase().query(
            "hr_sessions", null, "session_id=?", new String[]{sessionId}, null, null, null, "1")) {
            if (!cursor.moveToFirst()) return null;
            return readSession(cursor);
        }
    }

    public synchronized List<SampleRecord> listSamples(String sessionId, long afterMs) {
        List<SampleRecord> samples = new ArrayList<>();
        try (Cursor cursor = getReadableDatabase().query(
            "hr_samples", null, "session_id=? AND captured_at_ms>?",
            new String[]{sessionId, Long.toString(afterMs)}, null, null, "captured_at_ms ASC, id ASC")) {
            while (cursor.moveToNext()) samples.add(readSample(cursor));
        }
        return samples;
    }

    private SessionRecord readSession(Cursor cursor) {
        return new SessionRecord(
            cursor.getString(cursor.getColumnIndexOrThrow("session_id")),
            cursor.getString(cursor.getColumnIndexOrThrow("device_id")),
            cursor.getString(cursor.getColumnIndexOrThrow("device_name")),
            cursor.getLong(cursor.getColumnIndexOrThrow("started_at_ms")),
            cursor.isNull(cursor.getColumnIndexOrThrow("ended_at_ms")) ? null : cursor.getLong(cursor.getColumnIndexOrThrow("ended_at_ms")),
            cursor.getInt(cursor.getColumnIndexOrThrow("active")) == 1,
            cursor.isNull(cursor.getColumnIndexOrThrow("last_bpm")) ? null : cursor.getInt(cursor.getColumnIndexOrThrow("last_bpm")),
            cursor.isNull(cursor.getColumnIndexOrThrow("last_sample_ms")) ? null : cursor.getLong(cursor.getColumnIndexOrThrow("last_sample_ms")),
            cursor.getInt(cursor.getColumnIndexOrThrow("sample_count"))
        );
    }

    private SampleRecord readSample(Cursor cursor) {
        return new SampleRecord(
            cursor.getLong(cursor.getColumnIndexOrThrow("captured_at_ms")),
            cursor.getInt(cursor.getColumnIndexOrThrow("bpm")),
            cursor.getString(cursor.getColumnIndexOrThrow("rr_intervals_json")),
            cursor.getInt(cursor.getColumnIndexOrThrow("rr_total")),
            cursor.getInt(cursor.getColumnIndexOrThrow("rr_invalid")),
            cursor.getInt(cursor.getColumnIndexOrThrow("rr_advertised")) == 1,
            cursor.getInt(cursor.getColumnIndexOrThrow("rr_payload_truncated")) == 1
        );
    }

    public static final class SessionRecord {
        public final String sessionId;
        public final String deviceId;
        public final String deviceName;
        public final long startedAtMs;
        public final Long endedAtMs;
        public final boolean active;
        public final Integer lastBpm;
        public final Long lastSampleMs;
        public final int sampleCount;

        SessionRecord(String sessionId, String deviceId, String deviceName, long startedAtMs, Long endedAtMs,
                      boolean active, Integer lastBpm, Long lastSampleMs, int sampleCount) {
            this.sessionId = sessionId;
            this.deviceId = deviceId;
            this.deviceName = deviceName;
            this.startedAtMs = startedAtMs;
            this.endedAtMs = endedAtMs;
            this.active = active;
            this.lastBpm = lastBpm;
            this.lastSampleMs = lastSampleMs;
            this.sampleCount = sampleCount;
        }
    }

    public static final class SampleRecord {
        public final long capturedAtMs;
        public final int bpm;
        public final String rrIntervalsJson;
        public final int rrTotal;
        public final int rrInvalid;
        public final boolean rrAdvertised;
        public final boolean rrPayloadTruncated;

        SampleRecord(long capturedAtMs, int bpm, String rrIntervalsJson, int rrTotal, int rrInvalid,
                     boolean rrAdvertised, boolean rrPayloadTruncated) {
            this.capturedAtMs = capturedAtMs;
            this.bpm = bpm;
            this.rrIntervalsJson = rrIntervalsJson;
            this.rrTotal = rrTotal;
            this.rrInvalid = rrInvalid;
            this.rrAdvertised = rrAdvertised;
            this.rrPayloadTruncated = rrPayloadTruncated;
        }
    }
}

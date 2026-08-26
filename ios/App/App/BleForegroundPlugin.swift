import Foundation
import Capacitor
import CoreBluetooth

private struct StoredQuality: Codable {
    let rrTotal: Int
    let rrInvalid: Int
    let rrAdvertised: Bool
    let rrPayloadTruncated: Bool
}

private struct StoredSample: Codable {
    let sessionId: String
    let capturedAtMs: Int64
    let bpm: Int
    let rrIntervalsMs: [Double]
    let quality: StoredQuality
    let sourceId: String
    let sourceName: String?
}

private struct StoredSession: Codable {
    let sessionId: String
    let deviceId: String
    var deviceName: String?
    let startedAtMs: Int64
    var endedAtMs: Int64?
    var active: Bool
    var samples: [StoredSample]
}

private final class BleSessionStore {
    private let fileURL: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let directory = support.appendingPathComponent("BoxLink", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        fileURL = directory.appendingPathComponent("ble-session.json")
    }

    func load() -> StoredSession? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? decoder.decode(StoredSession.self, from: data)
    }

    func save(_ session: StoredSession) {
        guard let data = try? encoder.encode(session) else { return }
        try? data.write(to: fileURL, options: [.atomic])
    }
}

private struct ParsedMeasurement {
    let bpm: Int
    let rrIntervalsMs: [Double]
    let quality: StoredQuality
}

private final class IosBleSessionCoordinator: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private static let restoreIdentifier = "com.crosscity.boxlink.ble.central"
    private static let heartRateService = CBUUID(string: "180D")
    private static let heartRateMeasurement = CBUUID(string: "2A37")
    private static let cccd = CBUUID(string: "2902")

    private let store = BleSessionStore()
    private let emitEvent: (String, [String: Any]) -> Void
    private var central: CBCentralManager!
    private var peripheral: CBPeripheral?
    private var targetDeviceId: UUID?
    private var reconnectAttempt = 0
    private var reconnectWorkItem: DispatchWorkItem?
    private var scanTimeoutWorkItem: DispatchWorkItem?
    private var stopping = false
    private var subscribed = false

    private let knownServiceIds: Set<String> = [
        "180d", "fb005c80-02e7-f387-1cad-8acd2d8df0c8", "a026ee0b-0a7d-4ab3-97fa-f1500f9feb8b",
        "3802", "fee0", "fee1", "fee7", "fff0", "ffe0", "fef0", "fef5", "feea",
        "49535343-fe7d-4ae5-8fa9-9fafd205e455", "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
        "0783b03e-8535-b5a0-7140-a304d2495cb7", "1530", "f000ffc0-0451-4000-b000-000000000000",
        "be940000-7333-be46-b7ae-689e71722bd5", "fcd0"
    ]
    private let knownCharacteristicIds: Set<String> = [
        "2a37", "fb005c81-02e7-f387-1cad-8acd2d8df0c8", "4a02", "fff1", "fff4", "fff6",
        "ffe1", "fef6", "6e400003-b5a3-f393-e0a9-e50e24dcca9e"
    ]

    init(emitEvent: @escaping (String, [String: Any]) -> Void) {
        self.emitEvent = emitEvent
        super.init()
        central = CBCentralManager(
            delegate: self,
            queue: DispatchQueue.main,
            options: [CBCentralManagerOptionRestoreIdentifierKey: Self.restoreIdentifier]
        )
    }

    func startSession(deviceId: String, deviceName: String?, sessionId: String) {
        guard let uuid = UUID(uuidString: deviceId) else {
            emitDiagnostic(code: "invalid_device", message: "O identificador do dispositivo iOS não é um UUID válido.")
            return
        }

        stopping = false
        reconnectAttempt = 0
        reconnectWorkItem?.cancel()
        scanTimeoutWorkItem?.cancel()
        targetDeviceId = uuid

        let existing = store.load()
        if existing?.sessionId != sessionId {
            if let current = existing, current.active {
                var ended = current
                ended.active = false
                ended.endedAtMs = nowMs()
                store.save(ended)
            }
            store.save(StoredSession(
                sessionId: sessionId,
                deviceId: deviceId,
                deviceName: deviceName,
                startedAtMs: nowMs(),
                endedAtMs: nil,
                active: true,
                samples: []
            ))
        } else if var resumed = existing, resumed.active {
            resumed.deviceName = deviceName ?? resumed.deviceName
            store.save(resumed)
        }

        if central.state == .poweredOn {
            connectToTarget()
        } else {
            emitStatus("connecting", reason: nil)
        }
    }

    func stopSession() {
        stopping = true
        reconnectWorkItem?.cancel()
        scanTimeoutWorkItem?.cancel()
        central.stopScan()
        if let peripheral {
            central.cancelPeripheralConnection(peripheral)
        }
        self.peripheral = nil
        subscribed = false
        if var session = store.load(), session.active {
            session.active = false
            session.endedAtMs = nowMs()
            store.save(session)
            emitStatus("disconnected", reason: "user")
        } else {
            emitStatus("disconnected", reason: "user")
        }
        targetDeviceId = nil
    }

    func activeSessionPayload() -> [String: Any] {
        guard let session = store.load(), session.active else { return ["active": false, "sampleCount": 0] }
        return sessionPayload(session)
    }

    func snapshotPayload(sessionId: String) -> [String: Any] {
        guard let session = store.load(), session.sessionId == sessionId else {
            return ["active": false, "sampleCount": 0]
        }
        return sessionPayload(session)
    }

    func samplesPayload(sessionId: String, afterMs: Int64) -> [String: Any] {
        let samples = (store.load()?.samples ?? []).filter {
            $0.sessionId == sessionId && $0.capturedAtMs > afterMs
        }
        return ["samples": samples.map(samplePayload)]
    }

    // MARK: CBCentralManagerDelegate

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            if let session = store.load(), session.active {
                targetDeviceId = UUID(uuidString: session.deviceId)
                connectToTarget()
            }
        case .unauthorized:
            emitDiagnostic(code: "bluetooth_permission", message: "Permissão de Bluetooth não concedida no iPhone.")
            emitStatus("error", reason: "bluetooth_permission")
        case .poweredOff:
            emitDiagnostic(code: "bluetooth_off", message: "O Bluetooth está desligado.")
            emitStatus("error", reason: "bluetooth_off")
        case .unsupported:
            emitDiagnostic(code: "bluetooth_unsupported", message: "Este dispositivo não suporta Bluetooth Low Energy.")
            emitStatus("error", reason: "bluetooth_unsupported")
        default:
            emitStatus("connecting", reason: nil)
        }
    }

    func centralManager(_ central: CBCentralManager, willRestoreState dict: [String: Any]) {
        let restored = (dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral]) ?? []
        guard let session = store.load(), session.active else { return }
        targetDeviceId = UUID(uuidString: session.deviceId)
        if let match = restored.first(where: { $0.identifier.uuidString.lowercased() == session.deviceId.lowercased() }) {
            peripheral = match
            match.delegate = self
            emitStatus("reconnecting", reason: "state_restored")
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any], rssi RSSI: NSNumber) {
        guard let target = targetDeviceId, peripheral.identifier == target, !stopping else { return }
        scanTimeoutWorkItem?.cancel()
        central.stopScan()
        self.peripheral = peripheral
        peripheral.delegate = self
        emitStatus("connecting", reason: nil)
        central.connect(peripheral, options: nil)
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        guard !stopping else { return }
        self.peripheral = peripheral
        peripheral.delegate = self
        reconnectAttempt = 0
        updateStoredDeviceName(peripheral.name)
        emitStatus("discovering", reason: nil)
        peripheral.discoverServices(nil)
    }

    func centralManager(_ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?) {
        guard !stopping else { return }
        emitDiagnostic(code: "connect_failed", message: error?.localizedDescription ?? "Falha ao conectar ao monitor.")
        scheduleReconnect()
    }

    func centralManager(_ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?) {
        subscribed = false
        guard !stopping, store.load()?.active == true else { return }
        emitStatus("reconnecting", reason: error?.localizedDescription ?? "disconnected")
        scheduleReconnect()
    }

    // MARK: CBPeripheralDelegate

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard !stopping, error == nil else {
            emitDiagnostic(code: "service_discovery", message: error?.localizedDescription ?? "Não foi possível descobrir os serviços.")
            scheduleReconnect()
            return
        }
        guard let services = peripheral.services else { scheduleReconnect(); return }
        let service = services.first(where: { isLikelyHeartRateService($0.uuid) })
        guard let service else {
            emitDiagnostic(code: "hr_service_missing", message: "Nenhum serviço de frequência cardíaca conhecido foi encontrado.")
            scheduleReconnect()
            return
        }
        peripheral.discoverCharacteristics(nil, for: service)
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard !stopping, error == nil else {
            emitDiagnostic(code: "characteristic_discovery", message: error?.localizedDescription ?? "Não foi possível descobrir o canal de FC.")
            scheduleReconnect()
            return
        }
        guard let characteristic = chooseCharacteristic(service.characteristics ?? []) else {
            emitDiagnostic(code: "hr_characteristic_missing", message: "Nenhum canal notificável de frequência cardíaca foi encontrado.")
            scheduleReconnect()
            return
        }
        peripheral.setNotifyValue(true, for: characteristic)
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil, characteristic.isNotifying else {
            emitDiagnostic(code: "notification_enable", message: error?.localizedDescription ?? "O monitor recusou notificações BLE.")
            scheduleReconnect()
            return
        }
        subscribed = true
        emitStatus("connected", reason: nil)
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard error == nil, subscribed, let data = characteristic.value else { return }
        let isStandard = characteristic.uuid == Self.heartRateMeasurement
        guard let measurement = parse(data: data, standard: isStandard), let session = store.load(), session.active else { return }
        let sample = StoredSample(
            sessionId: session.sessionId,
            capturedAtMs: nowMs(),
            bpm: measurement.bpm,
            rrIntervalsMs: measurement.rrIntervalsMs,
            quality: measurement.quality,
            sourceId: peripheral.identifier.uuidString,
            sourceName: peripheral.name ?? session.deviceName
        )
        var updated = session
        updated.samples.append(sample)
        store.save(updated)
        emitEvent("heartRate", samplePayload(sample))
    }

    // MARK: Core Bluetooth helpers

    private func connectToTarget() {
        guard !stopping, central.state == .poweredOn, let target = targetDeviceId else { return }
        if let current = peripheral, current.identifier == target {
            emitStatus(reconnectAttempt == 0 ? "connecting" : "reconnecting", reason: nil)
            central.connect(current, options: nil)
            return
        }
        let known = central.retrievePeripherals(withIdentifiers: [target])
        if let current = known.first {
            peripheral = current
            current.delegate = self
            emitStatus(reconnectAttempt == 0 ? "connecting" : "reconnecting", reason: nil)
            central.connect(current, options: nil)
            return
        }
        emitStatus("connecting", reason: "scanning")
        central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: false])
        scanTimeoutWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self, !self.stopping else { return }
            self.central.stopScan()
            self.emitDiagnostic(code: "device_not_found", message: "O monitor não foi encontrado para reconexão.")
            self.scheduleReconnect()
        }
        scanTimeoutWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 20, execute: work)
    }

    private func scheduleReconnect() {
        guard !stopping, store.load()?.active == true else { return }
        reconnectWorkItem?.cancel()
        let delays: [Double] = [1, 2, 4]
        let delay = delays[min(reconnectAttempt, delays.count - 1)]
        reconnectAttempt = min(reconnectAttempt + 1, delays.count - 1)
        emitStatus("reconnecting", reason: nil)
        let work = DispatchWorkItem { [weak self] in self?.connectToTarget() }
        reconnectWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: work)
    }

    private func chooseCharacteristic(_ characteristics: [CBCharacteristic]) -> CBCharacteristic? {
        let notifiable = characteristics.filter { $0.properties.contains(.notify) || $0.properties.contains(.indicate) }
        if let standard = notifiable.first(where: { $0.uuid == Self.heartRateMeasurement }) { return standard }
        if let known = notifiable.first(where: { knownCharacteristicIds.contains(normalized($0.uuid)) }) { return known }
        return notifiable.first
    }

    private func isLikelyHeartRateService(_ uuid: CBUUID) -> Bool {
        let normalizedId = normalized(uuid)
        return normalizedId == "180d" || knownServiceIds.contains(normalizedId) ||
            normalizedId.contains("pmd") || normalizedId.contains("fff") || normalizedId.contains("ffe") ||
            normalizedId.contains("fef")
    }

    private func normalized(_ uuid: CBUUID) -> String {
        uuid.uuidString.lowercased().replacingOccurrences(of: "0000", with: "").replacingOccurrences(of: "-1000-8000-00805f9b34fb", with: "")
    }

    private func parse(data: Data, standard: Bool) -> ParsedMeasurement? {
        let bytes = [UInt8](data)
        guard !bytes.isEmpty else { return nil }
        if standard {
            guard bytes.count >= 2 else { return nil }
            let flags = bytes[0]
            let bpm16 = (flags & 0x01) != 0
            let energyPresent = (flags & 0x08) != 0
            let rrPresent = (flags & 0x10) != 0
            var index = 1
            let bpm: Int
            if bpm16 {
                guard bytes.count >= index + 2 else { return nil }
                bpm = Int(bytes[index]) | (Int(bytes[index + 1]) << 8)
                index += 2
            } else {
                bpm = Int(bytes[index])
                index += 1
            }
            if energyPresent { index += 2 }
            guard bpm >= 30 && bpm <= 250 else { return nil }
            guard rrPresent, index < bytes.count else {
                return ParsedMeasurement(bpm: bpm, rrIntervalsMs: [], quality: StoredQuality(rrTotal: 0, rrInvalid: 0, rrAdvertised: rrPresent, rrPayloadTruncated: false))
            }
            return parseRr(bytes, index: index, bpm: bpm, advertised: rrPresent)
        }

        if bytes.count >= 2 {
            let raw16 = Int(bytes[0]) | (Int(bytes[1]) << 8)
            if raw16 >= 30 && raw16 <= 250 {
                return ParsedMeasurement(bpm: raw16, rrIntervalsMs: [], quality: StoredQuality(rrTotal: 0, rrInvalid: 0, rrAdvertised: false, rrPayloadTruncated: false))
            }
        }
        if bytes[0] >= 30 && bytes[0] <= 250 {
            return ParsedMeasurement(bpm: Int(bytes[0]), rrIntervalsMs: [], quality: StoredQuality(rrTotal: 0, rrInvalid: 0, rrAdvertised: false, rrPayloadTruncated: false))
        }
        for byte in bytes.dropFirst() where byte >= 40 && byte <= 220 {
            return ParsedMeasurement(bpm: Int(byte), rrIntervalsMs: [], quality: StoredQuality(rrTotal: 0, rrInvalid: 0, rrAdvertised: false, rrPayloadTruncated: false))
        }
        return nil
    }

    private func parseRr(_ bytes: [UInt8], index: Int, bpm: Int, advertised: Bool) -> ParsedMeasurement {
        var intervals: [Double] = []
        var total = 0
        var invalid = 0
        var cursor = index
        while cursor + 1 < bytes.count {
            let raw = Int(bytes[cursor]) | (Int(bytes[cursor + 1]) << 8)
            let milliseconds = Double(raw) * 1000.0 / 1024.0
            total += 1
            if milliseconds >= 250 && milliseconds <= 3000 {
                intervals.append(milliseconds)
            } else {
                invalid += 1
            }
            cursor += 2
        }
        if cursor < bytes.count { invalid += 1 }
        return ParsedMeasurement(
            bpm: bpm,
            rrIntervalsMs: intervals,
            quality: StoredQuality(rrTotal: total, rrInvalid: invalid, rrAdvertised: advertised, rrPayloadTruncated: cursor < bytes.count)
        )
    }

    private func updateStoredDeviceName(_ name: String?) {
        guard let name, !name.isEmpty, var session = store.load() else { return }
        session.deviceName = name
        store.save(session)
    }

    private func nowMs() -> Int64 { Int64(Date().timeIntervalSince1970 * 1000) }

    private func sessionPayload(_ session: StoredSession) -> [String: Any] {
        var result: [String: Any] = [
            "active": session.active,
            "sessionId": session.sessionId,
            "deviceId": session.deviceId,
            "startedAtMs": session.startedAtMs,
            "sampleCount": session.samples.count
        ]
        if let deviceName = session.deviceName { result["deviceName"] = deviceName }
        if let endedAtMs = session.endedAtMs { result["endedAtMs"] = endedAtMs }
        if let last = session.samples.last {
            result["lastBpm"] = last.bpm
            result["lastSampleMs"] = last.capturedAtMs
        }
        return result
    }

    private func samplePayload(_ sample: StoredSample) -> [String: Any] {
        var result: [String: Any] = [
            "sessionId": sample.sessionId,
            "capturedAtMs": sample.capturedAtMs,
            "bpm": sample.bpm,
            "rrIntervalsMs": sample.rrIntervalsMs,
            "sourceId": sample.sourceId,
            "quality": [
                "rrTotal": sample.quality.rrTotal,
                "rrInvalid": sample.quality.rrInvalid,
                "rrAdvertised": sample.quality.rrAdvertised,
                "rrPayloadTruncated": sample.quality.rrPayloadTruncated
            ]
        ]
        if let sourceName = sample.sourceName { result["sourceName"] = sourceName }
        return result
    }

    private func emitStatus(_ status: String, reason: String?) {
        var payload: [String: Any] = ["status": status]
        if let session = store.load() {
            payload["sessionId"] = session.sessionId
            payload["deviceId"] = session.deviceId
            if let name = session.deviceName { payload["deviceName"] = name }
        }
        if let reason { payload["reason"] = reason }
        emitEvent("status", payload)
    }

    private func emitDiagnostic(code: String, message: String) {
        var payload: [String: Any] = ["code": code, "message": message, "level": "warning"]
        if let session = store.load() {
            payload["sessionId"] = session.sessionId
            payload["deviceId"] = session.deviceId
            if let name = session.deviceName { payload["deviceName"] = name }
        }
        emitEvent("diagnostic", payload)
    }
}

@objc(BleForeground)
public class BleForeground: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BleForeground"
    public let jsName = "BleForeground"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getActiveSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listSamples", returnType: CAPPluginReturnPromise)
    ]

    private var coordinator: IosBleSessionCoordinator!

    override public func load() {
        coordinator = IosBleSessionCoordinator { [weak self] event, data in
            self?.notifyListeners(event, data: data)
        }
    }

    @objc func startSession(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("deviceId"), let sessionId = call.getString("sessionId") else {
            call.reject("deviceId e sessionId são obrigatórios.")
            return
        }
        coordinator.startSession(deviceId: deviceId, deviceName: call.getString("deviceName"), sessionId: sessionId)
        call.resolve()
    }

    @objc func stopSession(_ call: CAPPluginCall) {
        coordinator.stopSession()
        call.resolve()
    }

    @objc func getActiveSession(_ call: CAPPluginCall) {
        call.resolve(coordinator.activeSessionPayload())
    }

    @objc func getSnapshot(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId") else {
            call.reject("sessionId é obrigatório.")
            return
        }
        call.resolve(coordinator.snapshotPayload(sessionId: sessionId))
    }

    @objc func listSamples(_ call: CAPPluginCall) {
        guard let sessionId = call.getString("sessionId") else {
            call.reject("sessionId é obrigatório.")
            return
        }
        let after = Int64(call.getDouble("afterMs") ?? 0)
        call.resolve(coordinator.samplesPayload(sessionId: sessionId, afterMs: after))
    }
}

import Capacitor

final class MainViewController: CAPBridgeViewController {
    // `override func`, não `override open func`: o Swift recusa membros `open`
    // numa classe `final`, porque eles não podem ser sobrescritos.
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(BleForeground())
    }
}

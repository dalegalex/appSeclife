import Capacitor

final class SeclifeBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(SeclifeQrScannerPlugin())
        bridge?.registerPluginInstance(SeclifeBadgePlugin())
    }
}

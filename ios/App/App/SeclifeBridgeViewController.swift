import Capacitor

final class SeclifeBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(SeclifeQrScannerPlugin())
        bridge?.registerPluginInstance(SeclifePlacaOcrPlugin())
        bridge?.registerPluginInstance(SeclifeBadgePlugin())
        bridge?.registerPluginInstance(SeclifeBoletaPdfPlugin())
    }
}

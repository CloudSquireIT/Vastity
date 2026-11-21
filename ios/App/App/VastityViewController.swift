import UIKit
import Capacitor

/// View controller dell'app: registra i plugin nativi di Vastity (icona alternativa e dock in vetro liquido).
class VastityViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppIconPlugin())
        bridge?.registerPluginInstance(GlassDockPlugin())
    }
}

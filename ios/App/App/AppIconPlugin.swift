import UIKit
import Capacitor

/// Cambia l'icona dell'app nella schermata Home (icone alternative dell'asset catalog).
@objc(AppIconPlugin)
public class AppIconPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppIconPlugin"
    public let jsName = "AppIcon"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
    ]

    @objc func set(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? ""
        DispatchQueue.main.async {
            guard UIApplication.shared.supportsAlternateIcons else {
                call.reject("Icone alternative non supportate")
                return
            }
            UIApplication.shared.setAlternateIconName(name.isEmpty ? nil : name) { error in
                if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
            }
        }
    }

    @objc func get(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["name": UIApplication.shared.alternateIconName ?? ""])
        }
    }
}

import Capacitor
import UIKit
import UserNotifications

@objc(SeclifeBadgePlugin)
public final class SeclifeBadgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SeclifeBadgePlugin"
    public let jsName = "SeclifeBadge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setCount", returnType: CAPPluginReturnPromise)
    ]

    @objc func setCount(_ call: CAPPluginCall) {
        let count = max(0, call.getInt("count") ?? 0)

        DispatchQueue.main.async {
            if #available(iOS 16.0, *) {
                UNUserNotificationCenter.current().setBadgeCount(count) { error in
                    if let error {
                        call.reject("No fue posible actualizar el contador de notificaciones.", nil, error)
                        return
                    }
                    call.resolve()
                }
            } else {
                UIApplication.shared.applicationIconBadgeNumber = count
                call.resolve()
            }
        }
    }
}

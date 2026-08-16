import Capacitor
import StoreKit

@objc(AppReviewPlugin)
public class AppReviewPlugin: CAPPlugin {

    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if #available(iOS 14.0, *) {
                if let scene = UIApplication.shared.connectedScenes
                    .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene {
                    SKStoreReviewController.requestReview(in: scene)
                }
            } else {
                SKStoreReviewController.requestReview()
            }
            call.resolve()
        }
    }
}

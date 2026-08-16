import Capacitor
import StoreKit

@objc(AppReviewPlugin)
public class AppReviewPlugin: CAPPlugin {

    @objc func requestReview(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if #available(iOS 14.0, *) {
                // Guard: reject if no foreground-active window scene is present.
                // This can happen in lifecycle races (app going inactive while the
                // async dispatch is pending). Rejecting here prevents the JS side
                // from setting the "review requested" flag without a dialog having
                // actually been shown, so the prompt can retry on the next launch.
                guard let scene = UIApplication.shared.connectedScenes
                    .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else {
                    call.reject("NO_ACTIVE_SCENE")
                    return
                }
                SKStoreReviewController.requestReview(in: scene)
                call.resolve()
            } else {
                // iOS 13 — no scene API, always available in foreground
                SKStoreReviewController.requestReview()
                call.resolve()
            }
        }
    }
}

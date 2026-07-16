import Capacitor
import AuthenticationServices

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {

    private var pluginCall: CAPPluginCall?

    @objc func signIn(_ call: CAPPluginCall) {
        self.pluginCall = call
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        if let nonce = call.getString("nonce") {
            request.nonce = nonce
        }
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        DispatchQueue.main.async {
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return self.bridge!.viewController!.view.window!
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let cred = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = cred.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8) else {
            pluginCall?.reject("Failed to get identity token")
            return
        }
        var result: [String: Any] = [
            "identityToken": identityToken,
            "user": cred.user
        ]
        if let email = cred.email { result["email"] = email }
        if let given = cred.fullName?.givenName { result["givenName"] = given }
        if let family = cred.fullName?.familyName { result["familyName"] = family }
        pluginCall?.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let code = (error as? ASAuthorizationError)?.code
        if code == .canceled {
            pluginCall?.reject("SIGN_IN_CANCELLED")
        } else {
            pluginCall?.reject(error.localizedDescription)
        }
    }
}

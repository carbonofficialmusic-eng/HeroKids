import UIKit
import WebKit

/// The first remote document must bypass an old WKWebView HTTP cache even when
/// that cached page predates all web-based update logic. Keep Capacitor's own
/// navigation delegate and persistent website data store intact.
final class FreshStartWebView: WKWebView {
    private var hasLoadedRemoteDocument = false

    override func load(_ request: URLRequest) -> WKNavigation? {
        guard !hasLoadedRemoteDocument,
              let url = request.url,
              NativeWebUpdater.isAppURL(url),
              (request.httpMethod ?? "GET") == "GET" else {
            return super.load(request)
        }
        hasLoadedRemoteDocument = true
        var freshRequest = request
        freshRequest.url = NativeWebUpdater.freshURL(url)
        freshRequest.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        freshRequest.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        return super.load(freshRequest)
    }
}

final class NativeWebUpdater {
    private var task: URLSessionDataTask?
    private var generation = 0
    private var attemptedBuilds = Set<String>()
    private var activeSince = Date()

    var isInActivationGracePeriod: Bool {
        Date().timeIntervalSince(activeSince) < 5
    }

    static func isAppURL(_ url: URL) -> Bool {
        url.scheme == "https" && url.host?.lowercased() == "littlechamps.net"
            && (url.port == nil || url.port == 443) && url.user == nil && url.password == nil
    }

    static func freshURL(_ url: URL) -> URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else { return url }
        var items = (components.queryItems ?? []).filter { $0.name != "_lc_native_web" }
        items.append(URLQueryItem(name: "_lc_native_web", value: UUID().uuidString))
        components.queryItems = items
        return components.url ?? url
    }

    static func installGuard(in webView: WKWebView) {
        guard let url = Bundle.main.url(forResource: "NativeWebUpdateGuard", withExtension: "js"),
              let source = try? String(contentsOf: url, encoding: .utf8) else {
            assertionFailure("Missing bundled native web-update guard")
            return
        }
        webView.configuration.userContentController.addUserScript(WKUserScript(
            source: source,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
    }

    func didBecomeActive() {
        activeSince = Date()
    }

    func suspend() {
        generation += 1
        task?.cancel()
        task = nil
    }

    deinit { task?.cancel() }

    /// Called by the existing health-check cadence; no second repeating timer.
    func check(webView: WKWebView, canReload: @escaping () -> Bool) {
        guard task == nil, !isInActivationGracePeriod, canReload(),
              !webView.isLoading, let navigationURL = webView.url,
              Self.isAppURL(navigationURL) else { return }

        generation += 1
        let expectedGeneration = generation
        let buildURL = Self.freshURL(URL(string: "https://littlechamps.net/build-info.json")!)
        var request = URLRequest(url: buildURL)
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        request.timeoutInterval = 8

        task = URLSession.shared.dataTask(with: request) { [weak self, weak webView] data, response, error in
            let http = response as? HTTPURLResponse
            let build = data.flatMap { try? JSONDecoder().decode(BuildInfo.self, from: $0) }
            DispatchQueue.main.async {
                guard let self, expectedGeneration == self.generation else { return }
                self.task = nil
                guard error == nil, http?.statusCode == 200,
                      let responseURL = http?.url, Self.isAppURL(responseURL),
                      let build, build.isValid, let webView,
                      !webView.isLoading, webView.url == navigationURL, canReload() else { return }

                // Ask the bundled guard AFTER the request, not before it:
                // an editor/camera/mutation may have opened while it was in flight.
                webView.evaluateJavaScript("window.__LC_NATIVE_WEB_UPDATE__?.readState()") { [weak self, weak webView] result, error in
                    guard let self, expectedGeneration == self.generation,
                          error == nil, let state = result as? [String: Any],
                          let loadedBuild = state["build"] as? String,
                          loadedBuild != build.id,
                          state["safe"] as? Bool == true, canReload(),
                          let webView, !webView.isLoading, webView.url == navigationURL,
                          !self.attemptedBuilds.contains(build.id) else { return }

                    // One automatic navigation per target build prevents loops
                    // if an upstream proxy temporarily serves inconsistent files.
                    self.attemptedBuilds.insert(build.id)
                    var freshRequest = URLRequest(url: Self.freshURL(navigationURL))
                    freshRequest.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
                    freshRequest.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
                    webView.load(freshRequest)
                }
            }
        }
        task?.resume()
    }

    private struct BuildInfo: Decodable {
        let id: String

        var isValid: Bool {
            guard id.range(of: #"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$"#, options: .regularExpression) != nil else {
                return false
            }
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return formatter.date(from: id) != nil
        }
    }
}

import UIKit
import Capacitor

class ViewController: CAPBridgeViewController {
    private enum ServerState: Equatable {
        case unknown
        case available
        case unavailable
    }

    private enum WebViewReadiness {
        case loading
        case ready
        case failed
    }

    private let appStartURL = URL(string: "https://littlechamps.net")!
    private let fallbackView = UIView()
    private let statusTitleLabel = UILabel()
    private let statusDescriptionLabel = UILabel()
    private let retryButton = UIButton(type: .system)
    private var healthTimer: Timer?
    private var healthTask: URLSessionDataTask?
    private var healthCheckGeneration = 0
    private var healthCheckInFlight = false
    private var serverState = ServerState.unknown
    private var activationObserver: NSObjectProtocol?
    private var webViewLoadingObservation: NSKeyValueObservation?
    private var webViewNavigationGeneration = 0

    override func viewDidLoad() {
        super.viewDidLoad()
        configureNativeFallback()
        observeWebViewNavigations()
        checkServerHealth()
        scheduleHealthCheck(after: 8)
        activationObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.checkServerHealth(forceFreshCheck: true)
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        checkServerHealth()
    }

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(AppReviewPlugin())
    }

    deinit {
        healthTimer?.invalidate()
        healthTask?.cancel()
        webViewLoadingObservation?.invalidate()
        if let activationObserver {
            NotificationCenter.default.removeObserver(activationObserver)
        }
    }

    private func configureNativeFallback() {
        fallbackView.translatesAutoresizingMaskIntoConstraints = false
        fallbackView.backgroundColor = UIColor(
            red: 16.0 / 255.0,
            green: 20.0 / 255.0,
            blue: 34.0 / 255.0,
            alpha: 1
        )
        fallbackView.accessibilityIdentifier = "native-deploy-fallback"

        let logoView = UIImageView()
        logoView.translatesAutoresizingMaskIntoConstraints = false
        logoView.contentMode = .scaleAspectFit
        logoView.image = bundledWebImage(named: "favicon.png")
        logoView.accessibilityLabel = "Little Champs"

        statusTitleLabel.translatesAutoresizingMaskIntoConstraints = false
        statusTitleLabel.text = localizedFallbackCopy.title
        statusTitleLabel.textColor = .white
        statusTitleLabel.font = .systemFont(ofSize: 22, weight: .heavy)
        statusTitleLabel.textAlignment = .center

        statusDescriptionLabel.translatesAutoresizingMaskIntoConstraints = false
        statusDescriptionLabel.text = localizedFallbackCopy.description
        statusDescriptionLabel.textColor = UIColor.white.withAlphaComponent(0.6)
        statusDescriptionLabel.font = .systemFont(ofSize: 14, weight: .regular)
        statusDescriptionLabel.textAlignment = .center
        statusDescriptionLabel.numberOfLines = 0

        retryButton.translatesAutoresizingMaskIntoConstraints = false
        retryButton.setTitle(localizedFallbackCopy.retry, for: .normal)
        retryButton.setTitleColor(.white, for: .normal)
        retryButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .bold)
        retryButton.backgroundColor = UIColor(
            red: 91.0 / 255.0,
            green: 196.0 / 255.0,
            blue: 192.0 / 255.0,
            alpha: 1
        )
        retryButton.layer.cornerRadius = 12
        retryButton.contentEdgeInsets = UIEdgeInsets(top: 10, left: 28, bottom: 10, right: 28)
        retryButton.addTarget(self, action: #selector(retryServerConnection), for: .touchUpInside)

        let textStack = UIStackView(arrangedSubviews: [statusTitleLabel, statusDescriptionLabel])
        textStack.translatesAutoresizingMaskIntoConstraints = false
        textStack.axis = .vertical
        textStack.alignment = .fill
        textStack.spacing = 8

        let contentStack = UIStackView(arrangedSubviews: [logoView, textStack, retryButton])
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.axis = .vertical
        contentStack.alignment = .center
        contentStack.spacing = 24

        view.addSubview(fallbackView)
        fallbackView.addSubview(contentStack)

        NSLayoutConstraint.activate([
            fallbackView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            fallbackView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            fallbackView.topAnchor.constraint(equalTo: view.topAnchor),
            fallbackView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            contentStack.centerXAnchor.constraint(equalTo: fallbackView.safeAreaLayoutGuide.centerXAnchor),
            contentStack.centerYAnchor.constraint(equalTo: fallbackView.safeAreaLayoutGuide.centerYAnchor),
            contentStack.leadingAnchor.constraint(greaterThanOrEqualTo: fallbackView.safeAreaLayoutGuide.leadingAnchor, constant: 32),
            contentStack.trailingAnchor.constraint(lessThanOrEqualTo: fallbackView.safeAreaLayoutGuide.trailingAnchor, constant: -32),

            logoView.widthAnchor.constraint(equalToConstant: 160),
            logoView.heightAnchor.constraint(equalToConstant: 160),
            statusDescriptionLabel.widthAnchor.constraint(lessThanOrEqualToConstant: 280)
        ])

        fallbackView.isHidden = false
        view.bringSubviewToFront(fallbackView)
    }

    private func observeWebViewNavigations() {
        webViewLoadingObservation = webView?.observe(
            \.isLoading,
            options: [.new]
        ) { [weak self] _, change in
            DispatchQueue.main.async {
                guard let self, let isLoading = change.newValue else { return }

                if isLoading {
                    self.webViewNavigationGeneration += 1
                    self.fallbackView.isHidden = false
                    self.view.bringSubviewToFront(self.fallbackView)
                } else {
                    self.checkServerHealth(forceFreshCheck: true)
                }
            }
        }
    }

    private func bundledWebImage(named name: String) -> UIImage? {
        guard let publicDirectory = Bundle.main.resourceURL?.appendingPathComponent("public"),
              let image = UIImage(contentsOfFile: publicDirectory.appendingPathComponent(name).path) else {
            return nil
        }
        return image
    }

    @objc private func retryServerConnection() {
        checkServerHealth(userInitiated: true, forceFreshCheck: true)
    }

    private func checkServerHealth(
        userInitiated: Bool = false,
        forceFreshCheck: Bool = false
    ) {
        if forceFreshCheck {
            healthTask?.cancel()
            healthTask = nil
            healthCheckInFlight = false
            healthCheckGeneration += 1
        }

        guard !healthCheckInFlight else { return }
        healthCheckInFlight = true
        healthCheckGeneration += 1
        let currentGeneration = healthCheckGeneration

        if userInitiated {
            retryButton.isEnabled = false
            retryButton.alpha = 0.6
            retryButton.setTitle(localizedFallbackCopy.checking, for: .normal)
        }

        var request = URLRequest(url: appStartURL)
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        request.timeoutInterval = 8

        let task = URLSession.shared.dataTask(with: request) { [weak self] _, response, error in
            let httpResponse = response as? HTTPURLResponse
            let statusCode = httpResponse?.statusCode
            let finalHostMatches = httpResponse?.url?.host?.caseInsensitiveCompare("littlechamps.net") == .orderedSame
            let serverAvailable = error == nil
                && finalHostMatches
                && statusCode.map { (200..<300).contains($0) } == true

            DispatchQueue.main.async {
                guard let self, currentGeneration == self.healthCheckGeneration else { return }
                self.healthTask = nil
                self.healthCheckInFlight = false
                self.retryButton.isEnabled = true
                self.retryButton.alpha = 1
                self.retryButton.setTitle(self.localizedFallbackCopy.retry, for: .normal)

                guard serverAvailable else {
                    self.applyServerAvailability(false)
                    self.scheduleHealthCheck(after: 8)
                    return
                }

                self.checkWebViewReadiness { readiness in
                    switch readiness {
                    case .ready:
                        self.applyServerAvailability(true)
                        self.scheduleHealthCheck(after: 45)
                    case .loading:
                        self.scheduleHealthCheck(after: 1)
                    case .failed:
                        self.applyServerAvailability(false)
                        self.webView?.reload()
                        self.scheduleHealthCheck(after: 8)
                    }
                }
            }
        }
        healthTask = task
        task.resume()
    }

    private func checkWebViewReadiness(completion: @escaping (WebViewReadiness) -> Void) {
        guard let webView else {
            completion(.failed)
            return
        }

        guard !webView.isLoading else {
            completion(.loading)
            return
        }

        let expectedNavigationGeneration = webViewNavigationGeneration
        webView.evaluateJavaScript("document.getElementById('root')?.childElementCount > 0") { result, error in
            guard expectedNavigationGeneration == self.webViewNavigationGeneration,
                  !webView.isLoading else {
                completion(.loading)
                return
            }
            guard error == nil, let appDidMount = result as? Bool else {
                completion(.failed)
                return
            }
            completion(appDidMount ? .ready : .failed)
        }
    }

    private func applyServerAvailability(_ serverAvailable: Bool) {
        if serverAvailable {
            serverState = .available
            fallbackView.isHidden = true
        } else {
            serverState = .unavailable
            fallbackView.isHidden = false
            view.bringSubviewToFront(fallbackView)
        }
    }

    private func scheduleHealthCheck(after interval: TimeInterval) {
        healthTimer?.invalidate()
        healthTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
            self?.checkServerHealth()
        }
    }

    private var localizedFallbackCopy: (title: String, description: String, retry: String, checking: String) {
        let preferredLanguage = Locale.preferredLanguages.first?.lowercased() ?? "en"

        switch preferredLanguage {
        case let language where language.hasPrefix("de"):
            return (
                "Gleich zurück!",
                "Little Champs wird gerade aktualisiert. In wenigen Augenblicken geht es weiter.",
                "Erneut versuchen",
                "Prüfe …"
            )
        case let language where language.hasPrefix("es"):
            return (
                "¡Volvemos enseguida!",
                "Little Champs se está actualizando. Volverá a estar disponible en unos instantes.",
                "Intentar de nuevo",
                "Comprobando…"
            )
        case let language where language.hasPrefix("fr"):
            return (
                "De retour dans un instant !",
                "Little Champs est en cours de mise à jour. L’application sera bientôt de nouveau disponible.",
                "Réessayer",
                "Vérification…"
            )
        default:
            return (
                "Be right back!",
                "Little Champs is being updated. It will be available again in a moment.",
                "Try again",
                "Checking…"
            )
        }
    }
}

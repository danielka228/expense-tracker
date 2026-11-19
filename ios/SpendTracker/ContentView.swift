import SwiftUI
import WebKit
import UIKit
import AVFoundation
import Speech
import AuthenticationServices
import Security

struct ContentView: View {
    @StateObject private var appState = NativeAppState()

    var body: some View {
        VStack(spacing: 0) {
            SpendTrackerWebView(state: appState)
                .overlay(alignment: .top) {
                    GeometryReader { proxy in
                        Rectangle()
                            .fill(Color(red: 0.62, green: 0.53, blue: 1.0))
                            .frame(width: proxy.size.width, height: 2)
                            .opacity(appState.isLoading ? 1 : 0)
                            .animation(.easeOut(duration: 0.18), value: appState.isLoading)
                    }
                    .frame(height: 2)
                }

            if !appState.tabs.isEmpty {
                NativeTabBar(state: appState)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .background(Color.black)
        .preferredColorScheme(.dark)
    }
}

private struct NativeTab: Identifiable {
    let id: String
    let title: String
    let href: String
    let symbol: String
    let selected: Bool
}

@MainActor
private final class NativeAppState: ObservableObject {
    @Published var tabs: [NativeTab] = []
    @Published var selectedTab = ""
    @Published var isLoading = true
    weak var webView: WKWebView?
    var restoringSession = false

    func updateTabs(_ newTabs: [NativeTab]) {
        guard !newTabs.isEmpty else { return }
        withAnimation(.spring(response: 0.32, dampingFraction: 0.86)) {
            tabs = newTabs
            if let active = newTabs.first(where: \.selected) { selectedTab = active.id }
        }
    }

    func open(_ tab: NativeTab) {
        guard let url = URL(string: tab.href),
              url.scheme == "https", url.host == "traaaack.app" else { return }
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
        selectedTab = tab.id
        webView?.load(URLRequest(url: url, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30))
    }
}

private struct NativeTabBar: View {
    @ObservedObject var state: NativeAppState
    private let accent = Color(red: 0.64, green: 0.55, blue: 1.0)

    var body: some View {
        HStack(spacing: 2) {
            ForEach(state.tabs) { tab in
                Button {
                    state.open(tab)
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: tab.symbol)
                            .font(.system(size: 19, weight: state.selectedTab == tab.id ? .semibold : .regular))
                            .frame(height: 22)
                        Text(tab.title)
                            .font(.system(size: 10, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .foregroundStyle(state.selectedTab == tab.id ? accent : Color.white.opacity(0.58))
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background {
                        if state.selectedTab == tab.id {
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .fill(accent.opacity(0.15))
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .padding(.top, 7)
        .padding(.bottom, 3)
        .background(.ultraThinMaterial)
        .background(Color(red: 0.07, green: 0.075, blue: 0.09).opacity(0.72))
        .overlay(alignment: .top) { Color.white.opacity(0.08).frame(height: 0.5) }
        .background {
            Rectangle()
                .fill(.ultraThinMaterial)
                .ignoresSafeArea(edges: .bottom)
        }
        .animation(.snappy(duration: 0.22), value: state.selectedTab)
    }
}

private enum SessionVault {
    private static let account = "web-session-cookie"
    private static let service = Bundle.main.bundleIdentifier ?? "app.traaaack.spendtracker"

    static func save(_ cookie: HTTPCookie) {
        guard let properties = cookie.properties else { return }
        let serializable = Dictionary(uniqueKeysWithValues: properties.map { ($0.key.rawValue, $0.value) })
        guard let data = try? PropertyListSerialization.data(fromPropertyList: serializable, format: .binary, options: 0) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        let update = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if update == errSecItemNotFound {
            var insert = query
            insert[kSecValueData as String] = data
            insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(insert as CFDictionary, nil)
        }
    }

    static func load() -> HTTPCookie? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let object = try? PropertyListSerialization.propertyList(from: data, options: [], format: nil),
              let saved = object as? [String: Any] else { return nil }
        let properties = Dictionary(uniqueKeysWithValues: saved.map { (HTTPCookiePropertyKey(rawValue: $0.key), $0.value) })
        guard let cookie = HTTPCookie(properties: properties),
              cookie.name == "session",
              cookie.domain.hasSuffix("traaaack.app"),
              cookie.expiresDate.map({ $0 > Date() }) ?? true else {
            clear()
            return nil
        }
        return cookie
    }

    static func clear() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}

private struct SpendTrackerWebView: UIViewRepresentable {
    private static let siteURL = URL(string: "https://traaaack.app")!
    let state: NativeAppState

    // iOS WKWebView does not expose SpeechRecognition on every OS release. This bridge
    // gives the existing site script a Web Speech-compatible interface backed by Apple Speech.
    private static let speechShim = #"""
    (function () {
      if (window.SpeechRecognition || window.webkitSpeechRecognition) return;
      var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeSpeech;
      if (!handler) return;
      var active = null;
      function NativeSpeechRecognition() {
        this.lang = 'ru-RU'; this.continuous = false; this.interimResults = false; this.maxAlternatives = 1;
        this.onstart = this.onsoundstart = this.onspeechstart = this.onresult = this.onerror = this.onend = null;
      }
      NativeSpeechRecognition.prototype.start = function () {
        active = this;
        handler.postMessage({ action: 'start', language: this.lang || 'ru-RU' });
        if (this.onstart) this.onstart({ type: 'start' });
      };
      NativeSpeechRecognition.prototype.stop = function () {
        handler.postMessage({ action: 'stop', language: this.lang || 'ru-RU' });
      };
      NativeSpeechRecognition.prototype.abort = function () {
        if (active === this) active = null;
        handler.postMessage({ action: 'cancel', language: this.lang || 'ru-RU' });
      };
      window.addEventListener('spendtracker-native-speech', function (event) {
        var recognition = active, data = event.detail || {};
        if (!recognition) return;
        if (data.error && recognition.onerror) recognition.onerror({ type: 'error', error: data.error });
        if (data.text && recognition.onresult) {
          var result = [{ transcript: data.text, confidence: 1 }];
          result.isFinal = !!data.isFinal;
          recognition.onresult({ type: 'result', resultIndex: 0, results: [result] });
        }
        if (data.isFinal) {
          active = null;
          if (recognition.onend) recognition.onend({ type: 'end' });
        }
      });
      window.SpeechRecognition = NativeSpeechRecognition;
      window.webkitSpeechRecognition = NativeSpeechRecognition;
    })();
    """#

    private static let authBridge = #"""
    (function () {
      document.addEventListener('click', function (event) {
        var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
        if (!link) return;
        var url;
        try { url = new URL(link.href, location.href); } catch (_) { return; }
        if (url.origin !== 'https://traaaack.app' || url.pathname !== '/auth/telegram' || url.searchParams.has('link')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.webkit.messageHandlers.nativeSpeech.postMessage({ action: 'telegramLogin' });
      }, true);
    })();
    """#

    private static let nativeShell = #"""
    (function () {
      var handler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.nativeSpeech;
      var nav = document.querySelector('nav.tabbar');
      if (nav) {
        nav.style.display = 'none';
        var tabs = Array.from(nav.querySelectorAll('a.tab')).map(function (link) {
          var label = (link.innerText || '').trim();
          var href = link.href;
          var symbol = href.indexOf('/nutrition') >= 0 ? (href.indexOf('#food-purchases') >= 0 ? 'basket' : 'fork.knife')
            : href.indexOf('/subs') >= 0 ? 'bag' : href.indexOf('/friends') >= 0 ? 'person.2'
            : href.indexOf('/profile') >= 0 ? 'person.crop.circle' : href.indexOf('/settings') >= 0 ? 'gearshape'
            : label.toLowerCase().indexOf('nutrition') >= 0 || label.indexOf('Питание') >= 0 ? 'fork.knife' : 'chart.bar';
          return { id: href, title: label, href: href, symbol: symbol, selected: link.classList.contains('active') };
        });
        if (handler) handler.postMessage({ action: 'nativeTabs', tabs: JSON.stringify(tabs) });
      }
      var style = document.createElement('style');
      style.textContent = 'nav.tabbar{display:none!important}.wrap{padding-bottom:calc(22px + env(safe-area-inset-bottom))!important}button,a,[role="button"],input[type="submit"]{-webkit-tap-highlight-color:transparent;transition:transform .16s ease,opacity .16s ease}button:active,a:active,[role="button"]:active,input[type="submit"]:active{transform:scale(.985);opacity:.86}';
      (document.head || document.documentElement).appendChild(style);
      document.addEventListener('click', function (event) {
        var target = event.target && event.target.closest ? event.target.closest('button,a,[role="button"],input[type="submit"]') : null;
        if (!target || target.closest('nav.tabbar')) return;
        if (handler) handler.postMessage({ action: 'haptic' });
        var href = target.getAttribute('href');
        if (href === '/logout') { if (handler) handler.postMessage({ action: 'clearSession' }); }
      }, true);
      document.addEventListener('submit', function (event) {
        var logout = event.target && event.target.querySelector('input[name="action"][value="logout_all"]');
        if (logout && handler) handler.postMessage({ action: 'clearSession' });
      }, true);
    })();
    """#

    func makeCoordinator() -> Coordinator {
        Coordinator(state: state)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // Persistent WebKit storage keeps the signed-in session between app launches.
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []

        configuration.userContentController.addUserScript(WKUserScript(
            source: Self.speechShim,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        configuration.userContentController.addUserScript(WKUserScript(
            source: Self.authBridge,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        configuration.userContentController.addUserScript(WKUserScript(
            source: Self.nativeShell,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))

        let fastInteractions = """
        (function () {
          var style = document.createElement('style');
          style.textContent = 'button,a,[role="button"],.btn,.action,.tab{transition-duration:.16s!important}.sheet{transition-duration:.34s!important}';
          document.head.appendChild(style);
        })();
        """
        configuration.userContentController.addUserScript(WKUserScript(
            source: fastInteractions,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        ))

        let coordinator = context.coordinator
        configuration.userContentController.add(coordinator, name: "nativeSpeech")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        coordinator.webView = webView
        state.webView = webView
        webView.navigationDelegate = coordinator
        webView.uiDelegate = coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.delaysContentTouches = false
        webView.scrollView.keyboardDismissMode = .interactive
        webView.scrollView.decelerationRate = .fast
        webView.isOpaque = false
        webView.backgroundColor = UIColor.black
        webView.scrollView.backgroundColor = UIColor.black
        let initialRequest = URLRequest(url: Self.siteURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30)
        let cookieStore = configuration.websiteDataStore.httpCookieStore
        cookieStore.getAllCookies { cookies in
            Task { @MainActor in
                if let backupCookie = SessionVault.load() {
                    state.restoringSession = true
                    cookieStore.setCookie(backupCookie) {
                        Task { @MainActor in webView.load(initialRequest) }
                    }
                } else {
                    if let existingCookie = cookies.first(where: { $0.name == "session" && $0.domain.hasSuffix("traaaack.app") }) {
                        SessionVault.save(existingCookie)
                    }
                    webView.load(initialRequest)
                }
            }
        }
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.state = state
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {
        var state: NativeAppState
        weak var webView: WKWebView?
        private var speechRecognizer: SFSpeechRecognizer?
        private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
        private var recognitionTask: SFSpeechRecognitionTask?
        private var audioEngine: AVAudioEngine?
        private var speechSessionID = UUID()
        private var authSession: ASWebAuthenticationSession?

        init(state: NativeAppState) {
            self.state = state
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "nativeSpeech", let body = message.body as? [String: Any],
                  let action = body["action"] as? String else { return }
            if action == "nativeTabs", let json = body["tabs"] as? String,
               let data = json.data(using: .utf8),
               let items = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
                let tabs = items.compactMap { item -> NativeTab? in
                    guard let id = item["id"] as? String, let title = item["title"] as? String,
                          let href = item["href"] as? String, let symbol = item["symbol"] as? String else { return nil }
                    return NativeTab(id: id, title: title, href: href, symbol: symbol, selected: item["selected"] as? Bool ?? false)
                }
                state.updateTabs(tabs)
                return
            }
            if action == "haptic" {
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                return
            }
            if action == "clearSession" {
                SessionVault.clear()
                return
            }
            if action == "telegramLogin" {
                startTelegramLogin()
                return
            }
            switch action {
            case "start": startSpeech(language: body["language"] as? String ?? "ru-RU")
            case "stop": stopSpeech(cancel: false)
            case "cancel": stopSpeech(cancel: true)
            default: break
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            state.isLoading = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            state.isLoading = false
            if state.restoringSession, webView.url?.path == "/login" {
                SessionVault.clear()
                state.restoringSession = false
            } else if state.restoringSession, webView.url?.host == "traaaack.app" {
                state.restoringSession = false
            }
            webView.configuration.websiteDataStore.httpCookieStore.getAllCookies { cookies in
                guard let sessionCookie = cookies.first(where: { $0.name == "session" && $0.domain.hasSuffix("traaaack.app") }) else { return }
                SessionVault.save(sessionCookie)
            }
        }

        private func startTelegramLogin() {
            guard let url = URL(string: "https://traaaack.app/auth/telegram?app=1") else { return }
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "spendtracker") { [weak self] callback, error in
                Task { @MainActor in
                    guard let self else { return }
                    self.authSession = nil
                    guard error == nil, let callback,
                          let parts = URLComponents(url: callback, resolvingAgainstBaseURL: false),
                          let ticket = parts.queryItems?.first(where: { $0.name == "ticket" })?.value,
                          var handoff = URLComponents(string: "https://traaaack.app/auth/app-session") else {
                        self.webView?.reload()
                        return
                    }
                    handoff.queryItems = [URLQueryItem(name: "ticket", value: ticket)]
                    if let handoffURL = handoff.url { self.webView?.load(URLRequest(url: handoffURL)) }
                }
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            authSession = session
            session.start()
        }

        func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
                .first(where: \.isKeyWindow) ?? UIWindow()
        }

        private func startSpeech(language: String) {
            stopSpeech(cancel: true)
            let sessionID = UUID()
            speechSessionID = sessionID
            let locale = Locale(identifier: language)
            guard let recognizer = SFSpeechRecognizer(locale: locale), recognizer.isAvailable else {
                sendSpeechResult(text: "", isFinal: true, error: "service-not-allowed")
                return
            }
            speechRecognizer = recognizer

            let status = SFSpeechRecognizer.authorizationStatus()
            if status == .notDetermined {
                SFSpeechRecognizer.requestAuthorization { [weak self] status in
                    Task { @MainActor in
                        self?.continueSpeechAfterPermission(status, sessionID: sessionID)
                    }
                }
            } else {
                continueSpeechAfterPermission(status, sessionID: sessionID)
            }
        }

        private func continueSpeechAfterPermission(_ status: SFSpeechRecognizerAuthorizationStatus, sessionID: UUID) {
            guard speechSessionID == sessionID else { return }
            guard status == .authorized else {
                sendSpeechResult(text: "", isFinal: true, error: "not-allowed")
                return
            }

            AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
                Task { @MainActor in
                    guard let self, self.speechSessionID == sessionID else { return }
                    guard granted else {
                        self.sendSpeechResult(text: "", isFinal: true, error: "not-allowed")
                        return
                    }
                    guard let recognizer = self.speechRecognizer else { return }
                    self.beginSpeechRecognition(recognizer: recognizer, sessionID: sessionID)
                }
            }
        }

        private func beginSpeechRecognition(recognizer: SFSpeechRecognizer, sessionID: UUID) {
            guard speechSessionID == sessionID else { return }
            let audioEngine = AVAudioEngine()
            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            request.taskHint = .dictation
            self.audioEngine = audioEngine
            recognitionRequest = request

            let input = audioEngine.inputNode
            let format = input.outputFormat(forBus: 0)
            input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
                request.append(buffer)
            }

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                let text = result?.bestTranscription.formattedString ?? ""
                let isFinal = result?.isFinal ?? false
                let errorName = error == nil ? nil : "network"
                Task { @MainActor in
                    guard let self, self.speechSessionID == sessionID else { return }
                    if let errorName {
                        self.stopSpeech(cancel: true)
                        self.sendSpeechResult(text: text, isFinal: true, error: errorName)
                    } else if isFinal {
                        self.stopSpeech(cancel: true)
                        self.sendSpeechResult(text: text, isFinal: true, error: nil)
                    } else {
                        self.sendSpeechResult(text: text, isFinal: false, error: nil)
                    }
                }
            }

            do {
                let session = AVAudioSession.sharedInstance()
                try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
                try session.setActive(true, options: .notifyOthersOnDeactivation)
                audioEngine.prepare()
                try audioEngine.start()
            } catch {
                stopSpeech(cancel: true)
                sendSpeechResult(text: "", isFinal: true, error: "audio-capture")
            }
        }

        private func stopSpeech(cancel: Bool) {
            if cancel { speechSessionID = UUID() }
            if let engine = audioEngine {
                if engine.isRunning { engine.stop() }
                if cancel { engine.inputNode.removeTap(onBus: 0) }
            }
            recognitionRequest?.endAudio()
            if cancel {
                recognitionTask?.cancel()
                audioEngine = nil
                recognitionRequest = nil
                recognitionTask = nil
                speechRecognizer = nil
            }
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }

        private func sendSpeechResult(text: String, isFinal: Bool, error: String?) {
            guard let webView else { return }
            var payload: [String: Any] = ["text": text, "isFinal": isFinal]
            if let error { payload["error"] = error }
            guard let data = try? JSONSerialization.data(withJSONObject: payload),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('spendtracker-native-speech', {detail: \(json)}))")
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            guard let url = navigationAction.request.url else { return nil }
            if Self.isTelegramURL(url) {
                openTelegram(url)
            } else {
                webView.load(navigationAction.request)
            }
            return nil
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction) async -> WKNavigationActionPolicy {
            guard let url = navigationAction.request.url, Self.isTelegramURL(url) else { return .allow }
            openTelegram(url)
            return .cancel
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            guard (error as NSError).code != NSURLErrorCancelled else { return }
            showLoadError(in: webView)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            guard (error as NSError).code != NSURLErrorCancelled else { return }
            showLoadError(in: webView)
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
        }

        private static func isTelegramURL(_ url: URL) -> Bool {
            let scheme = url.scheme?.lowercased()
            let host = url.host?.lowercased() ?? ""
            if scheme == "tg" || scheme == "telegram" { return true }
            return (scheme == "https" || scheme == "http") &&
                (host == "t.me" || host.hasSuffix(".t.me") || host == "telegram.me")
        }

        private func openTelegram(_ url: URL) {
            Task { @MainActor in
                if let fallback = Self.telegramWebFallback(for: url),
                   await UIApplication.shared.open(fallback) {
                    return
                }
                await UIApplication.shared.open(url)
            }
        }

        private static func telegramWebFallback(for url: URL) -> URL? {
            guard url.scheme?.lowercased() == "tg",
                  url.host?.lowercased() == "resolve",
                  let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                  let domain = components.queryItems?.first(where: { $0.name == "domain" })?.value,
                  !domain.isEmpty else { return nil }

            var fallback = URLComponents()
            fallback.scheme = "https"
            fallback.host = "t.me"
            fallback.path = "/\(domain)"
            fallback.queryItems = components.queryItems?.filter { $0.name != "domain" }
            return fallback.url
        }

        private func showLoadError(in webView: WKWebView) {
            let html = """
            <!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>body{margin:0;background:#000;color:#fff;font:17px -apple-system,system-ui;display:grid;min-height:100vh;place-items:center;text-align:center}main{padding:28px}p{color:#999;line-height:1.5}button{border:0;border-radius:14px;background:#5b9dff;color:white;font-size:16px;font-weight:600;padding:14px 22px}</style>
            <main><h2>Не удалось открыть СпендТрекер</h2><p>Проверь подключение к интернету и попробуй ещё раз.</p><button onclick="location.reload()">Повторить</button></main></html>
            """
            webView.loadHTMLString(html, baseURL: SpendTrackerWebView.siteURL)
        }
    }
}

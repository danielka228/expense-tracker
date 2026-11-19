import SwiftUI
import WebKit
import UIKit
import AVFoundation
import Speech
import AuthenticationServices

struct ContentView: View {
    var body: some View {
        SpendTrackerWebView()
            .ignoresSafeArea(edges: .bottom)
            .preferredColorScheme(.dark)
    }
}

private struct SpendTrackerWebView: UIViewRepresentable {
    private static let siteURL = URL(string: "https://traaaack.app")!

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

    func makeCoordinator() -> Coordinator {
        Coordinator()
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
        webView.navigationDelegate = coordinator
        webView.uiDelegate = coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.delaysContentTouches = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor.black
        webView.scrollView.backgroundColor = UIColor.black
        webView.load(URLRequest(url: Self.siteURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 30))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, ASWebAuthenticationPresentationContextProviding {
        weak var webView: WKWebView?
        private var speechRecognizer: SFSpeechRecognizer?
        private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
        private var recognitionTask: SFSpeechRecognitionTask?
        private var audioEngine: AVAudioEngine?
        private var speechSessionID = UUID()
        private var authSession: ASWebAuthenticationSession?

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "nativeSpeech", let body = message.body as? [String: String] else { return }
            if body["action"] == "telegramLogin" {
                startTelegramLogin()
                return
            }
            switch body["action"] {
            case "start": startSpeech(language: body["language"] ?? "ru-RU")
            case "stop": stopSpeech(cancel: false)
            case "cancel": stopSpeech(cancel: true)
            default: break
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

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url, Self.isTelegramURL(url) else {
                decisionHandler(.allow)
                return
            }

            decisionHandler(.cancel)
            openTelegram(url)
        }

        // Let WebKit show the system's one-time microphone/camera permission prompt.
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            decisionHandler(.prompt)
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

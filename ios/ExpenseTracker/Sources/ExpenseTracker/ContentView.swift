import SwiftUI
import WebKit

struct ContentView: View {
    @State private var reloadToken = UUID()

    var body: some View {
        WebView(reloadToken: reloadToken)
            .ignoresSafeArea(edges: .bottom)
            .overlay(alignment: .topTrailing) {
                Button {
                    reloadToken = UUID()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(.primary)
                        .frame(width: 40, height: 40)
                        .background(.regularMaterial, in: Circle())
                }
                .accessibilityLabel("Перезагрузить страницу")
                .padding(.top, 8)
                .padding(.trailing, 12)
            }
    }
}

private struct WebView: UIViewRepresentable {
    let reloadToken: UUID
    private let address = URL(string: "https://traaaack.app")!

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.load(URLRequest(url: address))
        context.coordinator.lastReloadToken = reloadToken
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard context.coordinator.lastReloadToken != reloadToken else { return }
        context.coordinator.lastReloadToken = reloadToken
        webView.load(URLRequest(url: address))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        var lastReloadToken: UUID?

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            showLoadError(in: webView)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            showLoadError(in: webView)
        }

        private func showLoadError(in webView: WKWebView) {
            let page = """
            <!doctype html><html lang="ru"><meta name="viewport" content="width=device-width, initial-scale=1">
            <meta charset="utf-8"><style>body{font:17px -apple-system,sans-serif;background:#f6f7f9;color:#18202a;display:grid;min-height:85vh;place-items:center;text-align:center;padding:24px}main{max-width:340px}button{font:inherit;border:0;border-radius:12px;padding:12px 18px;background:#2563eb;color:white}</style>
            <main><h2>Не удалось открыть сайт</h2><p>Проверь подключение к интернету и попробуй ещё раз.</p><button onclick="location.href='https://traaaack.app'">Повторить</button></main></html>
            """
            webView.loadHTMLString(page, baseURL: URL(string: "https://traaaack.app"))
        }
    }
}

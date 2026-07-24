import SwiftUI
import WebKit

// 배포된 냉장고 프로젝트 웹앱을 그대로 띄우는 래퍼.
// 이 URL만 유지되면, 웹을 배포할 때마다 앱도 자동으로 최신 상태가 됩니다.
private let kAppURL = URL(string: "https://app-eight-amber-63.vercel.app")!
private let kCream = Color(red: 0.953, green: 0.925, blue: 0.855) // #f3ecda

struct ContentView: View {
    @State private var isLoading = true

    var body: some View {
        ZStack {
            kCream.ignoresSafeArea()
            WebView(url: kAppURL, isLoading: $isLoading)
                .ignoresSafeArea(edges: .bottom)   // 하단 여백은 웹앱이 직접 처리(탭바)
            if isLoading {
                ProgressView()
                    .tint(Color(red: 0.17, green: 0.20, blue: 0.31)) // navy
            }
        }
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var isLoading: Bool

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.953, green: 0.925, blue: 0.855, alpha: 1)

        // 당겨서 새로고침
        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.reload(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        context.coordinator.webView = webView
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let parent: WebView
        weak var webView: WKWebView?
        init(_ parent: WebView) { self.parent = parent }

        @objc func reload(_ sender: UIRefreshControl) { webView?.reload() }

        func webView(_ w: WKWebView, didStartProvisionalNavigation n: WKNavigation!) {
            parent.isLoading = true
        }
        func webView(_ w: WKWebView, didFinish n: WKNavigation!) {
            parent.isLoading = false
            w.scrollView.refreshControl?.endRefreshing()
        }
        func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) {
            parent.isLoading = false
            w.scrollView.refreshControl?.endRefreshing()
        }
        func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) {
            parent.isLoading = false
            w.scrollView.refreshControl?.endRefreshing()
        }
        // target="_blank" 링크도 같은 화면에서 열기
        func webView(_ w: WKWebView, createWebViewWith config: WKWebViewConfiguration,
                     for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url { w.load(URLRequest(url: url)) }
            return nil
        }
    }
}

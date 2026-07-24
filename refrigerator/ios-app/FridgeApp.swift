import SwiftUI

@main
struct FridgeApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.light)   // 앱이 라이트(크림) 테마 고정
        }
    }
}

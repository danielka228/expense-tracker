import SwiftUI
import UIKit
import AuthenticationServices
import Security
import VisionKit
import Vision
@preconcurrency import Speech
@preconcurrency import AVFoundation

private let site = URL(string: "https://traaaack.app")!
private let violet = Color(red: 0.63, green: 0.54, blue: 1)

struct ContentView: View {
    @StateObject private var store = NativeStore()

    var body: some View {
        Group {
            if store.isLoggedIn {
                NativeTabs(store: store)
            } else {
                NativeLogin(store: store)
            }
        }
        .background(Color.black.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .tint(violet)
        .task { await store.restore() }
    }
}

private struct Bootstrap: Decodable {
    let user: Account
    let overview: Overview
    let subscriptions: [Subscription]
    let monthTotal: Double
    let friends: [Friend]
    let incoming: [Incoming]
    let profile: ProfileSummary
    let categories: [String]
    let foodEntries: [FoodEntry]
}

private struct FoodEntry: Decodable, Identifiable {
    let id: Int
    let name: String
    let grams: Double
    let kcalPer100: Double
    let meal: String
    let entryDate: String
    let kind: String
    let source: String?
    var calories: Double { grams * kcalPer100 / 100 }
}

private struct Account: Decodable {
    let id: Int
    let username: String
    let currency: String
    let symbol: String
    let appMode: String
    let language: String
    let bio: String?
    let createdAt: String?
}

private struct Overview: Decodable {
    let today: String
    let todayTotal: Double
    let weekTotal: Double
    let monthTotal: Double
    let recent: [Expense]
}

private struct Expense: Decodable, Identifiable {
    let id: Int
    let amount: Double
    let category: String
    let note: String?
    let expenseDate: String
    let store: String?
}

private struct Subscription: Decodable, Identifiable {
    let id: Int
    let name: String
    let amount: Double
    let currency: String
    let period: String
    let nextDate: String
    let monthly: Double
    let sym: String
    let days: Int
}

private struct Friend: Decodable, Identifiable {
    let id: Int
    let username: String
    let total: Double
    let isMe: Bool
    let avatarV: String?
}

private struct Incoming: Decodable, Identifiable {
    let id: Int
    let username: String
}

private struct ProfileSummary: Decodable {
    let expenseCount: Int
    let allTimeTotal: Double
    let avatarV: String?
}

private struct PhotoGuess: Decodable {
    let ok: Bool
    let name: String?
    let category: String?
    let amount: Double?
    let grams: Double?
    let kcalPer100: Double?
    let guess: NutritionGuess?
}

private struct NutritionGuess: Decodable {
    let name: String
    let grams: Double?
    let kcalPer100: Double?
    let questions: [String]
    let note: String
    let source: String
}

private struct NativeProduct: Decodable, Identifiable {
    let barcode: String
    let found: Bool
    let name: String?
    let brand: String?
    let quantity: String?
    let image: String?
    let category: String?
    var id: String { barcode }
}

private struct PurchasePrice: Decodable { let amount: Double; let store: String?; let date: String? }
private struct StorePrice: Decodable { let store: String?; let n: Int; let avg: Double; let min: Double }
private struct ProductPrices: Decodable { let mine: [PurchasePrice]; let stores: [StorePrice] }
private struct ProductLookup: Decodable { let product: NativeProduct; let prices: ProductPrices; let ai: Bool }
private struct VoiceDraft: Decodable { let amount: Double?; let category: String?; let note: String; let date: String? }

@MainActor
private final class NativeStore: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published var isLoggedIn = false
    @Published var loading = false
    @Published var error: String?
    @Published var data: Bootstrap?
    @Published var tab = 0
    @Published var showAddExpense = false
    @Published var showAddSubscription = false
    @Published var showScanner = false
    @Published var showVoice = false
    @Published var voiceDraft: VoiceDraft?
    @Published var scannedProduct: NativeProduct?
    @Published var scannedPrices: ProductPrices?
    private var authSession: ASWebAuthenticationSession?
    private var restored = false

    func restore() async {
        guard !restored else { return }
        restored = true
        guard let cookie = SessionVault.load() else { return }
        do {
            try await fetchData(cookie: cookie)
            isLoggedIn = true
        } catch {
            if (error as? NativeError) == .unauthorized {
                SessionVault.clear()
            } else {
                isLoggedIn = true
                self.error = "Нет соединения. Потяни экран вниз, чтобы обновить данные."
            }
        }
    }

    func signInWithTelegram() {
        error = nil
        guard let url = URL(string: "/auth/telegram?app=1", relativeTo: site) else { return }
        let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "spendtracker") { [weak self] callback, authError in
            Task { @MainActor in
                guard let self else { return }
                self.authSession = nil
                guard authError == nil, let callback,
                      let parts = URLComponents(url: callback, resolvingAgainstBaseURL: false),
                      let ticket = parts.queryItems?.first(where: { $0.name == "ticket" })?.value else {
                    self.error = "Вход отменён. Попробуй ещё раз."
                    return
                }
                await self.exchange(ticket: ticket)
            }
        }
        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        authSession = session
        session.start()
    }

    private func exchange(ticket: String) async {
        loading = true
        defer { loading = false }
        do {
            let url = URL(string: "/auth/app-session?ticket=\(ticket.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")", relativeTo: site)!
            let (_, _) = try await URLSession.shared.data(from: url)
            let cookies = HTTPCookieStorage.shared.cookies(for: site) ?? []
            guard let cookie = cookies.first(where: { $0.name == "session" && $0.domain.hasSuffix("traaaack.app") }) else {
                throw NativeError.sessionMissing
            }
            SessionVault.save(cookie)
            try await fetchData(cookie: cookie)
            isLoggedIn = true
        } catch {
            self.error = "Не удалось завершить вход. Проверь интернет и попробуй снова."
        }
    }

    func refresh() async {
        guard let cookie = SessionVault.load() else { isLoggedIn = false; return }
        loading = true
        defer { loading = false }
        do { try await fetchData(cookie: cookie) }
        catch { self.error = "Не удалось обновить данные." }
    }

    func addExpense(amount: Double, category: String, note: String, date: Date, barcode: String? = nil) async {
        let payload: [String: Any] = ["amount": amount, "category": category, "note": note,
                                      "date": nativeDateString(date), "barcode": barcode ?? ""]
        await mutate(path: "/api/native/expenses", method: "POST", payload: payload)
    }

    func addSubscription(name: String, amount: Double, date: Date) async {
        let payload: [String: Any] = ["name": name, "amount": String(amount), "next_date": nativeDateString(date),
                                      "period": "month", "currency": data?.user.currency ?? "RUB", "category": "Развлечения"]
        await mutate(path: "/api/native/subscriptions", method: "POST", payload: payload)
    }

    func deleteSubscription(_ item: Subscription) async {
        await mutate(path: "/api/native/subscriptions/\(item.id)", method: "DELETE")
    }

    func addFood(name: String, grams: Double, kcalPer100: Double, meal: String, kind: String = "meal", amount: Double? = nil, source: String = "manual") async {
        var payload: [String: Any] = [
            "name": name, "grams": grams, "kcalPer100": kcalPer100, "meal": meal,
            "requestKey": UUID().uuidString, "kind": kind, "source": source
        ]
        if let amount { payload["amount"] = amount }
        await mutate(path: "/api/native/food", method: "POST", payload: payload)
    }

    func logPortion(from entry: FoodEntry, grams: Double) async {
        await addFood(name:entry.name,grams:grams,kcalPer100:entry.kcalPer100,meal:entry.meal,kind:"meal",source:entry.source ?? "manual")
    }

    func updateSettings(appMode: String, currency: String, language: String) async {
        let changedMode = data?.user.appMode != appMode
        await mutate(path: "/api/native/settings", method: "PUT", payload: [
            "appMode": appMode, "currency": currency, "language": language
        ])
        if changedMode { tab = 0 }
    }

    func recognizePhoto(_ image: UIImage, mode: String, context: String = "") async -> PhotoGuess? {
        guard let bytes = image.nativeJPEG else { error = "Не удалось обработать фото."; return nil }
        guard let cookie = SessionVault.load() else { isLoggedIn = false; return nil }
        loading = true
        defer { loading = false }
        do {
            var request = URLRequest(url: URL(string: "/api/native/recognize-photo?mode=\(mode)", relativeTo: site)!, timeoutInterval: 35)
            request.httpMethod = "POST"
            request.httpBody = bytes
            request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
            request.setValue("session=\(cookie.value)", forHTTPHeaderField: "Cookie")
            if mode == "nutrition" {
                let details = context.isEmpty ? "Пользователь записывает еду в дневник. Для блюда уточни размер порции, масло и скрытые ингредиенты. Для этикетки считывай только видимые значения." : context
                request.setValue(Data(details.utf8).base64EncodedString(), forHTTPHeaderField: "X-Food-Context-B64")
            }
            let (body, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw NativeError.requestFailed }
            let decoder = JSONDecoder(); decoder.keyDecodingStrategy = .convertFromSnakeCase
            let result = try decoder.decode(PhotoGuess.self, from: body)
            guard result.ok else { throw NativeError.requestFailed }
            error = nil
            return result
        } catch {
            self.error = "Не удалось распознать фото. Попробуй другое освещение или введи данные вручную."
            return nil
        }
    }

    func parseVoice(_ text: String) async -> VoiceDraft? {
        guard let cookie = SessionVault.load() else { isLoggedIn = false; return nil }
        do {
            var request = URLRequest(url: URL(string:"/api/native/voice-parse",relativeTo:site)!)
            request.httpMethod = "POST"; request.setValue("session=\(cookie.value)",forHTTPHeaderField:"Cookie")
            request.setValue("application/json",forHTTPHeaderField:"Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject:["text":text])
            let (body,response) = try await URLSession.shared.data(for:request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw NativeError.requestFailed }
            return try JSONDecoder().decode(VoiceDraft.self,from:body)
        } catch { self.error = "Не удалось разобрать фразу. Попробуй сказать сумму и покупку."; return nil }
    }

    func lookupBarcode(_ code: String) async {
        guard let cookie = SessionVault.load() else { isLoggedIn = false; return }
        loading = true; defer { loading = false }
        do {
            var request = URLRequest(url:URL(string:"/api/product/\(code)",relativeTo:site)!)
            request.setValue("session=\(cookie.value)",forHTTPHeaderField:"Cookie")
            let (body,response)=try await URLSession.shared.data(for:request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw NativeError.requestFailed }
            let result = try JSONDecoder().decode(ProductLookup.self,from:body)
            scannedProduct = result.product; scannedPrices = result.prices
        } catch { self.error = "Не удалось найти товар по штрихкоду." }
    }

    func logout() async {
        if let cookie = SessionVault.load() {
            var request = URLRequest(url: URL(string: "/logout", relativeTo: site)!)
            request.setValue("session=\(cookie.value)", forHTTPHeaderField: "Cookie")
            _ = try? await URLSession.shared.data(for: request)
        }
        (HTTPCookieStorage.shared.cookies(for: site) ?? []).forEach(HTTPCookieStorage.shared.deleteCookie)
        SessionVault.clear()
        data = nil
        isLoggedIn = false
        tab = 0
    }

    private func mutate(path: String, method: String, payload: [String: Any]? = nil) async {
        guard let cookie = SessionVault.load() else { isLoggedIn = false; return }
        error = nil
        do {
            var request = URLRequest(url: URL(string: path, relativeTo: site)!)
            request.httpMethod = method
            request.setValue("session=\(cookie.value)", forHTTPHeaderField: "Cookie")
            if let payload {
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            }
            let (body, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw NativeError.requestFailed }
            if let object = try JSONSerialization.jsonObject(with: body) as? [String: Any], object["error"] != nil {
                throw NativeError.requestFailed
            }
            try await fetchData(cookie: cookie)
        } catch {
            self.error = "Не удалось сохранить. Проверь данные и повтори попытку."
        }
    }

    private func fetchData(cookie: HTTPCookie) async throws {
        var request = URLRequest(url: URL(string: "/api/native/bootstrap", relativeTo: site)!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
        request.setValue("session=\(cookie.value)", forHTTPHeaderField: "Cookie")
        let (body, response) = try await URLSession.shared.data(for: request)
        guard let status = (response as? HTTPURLResponse)?.statusCode else { throw NativeError.requestFailed }
        if status == 401 || status == 403 { throw NativeError.unauthorized }
        guard status == 200 else { throw NativeError.requestFailed }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        data = try decoder.decode(Bootstrap.self, from: body)
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows).first(where: \.isKeyWindow) ?? UIWindow()
    }
}

private enum NativeError: Error, Equatable { case requestFailed, sessionMissing, unauthorized }

private enum SessionVault {
    private static let account = "web-session-cookie"
    private static let service = Bundle.main.bundleIdentifier ?? "app.traaaack.spendtracker"
    static func save(_ cookie: HTTPCookie) {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: service, kSecAttrAccount as String: account]
        let data = Data(cookie.value.utf8)
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecItemNotFound {
            var item = query
            item[kSecValueData as String] = data
            item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(item as CFDictionary, nil)
        }
    }
    static func load() -> HTTPCookie? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: service, kSecAttrAccount as String: account,
                                    kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data, let value = String(data: data, encoding: .utf8) else { return nil }
        let props: [HTTPCookiePropertyKey: Any] = [.domain: "traaaack.app", .path: "/", .name: "session",
            .value: value, .secure: "TRUE", .expires: Date().addingTimeInterval(90 * 86400)]
        return HTTPCookie(properties: props)
    }
    static func clear() {
        SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
                       kSecAttrAccount as String: account] as CFDictionary)
    }
}

private func nativeDateString(_ date: Date) -> String {
    date.formatted(.iso8601.year().month().day().dateSeparator(.dash).timeZone(separator: .omitted))
}

private struct NativeLogin: View {
    @ObservedObject var store: NativeStore
    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: "chart.bar.xaxis").font(.system(size: 38, weight: .semibold)).foregroundStyle(.white)
                .frame(width: 88, height: 88).background(LinearGradient(colors: [violet, Color.blue], startPoint: .topLeading, endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 24))
            Text("СпендТрекер").font(.system(size: 30, weight: .bold))
            Text("Твои расходы — под контролем").foregroundStyle(.white.opacity(0.62))
            Button(action: store.signInWithTelegram) {
                Label("Войти через Telegram", systemImage: "paperplane.fill")
                    .font(.system(size: 17, weight: .semibold)).frame(maxWidth: .infinity).frame(height: 54)
            }
            .buttonStyle(.borderedProminent).tint(Color(red: 0.12, green: 0.65, blue: 0.9)).padding(.top, 12)
            if store.loading { ProgressView().tint(violet) }
            if let error = store.error { Text(error).font(.footnote).foregroundStyle(.red).multilineTextAlignment(.center) }
            Spacer()
            Spacer()
        }
        .padding(28)
    }
}

private struct NativeTabs: View {
    @ObservedObject var store: NativeStore
    var body: some View {
        TabView(selection: $store.tab) {
            Group {
                if store.data?.user.appMode == "nutrition" { NutritionScreen(store: store) }
                else { ExpensesScreen(store: store) }
            }.tabItem { Label(store.data?.user.appMode == "nutrition" ? "Питание" : "Траты", systemImage: store.data?.user.appMode == "nutrition" ? "fork.knife" : "chart.bar.fill") }.tag(0)
            SubscriptionsScreen(store: store).tabItem { Label("Подписки", systemImage: "repeat") }.tag(1)
            FriendsScreen(store: store).tabItem { Label("Друзья", systemImage: "person.2.fill") }.tag(2)
            ProfileScreen(store: store).tabItem { Label("Профиль", systemImage: "person.crop.circle") }.tag(3)
            SettingsScreen(store: store).tabItem { Label("Настройки", systemImage: "gearshape") }.tag(4)
        }
        .toolbarBackground(Color(red: 0.09, green: 0.095, blue: 0.12), for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .overlay(alignment: .top) {
            if store.loading { ProgressView().tint(violet).frame(maxWidth: .infinity).background(Color.black.opacity(0.3)) }
            if let error = store.error { Text(error).font(.footnote).padding(10).frame(maxWidth: .infinity).background(Color.red.opacity(0.85)).onTapGesture { store.error = nil } }
        }
    }
}

private struct ExpensesScreen: View {
    @ObservedObject var store: NativeStore
    private var data: Bootstrap? { store.data }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    HStack { VStack(alignment: .leading, spacing: 3) { Text("Расходы").font(.largeTitle.bold()); Text("Привет, \(data?.user.username ?? "")").foregroundStyle(.secondary) }; Spacer(); Button { store.showAddExpense = true } label: { Image(systemName: "plus").font(.title3.bold()).frame(width: 44,height: 44).background(violet.opacity(0.2),in:Circle()) }.sensoryFeedback(.selection, trigger: store.showAddExpense) }
                    HStack(spacing:10) {
                        QuickAction(title:"Голосом",icon:"waveform",color:.mint) { store.showVoice = true }
                        QuickAction(title:"Сканер",icon:"barcode.viewfinder",color:violet) { store.showScanner = true }
                        QuickAction(title:"Фото / вручную",icon:"camera.fill",color:.orange) { store.showAddExpense = true }
                    }
                    if let d = data {
                        HStack(spacing: 10) {
                            TotalCard(title: "Сегодня", value: d.overview.todayTotal, symbol: d.user.symbol, tint: violet)
                            TotalCard(title: "За месяц", value: d.overview.monthTotal, symbol: d.user.symbol, tint: Color(red: 0.3, green: 0.8, blue: 0.68))
                        }
                        HStack { Text("За неделю").foregroundStyle(.secondary); Spacer(); Text(money(d.overview.weekTotal, d.user.symbol)).fontWeight(.semibold) }.padding(16).background(.white.opacity(0.055), in: RoundedRectangle(cornerRadius: 18))
                        HStack { Text("Последние траты").font(.title3.bold()); Spacer(); Button("Обновить") { Task { await store.refresh() } }.font(.footnote) }
                        if d.overview.recent.isEmpty { EmptyCard(text: "Пока нет записей. Добавь первую трату.") }
                        ForEach(d.overview.recent) { item in ExpenseRowView(item: item, symbol: d.user.symbol) }
                    } else { ProgressView().tint(violet).frame(maxWidth: .infinity).padding(50) }
                }
                .padding(18)
            }
            .background(Color.black)
            .refreshable { await store.refresh() }
            .sheet(isPresented: $store.showAddExpense) { AddExpenseSheet(store: store) }
            .fullScreenCover(isPresented:$store.showScanner) { BarcodeScannerScreen(store:store) }
            .fullScreenCover(isPresented:$store.showVoice) { VoiceEntryScreen(store:store) }
            .onChange(of:store.showVoice) { _, showing in
                if !showing && store.voiceDraft != nil {
                    DispatchQueue.main.asyncAfter(deadline:.now()+0.3) { store.showAddExpense = true }
                }
            }
        }
    }
}

private struct TotalCard: View {
    let title: String; let value: Double; let symbol: String; let tint: Color
    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title).font(.subheadline).foregroundStyle(.secondary)
            Text(money(value, symbol)).font(.system(size: 25, weight: .bold, design: .rounded)).minimumScaleFactor(0.75).lineLimit(1)
            RoundedRectangle(cornerRadius: 2).fill(tint).frame(height: 3)
        }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 20))
    }
}

private struct NutritionScreen: View {
    @ObservedObject var store: NativeStore
    @State private var showAdd = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Питание").font(.largeTitle.bold())
                    HStack(spacing:10) {
                        QuickAction(title:"Фото и ИИ",icon:"sparkles",color:violet) { showAdd = true }
                        QuickAction(title:"Добавить еду",icon:"plus",color:.mint) { showAdd = true }
                    }
                    if let data = store.data {
                        let eaten = data.foodEntries.filter { $0.kind == "meal" }
                        let purchases = data.foodEntries.filter { $0.kind == "purchase" }
                        let total = eaten.reduce(0) { $0 + $1.calories }
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Калории сегодня").foregroundStyle(.secondary)
                            Text("\(Int(total.rounded())) ккал").font(.system(size: 34, weight: .bold, design: .rounded))
                            Text("\(eaten.count) приёмов пищи · \(purchases.count) покупок отдельно").font(.caption).foregroundStyle(.secondary)
                        }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 20))
                        Text("Сегодня").font(.title3.bold()).padding(.top, 4)
                        if data.foodEntries.isEmpty { EmptyCard(text: "Пока ничего не записано. Добавь блюдо, чтобы начать дневник.") }
                        ForEach(eaten) { entry in FoodEntryRow(entry:entry,store:store) }
                        if !purchases.isEmpty { Text("Покупки продуктов").font(.title3.bold()).padding(.top,8);Text("Покупки синхронизируются с расходами. Запиши порцию отдельно, когда съешь.").font(.caption).foregroundStyle(.secondary);ForEach(purchases){FoodEntryRow(entry:$0,store:store)} }
                    }
                }.padding(18)
            }.background(Color.black).refreshable { await store.refresh() }
                .toolbar { ToolbarItem(placement:.topBarTrailing) { Button { showAdd = true } label:{Image(systemName:"plus")} } }
                .sheet(isPresented:$showAdd) { AddFoodSheet(store:store) }
        }
    }
}

private struct AddFoodSheet: View {
    @ObservedObject var store: NativeStore
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""; @State private var grams = "100"; @State private var kcal = ""; @State private var meal = "snack"; @State private var saving = false
    @State private var kind = "meal"; @State private var price = ""; @State private var source = "manual"
    @State private var photo: UIImage?; @State private var pickerSource: UIImagePickerController.SourceType = .photoLibrary; @State private var showPicker = false
    @State private var guess: NutritionGuess?; @State private var context = ""
    private let meals: [(String,String)] = [("breakfast","Завтрак"),("lunch","Обед"),("dinner","Ужин"),("snack","Перекус")]
    var body: some View { NavigationStack { Form {
        Section {
            Picker("Запись",selection:$kind) { Text("Съел(а)").tag("meal"); Text("Покупка в продукты").tag("purchase") }.pickerStyle(.segmented)
            if kind == "purchase" { TextField("Цена покупки",text:$price).keyboardType(.decimalPad) }
            Text(kind == "purchase" ? "Покупка попадёт и в расходы, и в список продуктов. Калории упаковки считаются по указанному весу." : "Проверь оценку ИИ: калории на фото могут быть приблизительными.")
                .font(.caption).foregroundStyle(.secondary)
        }
        Section("Фото еды или упаковки") {
            if let photo { Image(uiImage:photo).resizable().scaledToFill().frame(maxWidth:.infinity).frame(height:180).clipped().clipShape(RoundedRectangle(cornerRadius:14)) }
            HStack {
                Button { pickerSource = .camera; showPicker = true } label: { Label("Снять",systemImage:"camera") }.disabled(!UIImagePickerController.isSourceTypeAvailable(.camera))
                Button { pickerSource = .photoLibrary; showPicker = true } label: { Label("Выбрать фото",systemImage:"photo") }
            }
            if photo != nil { Button { Task { await analyze() } } label: { Label("Распознать еду и этикетку",systemImage:"sparkles") } }
            if let guess {
                Text(guess.note).font(.caption).foregroundStyle(guess.source == "label" ? .green : .orange)
                if !guess.questions.isEmpty { Text("Нужно уточнить").font(.subheadline.bold()); ForEach(guess.questions,id:\.self) { Text("• \($0)").font(.caption).foregroundStyle(.secondary) } }
                TextField("Добавь уточнение для ИИ",text:$context,axis:.vertical).lineLimit(2...4)
                Button("Уточнить результат") { Task { await analyze() } }.disabled(context.trimmingCharacters(in:.whitespaces).isEmpty)
            }
        }
        Section("Блюдо") { TextField("Название",text:$name);TextField("Съедено, грамм",text:$grams).keyboardType(.decimalPad);TextField("Ккал на 100 грамм",text:$kcal).keyboardType(.decimalPad);Picker("Приём пищи",selection:$meal){ForEach(meals,id:\.0){Text($0.1).tag($0.0)}} }
        Section { Button { Task { await save() } } label:{if saving{ProgressView()}else{Text("Добавить в дневник").frame(maxWidth:.infinity)}}.disabled(saving) }
    }.scrollContentBackground(.hidden).background(Color.black).navigationTitle("Добавить еду").toolbar{ToolbarItem(placement:.topBarLeading){Button("Закрыть"){dismiss()}}}.sheet(isPresented:$showPicker){NativeImagePicker(sourceType:pickerSource,image:$photo)} } }
    private func analyze() async {
        guard let photo, let result = await store.recognizePhoto(photo,mode:"nutrition",context:context) else { return }
        guard let parsed = result.guess else { return }
        guess = parsed; name = parsed.name
        if let grams = parsed.grams { self.grams = String(Int(grams.rounded())) }
        if let kcal = parsed.kcalPer100 { self.kcal = String(Int(kcal.rounded())) }
        source = parsed.source
    }
    private func save() async {
        guard let gramsValue=Double(grams.replacingOccurrences(of:",",with:".")),let kcalValue=Double(kcal.replacingOccurrences(of:",",with:".")),!name.trimmingCharacters(in:.whitespaces).isEmpty else{return}
        let amount = kind == "purchase" ? Double(price.replacingOccurrences(of:",",with:".")) : nil
        if kind == "purchase" && amount == nil { return }
        saving=true;await store.addFood(name:name,grams:gramsValue,kcalPer100:kcalValue,meal:meal,kind:kind,amount:amount,source:source);saving=false;if store.error == nil{dismiss()}
    }
}

private struct FoodEntryRow:View {
    @ObservedObject var store:NativeStore
    let entry:FoodEntry
    @State private var showPortion=false
    var body:some View {
        HStack {
            Image(systemName:entry.kind == "purchase" ? "basket.fill":"fork.knife").foregroundStyle(violet).frame(width:40,height:40).background(violet.opacity(0.14),in:RoundedRectangle(cornerRadius:13))
            VStack(alignment:.leading,spacing:3){Text(entry.name).fontWeight(.medium);Text("\(Int(entry.grams)) г · \(entry.kind == "purchase" ? "Покупка" : mealTitle(entry.meal)) · \(Int(entry.kcalPer100)) ккал / 100 г").font(.caption).foregroundStyle(.secondary);if entry.source == "estimate" { Text("Оценка ИИ · проверь точность").font(.caption2).foregroundStyle(.orange) } else if entry.source == "label" { Text("Считано с этикетки").font(.caption2).foregroundStyle(.green) } }
            Spacer();if entry.kind == "meal" { Text("\(Int(entry.calories.rounded())) ккал").font(.subheadline.weight(.semibold)) }
        }.padding(12).background(.white.opacity(0.05),in:RoundedRectangle(cornerRadius:17))
        if entry.kind == "purchase" { Button { showPortion=true } label:{Label("Записать съеденную порцию",systemImage:"plus.circle").font(.subheadline)}.padding(.leading,54).sheet(isPresented:$showPortion){LogPortionSheet(store:store,entry:entry)} }
    }
}

private struct LogPortionSheet:View {
    @ObservedObject var store:NativeStore;let entry:FoodEntry
    @Environment(\.dismiss) private var dismiss
    @State private var grams="100"
    var body:some View { NavigationStack { Form { Section(entry.name){TextField("Сколько съел, грамм",text:$grams).keyboardType(.decimalPad);Text("\(Int(entry.kcalPer100)) ккал на 100 г · всего \(Int((Double(grams.replacingOccurrences(of:",",with:".")) ?? 0) * entry.kcalPer100 / 100)) ккал").font(.caption).foregroundStyle(.secondary)};Section{Button("Добавить в дневник"){Task{guard let value=Double(grams.replacingOccurrences(of:",",with:".")),value>0 else{return};await store.logPortion(from:entry,grams:value);if store.error == nil{dismiss()}}}} }.scrollContentBackground(.hidden).background(Color.black).navigationTitle("Съеденная порция").toolbar{ToolbarItem(placement:.topBarLeading){Button("Закрыть"){dismiss()}}} } }
}

private struct ExpenseRowView: View {
    let item: Expense; let symbol: String
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon(item.category)).font(.system(size: 17,weight:.medium)).foregroundStyle(violet).frame(width: 42,height:42).background(violet.opacity(0.14),in:RoundedRectangle(cornerRadius:14))
            VStack(alignment:.leading,spacing:3) { Text(item.note?.isEmpty == false ? item.note! : item.category).fontWeight(.medium); Text("\(item.category) · \(item.expenseDate)").font(.caption).foregroundStyle(.secondary) }
            Spacer(minLength: 4); Text("−\(money(item.amount,symbol))").font(.subheadline.weight(.semibold))
        }.padding(12).background(.white.opacity(0.045),in:RoundedRectangle(cornerRadius:17))
    }
}

private struct SubscriptionsScreen: View {
    @ObservedObject var store: NativeStore
    var body: some View {
        NavigationStack {
            List {
                if let data = store.data {
                    Section { HStack { Text("В месяц").foregroundStyle(.secondary); Spacer(); Text(money(data.subscriptions.reduce(0){$0+$1.monthly},data.user.symbol)).font(.title3.bold()) }; HStack { Text("За текущий месяц").foregroundStyle(.secondary); Spacer(); Text(money(data.monthTotal,data.user.symbol)).fontWeight(.semibold) } }
                    Section("Активные подписки") {
                        ForEach(data.subscriptions) { item in
                            HStack(spacing:12) { Text(String(item.name.prefix(1)).uppercased()).font(.headline).foregroundStyle(violet).frame(width:38,height:38).background(violet.opacity(0.14),in:RoundedRectangle(cornerRadius:12)); VStack(alignment:.leading,spacing:4){Text(item.name).fontWeight(.medium);Text(item.days <= 0 ? "Списание сегодня" : "Списание через \(item.days) дн.").font(.caption).foregroundStyle(.secondary)};Spacer();Text(money(item.amount,item.sym)).fontWeight(.semibold) }
                        }.onDelete { offsets in for i in offsets { let item = data.subscriptions[i]; Task { await store.deleteSubscription(item) } } }
                    }
                }
            }
            .scrollContentBackground(.hidden).background(Color.black)
            .navigationTitle("Подписки")
            .toolbar { ToolbarItem(placement:.topBarTrailing) { Button { store.showAddSubscription = true } label:{Image(systemName:"plus")} } }
            .sheet(isPresented:$store.showAddSubscription){AddSubscriptionSheet(store:store)}
            .refreshable { await store.refresh() }
        }
    }
}

private struct FriendsScreen: View {
    @ObservedObject var store: NativeStore
    var body: some View {
        NavigationStack {
            List {
                if let friends = store.data?.friends {
                    Section("За этот месяц") {
                        ForEach(Array(friends.enumerated()),id:\.element.id) { index, person in
                            HStack(spacing:12){Text("\(index+1)").font(.headline.monospacedDigit()).foregroundStyle(index == 0 ? .yellow : .secondary).frame(width:26);NativeAvatar(userID:person.id,version:person.avatarV,size:42);Text(person.isMe ? "\(person.username) · вы" : person.username).fontWeight(person.isMe ? .semibold : .regular);Spacer();Text(money(person.total,store.data?.user.symbol ?? "₽")).font(.subheadline.monospacedDigit()) }
                        }
                    }
                    if !store.data!.incoming.isEmpty { Section("Заявки в друзья") { ForEach(store.data!.incoming){ Text($0.username) } } }
                }
            }.scrollContentBackground(.hidden).background(Color.black).navigationTitle("Друзья").refreshable { await store.refresh() }
        }
    }
}

private struct ProfileScreen: View {
    @ObservedObject var store: NativeStore
    var body: some View {
        NavigationStack {
            List {
                if let d = store.data {
                    Section { VStack(spacing:10){NativeAvatar(userID:d.user.id,version:d.profile.avatarV,size:86);Text(d.user.username).font(.title2.bold());Text(d.user.bio ?? "Твой профиль СпендТрекер").foregroundStyle(.secondary)}.frame(maxWidth:.infinity).padding(.vertical,12) }
                    Section("Моя статистика") { LabeledContent("Всего потрачено",value:money(d.profile.allTimeTotal,d.user.symbol));LabeledContent("Записей",value:"\(d.profile.expenseCount)");LabeledContent("Валюта",value:d.user.currency);LabeledContent("Режим",value:d.user.appMode == "nutrition" ? "Питание" : "Расходы") }
                    Section { Button(role:.destructive){Task{await store.logout()}} label:{Label("Выйти из аккаунта",systemImage:"rectangle.portrait.and.arrow.right")} }
                }
            }.scrollContentBackground(.hidden).background(Color.black).navigationTitle("Профиль").refreshable { await store.refresh() }
        }
    }
}

private struct SettingsScreen: View {
    @ObservedObject var store: NativeStore
    private let currencies = ["RUB", "KZT", "USD", "AED", "EUR", "KGS", "UZS"]
    var body: some View {
        NavigationStack {
            Form {
                if let user = store.data?.user {
                    Section("Режим приложения") {
                        Picker("Раздел", selection: Binding(get: { user.appMode }, set: { newValue in
                            Task { await store.updateSettings(appMode:newValue,currency:user.currency,language:user.language) }
                        })) {
                            Text("Расходы").tag("expenses")
                            Text("Питание").tag("nutrition")
                        }
                    }
                    Section("Регион") {
                        Picker("Валюта", selection: Binding(get: { user.currency }, set: { newValue in
                            Task { await store.updateSettings(appMode:user.appMode,currency:newValue,language:user.language) }
                        })) { ForEach(currencies,id:\.self){Text($0).tag($0)} }
                        Picker("Язык", selection: Binding(get: { user.language }, set: { newValue in
                            Task { await store.updateSettings(appMode:user.appMode,currency:user.currency,language:newValue) }
                        })) { Text("Русский").tag("ru");Text("English").tag("en") }
                    }
                    Section { Button(role:.destructive){Task{await store.logout()}} label:{Label("Выйти из аккаунта",systemImage:"rectangle.portrait.and.arrow.right")} }
                }
            }
            .scrollContentBackground(.hidden).background(Color.black).navigationTitle("Настройки")
            .refreshable { await store.refresh() }
        }
    }
}

private struct AddExpenseSheet: View {
    @ObservedObject var store: NativeStore
    @Environment(\.dismiss) private var dismiss
    @State private var amount=""; @State private var note=""; @State private var category="Еда"; @State private var date=Date(); @State private var saving=false
    @State private var photo: UIImage?; @State private var pickerSource: UIImagePickerController.SourceType = .photoLibrary; @State private var showPicker = false
    private let choices=["Еда","Транспорт","Жильё","Развлечения","Здоровье","Одежда","Табак","Прочее"]
    var body: some View {
        NavigationStack { Form {
            Section("Фото товара или чека") {
                if let photo { Image(uiImage:photo).resizable().scaledToFill().frame(maxWidth:.infinity).frame(height:180).clipped().clipShape(RoundedRectangle(cornerRadius:14)) }
                HStack {
                    Button { pickerSource = .camera; showPicker = true } label: { Label("Снять",systemImage:"camera") }.disabled(!UIImagePickerController.isSourceTypeAvailable(.camera))
                    Button { pickerSource = .photoLibrary; showPicker = true } label: { Label("Выбрать фото",systemImage:"photo") }
                }
                if photo != nil { Button { Task { if let photo, let guess = await store.recognizePhoto(photo, mode:"expense") { note = guess.name ?? note; category = guess.category ?? category; if let value = guess.amount { amount = String(value) } } } } label: { Label("Распознать с ИИ",systemImage:"sparkles") } }
            }
            Section("Новая трата") { TextField("Сумма",text:$amount).keyboardType(.decimalPad);TextField("На что потратил?",text:$note);Picker("Категория",selection:$category){ForEach(choices,id:\.self){Text($0)}};DatePicker("Дата",selection:$date,in:...Date(),displayedComponents:.date) }
            Section { Button { Task { await save() } } label: { if saving { ProgressView() } else { Text("Сохранить трату").frame(maxWidth:.infinity) } }.disabled(saving) }
        }.scrollContentBackground(.hidden).background(Color.black).navigationTitle("Добавить трату").navigationBarTitleDisplayMode(.inline).toolbar{ToolbarItem(placement:.topBarLeading){Button("Закрыть"){dismiss()}}}.sheet(isPresented:$showPicker){NativeImagePicker(sourceType:pickerSource,image:$photo)}.onAppear(perform:applyVoiceDraft) }
    }
    private func applyVoiceDraft() {
        guard let draft = store.voiceDraft else { return }
        if amount.isEmpty, let value = draft.amount { amount = String(value) }
        if note.isEmpty { note = draft.note }
        if let category = draft.category, choices.contains(category) { self.category = category }
        if let value = draft.date { let formatter = DateFormatter(); formatter.dateFormat = "yyyy-MM-dd"; formatter.timeZone = TimeZone(secondsFromGMT:0); if let parsed = formatter.date(from:value) { date = parsed } }
        store.voiceDraft = nil
    }
    private func save() async { guard let value=Double(amount.replacingOccurrences(of:",",with:".")),value>0 else{return};saving=true;await store.addExpense(amount:value,category:category,note:note,date:date);saving=false;if store.error == nil {dismiss()} }
}

private struct AddSubscriptionSheet: View {
    @ObservedObject var store: NativeStore
    @Environment(\.dismiss) private var dismiss
    @State private var name="";@State private var amount="";@State private var date=Calendar.current.date(byAdding:.day,value:7,to:Date()) ?? Date()
    var body: some View { NavigationStack { Form { Section("Новая подписка"){TextField("Название",text:$name);TextField("Цена за месяц",text:$amount).keyboardType(.decimalPad);DatePicker("Следующее списание",selection:$date,in:Date.distantPast...,displayedComponents:.date)};Section{Button("Сохранить"){Task{guard let value=Double(amount.replacingOccurrences(of:",",with:".")),!name.isEmpty else{return};await store.addSubscription(name:name,amount:value,date:date);if store.error == nil{dismiss()}}}} }.scrollContentBackground(.hidden).background(Color.black).navigationTitle("Подписка").toolbar{ToolbarItem(placement:.topBarLeading){Button("Закрыть"){dismiss()}}} } }
}

private struct QuickAction: View {
    let title: String; let icon: String; let color: Color; let action: () -> Void
    var body: some View {
        Button(action:action) {
            VStack(spacing:9) {
                Image(systemName:icon).font(.system(size:19,weight:.semibold)).foregroundStyle(color)
                    .frame(width:46,height:46).background(color.opacity(0.14),in:RoundedRectangle(cornerRadius:15))
                Text(title).font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.8)
            }
            .frame(maxWidth:.infinity).padding(.vertical,12)
            .background(.white.opacity(0.045),in:RoundedRectangle(cornerRadius:19))
        }.buttonStyle(.plain).sensoryFeedback(.selection,trigger:title)
    }
}

private struct BarcodeScannerScreen: View {
    @ObservedObject var store: NativeStore
    @Environment(\.dismiss) private var dismiss
    @State private var code = ""
    @State private var manual = ""
    var body: some View {
        NavigationStack {
            VStack(spacing:18) {
                if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                    BarcodeCaptureView { value in
                        guard code.isEmpty else { return }
                        code = value
                        Task { await store.lookupBarcode(value) }
                    }
                    .frame(height:420).clipShape(RoundedRectangle(cornerRadius:26)).overlay {
                        RoundedRectangle(cornerRadius:26).stroke(violet.opacity(0.7),lineWidth:2).padding(42).allowsHitTesting(false)
                    }
                    .padding(.horizontal,16)
                    Text(code.isEmpty ? "Наведи камеру на штрихкод" : "Ищу товар · \(code)")
                        .font(.headline).foregroundStyle(.secondary)
                } else {
                    EmptyCard(text:"Сканер камеры недоступен. Введи код вручную.")
                }
                HStack {
                    TextField("Штрихкод EAN-8 / EAN-13",text:$manual).keyboardType(.numberPad).textFieldStyle(.roundedBorder)
                    Button("Найти") { let value = String(manual.filter(\.isNumber)); guard (8...14).contains(value.count) else { return }; code = value; Task { await store.lookupBarcode(value) } }.buttonStyle(.borderedProminent)
                }.padding(.horizontal,18)
                Spacer(minLength:8)
            }
            .padding(.top,18).background(Color.black.ignoresSafeArea())
            .navigationTitle("Сканер товара").navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement:.topBarLeading) { Button("Закрыть") { dismiss() } } }
            .sheet(item:$store.scannedProduct) { product in ScannedProductSheet(store:store,product:product) }
            .overlay { if store.loading { ProgressView("Ищем товар…").padding(20).background(.ultraThinMaterial,in:RoundedRectangle(cornerRadius:18)) } }
        }
    }
}

private struct BarcodeCaptureView: UIViewControllerRepresentable {
    let onCode: (String) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(onCode:onCode) }
    func makeUIViewController(context:Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(recognizedDataTypes:[.barcode(symbologies:[.ean13,.ean8,.upce,.code128,.code39,.itf14])],qualityLevel:.balanced,isGuidanceEnabled:true,isHighlightingEnabled:true)
        scanner.delegate=context.coordinator
        do { try scanner.startScanning() } catch { }
        return scanner
    }
    func updateUIViewController(_ controller:DataScannerViewController,context:Context) {}
    @MainActor final class Coordinator: NSObject,DataScannerViewControllerDelegate {
        let onCode:(String)->Void; private var sent=false
        init(onCode:@escaping(String)->Void){self.onCode=onCode}
        func dataScanner(_ dataScanner:DataScannerViewController,didAdd addedItems:[RecognizedItem],allItems:[RecognizedItem]) {
            guard !sent else{return}
            for item in addedItems { if case .barcode(let code)=item,let value=code.payloadStringValue,(8...14).contains(value.count) { sent=true;onCode(value);return } }
        }
    }
}

private struct ScannedProductSheet: View {
    @ObservedObject var store:NativeStore
    let product:NativeProduct
    @Environment(\.dismiss) private var dismiss
    @State private var name=""; @State private var amount=""; @State private var category="Еда"
    @State private var photo:UIImage?; @State private var showPicker=false; @State private var picking:UIImagePickerController.SourceType = .camera
    private let categories=["Еда","Транспорт","Жильё","Развлечения","Здоровье","Одежда","Табак","Прочее"]
    var body:some View {
        NavigationStack { Form {
            Section("Найденный товар") {
                if let image=product.image,let url=URL(string:image) { AsyncImage(url:url){ $0.resizable().scaledToFit() } placeholder:{Image(systemName:"shippingbox").foregroundStyle(.secondary)}.frame(height:110).frame(maxWidth:.infinity) }
                TextField("Название товара",text:$name)
                Text("Штрихкод · \(product.barcode)\(product.quantity.map{" · \($0)"} ?? "")").font(.caption).foregroundStyle(.secondary)
                if let prior=store.scannedPrices?.mine.first { Text("Твоя прошлая цена: \(money(prior.amount,store.data?.user.symbol ?? "₽"))\(prior.store.map{" · \($0)"} ?? "")").font(.caption).foregroundStyle(.secondary) }
                else if let common=store.scannedPrices?.stores.first { Text("Обычно покупают за \(money(common.avg,store.data?.user.symbol ?? "₽"))\(common.store.map{" · \($0)"} ?? "")").font(.caption).foregroundStyle(.secondary) }
                if !product.found { Text("В каталоге не найден. Проверь название или добавь фото товара в следующем шаге.").font(.caption).foregroundStyle(.orange) }
                if let photo { Image(uiImage:photo).resizable().scaledToFit().frame(height:130).frame(maxWidth:.infinity) }
                HStack {
                    Button { picking = .camera;showPicker=true } label:{Label("Сфотографировать",systemImage:"camera")}.disabled(!UIImagePickerController.isSourceTypeAvailable(.camera))
                    Button { picking = .photoLibrary;showPicker=true } label:{Label("Из галереи",systemImage:"photo")}
                }
                if photo != nil { Button("Уточнить название по фото через ИИ") { Task { if let photo,let guess=await store.recognizePhoto(photo,mode:"expense") { name=guess.name ?? name;category=guess.category ?? category } } } }
            }
            Section("Покупка") { TextField("Цена",text:$amount).keyboardType(.decimalPad);Picker("Категория",selection:$category){ForEach(categories,id:\.self){Text($0)}} }
            Section { Button("Добавить в расходы") { Task { guard let value=Double(amount.replacingOccurrences(of:",",with:".")),value>0 else{return};await store.addExpense(amount:value,category:category,note:name,date:Date(),barcode:product.barcode);if store.error == nil{dismiss();store.scannedProduct=nil;store.showScanner=false} } }.disabled(name.isEmpty || amount.isEmpty) }
        }.scrollContentBackground(.hidden).background(Color.black).navigationTitle("Проверить товар").toolbar{ToolbarItem(placement:.topBarLeading){Button("Закрыть"){dismiss();store.scannedProduct=nil}}}.sheet(isPresented:$showPicker){NativeImagePicker(sourceType:picking,image:$photo)}.onAppear{if name.isEmpty{name=[product.name ?? product.brand,product.quantity].compactMap{$0}.joined(separator:" ");category=product.category ?? "Еда"};if amount.isEmpty,let previous=store.scannedPrices?.mine.first{amount=String(previous.amount)}else if amount.isEmpty,let average=store.scannedPrices?.stores.first{amount=String(average.avg)}} }
    }
}

@MainActor private final class NativeSpeechCapture:ObservableObject {
    @Published var transcript=""; @Published var message="Нажми на микрофон и продиктуй трату"
    @Published var listening=false
    private let engine=AVAudioEngine(); private var request:SFSpeechAudioBufferRecognitionRequest?; private var task:SFSpeechRecognitionTask?
    func start(language:String) {
        guard !listening else{return}
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            Task { @MainActor in
                guard let self else{return}
                guard status == .authorized else { self.message="Разреши распознавание речи в настройках iPhone";return }
                AVAudioSession.sharedInstance().requestRecordPermission { allowed in
                    Task { @MainActor in
                        guard allowed else { self.message="Разреши доступ к микрофону в настройках iPhone";return }
                        self.begin(language:language)
                    }
                }
            }
        }
    }
    private func begin(language:String) {
        guard let recognizer=SFSpeechRecognizer(locale:Locale(identifier:language == "en" ? "en-US" : "ru-RU")),recognizer.isAvailable else { message="Распознавание речи сейчас недоступно";return }
        let audio=AVAudioSession.sharedInstance()
        do {
            try audio.setCategory(.record,mode:.measurement,options:.duckOthers);try audio.setActive(true,options:.notifyOthersOnDeactivation)
            let input=engine.inputNode;let audioRequest=SFSpeechAudioBufferRecognitionRequest();request=audioRequest;audioRequest.shouldReportPartialResults=true
            if #available(iOS 13.0,*) { audioRequest.requiresOnDeviceRecognition=false }
            let format=input.outputFormat(forBus:0);input.installTap(onBus:0,bufferSize:1024,format:format){ buffer,_ in audioRequest.append(buffer) }
            engine.prepare();try engine.start();listening=true;message="Слушаю…"
            task=recognizer.recognitionTask(with:audioRequest){[weak self] result,error in
                let text=result?.bestTranscription.formattedString
                let isDone=error != nil || (result?.isFinal ?? false)
                Task { @MainActor in
                    guard let self else{return}
                    if let text { self.transcript=text }
                    if isDone { self.stop() }
                }
            }
        } catch { message="Не удалось включить микрофон";stop() }
    }
    func stop(){if engine.isRunning{engine.stop();engine.inputNode.removeTap(onBus:0)};request?.endAudio();task?.cancel();task=nil;request=nil;listening=false;try? AVAudioSession.sharedInstance().setActive(false)}
}

private struct VoiceEntryScreen:View {
    @ObservedObject var store:NativeStore
    @Environment(\.dismiss) private var dismiss
    @StateObject private var capture=NativeSpeechCapture()
    var body:some View {
        NavigationStack { VStack(spacing:26) {
            Spacer()
            Image(systemName:capture.listening ? "waveform" : "mic.fill").font(.system(size:42,weight:.semibold)).foregroundStyle(violet).frame(width:112,height:112).background(violet.opacity(0.14),in:Circle()).symbolEffect(.pulse, isActive:capture.listening)
            Text(capture.message).font(.headline).multilineTextAlignment(.center).foregroundStyle(.secondary)
            Text(capture.transcript.isEmpty ? "Например: «вчера такси тысяча двести»" : capture.transcript).font(.title3.weight(.medium)).multilineTextAlignment(.center).padding(.horizontal,20).frame(minHeight:80)
            Button { if capture.listening { capture.stop() } else { capture.start(language:store.data?.user.language ?? "ru") } } label:{Label(capture.listening ? "Остановить запись":"Начать запись",systemImage:capture.listening ? "stop.fill":"mic.fill").frame(maxWidth:.infinity).frame(height:54)}.buttonStyle(.borderedProminent).tint(violet).padding(.horizontal,24)
            if !capture.transcript.isEmpty { Button("Проверить и продолжить") { Task { capture.stop();if let draft=await store.parseVoice(capture.transcript){store.voiceDraft=draft;store.showVoice=false} } }.font(.headline) }
            Spacer()
        }.padding(18).background(Color.black.ignoresSafeArea()).navigationTitle("Добавить голосом").toolbar{ToolbarItem(placement:.topBarLeading){Button("Закрыть"){capture.stop();dismiss()}}}.onAppear{capture.start(language:store.data?.user.language ?? "ru")}.onDisappear{capture.stop()} }
    }
}

private struct EmptyCard: View {
    let text:String
    var body:some View{VStack(spacing:10){Image(systemName:"sparkle").font(.title2).foregroundStyle(violet);Text(text).multilineTextAlignment(.center).foregroundStyle(.secondary)}.frame(maxWidth:.infinity).padding(24).background(.white.opacity(0.05),in:RoundedRectangle(cornerRadius:20))}
}

private struct NativeImagePicker: UIViewControllerRepresentable {
    let sourceType: UIImagePickerController.SourceType
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController(); picker.sourceType = sourceType; picker.delegate = context.coordinator
        picker.allowsEditing = false; return picker
    }
    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(self) }
    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let parent: NativeImagePicker
        init(_ parent: NativeImagePicker) { self.parent = parent }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            parent.image = info[.originalImage] as? UIImage; parent.dismiss()
        }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}

private struct NativeAvatar: View {
    let userID: Int; let version: String?; let size: CGFloat
    @State private var image: UIImage?
    var body: some View {
        Group {
            if let image { Image(uiImage:image).resizable().scaledToFill() }
            else { Image(systemName:"person.fill").resizable().scaledToFit().padding(size * 0.25).foregroundStyle(violet).background(violet.opacity(0.15)) }
        }
        .frame(width:size,height:size).clipShape(Circle())
        .task(id:"\(userID)-\(version ?? "none")") {
            guard version != nil, let cookie = SessionVault.load(),
                  let url = URL(string:"/avatar/\(userID)?v=\(version ?? "")",relativeTo:site) else { image = nil; return }
            var request = URLRequest(url:url); request.setValue("session=\(cookie.value)",forHTTPHeaderField:"Cookie")
            if let (bytes, response) = try? await URLSession.shared.data(for:request),
               (response as? HTTPURLResponse)?.statusCode == 200 { image = UIImage(data:bytes) }
        }
    }
}

private extension UIImage {
    var nativeJPEG: Data? {
        let maxSide: CGFloat = 1600
        let ratio = min(1, maxSide / max(size.width,size.height))
        let target = CGSize(width:size.width * ratio,height:size.height * ratio)
        let renderer = UIGraphicsImageRenderer(size:target)
        return renderer.jpegData(withCompressionQuality:0.78) { _ in draw(in:CGRect(origin:.zero,size:target)) }
    }
}

private func money(_ value: Double, _ symbol: String) -> String {
    let number=NumberFormatter();number.numberStyle = .decimal;number.maximumFractionDigits=0;number.groupingSeparator=" ";return "\(number.string(from:NSNumber(value:value)) ?? "0") \(symbol)"
}

private func icon(_ category:String)->String { switch category {case "Еда":return "fork.knife";case "Транспорт":return "tram.fill";case "Жильё":return "house.fill";case "Развлечения":return "ticket.fill";case "Здоровье":return "heart.fill";case "Одежда":return "tshirt.fill";default:return "circle.grid.2x2.fill"} }
private func mealTitle(_ meal:String)->String { switch meal {case "breakfast":return "Завтрак";case "lunch":return "Обед";case "dinner":return "Ужин";default:return "Перекус"} }

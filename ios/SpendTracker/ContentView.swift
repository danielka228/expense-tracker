import SwiftUI
import UIKit
import AuthenticationServices
import Security

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
}

private struct Incoming: Decodable, Identifiable {
    let id: Int
    let username: String
}

private struct ProfileSummary: Decodable {
    let expenseCount: Int
    let allTimeTotal: Double
}

@MainActor
private final class NativeStore: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
    @Published var isLoggedIn = false
    @Published var loading = false
    @Published var error: String?
    @Published var data: Bootstrap?
    @Published var tab = 0
    @Published var showAddExpense = false
    @Published var showAddSubscription = false
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

    func addExpense(amount: Double, category: String, note: String, date: Date) async {
        let payload: [String: Any] = ["amount": amount, "category": category, "note": note,
                                      "date": ISO8601DateFormatter.nativeDate.string(from: date)]
        await mutate(path: "/api/native/expenses", method: "POST", payload: payload)
    }

    func addSubscription(name: String, amount: Double, date: Date) async {
        let payload: [String: Any] = ["name": name, "amount": String(amount), "next_date": ISO8601DateFormatter.nativeDate.string(from: date),
                                      "period": "month", "currency": data?.user.currency ?? "RUB", "category": "Развлечения"]
        await mutate(path: "/api/native/subscriptions", method: "POST", payload: payload)
    }

    func deleteSubscription(_ item: Subscription) async {
        await mutate(path: "/api/native/subscriptions/\(item.id)", method: "DELETE")
    }

    func addFood(name: String, grams: Double, kcalPer100: Double, meal: String) async {
        await mutate(path: "/api/native/food", method: "POST", payload: [
            "name": name, "grams": grams, "kcalPer100": kcalPer100, "meal": meal,
            "requestKey": UUID().uuidString
        ])
    }

    func updateSettings(appMode: String, currency: String, language: String) async {
        await mutate(path: "/api/native/settings", method: "PUT", payload: [
            "appMode": appMode, "currency": currency, "language": language
        ])
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

private extension ISO8601DateFormatter {
    static let nativeDate: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter(); f.formatOptions = [.withFullDate]; f.timeZone = TimeZone(secondsFromGMT: 0); return f
    }()
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
                    if let data = store.data {
                        let total = data.foodEntries.reduce(0) { $0 + $1.calories }
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Калории сегодня").foregroundStyle(.secondary)
                            Text("\(Int(total.rounded())) ккал").font(.system(size: 34, weight: .bold, design: .rounded))
                            Text("\(data.foodEntries.count) записей").font(.caption).foregroundStyle(.secondary)
                        }.padding(18).frame(maxWidth: .infinity, alignment: .leading).background(.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 20))
                        Text("Сегодня").font(.title3.bold()).padding(.top, 4)
                        if data.foodEntries.isEmpty { EmptyCard(text: "Пока ничего не записано. Добавь блюдо, чтобы начать дневник.") }
                        ForEach(data.foodEntries) { entry in
                            HStack { Image(systemName: "fork.knife").foregroundStyle(violet).frame(width: 40,height:40).background(violet.opacity(0.14),in:RoundedRectangle(cornerRadius:13)); VStack(alignment:.leading,spacing:3){Text(entry.name).fontWeight(.medium);Text("\(Int(entry.grams)) г · \(mealTitle(entry.meal))").font(.caption).foregroundStyle(.secondary)};Spacer();Text("\(Int(entry.calories.rounded())) ккал").font(.subheadline.weight(.semibold)) }.padding(12).background(.white.opacity(0.05),in:RoundedRectangle(cornerRadius:17))
                        }
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
    private let meals: [(String,String)] = [("breakfast","Завтрак"),("lunch","Обед"),("dinner","Ужин"),("snack","Перекус")]
    var body: some View { NavigationStack { Form {
        Section("Блюдо") { TextField("Название",text:$name);TextField("Съедено, грамм",text:$grams).keyboardType(.decimalPad);TextField("Ккал на 100 грамм",text:$kcal).keyboardType(.decimalPad);Picker("Приём пищи",selection:$meal){ForEach(meals,id:\.0){Text($0.1).tag($0.0)}} }
        Section { Button { Task { await save() } } label:{if saving{ProgressView()}else{Text("Добавить в дневник").frame(maxWidth:.infinity)}}.disabled(saving) }
    }.scrollContentBackground(.hidden).background(Color.black).navigationTitle("Добавить еду").toolbar{ToolbarItem(placement:.topBarLeading){Button("Закрыть"){dismiss()}}} } }
    private func save() async { guard let gramsValue=Double(grams.replacingOccurrences(of:",",with:".")),let kcalValue=Double(kcal.replacingOccurrences(of:",",with:".")),!name.trimmingCharacters(in:.whitespaces).isEmpty else{return};saving=true;await store.addFood(name:name,grams:gramsValue,kcalPer100:kcalValue,meal:meal);saving=false;if store.error == nil{dismiss()} }
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
                            HStack(spacing:12){Text("\(index+1)").font(.headline.monospacedDigit()).foregroundStyle(index == 0 ? .yellow : .secondary).frame(width:26);Text(String(person.username.prefix(1)).uppercased()).font(.headline).frame(width:40,height:40).background(violet.opacity(0.16),in:Circle());Text(person.isMe ? "\(person.username) · вы" : person.username).fontWeight(person.isMe ? .semibold : .regular);Spacer();Text(money(person.total,store.data?.user.symbol ?? "₽")).font(.subheadline.monospacedDigit()) }
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
                    Section { VStack(spacing:10){Image(systemName:"person.crop.circle.fill").font(.system(size:72)).foregroundStyle(violet);Text(d.user.username).font(.title2.bold());Text(d.user.bio ?? "Твой профиль СпендТрекер").foregroundStyle(.secondary)}.frame(maxWidth:.infinity).padding(.vertical,12) }
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
    private let choices=["Еда","Транспорт","Жильё","Развлечения","Здоровье","Одежда","Табак","Прочее"]
    var body: some View {
        NavigationStack { Form {
            Section("Новая трата") { TextField("Сумма",text:$amount).keyboardType(.decimalPad);TextField("На что потратил?",text:$note);Picker("Категория",selection:$category){ForEach(choices,id:\.self){Text($0)}};DatePicker("Дата",selection:$date,in:...Date(),displayedComponents:.date) }
            Section { Button { Task { await save() } } label: { if saving { ProgressView() } else { Text("Сохранить трату").frame(maxWidth:.infinity) } }.disabled(saving) }
        }.scrollContentBackground(.hidden).background(Color.black).navigationTitle("Добавить трату").navigationBarTitleDisplayMode(.inline).toolbar{ToolbarItem(placement:.topBarLeading){Button("Закрыть"){dismiss()}}} }
    }
    private func save() async { guard let value=Double(amount.replacingOccurrences(of:",",with:".")),value>0 else{return};saving=true;await store.addExpense(amount:value,category:category,note:note,date:date);saving=false;if store.error == nil {dismiss()} }
}

private struct AddSubscriptionSheet: View {
    @ObservedObject var store: NativeStore
    @Environment(\.dismiss) private var dismiss
    @State private var name="";@State private var amount="";@State private var date=Calendar.current.date(byAdding:.day,value:7,to:Date()) ?? Date()
    var body: some View { NavigationStack { Form { Section("Новая подписка"){TextField("Название",text:$name);TextField("Цена за месяц",text:$amount).keyboardType(.decimalPad);DatePicker("Следующее списание",selection:$date,in:Date.distantPast...,displayedComponents:.date)};Section{Button("Сохранить"){Task{guard let value=Double(amount.replacingOccurrences(of:",",with:".")),!name.isEmpty else{return};await store.addSubscription(name:name,amount:value,date:date);if store.error == nil{dismiss()}}}} }.scrollContentBackground(.hidden).background(Color.black).navigationTitle("Подписка").toolbar{ToolbarItem(placement:.topBarLeading){Button("Закрыть"){dismiss()}}} } }
}

private struct EmptyCard: View {
    let text:String
    var body:some View{VStack(spacing:10){Image(systemName:"sparkle").font(.title2).foregroundStyle(violet);Text(text).multilineTextAlignment(.center).foregroundStyle(.secondary)}.frame(maxWidth:.infinity).padding(24).background(.white.opacity(0.05),in:RoundedRectangle(cornerRadius:20))}
}

private func money(_ value: Double, _ symbol: String) -> String {
    let number=NumberFormatter();number.numberStyle = .decimal;number.maximumFractionDigits=0;number.groupingSeparator=" ";return "\(number.string(from:NSNumber(value:value)) ?? "0") \(symbol)"
}

private func icon(_ category:String)->String { switch category {case "Еда":return "fork.knife";case "Транспорт":return "tram.fill";case "Жильё":return "house.fill";case "Развлечения":return "ticket.fill";case "Здоровье":return "heart.fill";case "Одежда":return "tshirt.fill";default:return "circle.grid.2x2.fill"} }
private func mealTitle(_ meal:String)->String { switch meal {case "breakfast":return "Завтрак";case "lunch":return "Обед";case "dinner":return "Ужин";default:return "Перекус"} }

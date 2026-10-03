import Foundation
import StoreKit

/// StoreKit 2 wrapper for Folio Pro.
@MainActor @Observable
final class StoreService {
    enum ProductID: String, CaseIterable {
        case yearly = "app.folio.pro.yearly"
        case lifetime = "app.folio.pro.lifetime"
    }

    private(set) var products: [Product] = []
    private(set) var isPro = false
    private(set) var isLoadingProducts = false
    private(set) var isPurchasing = false
    private(set) var lastError: String?

    private var updatesTask: Task<Void, Never>?

    #if DEBUG
    /// Lets you exercise Pro features in Debug builds without a purchase.
    var debugUnlock: Bool {
        get { UserDefaults.standard.bool(forKey: "debug.proUnlocked") }
        set {
            UserDefaults.standard.set(newValue, forKey: "debug.proUnlocked")
            Task { await refreshEntitlements() }
        }
    }
    #endif

    func start() async {
        if updatesTask == nil {
            updatesTask = Task.detached { [weak self] in
                for await result in Transaction.updates {
                    if case .verified(let transaction) = result {
                        await transaction.finish()
                    }
                    await self?.refreshEntitlements()
                }
            }
        }
        await refreshEntitlements()
        await loadProducts()
    }

    func loadProducts() async {
        guard !isLoadingProducts else { return }
        isLoadingProducts = true
        defer { isLoadingProducts = false }
        do {
            let loaded = try await Product.products(for: ProductID.allCases.map(\.rawValue))
            products = loaded.sorted { $0.price < $1.price }
            lastError = nil
        } catch {
            lastError = error.localizedDescription
        }
    }

    func refreshEntitlements() async {
        var entitled = false
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            guard ProductID(rawValue: transaction.productID) != nil else { continue }
            if transaction.revocationDate == nil {
                entitled = true
            }
        }
        #if DEBUG
        if debugUnlock { entitled = true }
        #endif
        isPro = entitled
    }

    /// Returns true when the purchase completed and Pro is now active.
    func purchase(_ product: Product) async -> Bool {
        guard !isPurchasing else { return false }
        isPurchasing = true
        defer { isPurchasing = false }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                guard case .verified(let transaction) = verification else {
                    lastError = "The purchase couldn't be verified."
                    return false
                }
                await transaction.finish()
                await refreshEntitlements()
                return isPro
            case .userCancelled, .pending:
                return false
            @unknown default:
                return false
            }
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    func restore() async {
        do {
            try await AppStore.sync()
        } catch {
            lastError = error.localizedDescription
        }
        await refreshEntitlements()
    }

    func product(_ id: ProductID) -> Product? {
        products.first { $0.id == id.rawValue }
    }
}

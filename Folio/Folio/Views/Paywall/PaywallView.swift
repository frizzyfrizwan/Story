import StoreKit
import SwiftUI

/// The Folio Pro paywall. Shows what Pro adds, with the feature that
/// brought the user here called out first.
struct PaywallView: View {
    var feature: ProFeature?

    @Environment(StoreService.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var selected: StoreService.ProductID = .yearly
    @State private var message: String?

    private var orderedFeatures: [ProFeature] {
        guard let feature else { return ProFeature.allCases }
        return [feature] + ProFeature.allCases.filter { $0 != feature }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    hero
                    featureList
                    products
                    purchaseButton
                    footer
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 32)
            }
            .background(FolioTheme.canvas)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .symbolRenderingMode(.hierarchical)
                            .font(.title3)
                    }
                    .accessibilityLabel("Close")
                }
            }
            .task {
                if store.products.isEmpty { await store.loadProducts() }
            }
            .onChange(of: store.isPro) { _, isPro in
                if isPro { dismiss() }
            }
            .alert("Folio Pro", isPresented: Binding(
                get: { message != nil },
                set: { if !$0 { message = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(message ?? "")
            }
        }
    }

    private var hero: some View {
        VStack(spacing: 10) {
            Image(systemName: "sparkles.rectangle.stack.fill")
                .font(.system(size: 48))
                .foregroundStyle(FolioTheme.pro)
                .padding(.top, 8)
            Text("Folio Pro")
                .font(.largeTitle.weight(.bold))
            Text(feature?.detail ?? "The tools that turn paper into real, searchable, safe documents.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 340)
        }
    }

    private var featureList: some View {
        VStack(spacing: 0) {
            ForEach(orderedFeatures) { item in
                HStack(spacing: 14) {
                    Image(systemName: item.symbol)
                        .font(.title3)
                        .frame(width: 40, height: 40)
                        .background(FolioTheme.pro.opacity(0.14), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .foregroundStyle(FolioTheme.pro)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.title)
                            .font(.body.weight(.semibold))
                        Text(item.detail)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 10)
                if item != orderedFeatures.last {
                    Divider()
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 6)
        .background(FolioTheme.paper, in: RoundedRectangle(cornerRadius: FolioTheme.cardRadius, style: .continuous))
    }

    private var products: some View {
        VStack(spacing: 10) {
            if store.isLoadingProducts && store.products.isEmpty {
                ProgressView("Loading plans…")
                    .frame(maxWidth: .infinity)
                    .padding()
            } else if store.products.isEmpty {
                VStack(spacing: 8) {
                    Text("Plans couldn't be loaded.")
                        .foregroundStyle(.secondary)
                    Button("Try again") {
                        Task { await store.loadProducts() }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding()
            } else {
                if let yearly = store.product(.yearly) {
                    planCard(product: yearly, id: .yearly, badge: "Most popular")
                }
                if let lifetime = store.product(.lifetime) {
                    planCard(product: lifetime, id: .lifetime, badge: "Pay once")
                }
            }
        }
    }

    private func planCard(product: Product, id: StoreService.ProductID, badge: String) -> some View {
        let isSelected = selected == id
        return Button {
            Haptics.selection()
            selected = id
        } label: {
            HStack(spacing: 12) {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 8) {
                        Text(planTitle(for: id))
                            .font(.body.weight(.semibold))
                        Text(badge)
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.accentColor.opacity(0.14), in: Capsule())
                            .foregroundStyle(Color.accentColor)
                    }
                    Text(planDetail(for: product, id: id))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text(product.displayPrice)
                    .font(.body.weight(.semibold))
            }
            .padding(16)
            .background(FolioTheme.paper, in: RoundedRectangle(cornerRadius: FolioTheme.cardRadius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: FolioTheme.cardRadius, style: .continuous)
                    .strokeBorder(isSelected ? Color.accentColor : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private func planTitle(for id: StoreService.ProductID) -> String {
        switch id {
        case .yearly: return "Yearly"
        case .lifetime: return "Lifetime"
        }
    }

    private func planDetail(for product: Product, id: StoreService.ProductID) -> String {
        switch id {
        case .yearly:
            if let offer = product.subscription?.introductoryOffer, offer.paymentMode == .freeTrial {
                return "\(trialText(offer)) free, then \(product.displayPrice) per year. Cancel any time."
            }
            return "\(product.displayPrice) per year. Cancel any time."
        case .lifetime:
            return "One payment, every Pro feature forever."
        }
    }

    private func trialText(_ offer: Product.SubscriptionOffer) -> String {
        let period = offer.period
        let unit: String
        switch period.unit {
        case .day: unit = period.value == 1 ? "day" : "days"
        case .week: unit = period.value == 1 ? "week" : "weeks"
        case .month: unit = period.value == 1 ? "month" : "months"
        case .year: unit = period.value == 1 ? "year" : "years"
        @unknown default: unit = "period"
        }
        return "\(period.value) \(unit)"
    }

    private var purchaseButton: some View {
        VStack(spacing: 12) {
            Button {
                Task { await purchase() }
            } label: {
                HStack {
                    if store.isPurchasing {
                        ProgressView().tint(.white)
                    }
                    Text(ctaTitle)
                        .fontWeight(.semibold)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(store.products.isEmpty || store.isPurchasing)

            Button("Restore purchases") {
                Task {
                    await store.restore()
                    if !store.isPro { message = "No previous purchase was found for this Apple ID." }
                }
            }
            .font(.footnote)
        }
    }

    private var ctaTitle: String {
        if selected == .yearly,
           let yearly = store.product(.yearly),
           let offer = yearly.subscription?.introductoryOffer,
           offer.paymentMode == .freeTrial {
            return "Start free trial"
        }
        return "Continue"
    }

    private var footer: some View {
        Text("Payment is charged to your Apple ID. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel in Settings › Apple ID › Subscriptions.")
            .font(.caption2)
            .foregroundStyle(.tertiary)
            .multilineTextAlignment(.center)
    }

    private func purchase() async {
        guard let product = store.product(selected) else { return }
        let success = await store.purchase(product)
        if success {
            Haptics.success()
            dismiss()
        } else if let error = store.lastError {
            message = error
        }
    }
}

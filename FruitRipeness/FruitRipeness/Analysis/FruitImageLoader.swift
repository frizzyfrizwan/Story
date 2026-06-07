import SwiftUI
import UIKit

// Fetches and caches fruit photos from Wikipedia's public REST API.
// Called from within the running iOS app — works fine on device/simulator.
@MainActor
final class FruitImageLoader: ObservableObject {

    @Published var images: [FruitType: UIImage] = [:]

    private var inFlight: Set<FruitType> = []

    func load(_ fruit: FruitType) {
        guard fruit != .unknown,
              images[fruit] == nil,
              !inFlight.contains(fruit) else { return }

        inFlight.insert(fruit)

        Task {
            if let image = await fetchWikipediaImage(for: fruit) {
                images[fruit] = image
            }
            inFlight.remove(fruit)
        }
    }

    func preloadAll() {
        for fruit in FruitType.allCases where fruit != .unknown {
            load(fruit)
        }
    }

    // MARK: - Wikipedia REST API

    private func fetchWikipediaImage(for fruit: FruitType) async -> UIImage? {
        let title = fruit.wikipediaTitle.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? fruit.wikipediaTitle
        let summaryURL = URL(string: "https://en.wikipedia.org/api/rest_v1/page/summary/\(title)")!

        var request = URLRequest(url: summaryURL)
        request.setValue("FruitRipenessApp/1.0 (iOS; educational)", forHTTPHeaderField: "User-Agent")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let thumbnail = json["thumbnail"] as? [String: Any],
                  let sourceString = thumbnail["source"] as? String,
                  let imageURL = URL(string: sourceString) else { return nil }

            // Fetch the actual image
            let (imageData, _) = try await URLSession.shared.data(from: imageURL)
            return UIImage(data: imageData)
        } catch {
            print("[ImageLoader] Failed to load \(fruit.displayName): \(error.localizedDescription)")
            return nil
        }
    }
}

import XCTest
@testable import Vigil

final class FormattersTests: XCTestCase {
    // MARK: - Rates

    func testRateUsesDecimalUnits() {
        XCTAssertEqual(Format.rate(0), "0 B/s")
        XCTAssertEqual(Format.rate(500), "500 B/s")
        XCTAssertEqual(Format.rate(999), "999 B/s")
        XCTAssertEqual(Format.rate(12_400), "12.4 KB/s")
        XCTAssertEqual(Format.rate(2_500_000), "2.5 MB/s")
        XCTAssertEqual(Format.rate(3_000_000_000), "3.00 GB/s")
    }

    func testRateClampsNegativeValues() {
        XCTAssertEqual(Format.rate(-5_000), "0 B/s")
    }

    func testCompactRateForMenuBar() {
        XCTAssertEqual(MenuBarRenderer.compactRate(0), "0 K")
        XCTAssertEqual(MenuBarRenderer.compactRate(500), "0 K")
        XCTAssertEqual(MenuBarRenderer.compactRate(-100), "0 K")
        XCTAssertEqual(MenuBarRenderer.compactRate(12_400), "12 K")
        XCTAssertEqual(MenuBarRenderer.compactRate(999_000), "999 K")
        XCTAssertEqual(MenuBarRenderer.compactRate(2_500_000), "2.5 M")
        XCTAssertEqual(MenuBarRenderer.compactRate(25_000_000), "25 M")
        XCTAssertEqual(MenuBarRenderer.compactRate(3_000_000_000), "3.0 G")
    }

    // MARK: - Durations

    func testDurationFormatsDaysAndHours() {
        XCTAssertEqual(Format.duration(90_061), "1d 1h")
        XCTAssertEqual(Format.duration(86_400), "1d")
        XCTAssertEqual(Format.duration(2 * 86_400 + 5 * 3_600 + 59 * 60), "2d 5h")
    }

    func testDurationFormatsHoursAndMinutes() {
        XCTAssertEqual(Format.duration(3_600), "1h")
        XCTAssertEqual(Format.duration(3_660), "1h 1m")
        XCTAssertEqual(Format.duration(5_400), "1h 30m")
    }

    func testDurationFormatsMinutesAndSeconds() {
        XCTAssertEqual(Format.duration(120), "2m")
        XCTAssertEqual(Format.duration(119), "1m")
        XCTAssertEqual(Format.duration(45), "45s")
        XCTAssertEqual(Format.duration(0), "0s")
    }

    func testDurationRejectsInvalidValues() {
        XCTAssertEqual(Format.duration(-1), "—")
        XCTAssertEqual(Format.duration(.nan), "—")
        XCTAssertEqual(Format.duration(.infinity), "—")
    }

    func testMinutes() {
        XCTAssertEqual(Format.minutes(0), "0m")
        XCTAssertEqual(Format.minutes(45), "45m")
        XCTAssertEqual(Format.minutes(60), "1h 0m")
        XCTAssertEqual(Format.minutes(90), "1h 30m")
        XCTAssertEqual(Format.minutes(150), "2h 30m")
        XCTAssertEqual(Format.minutes(-1), "—")
    }

    // MARK: - Percentages

    func testPercentValue() {
        XCTAssertEqual(Format.percentValue(0), "0%")
        XCTAssertEqual(Format.percentValue(42), "42%")
        XCTAssertEqual(Format.percentValue(42.6), "43%")
        XCTAssertEqual(Format.percentValue(42.64, decimals: 1), "42.6%")
        XCTAssertEqual(Format.percentValue(100), "100%")
    }

    func testPercentValueTreatsNonFiniteAsZero() {
        XCTAssertEqual(Format.percentValue(.nan), "0%")
        XCTAssertEqual(Format.percentValue(.infinity), "0%")
    }

    func testPercentFromFraction() {
        XCTAssertEqual(Format.percent(0.5), "50%")
        XCTAssertEqual(Format.percent(0.125, decimals: 1), "12.5%")
        XCTAssertEqual(Format.percent(.nan), "0%")
    }

    // MARK: - Temperature

    func testTemperatureInCelsius() {
        XCTAssertEqual(Format.temperature(100, unit: .celsius), "100°C")
        XCTAssertEqual(Format.temperature(36.6, unit: .celsius, decimals: 1), "36.6°C")
        XCTAssertEqual(Format.temperature(0, unit: .celsius), "0°C")
    }

    func testTemperatureInFahrenheit() {
        XCTAssertEqual(Format.temperature(100, unit: .fahrenheit), "212°F")
        XCTAssertEqual(Format.temperature(0, unit: .fahrenheit), "32°F")
        XCTAssertEqual(Format.temperature(37, unit: .fahrenheit, decimals: 1), "98.6°F")
    }

    func testTemperatureUnitTitles() {
        XCTAssertEqual(TemperatureUnit.celsius.title, "Celsius")
        XCTAssertEqual(TemperatureUnit.fahrenheit.title, "Fahrenheit")
        XCTAssertEqual(TemperatureUnit.allCases.count, 2)
    }

    // MARK: - Power

    func testWattsUsesOneDecimalBelowTen() {
        XCTAssertEqual(Format.watts(0), "0.0 W")
        XCTAssertEqual(Format.watts(5.5), "5.5 W")
        XCTAssertEqual(Format.watts(9.99), "10.0 W")
    }

    func testWattsUsesWholeNumbersAtTenAndAbove() {
        XCTAssertEqual(Format.watts(10), "10 W")
        XCTAssertEqual(Format.watts(42.4), "42 W")
        XCTAssertEqual(Format.watts(140), "140 W")
    }

    // MARK: - Misc

    func testRPM() {
        XCTAssertEqual(Format.rpm(1_234.6), "1235 rpm")
        XCTAssertEqual(Format.rpm(0), "0 rpm")
    }

    func testBytesAndMemoryAreNonEmpty() {
        XCTAssertFalse(Format.bytes(Int64(1_000_000_000)).isEmpty)
        XCTAssertFalse(Format.bytes(UInt64(1_000_000_000)).isEmpty)
        XCTAssertFalse(Format.memory(UInt64(1_073_741_824)).isEmpty)
        XCTAssertFalse(Format.memory(Int64(1_073_741_824)).isEmpty)
    }

    func testRelativeDescribesPast() {
        let reference = Date()
        let text = Format.relative(reference.addingTimeInterval(-3600), to: reference)
        XCTAssertFalse(text.isEmpty)
    }
}

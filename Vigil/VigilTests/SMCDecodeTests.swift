import XCTest
@testable import Vigil

final class SMCDecodeTests: XCTestCase {
    private func floatBytes(_ value: Float) -> [UInt8] {
        withUnsafeBytes(of: value.bitPattern.littleEndian) { Array($0) }
    }

    // MARK: - decode

    func testDecodesLittleEndianFloat() throws {
        let decoded = try XCTUnwrap(SMCProbe.decode(floatBytes(42.5), type: "flt "))
        XCTAssertEqual(decoded, 42.5, accuracy: 0.0001)
        XCTAssertEqual(SMCProbe.decode(floatBytes(0), type: "flt "), 0)
        XCTAssertEqual(SMCProbe.decode(floatBytes(-1.5), type: "flt "), -1.5)
    }

    func testFloatRejectsNonFiniteValues() {
        XCTAssertNil(SMCProbe.decode(floatBytes(.nan), type: "flt "))
        XCTAssertNil(SMCProbe.decode(floatBytes(.infinity), type: "flt "))
    }

    func testDecodesSignedFixedPoint78() {
        XCTAssertEqual(SMCProbe.decode([0x2A, 0x80], type: "sp78"), 42.5)
        XCTAssertEqual(SMCProbe.decode([0x00, 0x00], type: "sp78"), 0)
        // 0xFF80 is -128/256 = -0.5
        XCTAssertEqual(SMCProbe.decode([0xFF, 0x80], type: "sp78"), -0.5)
    }

    func testDecodesOtherSignedFixedPointFormats() {
        XCTAssertEqual(SMCProbe.decode([0x15, 0x40], type: "sp87"), 42.5)   // 0x1540 = 5440 / 128
        XCTAssertEqual(SMCProbe.decode([0x0A, 0xA0], type: "sp96"), 42.5)   // 0x0AA0 = 2720 / 64
        XCTAssertEqual(SMCProbe.decode([0x55, 0x00], type: "sp69"), 42.5)   // 0x5500 = 21760 / 512
    }

    func testDecodesUnsignedFixedPointE2() {
        XCTAssertEqual(SMCProbe.decode([0x0B, 0xB8], type: "fpe2"), 750)
        XCTAssertEqual(SMCProbe.decode([0x00, 0x04], type: "fpe2"), 1)
        XCTAssertEqual(SMCProbe.decode([0x2A, 0x80], type: "fp88"), 42.5)
    }

    func testDecodesUnsignedIntegers() {
        XCTAssertEqual(SMCProbe.decode([7], type: "ui8 "), 7)
        XCTAssertEqual(SMCProbe.decode([255], type: "ui8 "), 255)
        XCTAssertEqual(SMCProbe.decode([1, 0], type: "ui16"), 256)
        XCTAssertEqual(SMCProbe.decode([0, 1], type: "ui16"), 1)
        XCTAssertEqual(SMCProbe.decode([0, 0, 1, 0], type: "ui32"), 256)
    }

    func testDecodesSignedInteger() {
        XCTAssertEqual(SMCProbe.decode([0xFF, 0xFF], type: "si16"), -1)
        XCTAssertEqual(SMCProbe.decode([0x01, 0x00], type: "si16"), 256)
    }

    func testDecodesIOFloat() {
        // 1.0 in 48.16 fixed point: 0x0000_0000_0001_0000
        XCTAssertEqual(SMCProbe.decode([0, 0, 0, 0, 0, 1, 0, 0], type: "ioft"), 1)
        XCTAssertEqual(SMCProbe.decode([0, 0, 0, 0, 0, 0, 0x80, 0], type: "ioft"), 0.5)
    }

    func testUnknownTypeReturnsNil() {
        XCTAssertNil(SMCProbe.decode([1, 2, 3, 4], type: "zzzz"))
        XCTAssertNil(SMCProbe.decode([1, 2, 3, 4], type: ""))
        XCTAssertNil(SMCProbe.decode([1, 2, 3, 4], type: "ch8*"))
    }

    func testTooShortDataReturnsNil() {
        XCTAssertNil(SMCProbe.decode([1, 2], type: "flt "))
        XCTAssertNil(SMCProbe.decode([1], type: "sp78"))
        XCTAssertNil(SMCProbe.decode([1], type: "fpe2"))
        XCTAssertNil(SMCProbe.decode([], type: "ui8 "))
        XCTAssertNil(SMCProbe.decode([1], type: "ui16"))
        XCTAssertNil(SMCProbe.decode([1, 2, 3], type: "ui32"))
        XCTAssertNil(SMCProbe.decode([1, 2, 3, 4, 5, 6, 7], type: "ioft"))
    }

    // MARK: - Key codes

    func testKeyCodeRoundTrips() {
        let code = SMCProbe.code("TC0P")
        XCTAssertEqual(code, 0x5443_3050)
        XCTAssertEqual(SMCProbe.string(from: code), "TC0P")
        for key in ["#KEY", "FNum", "F0Ac", "PSTR", "flt ", "ui8 "] {
            XCTAssertEqual(SMCProbe.string(from: SMCProbe.code(key)), key, "Key \(key) did not round-trip")
        }
    }

    func testShortKeysArePaddedWithZeroBytes() {
        XCTAssertEqual(SMCProbe.code("T"), 0x5400_0000)
        XCTAssertEqual(SMCProbe.code(""), 0)
    }

    func testLongKeysAreTruncatedToFourCharacters() {
        XCTAssertEqual(SMCProbe.code("TC0PXYZ"), SMCProbe.code("TC0P"))
    }

    // MARK: - Grouping

    func testGroupsByPrefix() {
        XCTAssertEqual(SMCProbe.group(for: "Tp09"), .cpu)
        XCTAssertEqual(SMCProbe.group(for: "TC0P"), .cpu)
        XCTAssertEqual(SMCProbe.group(for: "Tg0D"), .gpu)
        XCTAssertEqual(SMCProbe.group(for: "TG0P"), .gpu)
        XCTAssertEqual(SMCProbe.group(for: "TB0T"), .battery)
        XCTAssertEqual(SMCProbe.group(for: "TM0P"), .memory)
        XCTAssertEqual(SMCProbe.group(for: "TH0x"), .storage)
        XCTAssertEqual(SMCProbe.group(for: "TA0P"), .system)
        XCTAssertEqual(SMCProbe.group(for: "F0Ac"), .other)
    }

    func testGroupRejectsKeysThatAreNotFourCharacters() {
        XCTAssertEqual(SMCProbe.group(for: "TC0"), .other)
        XCTAssertEqual(SMCProbe.group(for: "TC0PP"), .other)
        XCTAssertEqual(SMCProbe.group(for: ""), .other)
    }

    func testSensorNames() {
        XCTAssertEqual(SMCProbe.sensorName(for: "TC0P"), "CPU proximity")
        XCTAssertEqual(SMCProbe.sensorName(for: "TC0D"), "CPU die")
        XCTAssertEqual(SMCProbe.sensorName(for: "TC1C"), "CPU core 1")
        XCTAssertEqual(SMCProbe.sensorName(for: "TG0P"), "GPU proximity")
        XCTAssertEqual(SMCProbe.sensorName(for: "TB0T"), "Battery 0T")
        XCTAssertEqual(SMCProbe.sensorName(for: "TA0P"), "Ambient 0P")
        XCTAssertEqual(SMCProbe.sensorName(for: "F0Ac"), "F0Ac")
    }
}

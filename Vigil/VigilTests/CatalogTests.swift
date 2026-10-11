import XCTest
@testable import Vigil

final class CatalogTests: XCTestCase {
    // MARK: - Tweaks

    func testTweakIdentifiersAreUnique() {
        let ids = TweakCatalog.all.map(\.id)
        XCTAssertFalse(ids.isEmpty)
        XCTAssertEqual(ids.count, Set(ids).count, "Duplicate tweak ids: \(duplicates(in: ids))")
    }

    func testEveryTweakHasDomainKeyAndTitle() {
        for tweak in TweakCatalog.all {
            XCTAssertFalse(tweak.domain.isEmpty, "Tweak \(tweak.id) has no domain")
            XCTAssertFalse(tweak.key.isEmpty, "Tweak \(tweak.id) has no key")
            XCTAssertFalse(tweak.title.isEmpty, "Tweak \(tweak.id) has no title")
            XCTAssertFalse(tweak.detail.isEmpty, "Tweak \(tweak.id) has no detail")
        }
    }

    func testEveryChoiceTweakOffersAtLeastTwoOptions() {
        var choiceCount = 0
        for tweak in TweakCatalog.all {
            if case .choice(let options) = tweak.kind {
                choiceCount += 1
                XCTAssertGreaterThanOrEqual(options.count, 2, "Tweak \(tweak.id) needs at least two choices")
                for option in options {
                    XCTAssertFalse(option.label.isEmpty, "Tweak \(tweak.id) has an unlabelled option")
                }
                XCTAssertTrue(options.contains { $0.value.matches(tweak.defaultValue) }, "Tweak \(tweak.id) default is not one of its options")
            }
        }
        XCTAssertGreaterThan(choiceCount, 0)
    }

    func testEveryNumberTweakRangeContainsItsDefault() throws {
        var numberCount = 0
        for tweak in TweakCatalog.all {
            if case .number(let range, let step) = tweak.kind {
                numberCount += 1
                let value = try XCTUnwrap(tweak.defaultValue.doubleValue, "Tweak \(tweak.id) default has no numeric value")
                XCTAssertTrue(range.contains(value), "Tweak \(tweak.id) default \(value) is outside \(range)")
                XCTAssertGreaterThan(step, 0, "Tweak \(tweak.id) has a non-positive step")
            }
        }
        XCTAssertGreaterThan(numberCount, 0)
    }

    func testEveryToggleTweakHasDistinctOnAndOffValues() {
        for tweak in TweakCatalog.all {
            if case .toggle(let on, let off) = tweak.kind {
                XCTAssertNotEqual(on, off, "Tweak \(tweak.id) toggles to the same value")
                XCTAssertTrue(on.matches(tweak.defaultValue) || off.matches(tweak.defaultValue), "Tweak \(tweak.id) default is neither its on nor off value")
            }
        }
    }

    func testEveryTweakCategoryIsUsed() {
        let used = Set(TweakCatalog.all.map(\.category))
        for category in Tweak.Category.allCases {
            XCTAssertTrue(used.contains(category), "No tweaks in category \(category.rawValue)")
        }
    }

    func testTweakValueFromAnyMapsFoundationTypes() {
        XCTAssertEqual(TweakValue(any: NSNumber(value: true)), .bool(true))
        XCTAssertEqual(TweakValue(any: NSNumber(value: false)), .bool(false))
        XCTAssertEqual(TweakValue(any: NSNumber(value: 5)), .int(5))
        XCTAssertEqual(TweakValue(any: NSNumber(value: 0.5)), .double(0.5))
        XCTAssertEqual(TweakValue(any: NSNumber(value: 2.0)), .double(2.0))
        XCTAssertEqual(TweakValue(any: "x"), .string("x"))
        XCTAssertNil(TweakValue(any: nil))
        XCTAssertNil(TweakValue(any: [1, 2, 3]))
    }

    func testTweakValueMatchesLoosely() {
        XCTAssertTrue(TweakValue.int(1).matches(.double(1.0)))
        XCTAssertTrue(TweakValue.double(1.0).matches(.int(1)))
        XCTAssertTrue(TweakValue.bool(true).matches(.int(1)))
        XCTAssertTrue(TweakValue.int(1).matches(.bool(true)))
        XCTAssertTrue(TweakValue.bool(false).matches(.int(0)))
        XCTAssertTrue(TweakValue.string("3").matches(.int(3)))
        XCTAssertTrue(TweakValue.string("0.5").matches(.double(0.5)))
        XCTAssertTrue(TweakValue.string("true").matches(.bool(true)))
        XCTAssertTrue(TweakValue.string("abc").matches(.string("abc")))
        XCTAssertFalse(TweakValue.int(1).matches(.int(2)))
        XCTAssertFalse(TweakValue.int(1).matches(.double(1.5)))
        XCTAssertFalse(TweakValue.bool(true).matches(.int(2)))
        XCTAssertFalse(TweakValue.string("abc").matches(.int(1)))
    }

    func testTweakValueDescriptionAndDoubleValue() {
        XCTAssertEqual(TweakValue.bool(true).description, "On")
        XCTAssertEqual(TweakValue.bool(false).description, "Off")
        XCTAssertEqual(TweakValue.int(48).description, "48")
        XCTAssertEqual(TweakValue.double(2.0).description, "2")
        XCTAssertEqual(TweakValue.double(0.25).description, "0.25")
        XCTAssertEqual(TweakValue.string("genie").description, "genie")
        XCTAssertEqual(TweakValue.int(3).doubleValue, 3)
        XCTAssertEqual(TweakValue.bool(true).doubleValue, 1)
        XCTAssertEqual(TweakValue.string("1.5").doubleValue, 1.5)
        XCTAssertNil(TweakValue.string("abc").doubleValue)
    }

    // MARK: - Cleanup

    func testCleanupIdentifiersAreUnique() {
        let ids = CleanupCatalog.all.map(\.id)
        XCTAssertFalse(ids.isEmpty)
        XCTAssertEqual(ids.count, Set(ids).count, "Duplicate cleanup ids: \(duplicates(in: ids))")
    }

    func testCleanupGroupsAreKnown() {
        let known = Set(CleanupCatalog.groups)
        for category in CleanupCatalog.all {
            XCTAssertTrue(known.contains(category.group), "Cleanup \(category.id) uses unknown group \(category.group)")
        }
        for group in CleanupCatalog.groups {
            XCTAssertTrue(CleanupCatalog.all.contains { $0.group == group }, "Group \(group) has no categories")
        }
    }

    func testEveryNonCommandCleanupCategoryHasPaths() {
        for category in CleanupCatalog.all {
            if case .command = category.method { continue }
            XCTAssertFalse(category.paths.isEmpty, "Cleanup \(category.id) has no paths")
            for path in category.paths {
                XCTAssertFalse(path.isEmpty, "Cleanup \(category.id) has an empty path")
            }
        }
    }

    func testTrashCategoriesRequireReview() {
        var trashCount = 0
        for category in CleanupCatalog.all {
            if case .trash = category.method {
                trashCount += 1
                XCTAssertGreaterThanOrEqual(category.risk, .review, "Cleanup \(category.id) moves files to the Trash but is marked safe")
            }
        }
        XCTAssertGreaterThan(trashCount, 0)
    }

    func testEveryCleanupCategoryHasTitleDetailAndSymbol() {
        for category in CleanupCatalog.all {
            XCTAssertFalse(category.title.isEmpty, "Cleanup \(category.id) has no title")
            XCTAssertFalse(category.detail.isEmpty, "Cleanup \(category.id) has no detail")
            XCTAssertFalse(category.symbol.isEmpty, "Cleanup \(category.id) has no symbol")
        }
    }

    func testCleanupRiskOrdering() {
        XCTAssertLessThan(CleanupCategory.Risk.safe, .review)
        XCTAssertLessThan(CleanupCategory.Risk.review, .careful)
        XCTAssertEqual(CleanupCategory.Risk.safe.title, "Safe")
    }

    // MARK: - Toolbox

    @MainActor
    func testToolboxActionIdentifiersAreUnique() {
        let ids = Toolbox.actions.map(\.id)
        XCTAssertFalse(ids.isEmpty)
        XCTAssertEqual(ids.count, Set(ids).count, "Duplicate toolbox ids: \(duplicates(in: ids))")
    }

    @MainActor
    func testAdminActionsExplainThemselves() {
        var adminCount = 0
        for action in Toolbox.actions {
            XCTAssertFalse(action.title.isEmpty, "Toolbox action \(action.id) has no title")
            XCTAssertFalse(action.symbol.isEmpty, "Toolbox action \(action.id) has no symbol")
            if action.needsAdmin {
                adminCount += 1
                XCTAssertFalse(action.detail.isEmpty, "Admin action \(action.id) must explain what it does")
            }
        }
        XCTAssertGreaterThan(adminCount, 0)
    }

    @MainActor
    func testToolboxLookupById() throws {
        let keepAwake = try XCTUnwrap(Toolbox.action(id: "keepAwake"))
        XCTAssertEqual(keepAwake.title, "Keep Awake")
        XCTAssertFalse(keepAwake.needsAdmin)
        XCTAssertFalse(keepAwake.isDestructive)
        XCTAssertNil(Toolbox.action(id: "doesNotExist"))
        // Actions referenced by the cleanup catalog's commands must exist.
        XCTAssertNotNil(Toolbox.action(id: "emptyTrash"))
        XCTAssertNotNil(Toolbox.action(id: "thinSnapshots"))
    }

    @MainActor
    func testEveryToolboxCategoryIsUsed() {
        let used = Set(Toolbox.actions.map(\.category))
        for category in ToolboxAction.Category.allCases {
            XCTAssertTrue(used.contains(category), "No toolbox actions in category \(category.rawValue)")
        }
    }

    // MARK: - Helpers

    private func duplicates(in ids: [String]) -> [String] {
        var seen: Set<String> = []
        var result: [String] = []
        for id in ids where !seen.insert(id).inserted {
            result.append(id)
        }
        return result
    }
}

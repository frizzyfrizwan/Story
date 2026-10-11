import Foundation
import AppKit

struct ShellResult {
    let status: Int32
    let output: String
    let error: String
    var succeeded: Bool { status == 0 }
}

enum ShellError: LocalizedError {
    case launchFailed(String)
    case failed(command: String, status: Int32, stderr: String)
    case privilegedCancelled
    case privilegedFailed(String)

    var errorDescription: String? {
        switch self {
        case .launchFailed(let path): return "Could not launch \(path)."
        case .failed(let command, let status, let stderr):
            let detail = stderr.trimmingCharacters(in: .whitespacesAndNewlines)
            return detail.isEmpty ? "\(command) exited with status \(status)." : detail
        case .privilegedCancelled: return "Cancelled."
        case .privilegedFailed(let message): return message
        }
    }
}

/// Reference box so a background reader can fill a buffer without capturing a mutable local.
final class DataBox: @unchecked Sendable {
    var data = Data()
}

/// Runs command-line tools. All calls are synchronous; call from a background task.
enum Shell {
    @discardableResult
    static func run(_ executable: String, _ arguments: [String] = [], timeout: TimeInterval = 30) -> ShellResult {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        let stdout = Pipe()
        let stderr = Pipe()
        process.standardOutput = stdout
        process.standardError = stderr
        do {
            try process.run()
        } catch {
            return ShellResult(status: -1, output: "", error: error.localizedDescription)
        }
        let watchdog = DispatchWorkItem { if process.isRunning { process.terminate() } }
        DispatchQueue.global(qos: .utility).asyncAfter(deadline: .now() + timeout, execute: watchdog)
        let errBox = DataBox()
        let group = DispatchGroup()
        group.enter()
        DispatchQueue.global(qos: .utility).async {
            errBox.data = stderr.fileHandleForReading.readDataToEndOfFile()
            group.leave()
        }
        let outData = stdout.fileHandleForReading.readDataToEndOfFile()
        group.wait()
        process.waitUntilExit()
        watchdog.cancel()
        return ShellResult(status: process.terminationStatus,
                           output: String(decoding: outData, as: UTF8.self),
                           error: String(decoding: errBox.data, as: UTF8.self))
    }

    /// Runs a shell snippet through `/bin/zsh -c`.
    @discardableResult
    static func zsh(_ command: String, timeout: TimeInterval = 30) -> ShellResult {
        run("/bin/zsh", ["-lc", command], timeout: timeout)
    }

    @discardableResult
    static func runChecked(_ executable: String, _ arguments: [String] = [], timeout: TimeInterval = 30) throws -> String {
        let result = run(executable, arguments, timeout: timeout)
        guard result.succeeded else {
            throw ShellError.failed(command: ([executable] + arguments).joined(separator: " "), status: result.status, stderr: result.error)
        }
        return result.output
    }

    /// Runs a shell snippet with administrator privileges through the standard macOS password prompt.
    /// Must be called on the main thread (NSAppleScript is not thread-safe).
    @MainActor
    @discardableResult
    static func runPrivileged(_ command: String) throws -> String {
        let escaped = command
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
        let source = "do shell script \"\(escaped)\" with administrator privileges"
        guard let script = NSAppleScript(source: source) else { throw ShellError.privilegedFailed("Could not build the privileged command.") }
        var errorInfo: NSDictionary?
        let descriptor = script.executeAndReturnError(&errorInfo)
        if let errorInfo {
            let number = errorInfo[NSAppleScript.errorNumber] as? Int ?? 0
            if number == -128 { throw ShellError.privilegedCancelled }
            let message = errorInfo[NSAppleScript.errorMessage] as? String ?? "The command failed."
            throw ShellError.privilegedFailed(message)
        }
        return descriptor.stringValue ?? ""
    }

    /// Runs an AppleScript snippet (used for Finder / System Events automation).
    @MainActor
    @discardableResult
    static func appleScript(_ source: String) throws -> String {
        guard let script = NSAppleScript(source: source) else { throw ShellError.privilegedFailed("Could not build the script.") }
        var errorInfo: NSDictionary?
        let descriptor = script.executeAndReturnError(&errorInfo)
        if let errorInfo {
            let message = errorInfo[NSAppleScript.errorMessage] as? String ?? "The script failed."
            throw ShellError.privilegedFailed(message)
        }
        return descriptor.stringValue ?? ""
    }

    static func killAll(_ processName: String) {
        run("/usr/bin/killall", [processName])
    }
}

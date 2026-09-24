// Fetches a link the way Messages does (Apple's LinkPresentation) and prints what it found.
//   swift scripts/check-preview.swift https://example.com
import Foundation
import LinkPresentation

let url = URL(string: CommandLine.arguments.dropFirst().first ?? "https://ai-election-errors.vercel.app/")!
let provider = LPMetadataProvider()
provider.timeout = 30
var finished = false
provider.startFetchingMetadata(for: url) { meta, error in
  defer { finished = true }
  if let error = error { print("ERROR:", error.localizedDescription) }
  if let m = meta {
    print("title:", m.title ?? "(none)")
    print("url:", m.url?.absoluteString ?? "(none)")
    print("image:", m.imageProvider != nil ? "yes" : "NO")
    print("icon:", m.iconProvider != nil ? "yes" : "NO")
  }
}
let deadline = Date().addingTimeInterval(40)
while !finished && Date() < deadline { RunLoop.main.run(until: Date().addingTimeInterval(0.2)) }
if !finished { print("TIMEOUT: no answer in 40s") }

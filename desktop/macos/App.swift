import Cocoa
import WebKit

@main
final class App: NSObject, NSApplicationDelegate, WKNavigationDelegate {
 var window: NSWindow!
 var backend: Process?
 var origin = ""
 static func main() {
  let app = NSApplication.shared
  let delegate = App()
  app.delegate = delegate
  app.setActivationPolicy(.regular)
  app.run()
 }
 func applicationDidFinishLaunching(_ notification: Notification) {
  let menu = NSMenu()
  let item = NSMenuItem()
  let submenu = NSMenu()
  submenu.addItem(withTitle: "Quit FDUDash", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
  item.submenu = submenu
  menu.addItem(item)
  let editItem = NSMenuItem()
  let editMenu = NSMenu(title: "Edit")
  for (title, action, key) in [("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
   editMenu.addItem(withTitle: title, action: NSSelectorFromString(action), keyEquivalent: key)
  }
  editItem.submenu = editMenu
  menu.addItem(editItem)
  NSApp.mainMenu = menu
  window = NSWindow(contentRect: NSRect(x: 0,y: 0,width: 1200,height: 850),styleMask: [.titled,.closable,.miniaturizable,.resizable],backing: .buffered,defer: false)
  window.title = "FDUDash"
  window.center()
  let web = WKWebView(frame: window.contentView!.bounds)
  web.autoresizingMask = [.width,.height]
  web.navigationDelegate = self
  window.contentView!.addSubview(web)
  window.makeKeyAndOrderFront(nil)
  NSApp.activate(ignoringOtherApps: true)
  let base = Bundle.main.resourceURL!.appendingPathComponent("backend")
  let process = Process()
  process.executableURL = base.appendingPathComponent("runtime/node")
  process.arguments = ["server.mjs"]
  process.currentDirectoryURL = base
  var env = ProcessInfo.processInfo.environment
  env["PORT"] = "0"
  env["FDUDASH_DESKTOP"] = "1"
  env["FDUDASH_MAC_VAULT"] = Bundle.main.executableURL!.deletingLastPathComponent().appendingPathComponent("vault").path
  process.environment = env
  let pipe = Pipe()
  process.standardOutput = pipe
  process.standardError = FileHandle.nullDevice
  backend = process
  do { try process.run() } catch { fail("Could not start FDUDash."); return }
  DispatchQueue.global().async {
   let data = pipe.fileHandleForReading.availableData
   let text = String(data: data,encoding: .utf8) ?? ""
   guard let range = text.range(of: "http://127.0.0.1:[0-9]+",options: .regularExpression) else {
    DispatchQueue.main.async { self.fail("Could not read the local service address.") }; return
   }
   let address = String(text[range])
   DispatchQueue.main.async { self.origin = address; web.load(URLRequest(url: URL(string: address)!)) }
  }
 }
 func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
  webView.evaluateJavaScript("document.querySelector('#nav-dashboard') !== null") { result, error in
   if result as? Bool == true {
    FileHandle.standardOutput.write(Data("FDUDash interface ready\n".utf8))
   }
  }
 }
 func fail(_ message: String) {
  let alert = NSAlert()
  alert.messageText = message
  alert.runModal()
  NSApp.terminate(nil)
 }
 func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
  guard let url = action.request.url else { decisionHandler(.cancel); return }
  if url.absoluteString.hasPrefix(origin + "/") { decisionHandler(.allow) }
  else { if ["https","http"].contains(url.scheme ?? "") { NSWorkspace.shared.open(url) }; decisionHandler(.cancel) }
 }
 func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
 func applicationWillTerminate(_ notification: Notification) { backend?.terminate() }
}

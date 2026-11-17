import Capacitor
import UIKit
import WebKit

@objc(SeclifeBoletaPdfPlugin)
public class SeclifeBoletaPdfPlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate {
    public let identifier = "SeclifeBoletaPdfPlugin"
    public let jsName = "SeclifeBoletaPdf"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "create", returnType: CAPPluginReturnPromise)]
    private var pending: CAPPluginCall?
    private var web: WKWebView?
    @objc func create(_ call: CAPPluginCall) {
        guard let html = call.getString("html"), html.count < 4000000 else { call.reject("Boleta invalida."); return }
        DispatchQueue.main.async {
            guard self.pending == nil else { call.reject("Ya se esta generando una boleta."); return }
            self.pending = call
            let config = WKWebViewConfiguration()
            config.websiteDataStore = .nonPersistent()
            config.defaultWebpagePreferences.allowsContentJavaScript = false
            let view = WKWebView(frame: CGRect(x: 0,y: 0,width: 842,height: 595),configuration: config)
            view.navigationDelegate = self
            self.web = view
            view.loadHTMLString(html,baseURL: nil)
            DispatchQueue.main.asyncAfter(deadline: .now()+60) { [weak self, weak call] in
                guard let self, let call, self.pending === call else { return }
                call.reject("La generacion excedio el tiempo disponible."); self.clear()
            }
        }
    }
    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard let call = pending else { return }
        let renderer = UIPrintPageRenderer()
        renderer.addPrintFormatter(webView.viewPrintFormatter(),startingAtPageAt: 0)
        let paper = CGRect(x: 0,y: 0,width: 842,height: 595)
        renderer.setValue(NSValue(cgRect: paper),forKey: "paperRect")
        renderer.setValue(NSValue(cgRect: paper.insetBy(dx: 28,dy: 28)),forKey: "printableRect")
        let data = NSMutableData()
        UIGraphicsBeginPDFContextToData(data,paper,nil)
        renderer.prepare(forDrawingPages: NSRange(location: 0,length: renderer.numberOfPages))
        for page in 0..<renderer.numberOfPages { UIGraphicsBeginPDFPage(); renderer.drawPage(at: page,in: UIGraphicsGetPDFContextBounds()) }
        UIGraphicsEndPDFContext()
        do {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("boleta-\(UUID().uuidString).pdf")
            try data.write(to: url,options: .atomic)
            call.resolve(["uri":url.absoluteString])
        } catch { call.reject("No fue posible escribir el PDF.") }
        clear()
    }
    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { pending?.reject("No fue posible generar la boleta."); clear() }
    private func clear() { web?.stopLoading();web?.navigationDelegate=nil;web=nil;pending=nil }
}

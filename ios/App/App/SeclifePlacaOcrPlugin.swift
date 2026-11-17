import Capacitor
import Vision
import ImageIO

@objc(SeclifePlacaOcrPlugin)
public class SeclifePlacaOcrPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SeclifePlacaOcrPlugin"
    public let jsName = "SeclifePlacaOcr"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "recognize", returnType: CAPPluginReturnPromise)]

    @objc func recognize(_ call: CAPPluginCall) {
        guard let encoded = call.getString("base64"), encoded.count <= 8000000,
              let data = Data(base64Encoded: encoded) else {
            call.reject("Imagen no valida."); return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            autoreleasepool {
                guard let source = CGImageSourceCreateWithData(data as CFData, nil),
                      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
                      let width = properties[kCGImagePropertyPixelWidth] as? Int,
                      let height = properties[kCGImagePropertyPixelHeight] as? Int,
                      width > 0, height > 0, width <= 6000, height <= 6000, width * height <= 6000000 else {
                    call.reject("Imagen demasiado grande o no valida."); return
                }
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = false
                do {
                    try VNImageRequestHandler(data: data, options: [:]).perform([request])
                    let lines = (request.results ?? []).prefix(100).compactMap { $0.topCandidates(1).first?.string }
                    call.resolve(["lines": lines])
                } catch {
                    call.reject("No fue posible reconocer la placa.")
                }
            }
        }
    }
}

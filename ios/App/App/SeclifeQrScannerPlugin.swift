import AVFoundation
import Capacitor
import UIKit

@objc(SeclifeQrScannerPlugin)
public final class SeclifeQrScannerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SeclifeQrScannerPlugin"
    public let jsName = "SeclifeQrScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise)
    ]

    private var scannerViewController: SeclifeQrScannerViewController?

    @objc func scan(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.openScanner(call)
        }
    }

    private func openScanner(_ call: CAPPluginCall) {
        guard scannerViewController == nil else {
            call.reject("Ya hay una lectura QR en curso.", "SCAN_IN_PROGRESS")
            return
        }

        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            presentScanner(call)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted {
                        self?.presentScanner(call)
                    } else {
                        call.reject("No se autorizo el acceso a la camara.", "CAMERA_ACCESS_DENIED")
                    }
                }
            }
        default:
            call.reject("No se autorizo el acceso a la camara.", "CAMERA_ACCESS_DENIED")
        }
    }

    private func presentScanner(_ call: CAPPluginCall) {
        guard let presenter = bridge?.viewController else {
            call.reject("No fue posible abrir el lector QR.", "VIEW_CONTROLLER_UNAVAILABLE")
            return
        }

        let instructions = call.getString("scanInstructions") ?? "Alinea el codigo QR dentro del recuadro."
        let scanner = SeclifeQrScannerViewController(instructions: instructions)
        scanner.modalPresentationStyle = .fullScreen
        scanner.onResult = { [weak self] result in
            self?.scannerViewController = nil
            if let result {
                call.resolve(["ScanResult": result, "format": 0])
            } else {
                call.reject("Lectura QR cancelada.", "SCAN_CANCELLED")
            }
        }
        scannerViewController = scanner
        presenter.present(scanner, animated: true)
    }
}

private final class SeclifeQrScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onResult: ((String?) -> Void)?

    private let instructions: String
    private let captureSession = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "mx.com.seclife.qr.capture")
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var finished = false

    init(instructions: String) {
        self.instructions = instructions
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureInterface()
        configureCaptureSession()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        sessionQueue.async { [weak self] in
            guard let self, !self.captureSession.isRunning else { return }
            self.captureSession.startRunning()
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    private func configureInterface() {
        let instructionsLabel = UILabel()
        instructionsLabel.translatesAutoresizingMaskIntoConstraints = false
        instructionsLabel.text = instructions
        instructionsLabel.textColor = .white
        instructionsLabel.textAlignment = .center
        instructionsLabel.numberOfLines = 0
        instructionsLabel.backgroundColor = UIColor.black.withAlphaComponent(0.65)
        instructionsLabel.layer.cornerRadius = 10
        instructionsLabel.layer.masksToBounds = true

        let cancelButton = UIButton(type: .system)
        cancelButton.translatesAutoresizingMaskIntoConstraints = false
        cancelButton.setTitle("Cancelar", for: .normal)
        cancelButton.setTitleColor(.white, for: .normal)
        cancelButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        cancelButton.backgroundColor = UIColor.black.withAlphaComponent(0.65)
        cancelButton.layer.cornerRadius = 10
        cancelButton.addTarget(self, action: #selector(cancelScan), for: .touchUpInside)

        view.addSubview(instructionsLabel)
        view.addSubview(cancelButton)

        NSLayoutConstraint.activate([
            instructionsLabel.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            instructionsLabel.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            instructionsLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            instructionsLabel.heightAnchor.constraint(greaterThanOrEqualToConstant: 54),
            cancelButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            cancelButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
            cancelButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 140),
            cancelButton.heightAnchor.constraint(equalToConstant: 50)
        ])
    }

    private func configureCaptureSession() {
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
              let input = try? AVCaptureDeviceInput(device: camera),
              captureSession.canAddInput(input) else {
            finish(with: nil)
            return
        }

        captureSession.beginConfiguration()
        captureSession.addInput(input)

        let output = AVCaptureMetadataOutput()
        guard captureSession.canAddOutput(output) else {
            captureSession.commitConfiguration()
            finish(with: nil)
            return
        }

        captureSession.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]
        captureSession.commitConfiguration()

        let layer = AVCaptureVideoPreviewLayer(session: captureSession)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.insertSublayer(layer, at: 0)
        previewLayer = layer
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard let code = metadataObjects
            .compactMap({ $0 as? AVMetadataMachineReadableCodeObject })
            .first(where: { $0.type == .qr })?
            .stringValue,
              !code.isEmpty else { return }

        finish(with: code)
    }

    @objc private func cancelScan() {
        finish(with: nil)
    }

    private func finish(with result: String?) {
        guard !finished else { return }
        finished = true
        sessionQueue.async { [weak self] in
            self?.captureSession.stopRunning()
        }
        dismiss(animated: true) { [weak self] in
            self?.onResult?(result)
            self?.onResult = nil
        }
    }
}

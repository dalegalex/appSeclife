# Preparacion iOS para publicacion

## Identidad del producto

- Nombre visible: `Seclife School`
- Bundle ID: `mx.com.seclife.schoolmaster`
- Team ID: `HQ4BYF4C25`
- Version: `4.0.0`
- Build: `1`
- iOS minimo: `15.0`

## Bloqueos antes de compilar en Mac

1. Crear o localizar en Google Cloud un OAuth Client ID de tipo iOS para
   `mx.com.seclife.schoolmaster`.
2. Incorporar ese valor como `iOSClientId` en la inicializacion de
   `@capgo/capacitor-social-login`. No usar el cliente Web como sustituto.
3. Crear en Xcode un certificado Apple Distribution vigente con el Team
   `HQ4BYF4C25` y confirmar firma automatica del target `App`.
4. Confirmar que el App ID conserva la capacidad NFC Tag Reading. Push
   Notifications se deja fuera de esta primera actualizacion.

## Flujo en la Mac

```bash
npm ci
npm run build
npx cap sync ios
npx cap open ios
```

Despues de `cap sync ios`, confirmar que `ios/App/CapApp-SPM/Package.swift`
mantiene rutas con `/`. En Xcode ejecutar primero sobre un iPhone fisico:

1. Login por correo personal.
2. Login con Google.
3. Lectura QR y NFC.
4. Consulta de cuenta y solicitud de eliminacion.
5. Cierre de sesion y nuevo ingreso.

Solo despues: `Product > Archive`, validacion y carga a TestFlight.

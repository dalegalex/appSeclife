# Preparacion iOS para publicacion

## Identidad del producto

- Nombre visible: `Seclife School`
- Bundle ID: `mx.com.seclife.schoolmaster`
- Team ID: `HQ4BYF4C25`
- Version candidata: `4.1.1`
- Build candidato: `1` (confirmar disponibilidad en App Store Connect)
- iOS minimo: `15.0`

## Estado confirmado en Windows

- La aplicacion web compila con Angular 21.
- La version de consentimiento es `2026-08-13`.
- El paquete incluye el modulo web de Notificaciones.
- Por decision de publicacion, Conductor y GPS quedan disponibles solo en Android en esta version.
- No existe `GoogleService-Info.plist` en el checkout de Windows.
- `App.entitlements` conserva NFC, pero aun no incluye Push Notifications.
- `Info.plist` no debe declarar uso de ubicacion en esta version.
- `AppDelegate.swift` aun no integra el registro requerido por Push Notifications.
- El GPS continuo `SeclifeBackgroundLocation` solo tiene implementacion nativa Android y queda excluido en iOS.

## Bloqueos iOS antes de compilar

1. Descargar `GoogleService-Info.plist` de Firebase para el Bundle ID exacto y agregarlo al target `App`. No usar ni copiar el JSON de cuenta de servicio del backend.
2. Implementar Firebase Messaging nativo para obtener un token FCM en iOS. El token APNs que devuelve por si solo `@capacitor/push-notifications` no debe registrarse como si fuera token FCM.
3. Agregar la capacidad `Push Notifications` y validar el entorno APNs Sandbox/Production con la clave ya registrada en Firebase.
4. Incorporar en `AppDelegate.swift` los callbacks exigidos por el plugin de notificaciones y validar registro, recepcion en primer plano, segundo plano y apertura desde una notificacion.
5. Confirmar que el menu, la tarjeta y la ruta directa de Conductor permanezcan deshabilitados en iOS.
6. No agregar descripciones de ubicacion ni `Background Modes > Location updates` en esta version.
7. Habilitar Background Modes > Remote notifications solo si se enviaran mensajes silenciosos o de datos que deban despertar la app.
8. Confirmar certificado Apple Distribution, firma automatica, perfil y capacidades del App ID.

## Flujo en la Mac

```bash
npm ci
npm run build
npx cap sync ios
npx cap open ios
```

Despues de `cap sync ios`, confirmar que `ios/App/CapApp-SPM/Package.swift` mantiene rutas con `/` y que el plugin de notificaciones aparece entre las dependencias.

## Pruebas obligatorias en dispositivo iOS fisico

1. Login por correo personal y por Google.
2. Aviso de privacidad `2026-08-13` en primer ingreso.
3. Registro del dispositivo con token FCM valido y plataforma `ios`.
4. Recepcion Push con app abierta, en segundo plano y cerrada.
5. Apertura de la ruta correcta desde la notificacion.
6. Lectura QR, camara y galeria en el iPad disponible; NFC se valida solo en un dispositivo iOS compatible y no bloquea esta entrega.
7. Consulta y eliminacion de cuenta.
8. Confirmar que Conductor/GPS no aparezcan ni sean navegables en iOS, incluso con un perfil de conductor.

## Alcance diferido

Conductor y GPS en segundo plano se incorporaran en una actualizacion posterior para iOS, despues de implementar Core Location nativo y completar pruebas en un iPhone fisico. No se declarara recopilacion de ubicacion para la version iOS `4.1.1`. El iPad fisico disponible se utilizara para validar el resto de la entrega.


Solo despues: `Product > Archive`, validacion, carga a TestFlight y prueba del mismo build que se enviara a revision.
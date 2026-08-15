# Publicacion appSeclife 4.1.1

Fecha de preparacion: 14 de agosto de 2026.

## Identidad candidata

- Nombre: `Seclife School`
- Paquete / Bundle ID: `mx.com.seclife.schoolmaster`
- Version: `4.1.1`
- Android versionCode: `20101`
- iOS build: `1` candidato (confirmar disponibilidad en App Store Connect)
- Aviso de privacidad y consentimiento: `2026-08-13`

## Android

Estado tecnico: AAB generado, firmado, publicado en prueba interna y validado en dispositivo fisico.

- Artefacto: `ARTEFACTOS PUBLICACION/Android/Seclife-School-4.1.1-20101.aab`
- Tamano aproximado: 23.54 MB
- SHA-256 del archivo: `2A556FBB0FBF9C7A2D38C930066A4672314280376D51BE2DDD8DAC8085331C4F`
- Certificado de subida: coincide con la huella registrada en Google Play.
- minSdk: 26
- targetSdk / compileSdk: 36

## Estado antes de produccion

1. Aviso de privacidad `2026-08-13` publicado y accesible.
2. `versionCode 20101` disponible para testers internos.
3. GPS Conductor y notificacion persistente validados en Android fisico.
4. Declaraciones de ubicacion en segundo plano y servicio en primer plano enviadas a revision de Google.
5. iOS se prepara conforme a `docs/ios-publicacion.md`; Conductor/GPS quedan excluidos de iOS en esta version.

## Declaracion Google Play: ubicacion en segundo plano

Declarar una sola funcion principal:

`Seguimiento en tiempo real del recorrido escolar iniciado expresamente por el conductor y visible para las familias autorizadas, incluso cuando la pantalla del dispositivo del conductor esta apagada o la aplicacion queda en segundo plano.`

La evidencia debe incluir:

- Inicio de sesion con perfil Conductor.
- Aviso destacado antes del permiso del sistema.
- Inicio voluntario de un recorrido.
- Solicitud de ubicacion `Permitir todo el tiempo`.
- Notificacion persistente del servicio GPS.
- Aplicacion en segundo plano o pantalla apagada.
- Movimiento reflejado en el mapa familiar o lecturas recibidas por el servicio.
- Fin de recorrido y detencion del GPS.

Google solicita formulario de permisos, video breve, aviso destacado dentro de la app y politica de privacidad accesible tanto en la app como en la ficha.

## Actualizacion de Seguridad de los datos

Revisar al menos:

- Ubicacion precisa: recopilada para funcionalidad de transporte; no para publicidad.
- Identificadores de dispositivo o instalacion: usados para registro y administracion de notificaciones.
- Datos personales, fotografias y contenido generado por el usuario: conservar las declaraciones ya aplicables y validar terceros SDK.
- Cifrado en transito, eliminacion de cuenta y canal de solicitud.

## Pruebas Android obligatorias sobre el AAB de Play

1. Actualizacion sobre la version productiva sin perdida de sesion o datos locales.
2. Login por Google y correo personal.
3. Aviso de privacidad nuevo para un usuario que habia aceptado la version anterior.
4. Permiso Push: aceptar, rechazar y habilitar despues desde Ajustes.
5. Push en primer plano, segundo plano y app cerrada; apertura de ruta y marcado de lectura.
6. GPS Conductor en primer plano, segundo plano y pantalla apagada; inicio y fin de recorrido.
7. QR, NFC, camara, galeria y credencial digital por los tres perfiles autorizables.
8. Expediente Documental y permisos dinamicos de menu.
9. Solicitud de eliminacion de cuenta.
10. Codigo demo de revision liberado y backend disponible durante toda la revision.

## Notas de version propuestas

`Incorporamos seguimiento de recorridos escolares para perfiles autorizados, notificaciones escolares mediante Firebase Cloud Messaging, historial y preferencias de avisos, mejoras en credencial digital, permisos de acceso y expediente documental. Tambien incluimos ajustes de estabilidad, privacidad y seguridad.`

## Pendientes no bloqueantes del codigo

- Migrar en una iteracion controlada las plantillas modificadas que aun usan `*ngIf`, `*ngFor` o `ngModel`; hacerlo dentro de esta ventana de publicacion aumentaria el riesgo de regresion.
- Reducir cinco hojas SCSS que exceden el presupuesto de 4 kB.
- Sustituir u optimizar la dependencia CommonJS `qrcode`.
- Automatizar antes del 30 de noviembre de 2026 las politicas de conservacion comprometidas para GPS, notificaciones y tokens inactivos.
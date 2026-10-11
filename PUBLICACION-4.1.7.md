# appSeclife 4.1.7 - Android y Codi Mac

## Identificacion

- Fecha de preparacion: 2026-10-11.
- Rama: `codex/appseclife-4.1.7-publicacion`, repositorio `dalegalex/appSeclife`.
- Android corregido: versionName 4.1.7, versionCode 20108, target SDK 36.
- iOS: MARKETING_VERSION 4.1.7, build inicial 1; comprobar que no este utilizado en App Store Connect.
- El usuario confirma SQL y GpsApi publicados y ultima version iOS 4.1.6. Esta confirmacion no sustituye pruebas de integracion.

## Cambios integrados

- Lectura asistida de brigadas y ajustes de avisos de asistencia.
- Validacion de administracion de Red Familiar por estado de TAG, conservando la foto propia.
- Expediente Documental: soporte adjunto a representacion y restauracion.
- Ficha del alumno: consulta y aplicacion de domicilio familiar.
- Orden de alumnos en consulta de rutas de transporte.
- Categorias dinamicas de videotutoriales, con respaldo de categorias conocidas cuando falla el catalogo.

## Entrega a Codi Mac

Revisar `git status` antes de cambiar de rama. Conservar cambios locales y ajustes nativos de iOS; no usar reset --hard. Comparar los commits locales de iOS antes de integrar esta rama.

```bash
git fetch origin
git switch --track origin/codex/appseclife-4.1.7-publicacion
npm ci
npm run build -- --configuration production
npx cap sync ios
npx cap open ios
```

Si la rama ya existe, usar `git switch codex/appseclife-4.1.7-publicacion` y `git pull --ff-only`.
Comprobar `git rev-parse HEAD` con el commit comunicado. Mantener Bundle ID `mx.com.seclife.schoolmaster`, equipo de firma, Push, NFC y Keychain. No activar GPS de conductor en iOS: permanece exclusivo de Android.
Archivar y subir a TestFlight; validar fisicamente antes de enviar a revision.

## Pruebas de aceptacion pendientes

- Actualizar sobre 4.1.6 sin perder sesion; login Google/correo, biometria y credencial del dispositivo.
- Bloqueo local a los 10 minutos en segundo plano, cancelacion/reintento y renovacion de JWT.
- Red Familiar: Master/delegado con TAG valida; TAG bloqueada/sin TAG impide administrar, no consultar ni editar foto propia.
- Brigadas: entrega autorizada y restricciones por ciclo y organizacion.
- Expediente Documental: adjuntos, restauracion y limites de representacion con datos de prueba.
- Domicilio familiar: candidatos y aplicacion exclusivamente al alumno autorizado.
- Videotutoriales: categorias publicadas y aislamiento por organizacion/perfil.
- QR, NFC en dispositivo compatible, camara, galeria, push/badge y transporte; GPS Android al iniciar y detener recorrido.
- Fallo de red: mensaje entendible sin URL; no bloqueo persistente por fallo al consultar politica de version.

## Validacion local

- Angular production: correcto (advertencias CSS/CommonJS existentes).
- 106 pruebas automatizadas: correctas, con `tsconfig.publicacion.spec.json`.
- Sincronizacion Android: correcta.
- Gradle `bundleRelease assembleRelease --no-daemon --max-workers=1`: correcto. Primer intento fallo por bloqueo del cache de Windows; reintento sin omitir lint.
- APK: firma verificada por apksigner; AAB: jarsigner devuelve `jar verified` con advertencias de certificado autofirmado, timestamp y orden de entradas ZIP.
- Paquete `mx.com.seclife.schoolmaster`, version 4.1.7/20107, min SDK 26, target SDK 36 verificados en APK.
- Artefactos locales en `releases/4.1.7/`, excluidos de Git.
- AAB SHA256: `78A149B43EE8E3C2C6395E34D005508DC238426AEB868C527D5A14CFB6E007D4`.
- APK SHA256: `35E04BA7A488728A2F7A26CF63106B7FC5B224627894C3C9238619CDC1DFE50F`.

## Publicacion

Correccion posterior: el paquete 20107 tenia version nativa 4.1.7, pero ambos environments conservaban appVersion 4.1.6 y el menu mostraba ese texto fijo. Se corrigen a 4.1.7, se agrega `prebuild` para validar package/lock/environments/Android/iOS, con tres pruebas Node. El paquete 20107 no debe promoverse a produccion; usar 20108 tras nueva compilacion y prueba. Los hashes anteriores corresponden exclusivamente a 20107.
Codi Mac debe actualizar esta rama antes de compilar. Si ya subio 4.1.7 (1), incrementar el build iOS a uno libre y generar otro archivo; no reutilizar el binario anterior.

Estado verificado el 2026-10-11: Android 4.1.7 (20107) disponible para testers internos en Play Console, release 9 del canal 4699629436129831654. Sin errores bloqueantes ni perdida de dispositivos compatibles. Advertencias: archivo de desofuscacion y simbolos nativos no adjuntos. Produccion no promovida; pendiente prueba del usuario sobre la instalacion de tienda. iOS pendiente de compilar y probar en Mac/TestFlight.

Primero prueba interna Android y TestFlight iOS. No activar actualizacion obligatoria ni elevar minimos hasta que cada plataforma tenga la version disponible para su audiencia.
Verificar Mexico, Canada y Estados Unidos antes de produccion. No se modificaron politicas productivas de versiones durante la preparacion.
La compilacion de iOS debe realizarse en Mac; no se ha compilado ni enviado desde Windows.

## Notas propuestas para las tiendas

Mejoras en Red Familiar, brigadas y lectura asistida. Actualizaciones de Expediente Documental y domicilio familiar. Mejor organizacion de videotutoriales y consultas de transporte escolar.

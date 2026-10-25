# appSeclife 4.1.9 - Android y Codi Mac

## Identificacion

- Preparacion: 2026-10-25, Ciudad de Mexico.
- Repositorio: dalegalex/appSeclife.
- Rama: codex/appseclife-4.1.9-publicacion.
- Base: 8be7d55, entrega anterior 4.1.8.
- Android: versionName 4.1.9, versionCode 20111, target SDK 36.
- iOS: MARKETING_VERSION 4.1.9, build inicial 1; confirmar disponibilidad en App Store Connect.
- Alex confirma que la version iOS publicada es 4.1.8.

## Cambios incluidos

1. Auditoria de acceso: metadatos de version, plataforma e instalacion; actividad al regresar a primer plano y cierre explicito de sesion. El transporte de auditoria es independiente y sus errores no bloquean el ingreso. Renovacion biometrica usa /auth/biometria/renovar, diferenciada del ingreso. Conservacion de servidor acordada: 90 dias.
2. Avisos de asistencia: modalidad por organizacion AVISO_DICTAMEN_POSTERIOR, etiquetas Recibido/Enterado/Justificada/No justificada, evidencia opcional y cancelacion restringida cuando el colegio ya esta enterado. Se conserva la modalidad tradicional y el modo historico de cada aviso.
3. Red Familiar: master o administrador autorizado puede editar celular y correo de contacto aun con TAG en tramite/activada. Se preservan nombre, apellidos y parentesco protegidos.

## Dependencias y limites

- Auditoria SQL/GpsApi/PSeclife publicados y probados segun confirmacion previa de Alex. No se ha vuelto a desplegar el servidor durante esta preparacion.
- Avisos requiere el contrato API/SQL del dictamen posterior; el agente de Asistencia confirmo conciliacion del SP instalado con el maestro. Validar el flujo integrado en pruebas internas.
- El ajuste de celular no requiere nueva publicacion de SQL/GpsApi.
- Sin nuevos permisos nativos ni cambios a firma, Bundle ID, politica de version minima o canales de produccion.
- GPS de conductor sigue exclusivo de Android.
- No activar actualizacion obligatoria antes de disponibilidad publica de cada plataforma.

## Validacion local

- Angular production correcto; advertencias existentes de presupuesto CSS y CommonJS qrcode.
- 116 pruebas correctas: modulos, HTTP, actualizaciones y auditoria de autenticacion.
- Tres pruebas del validador de versiones correctas.
- Sincronizacion Capacitor Android correcta.
- ChromeHeadless requirio ejecucion fuera del aislamiento local; la primera ejecucion no pudo iniciar Chrome. Gradle tambien requirio acceso fuera del aislamiento para conectarse a su daemon.
- Gradle bundleRelease/assembleRelease correcto. APK firmado verificado con apksigner; paquete mx.com.seclife.schoolmaster, minimo API 26 y target 36 verificados con aapt.
- AAB verificado con jarsigner; advertencias de certificado autofirmado, timestamp y orden ZIP, iguales a las documentadas en 4.1.8.
- AAB: releases/4.1.9/appSeclife-4.1.9-20111.aab, SHA256 5EBA9EDB7F207E1B30D869D5D825CD0AEE09F112530B9D5D52C837F8F40336B7.
- APK: releases/4.1.9/appSeclife-4.1.9-20111.apk, SHA256 5873285C9B337FA8F3549868F891CCD2A70C17EBA565D7F164CB108C4209C17E.
- Play Console confirma Disponible para testers internos el 2026-10-25 a las 13:59 CDMX, release 13, canal 4699629436129831654. Sin errores bloqueantes ni perdida de dispositivos compatibles; dos advertencias de desofuscacion y simbolos nativos. Evidencia: releases/4.1.9/play-interna-20111.png.
- Commit funcional subido a origin: 2848e66e92eb7968cfa68dcba47367c4a5698be8. Los commits posteriores de esta rama documentan el estado de publicacion.
- Alex confirma pruebas satisfactorias como tester Android y autoriza promocion a produccion. iOS mantiene su validacion independiente con Codi Mac.

## Codi Mac

Revisar cambios locales antes de cambiar de rama. Conservar los ajustes nativos y de firma de iOS; no usar reset --hard ni sobrescribirlos.

```bash
git status
git fetch origin
git switch --track origin/codex/appseclife-4.1.9-publicacion
npm ci
npm run build -- --configuration production
npx cap sync ios
npx cap open ios
```

Si la rama ya existe, usar git switch codex/appseclife-4.1.9-publicacion y git pull --ff-only. Si hay cambios locales o divergencia, revisarlos e integrarlos antes de continuar.

Conservar mx.com.seclife.schoolmaster, equipo de firma, Firebase, Push, NFC, Keychain y ajustes de biometria/DEVICE_CREDENTIAL ya probados en Mac. La guia docs/ios-publicacion.md contiene antecedentes 4.1.1; no usar sus antiguos pendientes como instrucciones para deshacer configuracion actual.

Verificar version 4.1.9 y build libre; archivar, validar, subir a TestFlight y probar el mismo build antes de enviar a revision.

## Pruebas de aceptacion

- Actualizar sobre 4.1.8 y confirmar 4.1.9 al pie del menu.
- Login Google/correo, biometria, cancelacion de desbloqueo y bloqueo tras segundo plano. Renovacion de JWT debe mantener acceso y no contarse como nuevo ingreso interactivo.
- Ver acceso/actividad en PSeclife para organizacion y usuario correctos, tanto Android como iOS. La fecha registrada no demuestra la fecha real de instalacion.
- Editar celular como master y delegado con TAG protegida; volver a consultar y comprobar persistencia y campos protegidos sin cambios.
- Avisos: probar organizacion con modalidad tradicional y otra con dictamen posterior; crear aviso, marcar enterado desde portal, dictaminar y revisar etiquetas/cancelacion. Revisar tambien ingreso tardio y salida temprana.
- QR/NFC en equipo compatible, camara, galeria, Push, videotutoriales, Expediente Documental.
- GPS Android al iniciar/finalizar recorrido.

## Publicacion

Android promovido a produccion y enviado a revision de Google tras confirmacion de pruebas de Alex. Release 106 del canal 4697946813617665984, mismo AAB 20111 de prueba interna, sin recompilar.

Play Console muestra Cambios en revision, con comprobaciones rapidas aun en curso. No confirma aprobacion ni disponibilidad publica. Lanzamiento completo al 100%, exclusivamente Mexico, Canada y Estados Unidos, verificados en Paises/Territorios. Publicacion gestionada desactivada.

Se conserva el APK legacy 20096 que ya estaba incluido en produccion. Sin perdida de dispositivos compatibles. Tres advertencias no bloqueantes: desofuscacion de 20096 y 20111, y simbolos nativos de 20111. No se modifica la regla de actualizacion obligatoria.

Evidencia: releases/4.1.9/play-produccion-20111.png. iOS mantiene compilacion, TestFlight y revision independientes con Codi Mac.

Play Console mantiene advertencia de optimizacion DEX para febrero 2027, independiente de esta entrega; no se activa minificacion sin su prueba especifica.

Notas: Mejoras en avisos de asistencia y consulta de su estado segun la configuracion del Colegio. Edicion del celular de familiares autorizados sin modificar los datos protegidos de su credencial. Registro de accesos y actividad para el seguimiento administrativo de appSeclife.

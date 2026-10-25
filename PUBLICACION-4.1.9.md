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
- Carga en curso en prueba interna de Play Console, release 13, canal 4699629436129831654. No confirma aun disponibilidad para testers ni produccion.
- Pendientes pruebas fisicas Android y iOS de esta entrega.

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

Primero prueba interna Android y TestFlight iOS. Esperar prueba fisica satisfactoria antes de promover a produccion. Mantener Mexico, Canada y Estados Unidos exclusivamente.

Play Console mantiene advertencia de optimizacion DEX para febrero 2027, independiente de esta entrega; no se activa minificacion sin su prueba especifica.

Notas: Mejoras en avisos de asistencia y consulta de su estado segun la configuracion del Colegio. Edicion del celular de familiares autorizados sin modificar los datos protegidos de su credencial. Registro de accesos y actividad para el seguimiento administrativo de appSeclife.

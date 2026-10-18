# appSeclife 4.1.8 - Android y Codi Mac

## Identificacion

- Preparacion: 2026-10-17, hora Ciudad de Mexico.
- Rama: `codex/appseclife-4.1.8-publicacion`, repositorio `dalegalex/appSeclife`.
- Base: `58db9bf`, publicacion anterior 4.1.7.
- Android: versionName 4.1.8, versionCode 20110, target SDK 36.
- iOS: MARKETING_VERSION 4.1.8, build inicial 1. Mac debe comprobar disponibilidad del build en App Store Connect.
- El usuario confirma ultima version iOS 4.1.7 y SQL/GpsApi publicados.

## Cambios incluidos

- Expediente Documental: aceptacion expresa con OTP sin firma grafica cuando el documento no la requiere.
- Se conserva el flujo de firma grafica y OTP cuando el documento la exige.
- Pestaña Atendidos agrupa documentos atendidos; acciones y confirmaciones distinguen firma y aceptacion.
- Grupo del alumno en representacion e indicador de carga al abrir PDF.
- Version visible y nativa sincronizadas; no se modifican permisos nativos ni politica de actualizacion obligatoria.
- Dependencia API: POST documentos/{id}/aceptacion en ExpedientePortalController.

## Validacion

- Angular production correcto; advertencias de presupuesto CSS y CommonJS qrcode.
- Tres pruebas del validador de versiones correctas.
- Sincronizacion Android correcta.
- Gradle bundleRelease/assembleRelease correcto; APK firmado con el certificado existente, paquete/version/SDK verificados con aapt. AAB verificado con jarsigner (advertencias de certificado autofirmado, timestamp y orden ZIP).
- 111 pruebas de regresion correctas, incluidas cuatro nuevas de aceptacion/firma. Comando: `npx ng test --watch=false --browsers=ChromeHeadless --ts-config=tsconfig.publicacion.spec.json --include="src/app/modules/**/*.spec.ts" --include="src/app/core/http/**/*.spec.ts" --include="src/app/core/updates/**/*.spec.ts"`.
- Los intentos iniciales fallaron por inclusion de specs fuera del tsconfig y por restricciones de inicio de Chrome/Gradle en sandbox; corregido el comando y ejecutado con acceso local, sin omitir validaciones.
- AAB: `releases/4.1.8/appSeclife-4.1.8-20110.aab`, SHA256 `6F9F5B001ADFCA6E17B47296D1C260EEA4042B573B88FC2CE90288B0CC91AA42`.
- APK: `releases/4.1.8/appSeclife-4.1.8-20110.apk`, SHA256 `4DB2A9CDA16066F07502A66BB20C390686E4F4C3F1207B277E76E47A7BE643D9`.
- Play Console confirma 4.1.8 (20110) disponible para testers internos el 2026-10-17 a las 21:31, release 12 del canal 4699629436129831654. Sin errores bloqueantes ni perdida de dispositivos compatibles; dos advertencias de desofuscacion/simbolos nativos. Evidencia: releases/4.1.8/play-interna-20110.jpg.
- No se ha compilado iOS desde Windows ni promovido esta version a produccion.

## Codi Mac

Conservar cambios locales e integrar ajustes nativos previos de iOS. No usar reset --hard.

```bash
git status
git fetch origin
git switch --track origin/codex/appseclife-4.1.8-publicacion
npm ci
npm run build -- --configuration production
npx cap sync ios
npx cap open ios
```

Si la rama ya existe, usar `git switch codex/appseclife-4.1.8-publicacion` y `git pull --ff-only`.
Revisar diferencias locales antes de cambiar de rama; no sobrescribir ajustes de firma.
Conservar Bundle ID mx.com.seclife.schoolmaster, equipo, Push, NFC y Keychain.
GPS de conductor permanece exclusivo de Android. Usar build iOS libre si 4.1.8 (1) ya existe.
Archivar, subir a TestFlight y probar en dispositivo antes de enviar a revision.

## Pruebas fisicas requeridas

- Actualizacion sobre 4.1.7 y version 4.1.8 visible al pie del menu.
- Aceptacion sin firma: abrir PDF, marcar declaracion, recibir OTP, confirmar, consultar constancia y Atendidos.
- Firma grafica: no debe permitir solicitar OTP sin firma ni declaracion; completar firma y consultar constancia.
- Cancelacion, OTP incorrecto/vencido, y error de conectividad sin mostrar datos tecnicos.
- Login Google/correo, biometria, bloqueo, QR/NFC, camara/galeria y notificaciones.
- GPS Android al iniciar/detener recorrido; aislamiento por organizacion y familia.

## Publicacion

Primero prueba interna Android y TestFlight. Produccion pendiente de pruebas y confirmacion.
Mantener exclusivamente Mexico, Canada y Estados Unidos en produccion.
No elevar versiones minimas ni activar actualizacion obligatoria como parte de esta entrega.

Notas: Mejoras en Expediente Documental: aceptacion de documentos mediante codigo de confirmacion, firmas segun los requisitos del documento, consulta de documentos atendidos y mejoras al visualizar PDF y grupos de alumnos.

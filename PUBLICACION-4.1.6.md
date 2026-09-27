# appSeclife 4.1.6 - entrega Android / Codi Mac

## Alcance

- Rama: `codex/appseclife-4.1.6-publicacion` en `dalegalex/appSeclife`.
- Android: versionName `4.1.6`, versionCode `20106`, target SDK 36.
- iOS: version `4.1.6`, build inicial `1`. Verificar en App Store Connect que no exista ya; incrementar el build si fuera necesario.
- Entrega Android autorizada: prueba interna. No promover a produccion sin pruebas y autorizacion posteriores.
- GpsApi, PSeclife y los tres scripts de control de versiones fueron publicados/ejecutados por el usuario, segun su confirmacion.

## Cambios incluidos

- Control de versiones recomendadas/obligatorias por plataforma y apertura de la tienda oficial.
- Consulta nativa de version/build; comprobacion al iniciar, regresar a primer plano, recuperar conexion y periodicamente.
- Falla de consulta de politica no bloquea la app. Se difiere el bloqueo durante operaciones protegidas, peticiones activas, GPS activo o pendientes offline de transporte.
- Ficha Medica familiar independiente, con datos, adjuntos y consulta de atenciones segun autorizacion del backend.
- Lectura asistida y fotografia de personas temporales; sin crear usuario/TAG para guardar su foto.
- Seleccion y cambio de ruta en pase de abordaje, con proteccion contra respuestas obsoletas.
- Ajustes de Inicio y Red Familiar incluidos en el arbol de trabajo aprobado por el usuario.

## Instrucciones para Codi Mac

Antes de cambiar de rama, ejecutar `git status`. Si hay cambios locales, conservarlos y revisar su integracion; no usar reset --hard ni descartar ajustes nativos.

```bash
git fetch origin
git switch --track origin/codex/appseclife-4.1.6-publicacion
npm ci
npm run build -- --configuration production
npx cap sync ios
npx cap open ios
```

Si la rama ya existe localmente, usar `git switch codex/appseclife-4.1.6-publicacion` y `git pull --ff-only` en lugar de crearla otra vez.
Comprobar el commit con `git rev-parse HEAD` contra el comunicado de entrega.

En Xcode confirmar Bundle ID `mx.com.seclife.schoolmaster`, version 4.1.6, build no utilizado, equipo de firma y capacidades Push/NFC/Keychain existentes. No sustituir certificados ni perfiles compartidos desde Windows.
Archivar y subir primero a TestFlight. No activar GPS de conductor en iOS: se mantiene exclusivo de Android.

## Pruebas requeridas en dispositivos

- Actualizacion sobre 4.1.5 sin perder sesion; login Google/correo, biometria y credencial del dispositivo.
- Bloqueo local despues de 10 minutos en segundo plano, cancelar/reintentar, renovacion de sesion.
- Politica deshabilitada: ingreso normal. Recomendacion, posponer, enlace de tienda y regreso. Obligatoria solo en entorno/cuenta de pruebas controlado, no cambiando el minimo global de produccion.
- Sin red o fallo de GpsApi: mensaje entendible y sin URL tecnica; no bloqueo de actualizacion persistente por fallo de consulta.
- No interrumpir ruta GPS, lectura asistida/autogestionada ni pendientes de transporte con una actualizacion.
- Personas temporales: lectura, permisos de recogida, foto y aislamiento por organizacion.
- Pase de abordaje: elegir otra ruta aun con pase abierto; no cerrar pases ni notificar por cambiar el selector.
- Ficha Medica con datos ficticios: acceso autorizado por alumno/organizacion, formularios, receta/cartilla y consulta de atenciones. Verificar declaraciones de privacidad y salud antes de produccion.
- Videotutoriales por audiencia, QR, NFC en equipo compatible, camara/galeria y push/badge.

## Control de publicacion

No activar actualizacion obligatoria ni elevar el minimo global hasta que la version correspondiente este disponible en la tienda para la audiencia prevista. Android e iOS tienen politicas independientes.
Las versiones anteriores sin este mecanismo no pueden bloquearse retroactivamente desde esta pantalla.
No se han modificado politicas productivas de versiones en esta preparacion.
Consulta publica de GpsApi verificada: Android 4.1.6 (20106) e iOS 4.1.6 (1) devuelven `CURRENT`, revision 0. El enlace de App Store esta vacio: registrar el enlace oficial correcto antes de habilitar recomendacion u obligatoriedad en iOS.

## Validacion local 2026-09-26

- Compilacion Angular de produccion: correcta. Permanecen advertencias de presupuestos CSS y CommonJS `qrcode`.
- 63 pruebas focalizadas: correctas (actualizacion, personas temporales/Red Familiar y pase de abordaje).
- `npx cap sync android`: correcto.
- Gradle `bundleRelease assembleRelease`: correcto. AAB firmado y certificado de carga igual al de 4.1.5.
- AAB SHA256: `E48EBE9A99DDF852D17A30DD0687B016FE310CCE2E3B8DF04B8EEA9B3532A19E`.
- APK SHA256: `5E37E1A22A6DD009D539732F40CB88B192CC6CD5DF55568302A1C3CCA75A75DA`.
- Esta evidencia local no sustituye pruebas fisicas ni aprobacion de tiendas. iOS debe compilarse y validarse en Mac.

## Notas de version propuestas

Ficha Medica familiar. Mejoras en personas temporales, lectura asistida y pases de abordaje. Control de actualizaciones de la aplicacion y ajustes de estabilidad.

Los instaladores de `releases/`, keystores y secretos no se versionan en Git.

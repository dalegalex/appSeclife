# appSeclife 4.1.12 - entrega para Android y Codi Mac

Preparacion: 2026-11-16. Rama: codex/appseclife-4.1.12-publicacion.
Android candidato: 20116. iOS propuesto: 4.1.12 (1), verificar disponibilidad
en App Store Connect antes de archivar. No usar el numero Android como build iOS.

## Cambios incluidos

- Calificaciones y boletas familiares: consulta por ciclo/hijo, visor interno y
  compartir PDF. El renderer versionado coincide con PSeclife; el Mac no necesita
  tener un checkout del portal para compilar. No editar el archivo generado.
- Lectura asistida: placas para entrega en auto y reconocimiento local por camara,
  siempre con confirmacion humana. No identifica ni autoriza familias por placa.
- Expediente Documental: diagnostico de preparacion familiar y correcciones de
  inicializacion/exportacion de la firma grafica.
- Pase de abordaje: selector de ruta y ajustes de seleccion/confirmacion.
- Conserva el RFC opcional de 4.1.11 y las reglas existentes de permisos.

## Dependencias antes de pruebas reales

Alex confirma el 2026-11-16 que SQL y GpsApi ya estan publicados y que iOS esta
en 4.1.11 (2). No activar banderas ni version minima de forma automatica.
Boletas familiares requiere menu y Boletas__FamiliaEnabled; una boleta no
publicada no debe hacerse visible. La preparacion familiar conserva su alcance
piloto 1011. Pruebas locales y compilacion no certifican despliegue del backend.

## Sincronizacion Mac

Revisar git status y conservar cambios locales de firma/configuracion. Si hay
cambios o divergencia, detenerse y conciliarlos; no usar reset --hard ni clean.
Con el arbol limpio:

```bash
git fetch origin
git switch codex/appseclife-4.1.12-publicacion
git pull --ff-only origin codex/appseclife-4.1.12-publicacion
npm ci
node --test scripts/check-release-version.test.cjs scripts/sync-boleta-renderer.test.cjs
npm run build -- --configuration production
npx cap sync ios
npx cap open ios
```

Se conserva Swift Package Manager. Verificar en Xcode registro y pertenencia al
target de SeclifeBoletaPdfPlugin.swift y SeclifePlacaOcrPlugin.swift, integrados
en SeclifeBridgeViewController. No borrar plugins existentes, firma ni APNs.
Confirmar bundle mx.com.seclife.schoolmaster, version 4.1.12 y build libre.
Product > Archive en Release; validar/subir desde Organizer y probar TestFlight
antes de solicitar publicacion. La compilacion iOS se valida en Mac, no Windows.

## Pruebas de aceptacion

1. Login Google/correo, biometria/credencial del dispositivo y bloqueo local.
2. Menu con version 4.1.12, permisos y aislamiento entre colegios/familias.
3. Boleta autorizada: vista completa, paginas, zoom, compartir PDF; sin acceso a
   hijos ajenos ni periodos aun no publicados.
4. Placa: captura, cancelacion, permiso denegado, correccion manual, confirmar,
   entrega directa/carrusel; comprobar regreso del NFC y que cambiar de familia
   no aplique un reconocimiento anterior.
5. Expediente: datos sin RFC, persistencia, pendientes, firma legible sobre blanco
   y OTP. Utilizar solo documentos/cuentas de prueba, no firmar contratos reales.
6. Pase de abordaje: cambiar ruta, seleccion, registrar y cerrar; verificar
   notificaciones y que datos locales no se mezclen entre usuarios/rutas.
7. Regresion: GPS al iniciar recorrido y en segundo plano, NFC, QR, camara,
   galeria, videotutoriales y notificaciones.

Primero pruebas internas/TestFlight. Produccion solo despues de aprobacion del
build por Alex. Conservar Mexico, Canada y Estados Unidos; no cambiar politicas
ni el minimo obligatorio como parte de esta entrega.

## Evidencia de preparacion

- Build web production 4.1.12 correcto; avisos CSS y CommonJS sin error.
- Siete pruebas Node de versiones y portabilidad del renderer aprobadas.
- Expediente Documental: 23 pruebas aprobadas en ChromeHeadless.
- Placas y pase de abordaje: 36 pruebas aprobadas en ChromeHeadless.
- Android bundleRelease firmado correcto. AAB local:
  releases/4.1.12/appSeclife-4.1.12-20116.aab.
- SHA256: cd9d5dd40d769f0c8429acd411e5e921d1cf932ff9e92be279e174600a01121b.
- Pendiente: pruebas internas en Play Console y pruebas fisicas de esta candidata.
- iOS no compilado aqui; requiere Codi Mac y TestFlight.

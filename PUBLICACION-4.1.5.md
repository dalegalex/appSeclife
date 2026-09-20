# appSeclife 4.1.5

Rama: codex/appseclife-4.1.5-publicacion
Android: 20105. iOS: 4.1.5 (1); verificar build libre en App Store Connect.

## Cambios

- Ayuda y videotutoriales por organizacion/perfil, filtros y scrolling de 20.
- Mensaje publico de conectividad sin URL para errores 0/502/503/504.
- Red Familiar: politicas de alta/baja de alumnos nucleo, recarga tras baja
  y consulta de brigada semanal segun disponibilidad del backend.
- Avisos de asistencia: justificante desde archivo/galeria o camara.
- Abordaje: listado dedicado de rutas y acceso administrativo limitado a
  modalidad de abordaje; recorrido GPS sigue reservado a conductor/asistente.

Usuario confirma prueba fisica de Red Familiar y version iOS previa 4.1.4.
Videotutoriales: usuario confirmo reproduccion y aislamiento por org/perfil.
Esto no sustituye smoke del binario final descargado del canal interno/TestFlight.

## Codi Mac

No descartar cambios locales. Revisar git status antes de cambiar de rama.
Si hay trabajo local pendiente, conciliarlo antes de continuar.

```sh
git fetch origin
git switch --track origin/codex/appseclife-4.1.5-publicacion
npm ci
npm run build
npx cap sync ios
npx cap open ios
```

Si la rama ya existe, usar git switch y git pull --ff-only en esa rama.
Verificar commit compartido, firma, equipo, bundle mx.com.seclife.schoolmaster,
version 4.1.5 y build disponible; no cambiar permisos nativos sin necesidad.
GPS conductor permanece exclusivo de Android por platform-capabilities.ts.

Antes de Archive/Upload y envio a revision, probar en iPad/iPhone fisico:
- Login Google/correo, huella/Touch ID/Face ID si aplica, cancelacion y bloqueo
  local de 10 minutos; no dar por probada DEVICE_CREDENTIAL solo por compilar.
- Tutoriales: alcance org/perfil, filtros, play/seek/pantalla completa/regreso,
  bloqueo y segundo plano, sin conexion y renovacion de enlace.
- Red Familiar: politicas, brigada por alumno/dia y baja con recarga backend.
- Avisos de asistencia: captura, cancelacion y archivo/galeria con permisos.
- Push y navegacion, credencial digital, OTP documental no visible.

No subir claves, keystore, perfiles privados ni binarios al repositorio Git.
SQL/API de tutoriales ya fueron publicados y probados por el usuario.
Confirmar disponibilidad productiva de contratos de brigadas y abordaje.

## Notas para tiendas

Nueva seccion de Ayuda y videotutoriales. Mejoras en Red Familiar y consulta
de brigadas semanales. Adjunta justificantes de asistencia desde la camara
o tus archivos. Mejoras de estabilidad y mensajes de conectividad.

Publicacion: primero canal interno/TestFlight y prueba del artefacto exacto;
despues envio a revision. Una carga no equivale a aprobacion ni publicacion.

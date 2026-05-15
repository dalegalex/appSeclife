# Modulos De La App

La app movil Seclife funcionara como contenedor de varios modulos.

## Transporte Escolar

Primer modulo funcional de la app.

Alcance inicial movil:

- Consulta de alumnos relacionados al padre de familia.
- Calendario de traslados.
- Viajes activos.
- Ubicacion del transporte cuando exista viaje activo.
- Estado del alumno dentro del viaje.
- Notificaciones de cambios, retrasos o incidencias.

## Estructura Recomendada

```text
src/app/modules/transporte-escolar/
  pages/
  components/
  services/
  models/
```

La administracion completa de rutas, unidades, conductores, horarios y asignaciones vivira principalmente en portal web.

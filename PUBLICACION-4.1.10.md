# appSeclife 4.1.10

Rama: codex/appseclife-4.1.10-publicacion (base d6018de).
Android: 20112. iOS: 4.1.10, build inicial 1, sujeto a disponibilidad.

Red Familiar: consulta del codigo en el contexto de la familia receptora,
seleccion de alumnos y tratamiento de autorizaciones provisionales existentes
segun la politica del colegio. Confirmar el contrato SQL/GpsApi desplegado
antes de promover. Probar con dos familias de prueba: aplicar a un alumno,
cancelar un duplicado sin cambios y comprobar la politica de bloqueo.

## Codi Mac

Confirmar arbol limpio y preservar cualquier ajuste nativo local antes de cambiar de rama.

```bash
git status --short --branch
git fetch origin
git switch --track origin/codex/appseclife-4.1.10-publicacion
npm ci
npm run build -- --configuration production
npx cap sync ios
npx cap open ios
```

Si la rama local ya existe, cambiar a ella y usar git pull --ff-only.
Conservar firma, identificador, capacidades y configuracion Firebase.
Verificar version/build en Xcode y App Store Connect, archivar y probar
el mismo build en TestFlight antes de enviarlo a revision.
No activar version minima ni modificar paises con esta preparacion.

# appSeclife 4.1.11

Android 20115 (solo pruebas internas); iOS 4.1.11, solo TestFlight.
Rama codex/appseclife-4.1.11-publicacion. No promover los builds 20113 ni 20114.
Ambos envios de datos contractuales deben mandar null en lugar de cadena vacia para RFC.
En Mac verificar el ultimo build cargado: si ya se subio el (2), usar (3) o el siguiente libre.
En ambos formularios, probar RFC vacio, mal formado y valido. Solo el mal
formado debe impedir guardar si los demas datos son correctos.
Expediente Documental: completar domicilio, telefonos y datos contractuales
del representante legal. Validar con SQL y GpsApi desplegados: propuesta,
edicion y confirmacion por documento. Usar cuentas y documentos de prueba;
no firmar contratos reales. Verificar persistencia al salir y volver.

## Codi Mac

Verificar git status; preservar cambios locales de firma y configuracion nativa.
Con el arbol limpio:

```bash
git fetch origin
git switch --track origin/codex/appseclife-4.1.11-publicacion
npm ci
npm run build -- --configuration production
npx cap sync ios
npx cap open ios
```

Si ya existe la rama local, cambiar a ella y usar git pull --ff-only.
Validar version 4.1.11 y build disponible en App Store Connect antes de archivar.
Probar el mismo build en TestFlight antes de enviar a revision. Verificar que
las declaraciones de privacidad en ambas tiendas cubran los datos recopilados.
No activar version minima ni cambiar paises como parte de esta prueba.

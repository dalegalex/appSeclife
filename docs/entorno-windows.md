# Entorno Windows

Este equipo sera el entorno principal de desarrollo diario.

## Responsabilidades

- Desarrollo de la app movil.
- Desarrollo del portal web.
- Desarrollo del backend/API.
- Programacion SQL con SQL Server Management Studio.
- Compilacion Android con Android Studio.

## Requisitos App Movil

- Node.js compatible con Angular 21.
- npm.
- Git.
- Android Studio.
- JDK compatible con la version de Gradle generada por Capacitor.

## Primer Levantamiento

```bash
git clone <url-del-repositorio>
cd appSeclife
npm install
npm start
```

## Android

```bash
npm run build
npx cap sync android
npx cap open android
```

## SQL Y Backend

El portal, backend/API y SQL Server pueden vivir en repositorios o proyectos separados. Los scripts SQL del modulo Transporte Escolar deben mantenerse versionados para que los cambios sean reproducibles.

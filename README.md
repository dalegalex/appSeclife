# Seclife App Movil

Aplicacion movil base de Seclife School construida con Angular, Ionic y Capacitor.

Este repositorio funcionara como contenedor de modulos moviles de distintos proyectos. El primer modulo funcional sera Transporte Escolar.

## Stack

- Angular 21
- Ionic Angular 8
- Capacitor 8
- Android Studio para Android
- Xcode para iOS

## Estructura Principal

```text
src/app/
  core/
  shared/
  modules/
    transporte-escolar/
```

- `core`: servicios globales, autenticacion, configuracion, interceptores y utilidades compartidas de aplicacion.
- `shared`: componentes, pipes, directivas y modelos reutilizables entre modulos.
- `modules`: funcionalidades por dominio. Transporte Escolar inicia aqui.

## Flujo De Trabajo

- macOS: compilacion y pruebas iOS con Xcode; tambien puede compilar Android.
- Windows 11: desarrollo diario, Android Studio, integracion con portal/API y SQL Server Management Studio.
- GitHub: sincronizacion entre equipos.

## Comandos Base

```bash
npm install
npm start
npm run build
npx cap sync
```

Para Android:

```bash
npx cap open android
```

Para iOS en macOS:

```bash
npx cap add ios
npx cap sync ios
npx cap open ios
```

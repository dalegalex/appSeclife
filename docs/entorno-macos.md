# Entorno macOS

Este equipo se usara principalmente para compilar, probar y publicar iOS.

## Requisitos

- Node.js compatible con Angular 21.
- npm.
- Xcode actualizado.
- CocoaPods, si algun plugin nativo lo requiere.
- Android Studio opcional para compilar Android tambien desde macOS.

## Primer Levantamiento

```bash
npm install
npm start
```

## iOS

Cuando se agregue la plataforma iOS:

```bash
npx cap add ios
npm run build
npx cap sync ios
npx cap open ios
```

Desde Xcode se atienden certificados, perfiles de aprovisionamiento, dispositivos fisicos y publicacion.

## Regla De Trabajo

Antes de compilar en Xcode, traer siempre los cambios mas recientes desde GitHub y ejecutar:

```bash
npm install
npm run build
npx cap sync ios
```

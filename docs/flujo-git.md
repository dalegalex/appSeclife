# Flujo Git

GitHub sera el puente entre macOS y Windows.

## Rama Principal

Usaremos `main` como rama principal estable.

## Flujo Basico

Antes de trabajar:

```bash
git pull
npm install
```

Al terminar una unidad de trabajo:

```bash
git status
git add .
git commit -m "Descripcion corta del cambio"
git push
```

## Reglas

- No versionar `node_modules`, `www`, builds de Android/iOS ni archivos locales de IDE.
- Versionar cambios de configuracion necesarios para reproducir el proyecto.
- Mantener commits pequenos y descriptivos.
- Confirmar que `npm run build` funcione antes de compartir cambios importantes.

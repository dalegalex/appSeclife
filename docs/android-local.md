# Android local

Para probar la app en el emulador Android contra `GpsApi` local en Windows, la app usa:

```text
http://127.0.0.1:5070/api
```

En el emulador, `127.0.0.1` apunta al propio Android. Por eso se requiere un tunel ADB hacia el host:

```powershell
npm run android:reverse
```

Flujo recomendado:

```powershell
npm run android:local
```

Este comando compila la app, sincroniza Capacitor, activa el tunel `tcp:5070 -> tcp:5070` y abre Android Studio.

Si Android Studio ya esta abierto y solo se reinicio el emulador, basta con:

```powershell
npm run android:reverse
```

Para pruebas en dispositivo fisico real no se usa `adb reverse`; ahi la app debe apuntar a una URL HTTPS accesible desde internet o desde la red local, por ejemplo el API publicado en Azure.

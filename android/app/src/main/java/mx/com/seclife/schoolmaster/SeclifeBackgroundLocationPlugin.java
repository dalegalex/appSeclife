package mx.com.seclife.schoolmaster;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SeclifeBackgroundLocation")
public class SeclifeBackgroundLocationPlugin extends Plugin {
    private static final String LOG_TAG = "SeclifeGps";
    private static boolean running = false;

    @PluginMethod
    public void start(PluginCall call) {
        Log.i(LOG_TAG, "Plugin start solicitado.");

        if (!hasLocationPermission()) {
            Log.w(LOG_TAG, "Plugin start rechazado: permiso de ubicacion no concedido.");
            call.reject("Permiso de ubicacion no concedido.");
            return;
        }

        if (!hasBackgroundLocationPermission()) {
            Log.w(LOG_TAG, "Plugin start rechazado: permiso de ubicacion en segundo plano no concedido.");
            call.reject("Permiso de ubicacion en segundo plano no concedido.");
            return;
        }

        String apiUrl = call.getString("apiUrl", "");
        String token = call.getString("token", "");
        Long idrecorrido = getLongValue(call, "idrecorrido");
        Integer idruta = getIntValue(call, "idruta");
        Integer idunidad = getIntValue(call, "idunidad");
        String origen = call.getString("origen", "APP_CONDUCTOR_BG");
        Long intervalMs = call.getLong("intervalMs");

        if (apiUrl == null || apiUrl.trim().isEmpty()) {
            Log.w(LOG_TAG, "Plugin start rechazado: apiUrl requerido.");
            call.reject("apiUrl es requerido.");
            return;
        }

        if (idrecorrido == null || idrecorrido <= 0 || idruta == null || idruta <= 0 || idunidad == null || idunidad <= 0) {
            Log.w(LOG_TAG, "Plugin start rechazado: datos incompletos. idrecorrido=" + idrecorrido + ", idruta=" + idruta + ", idunidad=" + idunidad);
            call.reject("Datos del recorrido incompletos.");
            return;
        }

        Intent intent = new Intent(getContext(), SeclifeBackgroundLocationService.class);
        intent.setAction(SeclifeBackgroundLocationService.ACTION_START);
        intent.putExtra("apiUrl", apiUrl);
        intent.putExtra("token", token == null ? "" : token);
        intent.putExtra("idrecorrido", idrecorrido);
        intent.putExtra("idruta", idruta);
        intent.putExtra("idunidad", idunidad);
        intent.putExtra("origen", origen);
        intent.putExtra("intervalMs", intervalMs == null ? 5000L : intervalMs);

        try {
            ContextCompat.startForegroundService(getContext(), intent);
            running = true;
            Log.i(LOG_TAG, "Plugin startForegroundService ejecutado. idrecorrido=" + idrecorrido + ", intervalMs=" + (intervalMs == null ? 5000L : intervalMs));
        } catch (Exception exception) {
            running = false;
            Log.e(LOG_TAG, "Plugin no pudo arrancar el servicio GPS.", exception);
            call.reject("No fue posible iniciar GPS en segundo plano.", exception);
            return;
        }

        JSObject result = new JSObject();
        result.put("running", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Log.i(LOG_TAG, "Plugin stop solicitado.");
        Intent intent = new Intent(getContext(), SeclifeBackgroundLocationService.class);
        intent.setAction(SeclifeBackgroundLocationService.ACTION_STOP);
        getContext().startService(intent);
        running = false;

        JSObject result = new JSObject();
        result.put("running", false);
        call.resolve(result);
    }

    @PluginMethod
    public void status(PluginCall call) {
        Log.d(LOG_TAG, "Plugin status solicitado. running=" + running + ", backgroundLocationGranted=" + hasBackgroundLocationPermission() + ", batteryOptimized=" + !isIgnoringBatteryOptimizations());
        JSObject result = new JSObject();
        result.put("running", running);
        result.put("batteryOptimized", !isIgnoringBatteryOptimizations());
        result.put("backgroundLocationGranted", hasBackgroundLocationPermission());
        call.resolve(result);
    }

    @PluginMethod
    public void openAppLocationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);

            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("No fue posible abrir la configuracion de la aplicacion.", exception);
        }
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || isIgnoringBatteryOptimizations()) {
            JSObject result = new JSObject();
            result.put("batteryOptimized", false);
            call.resolve(result);
            return;
        }

        try {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);

            JSObject result = new JSObject();
            result.put("batteryOptimized", true);
            call.resolve(result);
        } catch (Exception exception) {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);

            JSObject result = new JSObject();
            result.put("batteryOptimized", true);
            call.resolve(result);
        }
    }

    private boolean hasLocationPermission() {
        boolean fine = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean coarse = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        return fine || coarse;
    }

    private Long getLongValue(PluginCall call, String key) {
        Object value = call.getData().opt(key);
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }

        if (value instanceof String) {
            try {
                return Long.parseLong(((String) value).trim());
            } catch (NumberFormatException exception) {
                Log.w(LOG_TAG, "No fue posible convertir " + key + " a Long. value=" + value);
                return null;
            }
        }

        return null;
    }

    private Integer getIntValue(PluginCall call, String key) {
        Object value = call.getData().opt(key);
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }

        if (value instanceof String) {
            try {
                return Integer.parseInt(((String) value).trim());
            } catch (NumberFormatException exception) {
                Log.w(LOG_TAG, "No fue posible convertir " + key + " a Integer. value=" + value);
                return null;
            }
        }

        return null;
    }

    private boolean hasBackgroundLocationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return true;
        }

        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private boolean isIgnoringBatteryOptimizations() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return true;
        }

        PowerManager powerManager = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
        return powerManager != null && powerManager.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }
}

package mx.com.seclife.schoolmaster;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;

public class SeclifeBackgroundLocationService extends Service implements LocationListener {
    public static final String ACTION_START = "mx.com.seclife.schoolmaster.backgroundlocation.START";
    public static final String ACTION_STOP = "mx.com.seclife.schoolmaster.backgroundlocation.STOP";

    private static final String CHANNEL_ID = "seclife_transporte_gps";
    private static final String LOG_TAG = "SeclifeGps";
    private static final int NOTIFICATION_ID = 3142;
    private static final long DEFAULT_INTERVAL_MS = 5000L;
    private static final float MAX_ACCEPTED_ACCURACY_METERS = 35f;
    private static final long MAX_LOCATION_AGE_MS = 60000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private LocationManager locationManager;
    private String apiUrl;
    private String token;
    private long idrecorrido;
    private int idruta;
    private int idunidad;
    private String origen;
    private long intervalMs = DEFAULT_INTERVAL_MS;
    private long lastSentAt = 0L;
    private PowerManager.WakeLock wakeLock;

    private final Runnable tickRunnable = new Runnable() {
        @Override
        public void run() {
            Log.d(LOG_TAG, "tick activo. idrecorrido=" + idrecorrido + ", intervaloMs=" + intervalMs);
            sendLastKnownLocation();
            handler.postDelayed(this, intervalMs);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if (ACTION_STOP.equals(action)) {
            stopTracking();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent != null) {
            apiUrl = intent.getStringExtra("apiUrl");
            token = intent.getStringExtra("token");
            idrecorrido = intent.getLongExtra("idrecorrido", 0L);
            idruta = intent.getIntExtra("idruta", 0);
            idunidad = intent.getIntExtra("idunidad", 0);
            origen = intent.getStringExtra("origen");
            intervalMs = Math.max(5000L, intent.getLongExtra("intervalMs", DEFAULT_INTERVAL_MS));
        }

        startForeground(NOTIFICATION_ID, buildNotification());
        Log.i(LOG_TAG, "Servicio GPS en segundo plano iniciado. idrecorrido=" + idrecorrido + ", intervaloMs=" + intervalMs);
        startTracking();
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        Log.w(LOG_TAG, "Servicio GPS destruido por Android o por cierre explicito.");
        stopTracking();
        super.onDestroy();
    }

    @Override
    public void onLocationChanged(Location location) {
        Log.d(LOG_TAG, "onLocationChanged provider=" + location.getProvider()
            + ", accuracy=" + (location.hasAccuracy() ? location.getAccuracy() : -1)
            + ", ageMs=" + Math.max(0L, System.currentTimeMillis() - location.getTime()));
        sendLocation(location);
    }

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {
        // No-op.
    }

    @Override
    public void onProviderEnabled(String provider) {
        // No-op.
    }

    @Override
    public void onProviderDisabled(String provider) {
        // No-op.
    }

    private void startTracking() {
        if (!hasLocationPermission() || locationManager == null || !isConfigured()) {
            Log.w(LOG_TAG, "No se inicio tracking. permisos=" + hasLocationPermission() + ", configurado=" + isConfigured());
            return;
        }

        try {
            acquireWakeLock();
            locationManager.removeUpdates(this);

            if (locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, intervalMs, 0f, this, Looper.getMainLooper());
            }

            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, intervalMs, 0f, this, Looper.getMainLooper());
            }

            sendLastKnownLocation();
            handler.removeCallbacks(tickRunnable);
            handler.postDelayed(tickRunnable, intervalMs);
        } catch (SecurityException ignored) {
            // Permission was revoked while the service was active.
            Log.w(LOG_TAG, "Permiso de ubicacion revocado durante el servicio.", ignored);
        }
    }

    private void stopTracking() {
        handler.removeCallbacks(tickRunnable);
        if (locationManager != null) {
            try {
                locationManager.removeUpdates(this);
            } catch (SecurityException ignored) {
                // Permission was revoked while the service was active.
                Log.w(LOG_TAG, "Permiso de ubicacion revocado al detener servicio.", ignored);
            }
        }
        releaseWakeLock();
        Log.i(LOG_TAG, "Servicio GPS en segundo plano detenido.");
        stopForeground(true);
    }

    private void sendLastKnownLocation() {
        if (!hasLocationPermission() || locationManager == null || !isConfigured()) {
            return;
        }

        try {
            Location best = null;
            Location gps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
            Location network = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);

            best = resolveBestLocation(gps, network);

            if (best != null) {
                sendLocation(best);
            } else {
                Log.d(LOG_TAG, "Sin ultima ubicacion valida disponible.");
            }
        } catch (SecurityException ignored) {
            // Permission was revoked while the service was active.
            Log.w(LOG_TAG, "Permiso de ubicacion revocado al consultar ultima ubicacion.", ignored);
        }
    }

    private void sendLocation(Location location) {
        if (location == null || !isConfigured()) {
            return;
        }

        long ageMs = Math.max(0L, System.currentTimeMillis() - location.getTime());
        if (ageMs > MAX_LOCATION_AGE_MS) {
            Log.d(LOG_TAG, "Ubicacion descartada por antiguedad. provider=" + location.getProvider() + ", ageMs=" + ageMs);
            return;
        }

        if (location.hasAccuracy() && location.getAccuracy() > MAX_ACCEPTED_ACCURACY_METERS) {
            Log.d(LOG_TAG, "Ubicacion descartada por precision baja. provider=" + location.getProvider() + ", accuracy=" + location.getAccuracy());
            return;
        }

        long now = System.currentTimeMillis();
        if (now - lastSentAt < Math.max(4000L, intervalMs - 1000L)) {
            return;
        }

        lastSentAt = now;
        final double latitud = location.getLatitude();
        final double longitud = location.getLongitude();
        final Float precisionMetros = location.hasAccuracy() ? location.getAccuracy() : null;
        final String fechaHora = formatMexicoDateTime(new Date(now));

        new Thread(() -> postGps(latitud, longitud, precisionMetros, fechaHora)).start();
    }

    private void postGps(double latitud, double longitud, Float precisionMetros, String fechaHora) {
        HttpURLConnection connection = null;

        try {
            String endpoint = apiUrl.replaceAll("/+$", "") + "/transporte-escolar/gps";
            URL url = new URL(endpoint);
            connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(15000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");

            if (token != null && !token.trim().isEmpty()) {
                connection.setRequestProperty("Authorization", "Bearer " + token);
            }

            JSONObject payload = new JSONObject();
            payload.put("clientEventId", UUID.randomUUID().toString());
            payload.put("idrecorrido", idrecorrido);
            payload.put("idruta", idruta);
            payload.put("idunidad", idunidad);
            payload.put("fechaHora", fechaHora);
            payload.put("latitud", latitud);
            payload.put("longitud", longitud);
            if (precisionMetros != null) {
                payload.put("precisionMetros", precisionMetros);
            }
            payload.put("origen", origen == null || origen.trim().isEmpty() ? "APP_CONDUCTOR_BACKGROUND" : origen);

            byte[] body = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream outputStream = connection.getOutputStream()) {
                outputStream.write(body);
            }

            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) {
                // Keep service alive. Next tick will retry with a fresh position.
                Log.w(LOG_TAG, "GPS enviado con respuesta no exitosa. code=" + responseCode + ", body=" + readResponseBody(connection));
            } else {
                Log.i(LOG_TAG, "GPS enviado correctamente. idrecorrido=" + idrecorrido + ", lat=" + latitud + ", lng=" + longitud + ", accuracy=" + precisionMetros);
            }
        } catch (Exception exception) {
            // Keep service alive. Next tick will retry.
            Log.e(LOG_TAG, "No fue posible enviar GPS en segundo plano.", exception);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private boolean isConfigured() {
        return apiUrl != null && !apiUrl.trim().isEmpty()
            && idrecorrido > 0
            && idruta > 0
            && idunidad > 0;
    }

    private String readResponseBody(HttpURLConnection connection) {
        InputStream stream = null;

        try {
            stream = connection.getErrorStream();
            if (stream == null) {
                stream = connection.getInputStream();
            }

            if (stream == null) {
                return "";
            }

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] chunk = new byte[1024];
            int read;
            while ((read = stream.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
            }

            return buffer.toString(StandardCharsets.UTF_8.name());
        } catch (Exception exception) {
            return "No fue posible leer respuesta: " + exception.getMessage();
        } finally {
            if (stream != null) {
                try {
                    stream.close();
                } catch (Exception ignored) {
                    // No-op.
                }
            }
        }
    }

    private Location resolveBestLocation(Location first, Location second) {
        if (isBetterLocation(first, second)) {
            return first;
        }

        return second;
    }

    private boolean isBetterLocation(Location candidate, Location currentBest) {
        if (candidate == null) {
            return false;
        }

        if (currentBest == null) {
            return true;
        }

        boolean candidateHasAccuracy = candidate.hasAccuracy();
        boolean currentHasAccuracy = currentBest.hasAccuracy();

        if (candidateHasAccuracy && currentHasAccuracy) {
            float accuracyDiff = candidate.getAccuracy() - currentBest.getAccuracy();
            if (Math.abs(accuracyDiff) > 5f) {
                return accuracyDiff < 0f;
            }
        } else if (candidateHasAccuracy != currentHasAccuracy) {
            return candidateHasAccuracy;
        }

        return candidate.getTime() > currentBest.getTime();
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            return;
        }

        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager == null) {
            return;
        }

        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Seclife:TransporteGps");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire();
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        wakeLock = null;
    }

    private Notification buildNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Seclife Transporte Escolar")
            .setContentText("Compartiendo ubicacion durante el recorrido escolar.")
            .setSmallIcon(getApplicationInfo().icon)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "GPS Transporte Escolar",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Ubicacion en segundo plano durante recorridos escolares.");

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private String formatMexicoDateTime(Date date) {
        SimpleDateFormat formatter = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
        formatter.setTimeZone(TimeZone.getTimeZone("America/Mexico_City"));
        return formatter.format(date);
    }
}

package mx.com.seclife.schoolmaster;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

@CapacitorPlugin(name = "SeclifePlacaOcr")
public class SeclifePlacaOcrPlugin extends Plugin {
    @PluginMethod
    public void recognize(PluginCall call) {
        String encoded = call.getString("base64");
        if (encoded == null || encoded.length() > 8000000) {
            call.reject("Imagen no valida.");
            return;
        }
        try {
            byte[] data = Base64.decode(encoded, Base64.DEFAULT);
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || (long) bounds.outWidth * bounds.outHeight > 6000000) {
                call.reject("Imagen demasiado grande o no valida.");
                return;
            }
            Bitmap bitmap = BitmapFactory.decodeByteArray(data, 0, data.length);
            if (bitmap == null) { call.reject("No fue posible leer la imagen."); return; }
            TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            // Camera entrega el JPEG ya orientado y reducido.
            recognizer.process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener(result -> {
                    JSArray lines = new JSArray();
                    for (Text.TextBlock block : result.getTextBlocks()) {
                        for (Text.Line line : block.getLines()) {
                            if (lines.length() < 100) lines.put(line.getText());
                        }
                    }
                    JSObject response = new JSObject();
                    response.put("lines", lines);
                    call.resolve(response);
                })
                .addOnFailureListener(error -> call.reject("No fue posible reconocer la placa."))
                .addOnCompleteListener(task -> { recognizer.close(); bitmap.recycle(); });
        } catch (Exception error) {
            call.reject("No fue posible procesar la fotografia.");
        }
    }
}

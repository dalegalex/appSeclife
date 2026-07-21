package mx.com.seclife.schoolmaster;

import android.speech.tts.TextToSpeech;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Locale;

@CapacitorPlugin(name = "SeclifeTextToSpeech")
public class SeclifeTextToSpeechPlugin extends Plugin {
    private TextToSpeech textToSpeech;
    private boolean ready = false;

    @Override
    public void load() {
        textToSpeech = new TextToSpeech(getContext(), status -> {
            ready = status == TextToSpeech.SUCCESS;
            if (ready) {
                int languageResult = textToSpeech.setLanguage(new Locale("es", "MX"));
                if (languageResult == TextToSpeech.LANG_MISSING_DATA || languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                    textToSpeech.setLanguage(new Locale("es", "ES"));
                }
                textToSpeech.setSpeechRate(0.96f);
                textToSpeech.setPitch(1.0f);
            }
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null || text.trim().isEmpty()) {
            call.reject("Texto vacio.");
            return;
        }

        if (textToSpeech == null || !ready) {
            call.reject("TextToSpeech no esta listo.");
            return;
        }

        textToSpeech.stop();
        int result = textToSpeech.speak(text, TextToSpeech.QUEUE_FLUSH, null, "seclife-tts");
        if (result == TextToSpeech.SUCCESS) {
            JSObject response = new JSObject();
            response.put("spoken", true);
            call.resolve(response);
        } else {
            call.reject("No fue posible emitir voz.");
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (textToSpeech != null) {
            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }
    }
}

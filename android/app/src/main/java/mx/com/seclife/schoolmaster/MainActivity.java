package mx.com.seclife.schoolmaster;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SeclifeTextToSpeechPlugin.class);
        registerPlugin(SeclifeBackgroundLocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

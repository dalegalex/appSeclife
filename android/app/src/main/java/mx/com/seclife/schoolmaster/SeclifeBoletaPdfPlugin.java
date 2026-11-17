package mx.com.seclife.schoolmaster;

import android.content.Context;
import android.os.CancellationSignal;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="SeclifeBoletaPdf")
public class SeclifeBoletaPdfPlugin extends Plugin {
    private WebView pending;
    @PluginMethod public void create(PluginCall call) {
        String html=call.getString("html");
        if(html==null || html.length()>4000000){call.reject("Boleta invalida.");return;}
        getActivity().runOnUiThread(()->{
            if(pending!=null){call.reject("Cierra la impresion anterior.");return;}
            WebView view=new WebView(getContext());pending=view;
            view.getSettings().setJavaScriptEnabled(false);
            view.getSettings().setAllowFileAccess(false);
            view.getSettings().setAllowContentAccess(false);
            view.getSettings().setBlockNetworkLoads(true);
            view.setWebViewClient(new WebViewClient(){
                private boolean started;
                @Override public void onPageFinished(WebView web,String url){
                    if(started)return;started=true;
                    PrintDocumentAdapter source=web.createPrintDocumentAdapter("Boleta");
                    PrintDocumentAdapter adapter=new PrintDocumentAdapter(){
                        @Override public void onStart(){source.onStart();}
                        @Override public void onLayout(PrintAttributes old,PrintAttributes next,CancellationSignal signal,LayoutResultCallback callback,Bundle extras){source.onLayout(old,next,signal,callback,extras);}
                        @Override public void onWrite(PageRange[] pages,ParcelFileDescriptor target,CancellationSignal signal,WriteResultCallback callback){source.onWrite(pages,target,signal,callback);}
                        @Override public void onFinish(){source.onFinish();web.destroy();pending=null;}
                    };
                    PrintAttributes attrs=new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape()).setMinMargins(PrintAttributes.Margins.NO_MARGINS).build();
                    try{
                        PrintManager manager=(PrintManager)getActivity().getSystemService(Context.PRINT_SERVICE);
                        manager.print("Boleta de calificaciones",adapter,attrs);
                        JSObject result=new JSObject();result.put("systemPrint",true);call.resolve(result);
                    }catch(Exception e){web.destroy();pending=null;call.reject("No fue posible abrir Guardar como PDF.");}
                }
            });
            view.loadDataWithBaseURL(null,html,"text/html","UTF-8",null);
        });
    }
}

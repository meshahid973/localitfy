package com.meshahid973.localitfy;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocaltifyNativePlugin.class);
        super.onCreate(savedInstanceState);
        final LocalMediaHandler media = new LocalMediaHandler(getFilesDir());
        // Capacitor's own file server ignores the start of Range requests, which breaks seeking.
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse response = media.handle(request);
                return response != null ? response : super.shouldInterceptRequest(view, request);
            }
        });
        // The back gesture steps back through the app's pages; the page itself decides when to leave.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                bridge.triggerWindowJSEvent("localtifyback");
            }
        });
    }
}

package org.changes.centuripe;

import android.annotation.SuppressLint;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebViewAssetLoader;

/**
 * La postazione del museo: una sola finestra, a schermo intero, che mostra
 * l'archivio contenuto nell'applicazione stessa.
 *
 * I file del sito stanno dentro il pacchetto, in "assets/sito". Non vengono
 * aperti come file (i browser lo vietano, ed e' il motivo per cui altrove
 * serviva un piccolo server): li serve WebViewAssetLoader, che li presenta
 * alla pagina come se arrivassero da un indirizzo normale. Tutto resta
 * dentro il dispositivo: l'applicazione non chiede nemmeno il permesso di
 * usare la rete.
 */
public class MainActivity extends AppCompatActivity {

    private WebView vista;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle stato) {
        super.onCreate(stato);

        // lo schermo non si spegne mentre la sala e' aperta
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        final WebViewAssetLoader caricatore = new WebViewAssetLoader.Builder()
                .setDomain("epigrafi.centuripe")
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        vista = new WebView(this);
        WebSettings s = vista.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // il tema scelto resta memorizzato
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        /* Senza queste tre righe il WebView impagina come se lo schermo fosse
           largo 980 punti e ignora le misure dichiarate dalla pagina: di qui
           lo spazio vuoto a destra e la barra dei comandi che sborda. */
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        // e con questa la pagina non segue l'ingrandimento del testo di
        // sistema, che su un tablet impostato "grande" sfonda le barre
        s.setTextZoom(100);
        vista.setOverScrollMode(View.OVER_SCROLL_NEVER);
        vista.setBackgroundColor(0xFFF5F4F2);

        vista.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest richiesta) {
                WebResourceResponse risposta = caricatore.shouldInterceptRequest(richiesta.getUrl());
                if (risposta != null) return risposta;
                // Niente esce mai su internet: quello che non sta nel pacchetto
                // riceve un "non trovato" da qui, non una richiesta in rete.
                return new WebResourceResponse("text/plain", "utf-8",
                        new ByteArrayInputStream(("non trovato: " + richiesta.getUrl())
                                .getBytes(StandardCharsets.UTF_8)));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest richiesta) {
                // niente esce da qui: la postazione non naviga altrove
                String host = richiesta.getUrl().getHost();
                return host == null || !host.equals("epigrafi.centuripe");
            }
        });

        setContentView(vista);
        vista.loadUrl("https://epigrafi.centuripe/assets/sito/index.html");
    }

    /** Schermo intero vero: niente barra di stato, niente barra dei pulsanti. */
    @Override
    public void onWindowFocusChanged(boolean haFuoco) {
        super.onWindowFocusChanged(haFuoco);
        if (!haFuoco) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    /** Il tasto indietro torna indietro nella pagina, non chiude la postazione. */
    @Override
    public void onBackPressed() {
        if (vista != null && vista.canGoBack()) {
            vista.goBack();
        }
        // in fondo alla cronologia non si esce: la postazione resta aperta
    }

    @Override
    protected void onDestroy() {
        if (vista != null) {
            vista.destroy();
            vista = null;
        }
        super.onDestroy();
    }
}

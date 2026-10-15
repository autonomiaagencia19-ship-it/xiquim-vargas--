package br.com.xiquimvargas.tower

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.*
import android.widget.*

class MainActivity : Activity() {

    private val targetPath = "/admin.html"
    private val appTitle = "Xiquim Vargas\nTorre de Controle"
    private val appSubtitle = "Painel executivo, catálogo, auditoria, estoque inteligente e governança com IA."

    private var currentWebView: WebView? = null
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_REQ = 1001
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Api.init(this)

        registerNetworkMonitor()

        val url = Api.getBaseUrl()
        if (Api.isConfigured() && isValidUrl(url)) {
            launchWebView(url)
        } else {
            configScreen()
        }
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return true
        val net = cm.activeNetwork ?: return false
        val cap = cm.getNetworkCapabilities(net) ?: return false
        return cap.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun registerNetworkMonitor() {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        val builder = NetworkRequest.Builder().addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread {
                    currentWebView?.settings?.cacheMode = WebSettings.LOAD_DEFAULT
                    currentWebView?.evaluateJavascript(
                        "window.dispatchEvent(new Event('online')); if(typeof Realtime!=='undefined') Realtime.connectStream();",
                        null
                    )
                }
            }

            override fun onLost(network: Network) {
                runOnUiThread {
                    currentWebView?.settings?.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
                    currentWebView?.evaluateJavascript("window.dispatchEvent(new Event('offline'));", null)
                }
            }
        }
        try {
            cm.registerNetworkCallback(builder.build(), networkCallback!!)
        } catch (_: Exception) {}
    }

    override fun onDestroy() {
        super.onDestroy()
        networkCallback?.let {
            val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            try { cm?.unregisterNetworkCallback(it) } catch (_: Exception) {}
        }
    }

    private fun isValidUrl(value: String): Boolean {
        if (value.isBlank()) return false
        val clean = value.trim().trimEnd('/')
        return clean.startsWith("https://") ||
                clean.startsWith("http://10.0.2.2") ||
                clean.startsWith("http://localhost") ||
                clean.startsWith("http://127.0.0.1") ||
                clean.startsWith("http://192.168.") ||
                clean.startsWith("http://10.") ||
                clean.startsWith("http://172.")
    }

    private fun configScreen() {
        currentWebView = null
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 60, 40, 40)
            setBackgroundColor(Color.rgb(7, 12, 24))
            layoutParams = ViewGroup.LayoutParams(-1, -1)
        }

        val scroll = ScrollView(this).apply { addView(box) }
        setContentView(scroll)

        val title = TextView(this).apply {
            text = appTitle
            textSize = 26f
            setTextColor(Color.WHITE)
            setPadding(0, 0, 0, 16)
        }
        box.addView(title)

        val subtitle = TextView(this).apply {
            text = appSubtitle
            textSize = 15f
            setTextColor(Color.LTGRAY)
            setPadding(0, 0, 0, 36)
        }
        box.addView(subtitle)

        val label = TextView(this).apply {
            text = "URL DO SERVIDOR ERP:"
            textSize = 12f
            setTextColor(Color.rgb(253, 94, 2))
            setPadding(0, 0, 0, 8)
        }
        box.addView(label)

        val input = EditText(this).apply {
            hint = "https://seu-erp.onrender.com"
            setHintTextColor(Color.DKGRAY)
            setTextColor(Color.WHITE)
            if (Api.isConfigured()) {
                setText(Api.getBaseUrl())
            }
            isSingleLine = true
            setPadding(30, 30, 30, 30)
            setBackgroundColor(Color.rgb(20, 29, 44))
        }
        box.addView(input)

        val save = Button(this).apply {
            text = "Conectar e Acessar"
            setBackgroundColor(Color.rgb(253, 94, 2))
            setTextColor(Color.WHITE)
            val lp = LinearLayout.LayoutParams(-1, -2)
            lp.topMargin = 36
            layoutParams = lp
        }
        box.addView(save)

        save.setOnClickListener {
            val value = input.text.toString().trim().trimEnd('/')
            if (!isValidUrl(value)) {
                Toast.makeText(this, "Informe uma URL válida do ERP (HTTPS ou rede local).", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            Api.setBaseUrl(this, value)
            Toast.makeText(this, "Configuração salva.", Toast.LENGTH_SHORT).show()
            launchWebView(value)
        }
    }

    private fun showOfflineScreen(targetUrl: String) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 60, 40, 40)
            setBackgroundColor(Color.rgb(7, 12, 24))
            layoutParams = ViewGroup.LayoutParams(-1, -1)
        }
        val scroll = ScrollView(this).apply { addView(box) }
        setContentView(scroll)

        val title = TextView(this).apply {
            text = appTitle
            textSize = 24f
            setTextColor(Color.WHITE)
            setPadding(0, 0, 0, 16)
        }
        box.addView(title)

        val status = TextView(this).apply {
            text = "Aguardando conexão com o servidor\n\nConecte-se à internet para sincronizar e navegar na Torre de Controle."
            textSize = 15f
            setTextColor(Color.LTGRAY)
            setPadding(0, 0, 0, 36)
        }
        box.addView(status)

        val retryBtn = Button(this).apply {
            text = "🔄 Tentar Reconectar"
            setBackgroundColor(Color.rgb(253, 94, 2))
            setTextColor(Color.WHITE)
            val lp = LinearLayout.LayoutParams(-1, -2)
            lp.bottomMargin = 20
            layoutParams = lp
        }
        box.addView(retryBtn)
        retryBtn.setOnClickListener {
            launchWebView(Api.getBaseUrl())
        }

        val configBtn = Button(this).apply {
            text = "⚙ Configurar URL do Servidor"
            setBackgroundColor(Color.rgb(30, 41, 59))
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(-1, -2)
        }
        box.addView(configBtn)
        configBtn.setOnClickListener {
            configScreen()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun launchWebView(baseUrl: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                ServiceWorkerController.getInstance().setServiceWorkerClient(object : ServiceWorkerClient() {
                    override fun shouldInterceptRequest(request: WebResourceRequest): WebResourceResponse? = null
                })
            } catch (_: Exception) {}
        }

        val webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                mediaPlaybackRequiresUserGesture = false
                cacheMode = if (isOnline()) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_CACHE_ELSE_NETWORK
            }

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val uri = request?.url ?: return false
                    val scheme = uri.scheme ?: ""
                    if (scheme == "tel" || scheme == "mailto") {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, uri))
                            return true
                        } catch (_: Exception) {}
                    }
                    return false
                }

                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    super.onReceivedError(view, request, error)
                    if (request?.isForMainFrame == true && !isOnline()) {
                        showOfflineScreen(view?.url ?: (baseUrl + targetPath))
                    }
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    wv: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = filePathCallback

                    val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                    try {
                        startActivityForResult(intent, FILE_CHOOSER_REQ)
                    } catch (_: Exception) {
                        fileUploadCallback?.onReceiveValue(null)
                        fileUploadCallback = null
                        return false
                    }
                    return true
                }
            }

            loadUrl(baseUrl + targetPath)
        }
        currentWebView = webView
        setContentView(webView)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQ) {
            val result = if (resultCode == RESULT_OK && data != null) {
                val clip = data.clipData
                if (clip != null && clip.itemCount > 0) {
                    Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                } else {
                    data.data?.let { arrayOf(it) }
                }
            } else null
            fileUploadCallback?.onReceiveValue(result)
            fileUploadCallback = null
        }
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK && currentWebView?.canGoBack() == true) {
            currentWebView?.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }
}

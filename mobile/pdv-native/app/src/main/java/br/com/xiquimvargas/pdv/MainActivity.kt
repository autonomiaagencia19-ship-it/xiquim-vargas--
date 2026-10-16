package br.com.xiquimvargas.pdv

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
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.*
import android.widget.*
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class MainActivity : Activity() {

    private val targetPath = "/pdv.html"
    private val appTitle = "Xiquim Vargas\nFrente de Loja / PDV"
    private val appSubtitle = "Emissão ágil de cupons, bipagem de código de barras e vendas em contingência 100% offline."

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

    private var lastKnownOnline: Boolean? = null

    private fun registerNetworkMonitor() {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                runOnUiThread { checkAndDispatchNetwork(true) }
            }

            override fun onLost(network: Network) {
                runOnUiThread { checkAndDispatchNetwork(false) }
            }

            override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
                val hasInternet = networkCapabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                runOnUiThread { checkAndDispatchNetwork(hasInternet) }
            }
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                cm.registerDefaultNetworkCallback(networkCallback!!)
            } else {
                val builder = NetworkRequest.Builder().addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                cm.registerNetworkCallback(builder.build(), networkCallback!!)
            }
        } catch (_: Exception) {}
    }

    private fun checkAndDispatchNetwork(hintOnline: Boolean) {
        val current = isOnline()
        if (lastKnownOnline != null && lastKnownOnline == current) return
        lastKnownOnline = current

        if (current) {
            currentWebView?.settings?.cacheMode = WebSettings.LOAD_DEFAULT
            currentWebView?.evaluateJavascript(
                "window.dispatchEvent(new Event('online')); if(typeof syncOfflineQueue==='function') syncOfflineQueue();",
                null
            )
        } else {
            currentWebView?.settings?.cacheMode = WebSettings.LOAD_CACHE_ELSE_NETWORK
            currentWebView?.evaluateJavascript("window.dispatchEvent(new Event('offline'));", null)
        }
    }

    override fun onPause() {
        super.onPause()
        try {
            CookieManager.getInstance().flush()
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

    private fun testServerReachability(rawUrl: String, onResult: (Boolean, String?) -> Unit) {
        thread {
            var conn: HttpURLConnection? = null
            try {
                val clean = rawUrl.trim().trimEnd('/')
                val urlObj = URL(clean)
                conn = (urlObj.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 4000
                    readTimeout = 4000
                    instanceFollowRedirects = true
                    requestMethod = "GET"
                    setRequestProperty("User-Agent", "XiquimVargasMobileApp/1.8.2")
                }
                val code = conn.responseCode
                if (code in 200..499) {
                    runOnUiThread { onResult(true, null) }
                } else {
                    runOnUiThread { onResult(false, "Servidor retornou HTTP $code") }
                }
            } catch (e: Exception) {
                val msg = when {
                    e.javaClass.simpleName.contains("UnknownHost") -> "Endereço não encontrado (domínio inexistente ou erro de digitação)."
                    e.javaClass.simpleName.contains("SocketTimeout") || e.javaClass.simpleName.contains("Timeout") -> "Tempo limite esgotado (>4s sem resposta do servidor)."
                    e.javaClass.simpleName.contains("Connect") -> "Conexão recusada (o servidor está desligado ou a porta está incorreta)."
                    e.javaClass.simpleName.contains("SSL") -> "Erro de certificado SSL/HTTPS."
                    else -> e.localizedMessage ?: "Falha ao conectar no endereço informado."
                }
                runOnUiThread { onResult(false, msg) }
            } finally {
                try { conn?.disconnect() } catch (_: Exception) {}
            }
        }
    }

    private fun configScreen(initialError: String? = null) {
        currentWebView = null
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 50, 40, 40)
            setBackgroundColor(Color.rgb(7, 12, 24))
            layoutParams = ViewGroup.LayoutParams(-1, -1)
        }

        val scroll = ScrollView(this).apply { addView(box) }
        setContentView(scroll)

        val logoResId = resources.getIdentifier("logo_transparent", "drawable", packageName)
        if (logoResId != 0) {
            val logo = ImageView(this).apply {
                setImageResource(logoResId)
                adjustViewBounds = true
                val h = (90 * resources.displayMetrics.density).toInt()
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, h).apply {
                    gravity = Gravity.CENTER_HORIZONTAL
                    bottomMargin = 24
                }
            }
            box.addView(logo)
        }

        val title = TextView(this).apply {
            text = appTitle
            textSize = 24f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, 0, 0, 10)
        }
        box.addView(title)

        val subtitle = TextView(this).apply {
            text = appSubtitle
            textSize = 14f
            setTextColor(Color.LTGRAY)
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, 0, 0, 30)
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

        val statusBox = TextView(this).apply {
            textSize = 13f
            setPadding(20, 20, 20, 20)
            visibility = if (initialError != null) View.VISIBLE else View.GONE
            if (initialError != null) {
                text = "⚠️ $initialError"
                setTextColor(Color.rgb(255, 120, 120))
                setBackgroundColor(Color.rgb(40, 15, 20))
            }
            val lp = LinearLayout.LayoutParams(-1, -2).apply {
                topMargin = 20
            }
            layoutParams = lp
        }
        box.addView(statusBox)

        val progress = ProgressBar(this).apply {
            visibility = View.GONE
            val lp = LinearLayout.LayoutParams(-2, -2).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                topMargin = 20
            }
            layoutParams = lp
        }
        box.addView(progress)

        val save = Button(this).apply {
            text = "Conectar e Acessar"
            setBackgroundColor(Color.rgb(253, 94, 2))
            setTextColor(Color.WHITE)
            val lp = LinearLayout.LayoutParams(-1, -2).apply {
                topMargin = 26
            }
            layoutParams = lp
        }
        box.addView(save)

        val forceBtn = Button(this).apply {
            text = "Avançar Mesmo Assim"
            setBackgroundColor(Color.rgb(30, 41, 59))
            setTextColor(Color.LTGRAY)
            visibility = View.GONE
            val lp = LinearLayout.LayoutParams(-1, -2).apply {
                topMargin = 16
            }
            layoutParams = lp
        }
        box.addView(forceBtn)

        save.setOnClickListener {
            val value = input.text.toString().trim().trimEnd('/')
            if (!isValidUrl(value)) {
                Toast.makeText(this, "Informe uma URL válida do ERP (HTTPS ou rede local).", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }

            save.isEnabled = false
            save.text = "Verificando Servidor..."
            progress.visibility = View.VISIBLE
            statusBox.visibility = View.VISIBLE
            statusBox.text = "⏳ Testando conexão com o servidor ERP..."
            statusBox.setTextColor(Color.rgb(253, 180, 50))
            statusBox.setBackgroundColor(Color.rgb(35, 30, 15))
            forceBtn.visibility = View.GONE

            testServerReachability(value) { success, errorMsg ->
                save.isEnabled = true
                save.text = "Conectar e Acessar"
                progress.visibility = View.GONE

                if (success) {
                    Api.setBaseUrl(this, value)
                    Toast.makeText(this, "Conexão confirmada com sucesso!", Toast.LENGTH_SHORT).show()
                    launchWebView(value)
                } else {
                    statusBox.visibility = View.VISIBLE
                    statusBox.text = "❌ Falha ao conectar no endereço:\n${errorMsg ?: "Sem resposta"}\n\nCorrija a URL acima e tente novamente."
                    statusBox.setTextColor(Color.rgb(255, 120, 120))
                    statusBox.setBackgroundColor(Color.rgb(45, 15, 20))
                    forceBtn.visibility = View.VISIBLE
                }
            }
        }

        forceBtn.setOnClickListener {
            val value = input.text.toString().trim().trimEnd('/')
            Api.setBaseUrl(this, value)
            launchWebView(value)
        }
    }

    private fun showOfflineScreen(targetUrl: String, errorDetail: String? = null) {
        currentWebView = null
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 50, 40, 40)
            setBackgroundColor(Color.rgb(7, 12, 24))
            layoutParams = ViewGroup.LayoutParams(-1, -1)
        }
        val scroll = ScrollView(this).apply { addView(box) }
        setContentView(scroll)

        val logoResId = resources.getIdentifier("logo_transparent", "drawable", packageName)
        if (logoResId != 0) {
            val logo = ImageView(this).apply {
                setImageResource(logoResId)
                adjustViewBounds = true
                val h = (80 * resources.displayMetrics.density).toInt()
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, h).apply {
                    gravity = Gravity.CENTER_HORIZONTAL
                    bottomMargin = 20
                }
            }
            box.addView(logo)
        }

        val title = TextView(this).apply {
            text = appTitle
            textSize = 22f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(0, 0, 0, 16)
        }
        box.addView(title)

        val errorCard = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(25, 20, 35))
            setPadding(30, 30, 30, 30)
            val lp = LinearLayout.LayoutParams(-1, -2).apply {
                bottomMargin = 30
            }
            layoutParams = lp
        }

        val errorHeader = TextView(this).apply {
            text = "⚠️ Não foi possível carregar o ERP"
            textSize = 16f
            setTextColor(Color.rgb(253, 94, 2))
            setPadding(0, 0, 0, 10)
        }
        errorCard.addView(errorHeader)

        val errorText = TextView(this).apply {
            text = if (errorDetail != null) {
                "Detalhe: $errorDetail\n\nEndereço: $targetUrl"
            } else {
                "O aplicativo não conseguiu acessar o servidor:\n$targetUrl\n\nVerifique se o servidor está ativo ou se a URL foi alterada."
            }
            textSize = 14f
            setTextColor(Color.LTGRAY)
        }
        errorCard.addView(errorText)
        box.addView(errorCard)

        val retryBtn = Button(this).apply {
            text = "🔄 Tentar Reconectar"
            setBackgroundColor(Color.rgb(253, 94, 2))
            setTextColor(Color.WHITE)
            val lp = LinearLayout.LayoutParams(-1, -2).apply {
                bottomMargin = 16
            }
            layoutParams = lp
        }
        box.addView(retryBtn)
        retryBtn.setOnClickListener {
            launchWebView(Api.getBaseUrl())
        }

        val configBtn = Button(this).apply {
            text = "⚙ Digitar Nova URL do Servidor"
            setBackgroundColor(Color.rgb(30, 41, 59))
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(-1, -2)
        }
        box.addView(configBtn)
        configBtn.setOnClickListener {
            configScreen(errorDetail)
        }
    }

    private fun handleExternalUrl(uri: Uri): Boolean {
        val scheme = uri.scheme?.lowercase() ?: ""
        val host = uri.host?.lowercase() ?: ""
        val path = uri.path?.lowercase() ?: ""

        if (scheme == "tel" || scheme == "mailto" || scheme == "sms" || scheme == "geo" || scheme == "whatsapp") {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
                return true
            } catch (_: Exception) {
                return false
            }
        }

        if (host == "wa.me" || host.contains("whatsapp.com")) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, uri)
                intent.setPackage("com.whatsapp")
                startActivity(intent)
                return true
            } catch (_: Exception) {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                } catch (_: Exception) {
                    return false
                }
            }
        }

        if (host.contains("maps.google") || (host.contains("google.com") && path.contains("/maps")) || host.contains("waze.com")) {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
                return true
            } catch (_: Exception) {
                return false
            }
        }

        if (path.endsWith(".pdf") || uri.getQueryParameter("format") == "pdf" || uri.getQueryParameter("export") == "pdf") {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
                return true
            } catch (_: Exception) {
                return false
            }
        }

        return false
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
                javaScriptCanOpenWindowsAutomatically = true
                setSupportMultipleWindows(true)
                cacheMode = if (isOnline()) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_CACHE_ELSE_NETWORK
            }

            try {
                val cookieManager = CookieManager.getInstance()
                cookieManager.setAcceptCookie(true)
                cookieManager.setAcceptThirdPartyCookies(this, true)
            } catch (_: Exception) {}

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val uri = request?.url ?: return false
                    return handleExternalUrl(uri)
                }

                @Deprecated("Deprecated in Java")
                override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                    if (url == null) return false
                    return handleExternalUrl(Uri.parse(url))
                }

                override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                    super.onReceivedError(view, request, error)
                    if (request?.isForMainFrame == true) {
                        val desc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            error?.description?.toString() ?: "Falha de conexão"
                        } else "Falha de conexão"
                        showOfflineScreen(view?.url ?: (baseUrl + targetPath), desc)
                    }
                }

                override fun onReceivedHttpError(view: WebView?, request: WebResourceRequest?, errorResponse: WebResourceResponse?) {
                    super.onReceivedHttpError(view, request, errorResponse)
                    val code = errorResponse?.statusCode ?: 200
                    if (request?.isForMainFrame == true && code >= 400) {
                        showOfflineScreen(view?.url ?: (baseUrl + targetPath), "HTTP $code: Página não encontrada ou erro no servidor")
                    }
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
                    callback?.invoke(origin, true, false)
                }

                override fun onCreateWindow(
                    view: WebView?,
                    isDialog: Boolean,
                    isUserGesture: Boolean,
                    resultMsg: android.os.Message?
                ): Boolean {
                    val newWebView = WebView(this@MainActivity)
                    newWebView.webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                            val popupUri = request?.url ?: return false
                            if (handleExternalUrl(popupUri)) {
                                return true
                            }
                            try {
                                startActivity(Intent(Intent.ACTION_VIEW, popupUri))
                            } catch (_: Exception) {}
                            return true
                        }

                        @Deprecated("Deprecated in Java")
                        override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                            if (url == null) return false
                            val popupUri = Uri.parse(url)
                            if (handleExternalUrl(popupUri)) {
                                return true
                            }
                            try {
                                startActivity(Intent(Intent.ACTION_VIEW, popupUri))
                            } catch (_: Exception) {}
                            return true
                        }
                    }
                    val transport = resultMsg?.obj as? WebView.WebViewTransport
                    transport?.webView = newWebView
                    resultMsg?.sendToTarget()
                    return true
                }

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
                    val chooser = Intent.createChooser(intent, "Selecione o arquivo ou foto")
                    try {
                        startActivityForResult(chooser, FILE_CHOOSER_REQ)
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
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (currentWebView?.canGoBack() == true) {
                currentWebView?.goBack()
                return true
            }
            if (currentWebView != null) {
                configScreen()
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }
}

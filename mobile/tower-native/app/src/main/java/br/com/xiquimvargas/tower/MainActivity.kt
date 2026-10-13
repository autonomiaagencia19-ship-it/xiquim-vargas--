package br.com.xiquimvargas.tower

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.KeyEvent
import android.view.ViewGroup
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {

    private lateinit var box: LinearLayout
    private var currentWebView: WebView? = null
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null
    private val FILE_CHOOSER_REQ = 1001

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        Api.init(this)
        
        val url = Api.getBaseUrl()
        if (isValidUrl(url)) {
            launchWebView(url)
        } else {
            configScreen()
        }
    }

    private fun isValidUrl(value: String): Boolean {
        if (value.isBlank()) return false
        val clean = value.trim().trimEnd('/')
        if (clean.startsWith("https://")) return true
        if (clean.startsWith("http://10.0.2.2") || 
            clean.startsWith("http://localhost") || 
            clean.startsWith("http://127.0.0.1") ||
            clean.startsWith("http://192.168.") ||
            clean.startsWith("http://10.") ||
            clean.startsWith("http://172.")) return true
        return false
    }

    private fun configScreen() {
        currentWebView = null
        box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 60, 40, 40)
            setBackgroundColor(Color.rgb(7, 12, 24))
            layoutParams = ViewGroup.LayoutParams(-1, -1)
        }
        
        val scroll = ScrollView(this).apply { addView(box) }
        setContentView(scroll)

        val title = TextView(this).apply { 
            text = "Xiquim Vargas\nTorre de Controle"
            textSize = 26f
            setTextColor(Color.WHITE)
            setPadding(0, 0, 0, 20) 
        }
        box.addView(title)
        
        val subtitle = TextView(this).apply { 
            text = "Informe a URL do seu ERP para acessar o Painel de Gestão e Governança."
            textSize = 15f
            setTextColor(Color.LTGRAY)
            setPadding(0, 0, 0, 40) 
        }
        box.addView(subtitle)

        val input = EditText(this).apply {
            hint = "https://seu-erp.onrender.com"
            setHintTextColor(Color.DKGRAY)
            setTextColor(Color.WHITE)
            setText(Api.getBaseUrl())
            isSingleLine = true
            setPadding(30, 30, 30, 30)
            setBackgroundColor(Color.rgb(20, 29, 44))
        }
        box.addView(input)

        val save = Button(this).apply {
            text = "Acessar Torre de Controle"
            setBackgroundColor(Color.rgb(244, 90, 8)) // Brand orange
            setTextColor(Color.WHITE)
            val lp = LinearLayout.LayoutParams(-1, -2)
            lp.topMargin = 40
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
            Toast.makeText(this, "URL salva com sucesso.", Toast.LENGTH_SHORT).show()
            launchWebView(value)
        }
    }

    private fun launchWebView(baseUrl: String) {
        val webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            
            webViewClient = object : WebViewClient() {
                override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                    super.onReceivedError(view, errorCode, description, failingUrl)
                    Toast.makeText(this@MainActivity, "Erro de conexão: $description", Toast.LENGTH_LONG).show()
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
            
            loadUrl("$baseUrl/admin.html")
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

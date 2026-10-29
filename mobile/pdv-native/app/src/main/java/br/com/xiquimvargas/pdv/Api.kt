package br.com.xiquimvargas.pdv

import android.content.Context

object Api {
    private const val PREFS = "xv_config"
    private const val KEY = "api_base_url"
    @Volatile private var base: String? = null
    @Volatile private var isConfiguredByUser: Boolean = false

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY, null)?.trim()?.trimEnd('/')
        if (!saved.isNullOrBlank() &&
            !saved.contains("10.0.2.2") &&
            !saved.contains("localhost") &&
            !saved.contains("127.0.0.1") &&
            !saved.contains("xiquimvargas.com.br")) {
            base = saved
            isConfiguredByUser = true
        } else {
            val defaultUrl = "https://xiquim-vargas-erp.onrender.com"
            base = defaultUrl
            isConfiguredByUser = true
            prefs.edit().putString(KEY, defaultUrl).apply()
        }
    }

    fun isConfigured(): Boolean = true

    fun getBaseUrl(): String = base ?: "https://xiquim-vargas-erp.onrender.com"

    fun sanitizeUrl(raw: String): String {
        var clean = raw.trim().trimEnd('/')
        val suffixes = listOf(
            "/admin/admin.html", "/admin.html", "/admin",
            "/vendedor/vendedor.html", "/vendedor.html", "/vendedor",
            "/motorista/motorista.html", "/motorista.html", "/motorista",
            "/pdv/pdv.html", "/pdv.html", "/pdv", "/caixa",
            "/loja/loja.html", "/loja.html", "/loja"
        )
        for (suffix in suffixes) {
            if (clean.endsWith(suffix, ignoreCase = true)) {
                clean = clean.substring(0, clean.length - suffix.length).trimEnd('/')
                break
            }
        }
        return clean
    }

    fun setBaseUrl(context: Context, url: String) {
        val clean = sanitizeUrl(url)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, clean).apply()
        base = clean
        isConfiguredByUser = true
    }

    fun clearConfig(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY).apply()
        base = "https://xiquim-vargas-erp.onrender.com"
        isConfiguredByUser = false
    }
}

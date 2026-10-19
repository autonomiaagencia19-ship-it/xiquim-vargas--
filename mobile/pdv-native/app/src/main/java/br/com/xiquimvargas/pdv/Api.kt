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
        if (!saved.isNullOrBlank()) {
            base = saved
            isConfiguredByUser = true
        } else {
            val buildUrl = BuildConfig.API_BASE_URL.trimEnd('/')
            base = buildUrl
            isConfiguredByUser = !buildUrl.contains("10.0.2.2") &&
                    !buildUrl.contains("localhost") &&
                    !buildUrl.contains("127.0.0.1")
        }
    }

    fun isConfigured(): Boolean = isConfiguredByUser

    fun getBaseUrl(): String = base ?: BuildConfig.API_BASE_URL.trimEnd('/')

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
        base = BuildConfig.API_BASE_URL.trimEnd('/')
        isConfiguredByUser = false
    }
}

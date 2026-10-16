package br.com.xiquimvargas.seller

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

    fun setBaseUrl(context: Context, url: String) {
        val clean = url.trim().trimEnd('/')
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

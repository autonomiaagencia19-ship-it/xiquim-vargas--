package br.com.xiquimvargas.tower

import android.content.Context

object Api {
    private const val PREFS = "xv_config"
    private const val KEY = "api_base_url"
    @Volatile private var base: String? = null

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val saved = prefs.getString(KEY, null)?.trim()?.trimEnd('/')
        base = if (!saved.isNullOrBlank()) saved else BuildConfig.API_BASE_URL.trimEnd('/')
    }

    fun getBaseUrl(): String = base ?: BuildConfig.API_BASE_URL.trimEnd('/')

    fun setBaseUrl(context: Context, url: String) {
        val clean = url.trim().trimEnd('/')
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, clean).apply()
        base = clean
    }
}

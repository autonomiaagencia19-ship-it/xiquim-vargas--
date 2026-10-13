package br.com.xiquimvargas.driver

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

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

    fun request(path: String, method: String = "GET", token: String? = null, body: String? = null, extraHeaders: Map<String, String> = emptyMap()): String {
        val connection = URL(getBaseUrl() + path).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 8000
        connection.readTimeout = if (path.endsWith("/proof")) 60_000 else 15_000
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("Content-Type", "application/json")
        token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
        extraHeaders.forEach { (key, value) -> connection.setRequestProperty(key, value) }
        if (body != null) { connection.doOutput = true; connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) } }
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
        connection.disconnect()
        if (code !in 200..299) throw IllegalStateException(runCatching { JSONObject(text).optString("error", "HTTP $code") }.getOrDefault("HTTP $code"))
        return text
    }
}

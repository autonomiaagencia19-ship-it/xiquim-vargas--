package br.com.xiquimvargas.seller

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object Api {
    const val BASE = "http://10.0.2.2:3000"
    fun request(path: String, method: String = "GET", token: String? = null, body: String? = null): String {
        val c = URL(BASE + path).openConnection() as HttpURLConnection
        c.requestMethod = method; c.connectTimeout = 8000; c.readTimeout = 12000
        c.setRequestProperty("Content-Type", "application/json")
        token?.let { c.setRequestProperty("Authorization", "Bearer $it") }
        if (body != null) { c.doOutput = true; c.outputStream.use { it.write(body.toByteArray()) } }
        val stream = if (c.responseCode in 200..299) c.inputStream else c.errorStream
        val text = stream?.bufferedReader()?.readText() ?: ""
        if (c.responseCode !in 200..299) throw IllegalStateException(JSONObject(text).optString("error", "HTTP ${c.responseCode}"))
        return text
    }
}

package br.com.xiquimvargas.driver

import android.content.Context
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class SecureSession(context: Context) {
    private val prefs = context.getSharedPreferences("xv_driver_session_prefs", Context.MODE_PRIVATE)
    private val alias = "xv_driver_session"
    private fun key(): SecretKey {
        val ks = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (ks.getKey(alias, null) as? SecretKey)?.let { return it }
        val gen = KeyGenerator.getInstance("AES", "AndroidKeyStore")
        gen.init(android.security.keystore.KeyGenParameterSpec.Builder(alias, android.security.keystore.KeyProperties.PURPOSE_ENCRYPT or android.security.keystore.KeyProperties.PURPOSE_DECRYPT).setBlockModes(android.security.keystore.KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(android.security.keystore.KeyProperties.ENCRYPTION_PADDING_NONE).build())
        return gen.generateKey()
    }
    fun save(token: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key())
        val blob = cipher.iv + cipher.doFinal(token.toByteArray(StandardCharsets.UTF_8))
        prefs.edit().putString("token", Base64.encodeToString(blob, Base64.NO_WRAP)).apply()
    }
    fun read(): String? {
      return try {
        val raw = prefs.getString("token", null) ?: return null
        val blob = Base64.decode(raw, Base64.NO_WRAP); if (blob.size < 13) return null
        val cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, blob.copyOfRange(0,12)))
        String(cipher.doFinal(blob.copyOfRange(12, blob.size)), StandardCharsets.UTF_8)
      } catch (_: Exception) { null }
    }
    fun clear() { prefs.edit().clear().apply() }
}

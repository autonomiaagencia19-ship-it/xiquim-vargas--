package br.com.xiquimvargas.driver

import android.app.*
import android.graphics.Color
import android.net.Uri
import android.os.*
import android.content.*
import android.util.Base64
import android.view.*
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URLEncoder
import java.util.UUID

class MainActivity : Activity() {
    private lateinit var box: LinearLayout
    private lateinit var db: LocalDb
    private lateinit var session: SecureSession
    private var token: String? = null
    private var offline = false
    private var proofOrder = ""
    private val PICK = 77

    private fun tv(t: String, size: Float = 16f, dark: Boolean = false, bold: Boolean = false) = TextView(this).apply {
        text = t
        textSize = size
        setTextColor(if (dark) Color.rgb(20, 32, 58) else Color.WHITE)
        setPadding(10, 8, 10, 8)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    private fun button(t: String) = Button(this).apply {
        text = t
        setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        Api.init(this)
        db = LocalDb(this)
        session = SecureSession(this)
        token = session.read()
        if (token != null) home() else login()
    }

    private fun root() {
        box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18, 28, 18, 18)
            setBackgroundColor(Color.rgb(7, 12, 24))
            layoutParams = ViewGroup.LayoutParams(-1, -1)
        }
        setContentView(ScrollView(this).apply { addView(box) })
    }

    private fun login() {
        root()
        box.addView(tv("Xiquim Vargas\nLogística & Motorista", 26f, bold = true))
        box.addView(tv("Após sincronizar, sua rota e paradas ficam gravadas para entrega sem necessidade de internet.", 15f))
        val e = EditText(this).apply { hint = "Email"; setTextColor(Color.WHITE); setHintTextColor(Color.DKGRAY) }
        box.addView(e)
        val p = EditText(this).apply { hint = "Senha"; inputType = 0x81; setTextColor(Color.WHITE); setHintTextColor(Color.DKGRAY) }
        box.addView(p)
        val b = button("Entrar na Rota")
        box.addView(b)
        b.setOnClickListener {
            Thread {
                try {
                    val r = Api.request("/api/auth/login", "POST", body = JSONObject().put("email", e.text.toString().trim()).put("password", p.text.toString()).toString())
                    token = JSONObject(r).getString("token")
                    session.save(token!!)
                    runOnUiThread { home() }
                } catch (x: Exception) {
                    runOnUiThread { Toast.makeText(this, "Não foi possível entrar: ${x.message}", Toast.LENGTH_LONG).show() }
                }
            }.start()
        }
        val cfg = button("⚙ Configurar URL do servidor")
        box.addView(cfg)
        cfg.setOnClickListener { configScreen() }
    }

    private fun configScreen() {
        root()
        box.addView(tv("Configuração do servidor", 24f, bold = true))
        box.addView(tv("Informe a URL HTTPS do ERP publicada no Render ou endereço local de teste.", 15f))
        val input = EditText(this).apply {
            hint = "https://seu-erp.onrender.com"
            setText(Api.getBaseUrl())
            isSingleLine = true
            setTextColor(Color.WHITE)
            setHintTextColor(Color.DKGRAY)
        }
        box.addView(input)
        val save = button("Salvar URL")
        box.addView(save)
        save.setOnClickListener {
            val value = input.text.toString().trim().trimEnd('/')
            if (!isValidUrl(value)) {
                Toast.makeText(this, "Informe uma URL válida do ERP (HTTPS ou rede local).", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            Api.setBaseUrl(this, value)
            Toast.makeText(this, "URL salva com sucesso.", Toast.LENGTH_SHORT).show()
            if (token != null) home() else login()
        }
        val back = button("← Voltar")
        box.addView(back)
        back.setOnClickListener { if (token != null) home() else login() }
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

    private fun home() {
        root()
        box.addView(tv("Fila de Entregas do Dia", 24f, bold = true))
        val status = tv("Conectando...", 15f)
        box.addView(status)
        val server = button("⚙ Configurar URL do servidor")
        box.addView(server)
        server.setOnClickListener { configScreen() }

        Thread {
            try {
                sync()
                offline = false
            } catch (_: Exception) {
                offline = true
            }
            runOnUiThread {
                status.text = if (offline) "● OFFLINE — trabalhando com a rota salva" else "● ONLINE — rota sincronizada em tempo real"
                renderHome()
            }
        }.start()
    }

    private fun sync() {
        val t = token ?: throw Exception("Sessão não encontrada")
        db.retryErrors()
        syncOutbox()
        val routes = JSONObject(Api.request("/api/logistics/routes", token = t)).getJSONArray("items").toList()
        val orders = JSONObject(Api.request("/api/orders", token = t)).getJSONArray("items").toList()
        db.replace("routes", routes)
        db.replace("orders", orders)
        syncOutbox()
    }

    private fun syncOutbox() {
        val t = token ?: return
        for (item in db.pending()) {
            val id = item.getString("id")
            val type = item.getString("type")
            val p = item.getJSONObject("payload")
            try {
                when (type) {
                    "PROOF" -> {
                        val file = File(p.getString("file"))
                        if (!file.exists()) throw Exception("Comprovante local não encontrado")
                        val b64 = Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
                        Api.request("/api/logistics/orders/${p.getString("order_id")}/proof", "POST", t, JSONObject().put("data_url", "data:image/jpeg;base64,$b64").toString(), mapOf("Idempotency-Key" to p.optString("idempotency_key", "PROOF-${p.getString("order_id")}")))
                    }
                    "COMPLETE" -> {
                        val r = Api.request("/api/logistics/orders/${p.getString("order_id")}/complete", "POST", t, "{}")
                        db.put("orders", JSONObject(r).getJSONObject("item"))
                    }
                }
                db.done(id)
            } catch (e: Exception) {
                db.fail(id, e.message ?: "Falha na sincronização")
            }
        }
    }

    private fun renderHome() {
        box.removeAllViews()
        box.addView(tv("Fila de Entregas do Dia", 24f, bold = true))
        box.addView(tv(if (offline) "● OFFLINE" else "● ONLINE", 15f))
        box.addView(tv("${db.pendingCount()} comprovante(s)/entrega(s) aguardando sincronização", 14f))

        val orders = db.all("orders").associateBy { it.optString("id") }
        val routes = db.all("routes")
        var count = 0

        for (route in routes) {
            if (route.optString("status") == "CONCLUIDA") continue
            val ids = JSONArray(route.optString("sequencia_json", "[]"))

            for (i in 0 until ids.length()) {
                val o = orders[ids.getString(i)] ?: continue
                if (o.optString("status") == "CONCLUIDO") continue
                count++

                val card = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(16, 16, 16, 16)
                    setBackgroundColor(Color.rgb(20, 29, 44))
                    val lp = LinearLayout.LayoutParams(-1, -2)
                    lp.topMargin = dp(10)
                    layoutParams = lp
                }

                val numero = o.optString("numero", "")
                val mod = o.optString("modalidade_entrega", "ENTREGA")
                val modBadge = if (mod == "RETIRADA") "🏬 RETIRADA NO BALCÃO" else "🚚 ENTREGA"
                
                card.addView(tv("Parada ${i + 1} · Pedido $numero · $modBadge", 14f, bold = true))
                card.addView(tv(o.optString("cliente_nome", "Cliente"), 19f, bold = true))

                val bairro = o.optString("bairro", o.optString("cliente_bairro", ""))
                val end = o.optString("cliente_endereco", "Endereço não informado")
                val locText = if (bairro.isNotBlank()) "📍 Bairro: $bairro\n$end" else "📍 $end"
                card.addView(tv(locText, 14f))

                val total = o.optDouble("total", 0.0)
                card.addView(tv("Valor Total: R$ ${"%.2f".format(total)}", 16f, bold = true))

                val obs = o.optString("observacoes")
                if (obs.isNotBlank()) {
                    card.addView(tv("Obs: $obs", 13f))
                }

                val phone = o.optString("telefone", o.optString("cliente_telefone", "")).replace(Regex("[^0-9]"), "")

                // Linha de ações de comunicação e navegação
                val rowComm = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                val maps = button("🗺️ Rota Maps").apply {
                    setBackgroundColor(Color.rgb(40, 55, 80))
                    setTextColor(Color.WHITE)
                }
                rowComm.addView(maps, LinearLayout.LayoutParams(0, -2, 1f))

                if (phone.isNotBlank()) {
                    val callBtn = button("📞 Ligar").apply {
                        setBackgroundColor(Color.rgb(59, 130, 246))
                        setTextColor(Color.WHITE)
                    }
                    val wppBtn = button("📲 WhatsApp").apply {
                        setBackgroundColor(Color.rgb(37, 211, 102))
                        setTextColor(Color.WHITE)
                    }
                    rowComm.addView(callBtn, LinearLayout.LayoutParams(0, -2, 0.9f))
                    rowComm.addView(wppBtn, LinearLayout.LayoutParams(0, -2, 1.1f))

                    callBtn.setOnClickListener {
                        try {
                            startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$phone")))
                        } catch (_: Exception) {}
                    }
                    wppBtn.setOnClickListener {
                        val clientName = o.optString("cliente_nome", "Cliente")
                        val msg = "Olá $clientName, sou o motorista da Xiquim Vargas e estou a caminho para realizar a entrega do seu pedido #$numero."
                        try {
                            val url = "https://api.whatsapp.com/send?phone=55$phone&text=${URLEncoder.encode(msg, "UTF-8")}"
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (_: Exception) {}
                    }
                }
                card.addView(rowComm)

                maps.setOnClickListener {
                    val q = Uri.encode(end)
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.google.com/maps/search/?api=1&query=$q")))
                }

                // Linha de finalização
                val rowFinal = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    val lp = LinearLayout.LayoutParams(-1, -2)
                    lp.topMargin = dp(6)
                    layoutParams = lp
                }

                val proof = filesDir.resolve("proofs/${o.optString("id")}.jpg")
                val proofLabel = if (proof.exists()) "📷 Canhoto Salvo ✔" else "📷 Anexar Canhoto"
                val proofBtn = button(proofLabel).apply {
                    setBackgroundColor(if (proof.exists()) Color.rgb(34, 197, 94) else Color.rgb(100, 116, 139))
                    setTextColor(Color.WHITE)
                }
                val done = button("✔ Concluir Entrega").apply {
                    setBackgroundColor(Color.rgb(244, 90, 8))
                    setTextColor(Color.WHITE)
                }

                rowFinal.addView(proofBtn, LinearLayout.LayoutParams(0, -2, 1f))
                rowFinal.addView(done, LinearLayout.LayoutParams(0, -2, 1.2f))
                card.addView(rowFinal)

                proofBtn.setOnClickListener {
                    proofOrder = o.optString("id")
                    startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                        type = "image/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }, PICK)
                }
                done.setOnClickListener { complete(o) }

                box.addView(card)
            }
        }

        if (count == 0) {
            box.addView(tv("Nenhuma entrega pendente no momento. Parabéns!", 17f, bold = true))
        }

        val hist = button("✓ Consultar Rotas Concluídas")
        box.addView(hist)
        hist.setOnClickListener { completedRoutes() }

        val refresh = button("↻ Atualizar / Sincronizar")
        box.addView(refresh)
        refresh.setOnClickListener { home() }

        val out = button("Sair")
        box.addView(out)
        out.setOnClickListener {
            session.clear()
            token = null
            login()
        }
    }

    private fun complete(o: JSONObject) {
        val id = o.optString("id")
        val proof = filesDir.resolve("proofs/$id.jpg")

        Thread {
            if (online()) {
                try {
                    if (proof.exists()) uploadProofOnline(id, proof)
                    Api.request("/api/logistics/orders/$id/complete", "POST", token, "{}", mapOf("Idempotency-Key" to "COMPLETE-$id"))
                    localComplete(id)
                    runOnUiThread {
                        Toast.makeText(this, "Entrega concluída e sincronizada com sucesso!", Toast.LENGTH_SHORT).show()
                        home()
                    }
                    return@Thread
                } catch (_: Exception) {
                    if (proof.exists()) db.enqueue("PROOF", JSONObject().put("order_id", id).put("file", proof.absolutePath).put("idempotency_key", "PROOF-$id"), "PROOF-$id-${UUID.randomUUID()}")
                }
            }
            val payload = JSONObject().put("order_id", id)
            db.enqueue("COMPLETE", payload, "COMPLETE-$id-${UUID.randomUUID()}")
            localComplete(id)
            runOnUiThread {
                Toast.makeText(this, "Entrega registrada offline. Será enviada à Torre quando a conexão voltar.", Toast.LENGTH_LONG).show()
                home()
            }
        }.start()
    }

    private fun localComplete(id: String) {
        val o = db.get("orders", id) ?: return
        o.put("status", "CONCLUIDO").put("updated_at", System.currentTimeMillis().toString())
        db.put("orders", o)
        for (r in db.all("routes")) {
            val ids = JSONArray(r.optString("sequencia_json", "[]"))
            var all = true
            for (i in 0 until ids.length()) {
                if (db.get("orders", ids.getString(i))?.optString("status") != "CONCLUIDO") all = false
            }
            if (all) {
                r.put("status", "CONCLUIDA").put("updated_at", System.currentTimeMillis().toString())
                db.put("routes", r)
            }
        }
    }

    private fun uploadProofOnline(id: String, file: File) {
        val b64 = Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
        Api.request("/api/logistics/orders/$id/proof", "POST", token, JSONObject().put("data_url", "data:image/jpeg;base64,$b64").toString(), mapOf("Idempotency-Key" to "PROOF-$id"))
    }

    private fun completedRoutes() {
        root()
        box.addView(tv("Rotas Concluídas", 24f, bold = true))
        val routes = db.all("routes").filter { it.optString("status") == "CONCLUIDA" }.sortedByDescending { it.optString("updated_at", it.optString("data")) }
        val orders = db.all("orders").associateBy { it.optString("id") }

        if (routes.isEmpty()) box.addView(tv("Nenhuma rota concluída registrada no aparelho.", 16f))

        for (r in routes) {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(14, 14, 14, 14)
                setBackgroundColor(Color.rgb(20, 29, 44))
                val lp = LinearLayout.LayoutParams(-1, -2)
                lp.topMargin = dp(8)
                layoutParams = lp
            }
            card.addView(tv("Rota Finalizada · ${r.optString("data")}", 18f, bold = true))
            val ids = JSONArray(r.optString("sequencia_json", "[]"))
            for (i in 0 until ids.length()) {
                val o = orders[ids.getString(i)] ?: continue
                card.addView(tv("${i + 1}. ${o.optString("cliente_nome")} · Pedido ${o.optString("numero")}", 14f))
            }
            box.addView(card)
        }

        val back = button("← Voltar para Entregas do Dia")
        box.addView(back)
        back.setOnClickListener { home() }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != PICK || resultCode != RESULT_OK || data?.data == null) return
        Thread {
            try {
                val dir = File(filesDir, "proofs")
                dir.mkdirs()
                val target = File(dir, "$proofOrder.jpg")
                contentResolver.openInputStream(data.data!!)?.use { input -> target.outputStream().use { out -> input.copyTo(out) } } ?: throw Exception("Arquivo vazio")
                if (online()) {
                    try {
                        uploadProofOnline(proofOrder, target)
                        runOnUiThread {
                            Toast.makeText(this, "Canhoto enviado com sucesso para a Torre!", Toast.LENGTH_SHORT).show()
                            renderHome()
                        }
                        return@Thread
                    } catch (_: Exception) {}
                }
                db.enqueue("PROOF", JSONObject().put("order_id", proofOrder).put("file", target.absolutePath).put("idempotency_key", "PROOF-$proofOrder"), "PROOF-$proofOrder-${UUID.randomUUID()}")
                runOnUiThread {
                    Toast.makeText(this, "Canhoto salvo offline; será enviado quando a conexão voltar.", Toast.LENGTH_LONG).show()
                    renderHome()
                }
            } catch (e: Exception) {
                runOnUiThread { Toast.makeText(this, e.message, Toast.LENGTH_LONG).show() }
            }
        }.start()
    }

    private fun online(): Boolean = try {
        val c = java.net.URL(Api.getBaseUrl()).openConnection() as java.net.HttpURLConnection
        c.connectTimeout = 1500
        c.readTimeout = 1500
        c.requestMethod = "HEAD"
        c.connect()
        c.responseCode in 200..499
    } catch (_: Exception) {
        false
    }

    private fun JSONArray.toList(): List<JSONObject> {
        val out = mutableListOf<JSONObject>()
        for (i in 0 until length()) out.add(getJSONObject(i))
        return out
    }
}

package br.com.xiquimvargas.seller

import android.app.*
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.*
import android.view.*
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.net.URLEncoder
import java.util.UUID

class MainActivity : Activity() {
    private lateinit var box: LinearLayout
    private lateinit var db: LocalDb
    private lateinit var session: SecureSession
    private var token: String? = null
    private var clients = mutableListOf<JSONObject>()
    private var products = mutableListOf<JSONObject>()
    private var currentClient: JSONObject? = null
    private val cart = linkedMapOf<String, Int>()
    private var offline = false
    private var clientSearchQuery = ""
    private var selectedRfmFilter = "TODOS"

    private fun tv(t: String, size: Float = 16f, dark: Boolean = false, bold: Boolean = false) = TextView(this).apply {
        text = t
        textSize = size
        setTextColor(if (dark) Color.rgb(20, 32, 58) else Color.WHITE)
        setPadding(10, 10, 10, 10)
        if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    private fun button(t: String) = Button(this).apply { 
        text = t 
        setTypeface(typeface, android.graphics.Typeface.BOLD)
    }

    private val imageCache = object : android.util.LruCache<String, android.graphics.Bitmap>(16 * 1024 * 1024) {
        override fun sizeOf(key: String, value: android.graphics.Bitmap) = value.byteCount
    }

    private fun decodeThumb(bytes: ByteArray, target: Int): android.graphics.Bitmap? {
        val o = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, o)
        var s = 1
        while (o.outWidth / (s * 2) >= target && o.outHeight / (s * 2) >= target) s *= 2
        return android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size, android.graphics.BitmapFactory.Options().apply { inSampleSize = s })
    }

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun productThumb(p: JSONObject): View {
        val frame = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(242, 245, 249))
            setPadding(dp(8), dp(8), dp(8), dp(8))
            layoutParams = LinearLayout.LayoutParams(-1, dp(180))
        }
        val fallback = TextView(this).apply {
            text = p.optString("marca").ifBlank { "PRODUTO" }
            setTextColor(Color.rgb(136, 149, 167))
            gravity = Gravity.CENTER
            textSize = 12f
        }
        val img = ImageView(this).apply {
            scaleType = ImageView.ScaleType.FIT_CENTER
            adjustViewBounds = false
            visibility = View.GONE
        }
        frame.addView(fallback, FrameLayout.LayoutParams(-1, -1))
        frame.addView(img, FrameLayout.LayoutParams(-1, -1))
        val url = if (p.isNull("foto_url")) "" else p.optString("foto_url")
        if (url.isNotBlank()) {
            imageCache.get(url)?.let {
                img.setImageBitmap(it)
                img.visibility = View.VISIBLE
                fallback.visibility = View.GONE
            } ?: Thread {
                runCatching {
                    val bytes = Api.fetchBytes(url)
                    decodeThumb(bytes, dp(180))
                }.getOrNull()?.let { bmp ->
                    imageCache.put(url, bmp)
                    runOnUiThread {
                        img.setImageBitmap(bmp)
                        img.visibility = View.VISIBLE
                        fallback.visibility = View.GONE
                    }
                }
            }.start()
        }
        return frame
    }

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
        box.addView(tv("Xiquim Vargas\nVendedor Externo & CRM", 26f, bold = true))
        box.addView(tv("Primeiro acesso ao aplicativo precisa de internet. Depois, o vendedor poderá continuar trabalhando sem conexão.", 15f))
        val e = EditText(this).apply { hint = "Email"; setTextColor(Color.WHITE); setHintTextColor(Color.DKGRAY) }
        box.addView(e)
        val p = EditText(this).apply { hint = "Senha"; inputType = 0x81; setTextColor(Color.WHITE); setHintTextColor(Color.DKGRAY) }
        box.addView(p)
        val b = button("Entrar")
        box.addView(b)
        b.setOnClickListener {
            Thread {
                try {
                    val body = JSONObject().put("email", e.text.toString().trim()).put("password", p.text.toString()).toString()
                    val r = Api.request("/api/auth/login", "POST", body = body)
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
        box.addView(tv("Informe a URL HTTPS publicada no Render ou endereço de rede local.", 15f))
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
            Toast.makeText(this, "URL salva.", Toast.LENGTH_SHORT).show()
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
        box.addView(tv("Minha Carteira & CRM", 24f, bold = true))
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
                loadCache()
            }
            runOnUiThread {
                status.text = if (offline) "● OFFLINE — dados salvos no aparelho" else "● ONLINE — sincronizado com a Torre"
                renderHome()
            }
        }.start()
    }

    private fun loadCache() {
        clients = db.all("clients").toMutableList()
        products = db.all("products").toMutableList()
    }

    private fun sync() {
        val t = token ?: throw Exception("Sessão não encontrada")
        val cRaw = JSONObject(Api.request("/api/clients", token = t)).getJSONArray("items").toList()

        // Sync CRM Dashboard info if available
        val crmMap = mutableMapOf<String, JSONObject>()
        try {
            val crmRes = JSONObject(Api.request("/api/crm/dashboard", token = t))
            val crmItems = crmRes.optJSONArray("items") ?: JSONArray()
            for (i in 0 until crmItems.length()) {
                val it = crmItems.getJSONObject(i)
                crmMap[it.optString("id")] = it
            }
        } catch (_: Exception) {}

        val enrichedClients = cRaw.map { c ->
            val id = c.optString("id")
            val crm = crmMap[id]
            if (crm != null) {
                JSONObject(c.toString()).apply {
                    put("status_rfm", crm.optString("status_rfm", "ATIVO"))
                    if (crm.has("dias_sem_comprar") && !crm.isNull("dias_sem_comprar")) {
                        put("dias_sem_comprar", crm.optInt("dias_sem_comprar"))
                    }
                    put("top_produtos", crm.optJSONArray("top_produtos") ?: JSONArray())
                }
            } else c
        }

        db.replace("clients", enrichedClients)
        clients = enrichedClients.toMutableList()

        val p = JSONObject(Api.request("/api/products", token = t)).getJSONArray("items").toList()
        val st = JSONObject(Api.request("/api/seller/stock", token = t)).getJSONArray("items").toList()
        val stock = st.associateBy { it.optString("id") }
        products = p.map {
            JSONObject(it.toString()).apply {
                val q = stock[optString("id")]
                if (q != null) {
                    put("quantidade_disponivel", q.optInt("quantidade_disponivel"))
                    put("foto_url", q.optString("foto_url", optString("foto_url")))
                }
            }
        }.toMutableList()
        db.replace("products", products)

        syncOutbox()
        try {
            val o = JSONObject(Api.request("/api/orders", token = t)).getJSONArray("items").toList()
            db.replace("orders", o)
        } catch (_: Exception) {}
    }

    private fun syncOutbox() {
        val t = token ?: return
        for (item in db.pending()) {
            val id = item.getString("id")
            val type = item.getString("type")
            val payload = item.getJSONObject("payload")
            try {
                when (type) {
                    "CLIENT" -> {
                        val body = Api.request("/api/clients", "POST", t, payload.toString(), mapOf("Idempotency-Key" to payload.optString("idempotency_key", "OFF-$id")))
                        db.put("clients", JSONObject(body).getJSONObject("item"))
                    }
                    "ORDER" -> {
                        val body = Api.request("/api/orders", "POST", t, payload.getJSONObject("data").toString(), mapOf("Idempotency-Key" to payload.optString("idempotency_key", "OFF-$id")))
                        db.put("orders", JSONObject(body).getJSONObject("item"))
                    }
                    "CRM_INTERACTION" -> {
                        val cid = payload.getString("cliente_id")
                        val data = payload.getJSONObject("data")
                        Api.request("/api/clients/$cid/interactions", "POST", t, data.toString(), mapOf("Idempotency-Key" to payload.optString("idempotency_key", "CRM-$id")))
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
        box.addView(tv("Minha Carteira & CRM", 24f, bold = true))
        box.addView(tv(if (offline) "● OFFLINE — dados salvos no aparelho" else "● ONLINE — sincronizado com a Torre", 15f))

        // 1. Painel de KPIs de Saúde da Carteira no Topo (RFM)
        val totalCount = clients.size
        val vipCount = clients.count { it.optString("status_rfm") == "VIP" }
        val activeCount = clients.count { it.optString("status_rfm", "ATIVO") == "ATIVO" }
        val riskCount = clients.count { it.optString("status_rfm") == "EM_RISCO" }
        val inactiveCount = clients.count { it.optString("status_rfm") == "INATIVO" }
        val pendingCount = db.pendingCount()

        val kpiGrid1 = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            val lp = LinearLayout.LayoutParams(-1, -2)
            lp.topMargin = dp(6)
            layoutParams = lp
        }
        fun kpiCard(title: String, value: String, bgColor: Int): LinearLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(8), dp(8), dp(8), dp(8))
            setBackgroundColor(bgColor)
            val lp = LinearLayout.LayoutParams(0, -2, 1f)
            lp.setMargins(dp(3), dp(3), dp(3), dp(3))
            layoutParams = lp
            addView(TextView(this@MainActivity).apply {
                text = value
                textSize = 17f
                setTextColor(Color.WHITE)
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                gravity = Gravity.CENTER
            })
            addView(TextView(this@MainActivity).apply {
                text = title
                textSize = 11f
                setTextColor(Color.rgb(226, 232, 240))
                gravity = Gravity.CENTER
            })
        }

        kpiGrid1.addView(kpiCard("Carteira", "$totalCount", Color.rgb(30, 41, 59)))
        kpiGrid1.addView(kpiCard("⭐ VIP", "$vipCount", Color.rgb(180, 83, 9)))
        kpiGrid1.addView(kpiCard("🟢 Ativos", "$activeCount", Color.rgb(16, 185, 129)))
        box.addView(kpiGrid1)

        val kpiGrid2 = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            val lp = LinearLayout.LayoutParams(-1, -2)
            lp.bottomMargin = dp(6)
            layoutParams = lp
        }
        kpiGrid2.addView(kpiCard("⚠️ Em Risco", "$riskCount", Color.rgb(234, 88, 12)))
        kpiGrid2.addView(kpiCard("🔴 Inativos", "$inactiveCount", Color.rgb(220, 38, 38)))
        kpiGrid2.addView(kpiCard("🔄 Pendentes", "$pendingCount", Color.rgb(71, 85, 105)))
        box.addView(kpiGrid2)

        // 2. Barra de Filtros Rápidos RFM (Pills)
        val filterScroll = HorizontalScrollView(this).apply {
            val lp = LinearLayout.LayoutParams(-1, -2)
            lp.bottomMargin = dp(8)
            layoutParams = lp
        }
        val filterRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        filterScroll.addView(filterRow)

        lateinit var updateClientCards: (String) -> Unit

        val rfmPills = listOf(
            "TODOS" to "Todos ($totalCount)",
            "VIP" to "⭐ VIP ($vipCount)",
            "ATIVO" to "🟢 Ativos ($activeCount)",
            "EM_RISCO" to "⚠️ Em Risco ($riskCount)",
            "INATIVO" to "🔴 Inativos ($inactiveCount)"
        )

        val pillButtons = mutableListOf<Button>()
        rfmPills.forEach { (key, label) ->
            val pill = Button(this).apply {
                text = label
                textSize = 12f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                val isSelected = selectedRfmFilter == key
                setBackgroundColor(if (isSelected) Color.rgb(244, 90, 8) else Color.rgb(30, 41, 59))
                setTextColor(Color.WHITE)
                val lp = LinearLayout.LayoutParams(-2, -2)
                lp.rightMargin = dp(6)
                layoutParams = lp
            }
            pill.setOnClickListener {
                selectedRfmFilter = key
                pillButtons.forEachIndexed { i, b ->
                    val isCur = rfmPills[i].first == selectedRfmFilter
                    b.setBackgroundColor(if (isCur) Color.rgb(244, 90, 8) else Color.rgb(30, 41, 59))
                }
                updateClientCards(clientSearchQuery)
            }
            pillButtons.add(pill)
            filterRow.addView(pill)
        }
        box.addView(filterScroll)

        // 3. Campo de Pesquisa Textual
        val search = EditText(this).apply {
            hint = "Buscar cliente por nome, telefone, bairro..."
            setTextColor(Color.WHITE)
            setHintTextColor(Color.DKGRAY)
            setText(clientSearchQuery)
            setPadding(20, 20, 20, 20)
            setBackgroundColor(Color.rgb(20, 29, 44))
        }
        box.addView(search)

        val clientListContainer = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        box.addView(clientListContainer)

        updateClientCards = { query ->
            clientListContainer.removeAllViews()
            val filtered = clients.filter { c ->
                val text = (c.optString("razao_social") + " " + c.optString("nome_fantasia") + " " + c.optString("telefone") + " " + c.optString("bairro")).lowercase()
                val matchesText = text.contains(query.lowercase())
                val rfm = c.optString("status_rfm", "ATIVO")
                val matchesRfm = when (selectedRfmFilter) {
                    "VIP" -> rfm == "VIP"
                    "ATIVO" -> rfm == "ATIVO"
                    "EM_RISCO" -> rfm == "EM_RISCO"
                    "INATIVO" -> rfm == "INATIVO"
                    else -> true
                }
                matchesText && matchesRfm
            }

            if (filtered.isEmpty()) {
                clientListContainer.addView(tv("Nenhum cliente encontrado no filtro selecionado.", 15f))
            } else {
                for (c in filtered) {
                    val card = LinearLayout(this).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding(16, 16, 16, 16)
                        setBackgroundColor(Color.rgb(20, 29, 44))
                        val lp = LinearLayout.LayoutParams(-1, -2)
                        lp.topMargin = dp(8)
                        layoutParams = lp
                    }

                    val title = c.optString("razao_social").ifBlank { c.optString("nome_fantasia", "Cliente Sem Nome") }
                    val subName = c.optString("nome_fantasia")
                    card.addView(tv(title, 18f, bold = true))
                    if (subName.isNotBlank() && subName != title) {
                        card.addView(tv("Fantasia: $subName", 13f))
                    }

                    // RFM & Recency Badge
                    val rfm = c.optString("status_rfm", "ATIVO")
                    val days = if (c.has("dias_sem_comprar") && !c.isNull("dias_sem_comprar")) c.optInt("dias_sem_comprar") else null
                    val rfmText = when (rfm) {
                        "VIP" -> "⭐ VIP"
                        "EM_RISCO" -> "⚠️ EM RISCO"
                        "INATIVO" -> "🔴 INATIVO"
                        "NOVO" -> "🆕 NOVO"
                        else -> "🟢 ATIVO"
                    }
                    val recencyText = if (days != null) " · Última compra há $days dia(s)" else " · Sem histórico de compras"
                    card.addView(tv("$rfmText$recencyText", 13f, bold = true))

                    // Exibição dos Top Produtos Mais Comprados pelo Cliente
                    val topArr = c.optJSONArray("top_produtos")
                    if (topArr != null && topArr.length() > 0) {
                        val topItems = mutableListOf<String>()
                        for (i in 0 until minOf(3, topArr.length())) {
                            val item = topArr.optJSONObject(i)
                            if (item != null) {
                                topItems.add("${item.optString("nome")} (${item.optInt("total_qtd")} un)")
                            }
                        }
                        if (topItems.isNotEmpty()) {
                            card.addView(tv("📦 Mais comprados: ${topItems.joinToString(", ")}", 13f).apply {
                                setTextColor(Color.rgb(165, 180, 252)) // Soft Indigo
                            })
                        }
                    }

                    val loc = listOf(c.optString("bairro"), c.optString("cidade"), c.optString("telefone")).filter { it.isNotBlank() }.joinToString(" · ")
                    if (loc.isNotBlank()) card.addView(tv(loc, 13f))

                    // Linha 1: Novo Pedido & Repetir
                    val row1 = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                    val order = button("Novo Pedido").apply {
                        setBackgroundColor(Color.rgb(244, 90, 8))
                        setTextColor(Color.WHITE)
                    }
                    val repeat = button("↻ Repetir").apply {
                        setBackgroundColor(Color.rgb(40, 55, 80))
                        setTextColor(Color.WHITE)
                    }
                    row1.addView(order, LinearLayout.LayoutParams(0, -2, 1.3f))
                    row1.addView(repeat, LinearLayout.LayoutParams(0, -2, 1f))
                    card.addView(row1)

                    // Linha 2: WhatsApp & Nota CRM & Linha do Tempo
                    val row2 = LinearLayout(this).apply { 
                        orientation = LinearLayout.HORIZONTAL
                        val lp = LinearLayout.LayoutParams(-1, -2)
                        lp.topMargin = dp(4)
                        layoutParams = lp
                    }
                    val wpp = button("📲 WhatsApp").apply {
                        setBackgroundColor(Color.rgb(37, 211, 102)) // WhatsApp Green
                        setTextColor(Color.WHITE)
                    }
                    val crmBtn = button("📝 Nota").apply {
                        setBackgroundColor(Color.rgb(79, 70, 229)) // Indigo
                        setTextColor(Color.WHITE)
                    }
                    val timelineBtn = button("📜 Histórico").apply {
                        setBackgroundColor(Color.rgb(51, 65, 85)) // Slate
                        setTextColor(Color.WHITE)
                    }
                    row2.addView(wpp, LinearLayout.LayoutParams(0, -2, 1.2f))
                    row2.addView(crmBtn, LinearLayout.LayoutParams(0, -2, 0.9f))
                    row2.addView(timelineBtn, LinearLayout.LayoutParams(0, -2, 1.1f))
                    card.addView(row2)

                    order.setOnClickListener { newOrder(c) }
                    repeat.setOnClickListener { repeatLastOrder(c) }
                    wpp.setOnClickListener { openClientWhatsApp(c) }
                    crmBtn.setOnClickListener { openClientCrmDialog(c) }
                    timelineBtn.setOnClickListener { openClientTimelineDialog(c) }

                    clientListContainer.addView(card)
                }
            }
        }

        search.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
            override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) {
                clientSearchQuery = s.toString()
                updateClientCards(clientSearchQuery)
            }
            override fun afterTextChanged(e: android.text.Editable?) {}
        })
        updateClientCards(clientSearchQuery)

        val add = button("＋ Cadastrar Novo Cliente")
        box.addView(add)
        add.setOnClickListener { newClient() }

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

    private fun openClientWhatsApp(c: JSONObject) {
        val phone = c.optString("telefone", "").replace(Regex("[^0-9]"), "")
        val name = c.optString("razao_social").ifBlank { c.optString("nome_fantasia", "cliente") }
        val days = if (c.has("dias_sem_comprar") && !c.isNull("dias_sem_comprar")) c.optInt("dias_sem_comprar") else null
        
        // Pega top produtos para sugestão inteligente
        val topArr = c.optJSONArray("top_produtos")
        val topNames = mutableListOf<String>()
        if (topArr != null && topArr.length() > 0) {
            for (i in 0 until minOf(2, topArr.length())) {
                topArr.optJSONObject(i)?.optString("nome")?.let { if (it.isNotBlank()) topNames.add(it) }
            }
        }
        val topText = if (topNames.isNotEmpty()) " especialmente ${topNames.joinToString(" e ")}" else ""

        val msg = if (days != null && days > 7) {
            "Olá $name, tudo bem? Aqui é o vendedor da Xiquim Vargas. Notei que já faz $days dias desde seu último pedido. Gostaria de repor seu estoque hoje$topText para garantir a entrega rápida?"
        } else {
            "Olá $name, tudo bem? Aqui é o vendedor da Xiquim Vargas. Estou organizando a rota de entregas de hoje. Gostaria de conferir os pedidos para abastecer seu estoque$topText?"
        }

        try {
            val url = if (phone.isNotBlank()) {
                "https://api.whatsapp.com/send?phone=55$phone&text=${URLEncoder.encode(msg, "UTF-8")}"
            } else {
                "https://api.whatsapp.com/send?text=${URLEncoder.encode(msg, "UTF-8")}"
            }
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            Toast.makeText(this, "Não foi possível abrir o WhatsApp no aparelho.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun openClientTimelineDialog(c: JSONObject) {
        val cid = c.optString("id")
        val name = c.optString("razao_social").ifBlank { c.optString("nome_fantasia") }

        val d = AlertDialog.Builder(this)
        d.setTitle("Histórico CRM — $name")

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(26, 16, 26, 16)
        }
        val scroll = ScrollView(this).apply { addView(container) }
        d.setView(scroll)

        val loading = tv("Carregando histórico do cliente...", 14f, dark = true)
        container.addView(loading)

        val renderItems = { items: List<JSONObject> ->
            runOnUiThread {
                container.removeAllViews()
                if (items.isEmpty()) {
                    container.addView(tv("Nenhuma interação ou pedido anterior registrado para este cliente.", 14f, dark = true))
                } else {
                    for (it in items) {
                        val card = LinearLayout(this).apply {
                            orientation = LinearLayout.VERTICAL
                            setPadding(14, 10, 14, 10)
                            setBackgroundColor(Color.rgb(241, 245, 249))
                            val lp = LinearLayout.LayoutParams(-1, -2)
                            lp.bottomMargin = dp(8)
                            layoutParams = lp
                        }
                        val tipo = it.optString("tipo", "CONTATO").uppercase()
                        val badge = when (tipo) {
                            "WHATSAPP" -> "📲 WHATSAPP"
                            "LIGACAO" -> "📞 LIGAÇÃO"
                            "VISITA" -> "🤝 VISITA"
                            "COBRANCA" -> "💰 COBRANÇA"
                            "PEDIDO" -> "📦 PEDIDO"
                            else -> "📝 $tipo"
                        }
                        val data = it.optString("data_formatada", it.optString("created_at", ""))
                        card.addView(tv("$badge · $data", 13f, dark = true, bold = true))
                        val desc = it.optString("descricao").ifBlank { it.optString("detalhes", "Sem descrição") }
                        card.addView(tv(desc, 14f, dark = true))
                        val autor = it.optString("autor_nome")
                        if (autor.isNotBlank()) card.addView(tv("Por: $autor", 12f, dark = true))
                        container.addView(card)
                    }
                }
            }
        }

        if (online()) {
            Thread {
                try {
                    val res = JSONObject(Api.request("/api/clients/$cid/interactions", token = token))
                    val items = res.getJSONArray("items").toList()
                    renderItems(items)
                } catch (_: Exception) {
                    val local = db.pending().filter { it.optString("type") == "CRM_INTERACTION" && it.optJSONObject("payload")?.optString("cliente_id") == cid }.map {
                        it.getJSONObject("payload").getJSONObject("data")
                    }
                    renderItems(local)
                }
            }.start()
        } else {
            val local = db.pending().filter { it.optString("type") == "CRM_INTERACTION" && it.optJSONObject("payload")?.optString("cliente_id") == cid }.map {
                it.getJSONObject("payload").getJSONObject("data")
            }
            renderItems(local)
        }

        d.setPositiveButton("Fechar", null)
        d.setNeutralButton("＋ Registrar Nota") { _, _ -> openClientCrmDialog(c) }
        d.show()
    }

    private fun openClientCrmDialog(c: JSONObject) {
        val cid = c.optString("id")
        val name = c.optString("razao_social").ifBlank { c.optString("nome_fantasia") }

        val d = AlertDialog.Builder(this)
        d.setTitle("Registrar Contato CRM — $name")

        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(30, 20, 30, 20)
        }

        val typeLabel = tv("Tipo de interação:", 14f, dark = true, bold = true)
        form.addView(typeLabel)

        val spinner = Spinner(this)
        val types = arrayOf("WHATSAPP", "LIGACAO", "VISITA", "COBRANCA", "OBSERVACAO")
        spinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, types)
        form.addView(spinner)

        val descLabel = tv("Descrição / Notas do cliente:", 14f, dark = true, bold = true)
        form.addView(descLabel)

        val descInput = EditText(this).apply {
            hint = "Ex.: Confirmou que o estoque está baixo, pediu retorno na sexta..."
            setLines(3)
        }
        form.addView(descInput)
        d.setView(form)

        d.setPositiveButton("Salvar Contato") { _, _ ->
            val tipo = spinner.selectedItem.toString()
            val desc = descInput.text.toString().trim()
            if (desc.isBlank()) {
                Toast.makeText(this, "Informe a descrição do contato.", Toast.LENGTH_SHORT).show()
                return@setPositiveButton
            }

            val data = JSONObject().put("tipo", tipo).put("descricao", desc)
            val id = UUID.randomUUID().toString()
            val payload = JSONObject().put("cliente_id", cid).put("data", data).put("idempotency_key", "CRM-$id")

            if (online()) {
                Thread {
                    try {
                        Api.request("/api/clients/$cid/interactions", "POST", token, data.toString(), mapOf("Idempotency-Key" to "CRM-$id"))
                        runOnUiThread { Toast.makeText(this, "Contato CRM registrado com sucesso!", Toast.LENGTH_SHORT).show() }
                    } catch (_: Exception) {
                        db.enqueue("CRM_INTERACTION", payload, id)
                        runOnUiThread { Toast.makeText(this, "Contato salvo offline; será sincronizado com a Torre.", Toast.LENGTH_SHORT).show() }
                    }
                }.start()
            } else {
                db.enqueue("CRM_INTERACTION", payload, id)
                Toast.makeText(this, "Contato salvo offline. Será sincronizado quando a internet voltar.", Toast.LENGTH_LONG).show()
            }
        }
        d.setNegativeButton("Cancelar", null)
        d.show()
    }

    private fun repeatLastOrder(c: JSONObject) {
        val cid = c.optString("id")
        if (!online()) {
            Toast.makeText(this, "Conecte-se à internet para recuperar o histórico do último pedido.", Toast.LENGTH_SHORT).show()
            newOrder(c)
            return
        }

        Thread {
            try {
                val res = JSONObject(Api.request("/api/clients/$cid/repeat-last", "POST", token, "{}"))
                val itens = res.getJSONArray("itens")
                runOnUiThread {
                    cart.clear()
                    for (i in 0 until itens.length()) {
                        val it = itens.getJSONObject(i)
                        cart[it.getString("produto_id")] = it.getInt("quantidade")
                    }
                    Toast.makeText(this, "${itens.length()} itens do último pedido carregados no carrinho!", Toast.LENGTH_SHORT).show()
                    newOrder(c)
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this, "Cliente ainda não possui pedidos anteriores. Abrindo catálogo.", Toast.LENGTH_SHORT).show()
                    newOrder(c)
                }
            }
        }.start()
    }

    private fun newClient() {
        root()
        box.addView(tv("Cadastrar Novo Cliente", 24f, bold = true))
        val fields = mutableMapOf<String, EditText>()
        
        // Exibe Nome/Razão Social em primeiro lugar conforme requisito do usuário
        val orderKeys = listOf("razao_social", "nome_fantasia", "cnpj_cpf", "telefone", "email", "endereco", "bairro", "cidade", "estado")
        val labels = mapOf(
            "razao_social" to "Nome / Razão Social (*)",
            "nome_fantasia" to "Nome Fantasia",
            "cnpj_cpf" to "CNPJ ou CPF",
            "telefone" to "Telefone / WhatsApp",
            "email" to "E-mail",
            "endereco" to "Endereço completo (*)",
            "bairro" to "Bairro (*)",
            "cidade" to "Cidade",
            "estado" to "Estado"
        )

        orderKeys.forEach { key ->
            val label = labels[key] ?: key
            box.addView(tv(label, 14f))
            val e = EditText(this).apply {
                hint = label
                setTextColor(Color.WHITE)
                setHintTextColor(Color.DKGRAY)
                setPadding(20, 20, 20, 20)
                setBackgroundColor(Color.rgb(20, 29, 44))
            }
            box.addView(e)
            fields[key] = e
        }

        val save = button("Salvar Cliente").apply {
            setBackgroundColor(Color.rgb(244, 90, 8))
            setTextColor(Color.WHITE)
        }
        box.addView(save)
        val back = button("← Voltar")
        box.addView(back)
        back.setOnClickListener { home() }

        save.setOnClickListener {
            val id = UUID.randomUUID().toString()
            val rSocial = fields["razao_social"]?.text.toString().trim()
            val nFantasia = fields["nome_fantasia"]?.text.toString().trim()
            val end = fields["endereco"]?.text.toString().trim()
            val bairro = fields["bairro"]?.text.toString().trim()

            if (rSocial.isBlank() && nFantasia.isBlank()) {
                Toast.makeText(this, "Informe o Nome ou Razão Social do cliente.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (end.isBlank() || bairro.isBlank()) {
                Toast.makeText(this, "Endereço e Bairro são obrigatórios para a entrega.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val o = JSONObject().apply {
                put("id", id)
                put("razao_social", rSocial.ifBlank { nFantasia })
                put("nome_fantasia", nFantasia)
                put("cnpj_cpf", fields["cnpj_cpf"]?.text.toString().trim().ifBlank { "TEMP-$id" })
                put("email", fields["email"]?.text.toString().trim())
                put("telefone", fields["telefone"]?.text.toString().trim())
                put("endereco", end)
                put("bairro", bairro)
                put("cidade", fields["cidade"]?.text.toString().trim().ifBlank { "Principal" })
                put("estado", fields["estado"]?.text.toString().trim().ifBlank { "MG" })
                put("local_id", id)
                put("status_rfm", "NOVO")
            }

            clients.add(0, o)
            db.put("clients", o)
            val payload = JSONObject(o.toString()).put("idempotency_key", "CLIENT-$id")

            if (online()) {
                Thread {
                    try {
                        val r = Api.request("/api/clients", "POST", token, payload.toString(), mapOf("Idempotency-Key" to "CLIENT-$id"))
                        db.put("clients", JSONObject(r).getJSONObject("item"))
                        runOnUiThread {
                            Toast.makeText(this, "Cliente cadastrado e sincronizado com sucesso!", Toast.LENGTH_SHORT).show()
                            home()
                        }
                    } catch (e: Exception) {
                        db.enqueue("CLIENT", payload, id)
                        runOnUiThread {
                            Toast.makeText(this, "Cliente salvo offline; será sincronizado depois.", Toast.LENGTH_SHORT).show()
                            home()
                        }
                    }
                }.start()
            } else {
                db.enqueue("CLIENT", payload, id)
                Toast.makeText(this, "Cliente salvo offline; será sincronizado quando a internet voltar.", Toast.LENGTH_LONG).show()
                home()
            }
        }
    }

    private fun newOrder(c: JSONObject) {
        currentClient = c
        val clientId = c.optString("id")
        val cacheKey = "products_for_client:$clientId"
        val cached = db.meta(cacheKey)?.let { runCatching { JSONArray(it).toList() }.getOrNull() }
        val stockById = products.associateBy { it.optString("id") }

        fun withStock(items: List<JSONObject>) = items.map { item ->
            JSONObject(item.toString()).apply {
                stockById[optString("id")]?.let { stock ->
                    put("quantidade_disponivel", stock.optInt("quantidade_disponivel"))
                    if (!has("foto_url") || isNull("foto_url")) put("foto_url", stock.optString("foto_url"))
                }
            }
        }.toMutableList()

        if (!online()) {
            if (cached == null) {
                Toast.makeText(this, "Conecte-se para carregar o preço deste cliente antes de criar o pedido.", Toast.LENGTH_LONG).show()
                return
            }
            renderOrder(c, withStock(cached), true)
            return
        }

        root()
        box.addView(tv("Novo Pedido de Venda", 24f, bold = true))
        box.addView(tv("Carregando tabela de preços do cliente...", 15f))

        Thread {
            try {
                val encoded = URLEncoder.encode(clientId, "UTF-8")
                val result = JSONObject(Api.request("/api/products?cliente_id=$encoded", token = token)).getJSONArray("items").toList()
                db.putMeta(cacheKey, JSONArray().apply { result.forEach { put(it) } }.toString())
                val prepared = withStock(result)
                runOnUiThread { renderOrder(c, prepared, false) }
            } catch (e: Exception) {
                if (cached != null) {
                    val prepared = withStock(cached)
                    runOnUiThread {
                        Toast.makeText(this, "Sem conexão. Usando preços específicos do último sincronismo.", Toast.LENGTH_LONG).show()
                        renderOrder(c, prepared, true)
                    }
                } else runOnUiThread {
                    Toast.makeText(this, "Não foi possível carregar os preços: ${e.message}", Toast.LENGTH_LONG).show()
                    home()
                }
            }
        }.start()
    }

    private fun renderOrder(c: JSONObject, orderProducts: MutableList<JSONObject>, cachedPrices: Boolean) {
        currentClient = c
        root()
        box.addView(tv("Novo Pedido", 24f, bold = true))
        box.addView(tv(c.optString("razao_social").ifBlank { c.optString("nome_fantasia") }, 18f, bold = true))
        box.addView(tv(if (cachedPrices) "Preço salvo no aparelho (offline)." else "Preços sincronizados em tempo real.", 13f))

        val search = EditText(this).apply {
            hint = "Pesquisar produto por nome, SKU..."
            setTextColor(Color.WHITE)
            setHintTextColor(Color.DKGRAY)
            setPadding(16, 16, 16, 16)
            setBackgroundColor(Color.rgb(20, 29, 44))
        }
        box.addView(search)

        val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        box.addView(list)
        lateinit var renderCart: () -> Unit

        val render = { query: String ->
            list.removeAllViews()
            orderProducts.filter { (it.optString("nome") + " " + it.optString("sku") + " " + it.optString("marca")).contains(query, true) }.forEach { p ->
                val card = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(dp(10), dp(10), dp(10), dp(10))
                    setBackgroundColor(Color.WHITE)
                    val lp = LinearLayout.LayoutParams(-1, -2)
                    lp.bottomMargin = dp(10)
                    layoutParams = lp
                }
                card.addView(productThumb(p))
                card.addView(tv(p.optString("nome"), 16f, dark = true, bold = true))

                // Suporte a Atacado com Quantidade Mínima
                val pNormal = p.optDouble("preco_aplicado", p.optDouble("preco_base", 0.0))
                if (p.has("preco_tabela") && p.optInt("quantidade_minima", 1) > 1) {
                    val precoTab = p.optDouble("preco_tabela")
                    val qtdMin = p.optInt("quantidade_minima")
                    card.addView(tv("Varejo: R$ ${"%.2f".format(pNormal)}", 14f, dark = true))
                    card.addView(tv("Atacado: R$ ${"%.2f".format(precoTab)} (a partir de $qtdMin un.)", 15f, dark = true, bold = true))
                } else {
                    card.addView(tv("R$ ${"%.2f".format(pNormal)} · estoque ${p.optInt("quantidade_disponivel")}", 15f, dark = true, bold = true))
                }

                val add = button("Adicionar ao carrinho").apply {
                    setBackgroundColor(Color.rgb(244, 90, 8))
                    setTextColor(Color.WHITE)
                }
                card.addView(add)
                add.setOnClickListener {
                    val max = p.optInt("quantidade_disponivel")
                    val id = p.optString("id")
                    if (max <= 0) {
                        Toast.makeText(this, "Produto sem estoque disponível.", Toast.LENGTH_SHORT).show()
                    } else {
                        cart[id] = minOf(max, (cart[id] ?: 0) + 1)
                        add.text = "✓ Adicionado (${cart[id]})"
                        Toast.makeText(this, "Item adicionado ao carrinho", Toast.LENGTH_SHORT).show()
                        renderCart()
                    }
                }
                list.addView(card)
            }
        }

        search.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
            override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) { render(s.toString()) }
            override fun afterTextChanged(e: android.text.Editable?) {}
        })
        render("")

        val cartBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(10, 16, 10, 10)
        }
        box.addView(cartBox)

        fun renderLocal() {
            cartBox.removeAllViews()
            cartBox.addView(tv("Carrinho do Pedido — ${cart.values.sum()} itens", 20f, bold = true))

            for ((id, q) in cart) {
                val p = orderProducts.find { it.optString("id") == id } ?: continue
                val pn = p.optDouble("preco_aplicado", p.optDouble("preco_base", 0.0))
                val isWh = p.has("preco_tabela") && p.optInt("quantidade_minima", 1) > 1 && q >= p.optInt("quantidade_minima", 1)
                val pUn = if (isWh) p.optDouble("preco_tabela") else pn

                val lineTitle = if (isWh) "${p.optString("nome")} (Atacado)" else p.optString("nome")
                cartBox.addView(tv("$lineTitle · R$ ${"%.2f".format(pUn)} · $q un. = R$ ${"%.2f".format(q * pUn)}", 15f))

                val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                val minus = button("−")
                val plus = button("+")
                val remove = button("Remover")

                row.addView(minus, LinearLayout.LayoutParams(-2, -2))
                row.addView(tv(q.toString(), 16f, bold = true))
                row.addView(plus, LinearLayout.LayoutParams(-2, -2))
                row.addView(remove, LinearLayout.LayoutParams(-2, -2))
                cartBox.addView(row)

                minus.setOnClickListener {
                    cart[id] = q - 1
                    if (cart[id]!! <= 0) cart.remove(id)
                    renderCart()
                }
                plus.setOnClickListener {
                    cart[id] = minOf(p.optInt("quantidade_disponivel"), (cart[id] ?: 0) + 1)
                    renderCart()
                }
                remove.setOnClickListener {
                    cart.remove(id)
                    renderCart()
                }
            }

            val total = cart.entries.sumOf { (id, q) ->
                val p = orderProducts.find { it.optString("id") == id }
                if (p != null) {
                    val pn = p.optDouble("preco_aplicado", p.optDouble("preco_base", 0.0))
                    val isWh = p.has("preco_tabela") && p.optInt("quantidade_minima", 1) > 1 && q >= p.optInt("quantidade_minima", 1)
                    q * (if (isWh) p.optDouble("preco_tabela") else pn)
                } else 0.0
            }

            cartBox.addView(tv("Total do Pedido: R$ ${"%.2f".format(total)}", 22f, bold = true))

            val submit = button("Emitir Pedido de Venda").apply {
                setBackgroundColor(Color.rgb(244, 90, 8))
                setTextColor(Color.WHITE)
            }
            cartBox.addView(submit)
            submit.setOnClickListener { submitOrder(c, total) }
        }

        renderCart = { renderLocal() }
        renderCart()

        val back = button("← Voltar")
        box.addView(back)
        back.setOnClickListener { home() }
    }

    private fun submitOrder(c: JSONObject, total: Double) {
        if (cart.isEmpty()) return Toast.makeText(this, "Adicione itens ao carrinho antes de emitir.", Toast.LENGTH_SHORT).show()

        val items = JSONArray()
        cart.forEach { (id, q) -> items.put(JSONObject().put("produto_id", id).put("quantidade", q)) }

        val data = JSONObject().apply {
            put("cliente_id", c.optString("id"))
            put("itens", items)
            put("origem", "VENDEDOR")
            put("modalidade_entrega", "ENTREGA")
        }

        val id = UUID.randomUUID().toString()
        val payload = JSONObject().put("data", data).put("idempotency_key", "OFF-$id")

        if (online()) {
            Thread {
                try {
                    val r = Api.request("/api/orders", "POST", token, data.toString(), mapOf("Idempotency-Key" to "OFF-$id"))
                    val num = JSONObject(r).getJSONObject("item").optString("numero")
                    db.put("orders", JSONObject(r).getJSONObject("item"))
                    runOnUiThread {
                        Toast.makeText(this, "Pedido $num emitido com sucesso!", Toast.LENGTH_LONG).show()
                        home()
                    }
                } catch (e: Exception) {
                    db.enqueue("ORDER", payload, id)
                    runOnUiThread {
                        Toast.makeText(this, "Pedido salvo offline; será sincronizado com a Torre.", Toast.LENGTH_LONG).show()
                        home()
                    }
                }
            }.start()
        } else {
            db.enqueue("ORDER", payload, id)
            Toast.makeText(this, "Pedido salvo offline. Será sincronizado assim que a conexão voltar.", Toast.LENGTH_LONG).show()
            home()
        }
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

package br.com.xiquimvargas.pdv

import android.app.*
import android.graphics.Color
import android.os.*
import android.view.*
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class MainActivity : Activity() {
    private lateinit var box: LinearLayout
    private lateinit var db: LocalDb
    private lateinit var session: SecureSession
    private var token: String? = null
    private var clients = mutableListOf<JSONObject>()
    private var products = mutableListOf<JSONObject>()
    private var selectedClient: JSONObject? = null
    private val cart = linkedMapOf<String, Int>()
    private var offline = false
    private var barcodeQuery = ""

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
            layoutParams = LinearLayout.LayoutParams(-1, dp(140))
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
                    decodeThumb(bytes, dp(140))
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
        box.addView(tv("Xiquim Vargas\nFrente de Caixa & PDV", 26f, bold = true))
        box.addView(tv("Terminal inteligente de PDV para balcão, caixa e vendas rápidas com ou sem conexão.", 15f))
        val e = EditText(this).apply { hint = "Email"; setTextColor(Color.WHITE); setHintTextColor(Color.DKGRAY) }
        box.addView(e)
        val p = EditText(this).apply { hint = "Senha"; inputType = 0x81; setTextColor(Color.WHITE); setHintTextColor(Color.DKGRAY) }
        box.addView(p)
        val b = button("Abrir Caixa")
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
                    runOnUiThread { Toast.makeText(this, "Não foi possível abrir o PDV: ${x.message}", Toast.LENGTH_LONG).show() }
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
        box.addView(tv("Informe a URL HTTPS publicada no Render ou endereço local de teste.", 15f))
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
                Toast.makeText(this, "Informe uma URL válida do ERP.", Toast.LENGTH_LONG).show()
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
        box.addView(tv("Terminal PDV — Balcão", 24f, bold = true))
        val status = tv("Conectando...", 15f)
        box.addView(status)

        Thread {
            try {
                sync()
                offline = false
            } catch (_: Exception) {
                offline = true
                loadCache()
            }
            runOnUiThread {
                status.text = if (offline) "● MODO OFFLINE — vendas locais no aparelho" else "● MODO ONLINE — terminal integrado"
                renderPdvMain()
            }
        }.start()
    }

    private fun loadCache() {
        clients = db.all("clients").toMutableList()
        products = db.all("products").toMutableList()
    }

    private fun sync() {
        val t = token ?: throw Exception("Sessão não encontrada")
        val c = JSONObject(Api.request("/api/clients", token = t)).getJSONArray("items").toList()
        db.replace("clients", c)
        clients = c.toMutableList()

        val p = JSONObject(Api.request("/api/products", token = t)).getJSONArray("items").toList()
        val st = JSONObject(Api.request("/api/stock", token = t)).optJSONArray("items")?.toList() ?: emptyList()
        val stock = st.associateBy { it.optString("produto_id", it.optString("id")) }
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
    }

    private fun syncOutbox() {
        val t = token ?: return
        for (item in db.pending()) {
            val id = item.getString("id")
            val type = item.getString("type")
            val payload = item.getJSONObject("payload")
            try {
                when (type) {
                    "ORDER" -> {
                        val body = Api.request("/api/orders", "POST", t, payload.getJSONObject("data").toString(), mapOf("Idempotency-Key" to payload.optString("idempotency_key", "OFF-$id")))
                        db.put("orders", JSONObject(body).getJSONObject("item"))
                    }
                }
                db.done(id)
            } catch (e: Exception) {
                db.fail(id, e.message ?: "Falha na sincronização")
            }
        }
    }

    private fun renderPdvMain() {
        box.removeAllViews()
        box.addView(tv("Xiquim Vargas — PDV", 24f, bold = true))
        box.addView(tv(if (offline) "● OFFLINE" else "● ONLINE", 14f))
        box.addView(tv("${products.size} produtos carregados · ${db.pendingCount()} vendas pendentes", 14f))

        // Botão de Destaque: Venda Rápida Consumidor Balcão
        val quickBtn = button("⚡ Venda Rápida de Balcão (Consumidor)").apply {
            setBackgroundColor(Color.rgb(244, 90, 8))
            setTextColor(Color.WHITE)
            textSize = 17f
            val lp = LinearLayout.LayoutParams(-1, -2)
            lp.topMargin = dp(10)
            lp.bottomMargin = dp(14)
            layoutParams = lp
        }
        box.addView(quickBtn)
        quickBtn.setOnClickListener {
            // Seleciona CLIENTE-BALCAO ou primeiro cliente
            val defaultCli = clients.find { it.optString("id") == "CLIENTE-BALCAO" } ?: JSONObject().apply {
                put("id", "CLIENTE-BALCAO")
                put("razao_social", "Consumidor Final (Balcão)")
                put("nome_fantasia", "Cliente Balcão")
            }
            startPdvSale(defaultCli)
        }

        // Escolha de cliente identificado
        box.addView(tv("Ou selecione um cliente cadastrado:", 15f, bold = true))
        val clientSelect = Spinner(this)
        val clientLabels = listOf("Consumidor Final (Padrão)") + clients.filter { it.optString("id") != "CLIENTE-BALCAO" }.map {
            it.optString("razao_social").ifBlank { it.optString("nome_fantasia") }
        }
        clientSelect.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, clientLabels)
        box.addView(clientSelect)

        val identifiedSaleBtn = button("Iniciar Venda para Cliente Selecionado").apply {
            setBackgroundColor(Color.rgb(40, 55, 80))
            setTextColor(Color.WHITE)
        }
        box.addView(identifiedSaleBtn)
        identifiedSaleBtn.setOnClickListener {
            val idx = clientSelect.selectedItemPosition
            val chosen = if (idx == 0) {
                clients.find { it.optString("id") == "CLIENTE-BALCAO" } ?: JSONObject().apply {
                    put("id", "CLIENTE-BALCAO")
                    put("razao_social", "Consumidor Final (Balcão)")
                }
            } else {
                clients.filter { it.optString("id") != "CLIENTE-BALCAO" }[idx - 1]
            }
            startPdvSale(chosen)
        }

        val refresh = button("↻ Atualizar / Sincronizar")
        box.addView(refresh)
        refresh.setOnClickListener { home() }

        val cfg = button("⚙ Configurar Servidor")
        box.addView(cfg)
        cfg.setOnClickListener { configScreen() }

        val out = button("Fechar Caixa / Sair")
        box.addView(out)
        out.setOnClickListener {
            session.clear()
            token = null
            login()
        }
    }

    private fun startPdvSale(c: JSONObject) {
        selectedClient = c
        cart.clear()
        renderPdvTerminal()
    }

    private fun renderPdvTerminal() {
        val c = selectedClient ?: return
        root()
        val cName = c.optString("razao_social").ifBlank { c.optString("nome_fantasia", "Consumidor Final") }
        box.addView(tv("Caixa Aberto — $cName", 20f, bold = true))

        // Campo de Bipagem de Código de Barras / SKU / Busca Rápida
        val barcodeRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val barcodeInput = EditText(this).apply {
            hint = "🔍 Bipar Código de Barras ou digitar SKU"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.DKGRAY)
            setPadding(20, 20, 20, 20)
            setBackgroundColor(Color.rgb(20, 29, 44))
            isSingleLine = true
            imeOptions = android.view.inputmethod.EditorInfo.IME_ACTION_DONE
        }
        val biparBtn = button("Bipar / +").apply {
            setBackgroundColor(Color.rgb(244, 90, 8))
            setTextColor(Color.WHITE)
        }

        barcodeRow.addView(barcodeInput, LinearLayout.LayoutParams(0, -2, 1f))
        barcodeRow.addView(biparBtn, LinearLayout.LayoutParams(-2, -2))
        box.addView(barcodeRow)

        lateinit var updateCartBox: () -> Unit

        fun tryAddBarcode(code: String) {
            val q = code.trim().lowercase()
            if (q.isBlank()) return
            val found = products.find {
                it.optString("codigo_barras").lowercase() == q ||
                it.optString("sku").lowercase() == q ||
                it.optString("nome").lowercase().contains(q)
            }
            if (found != null) {
                val pid = found.optString("id")
                val stock = found.optInt("quantidade_disponivel", 9999)
                val cur = cart[pid] ?: 0
                if (cur < stock) {
                    cart[pid] = cur + 1
                    barcodeInput.setText("")
                    Toast.makeText(this, "+1 ${found.optString("nome")}", Toast.LENGTH_SHORT).show()
                    updateCartBox()
                } else {
                    Toast.makeText(this, "Estoque máximo atingido para ${found.optString("nome")}", Toast.LENGTH_SHORT).show()
                }
            } else {
                Toast.makeText(this, "Item \"$code\" não encontrado!", Toast.LENGTH_SHORT).show()
            }
        }

        barcodeInput.setOnEditorActionListener { _, _, _ ->
            tryAddBarcode(barcodeInput.text.toString())
            true
        }
        biparBtn.setOnClickListener {
            tryAddBarcode(barcodeInput.text.toString())
        }

        // Grade do Carrinho e Total
        val cartBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(10, 14, 10, 10)
        }
        box.addView(cartBox)

        fun renderCartLines() {
            cartBox.removeAllViews()
            cartBox.addView(tv("Itens da Venda (${cart.values.sum()} un)", 18f, bold = true))

            if (cart.isEmpty()) {
                cartBox.addView(tv("Nenhum item adicionado. Bipe um produto ou use a lista abaixo.", 14f))
            }

            for ((id, q) in cart) {
                val p = products.find { it.optString("id") == id } ?: continue
                val pNormal = p.optDouble("preco_aplicado", p.optDouble("preco_base", 0.0))
                val isWh = p.has("preco_tabela") && p.optInt("quantidade_minima", 1) > 1 && q >= p.optInt("quantidade_minima", 1)
                val pUn = if (isWh) p.optDouble("preco_tabela") else pNormal

                val lineName = if (isWh) "${p.optString("nome")} (Atacado)" else p.optString("nome")
                cartBox.addView(tv("$lineName · R$ ${"%.2f".format(pUn)} x $q = R$ ${"%.2f".format(q * pUn)}", 15f))

                val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
                val minus = button("−")
                val plus = button("+")
                val remove = button("Excluir")

                row.addView(minus, LinearLayout.LayoutParams(-2, -2))
                row.addView(tv(q.toString(), 16f, bold = true))
                row.addView(plus, LinearLayout.LayoutParams(-2, -2))
                row.addView(remove, LinearLayout.LayoutParams(-2, -2))
                cartBox.addView(row)

                minus.setOnClickListener {
                    cart[id] = q - 1
                    if (cart[id]!! <= 0) cart.remove(id)
                    renderCartLines()
                }
                plus.setOnClickListener {
                    cart[id] = minOf(p.optInt("quantidade_disponivel", 9999), (cart[id] ?: 0) + 1)
                    renderCartLines()
                }
                remove.setOnClickListener {
                    cart.remove(id)
                    renderCartLines()
                }
            }

            val total = cart.entries.sumOf { (id, q) ->
                val p = products.find { it.optString("id") == id }
                if (p != null) {
                    val pn = p.optDouble("preco_aplicado", p.optDouble("preco_base", 0.0))
                    val isWh = p.has("preco_tabela") && p.optInt("quantidade_minima", 1) > 1 && q >= p.optInt("quantidade_minima", 1)
                    q * (if (isWh) p.optDouble("preco_tabela") else pn)
                } else 0.0
            }

            cartBox.addView(tv("Subtotal: R$ ${"%.2f".format(total)}", 22f, bold = true))

            if (cart.isNotEmpty()) {
                val checkoutBtn = button("✔ Finalizar e Fechar Venda").apply {
                    setBackgroundColor(Color.rgb(34, 197, 94)) // Green
                    setTextColor(Color.WHITE)
                    textSize = 18f
                }
                cartBox.addView(checkoutBtn)
                checkoutBtn.setOnClickListener {
                    openPdvCheckoutDialog(c, total)
                }
            }
        }

        updateCartBox = { renderCartLines() }
        renderCartLines()

        // Catálogo Rápido com Pesquisa de Nome
        box.addView(tv("Catálogo de Produtos Rápidos:", 16f, bold = true))
        val catSearch = EditText(this).apply {
            hint = "Filtrar por nome de produto..."
            setTextColor(Color.WHITE)
            setHintTextColor(Color.DKGRAY)
            setPadding(16, 16, 16, 16)
            setBackgroundColor(Color.rgb(20, 29, 44))
        }
        box.addView(catSearch)

        val quickList = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        box.addView(quickList)

        fun renderCatList(q: String) {
            quickList.removeAllViews()
            val filtered = products.filter {
                (it.optString("nome") + " " + it.optString("sku") + " " + it.optString("marca")).contains(q, true)
            }.take(30)

            for (p in filtered) {
                val itemRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    setPadding(12, 10, 12, 10)
                    setBackgroundColor(Color.rgb(20, 29, 44))
                    val lp = LinearLayout.LayoutParams(-1, -2)
                    lp.topMargin = dp(4)
                    layoutParams = lp
                }
                val pPrice = p.optDouble("preco_aplicado", p.optDouble("preco_base", 0.0))
                val info = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
                info.addView(tv(p.optString("nome"), 15f, bold = true))
                info.addView(tv("R$ ${"%.2f".format(pPrice)} · Estoque: ${p.optInt("quantidade_disponivel")}", 13f))

                val addBtn = button("+ Adicionar")
                addBtn.setOnClickListener {
                    val pid = p.optString("id")
                    val st = p.optInt("quantidade_disponivel", 9999)
                    if (st <= 0) {
                        Toast.makeText(this, "Produto sem estoque.", Toast.LENGTH_SHORT).show()
                    } else {
                        cart[pid] = minOf(st, (cart[pid] ?: 0) + 1)
                        renderCartLines()
                    }
                }

                itemRow.addView(info, LinearLayout.LayoutParams(0, -2, 1f))
                itemRow.addView(addBtn, LinearLayout.LayoutParams(-2, -2))
                quickList.addView(itemRow)
            }
        }

        catSearch.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
            override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) { renderCatList(s.toString()) }
            override fun afterTextChanged(e: android.text.Editable?) {}
        })
        renderCatList("")

        val cancelBtn = button("← Cancelar / Voltar ao Início")
        box.addView(cancelBtn)
        cancelBtn.setOnClickListener { home() }
    }

    private fun openPdvCheckoutDialog(c: JSONObject, total: Double) {
        val d = AlertDialog.Builder(this)
        d.setTitle("Fechamento de Venda — R$ ${"%.2f".format(total)}")

        val form = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(30, 20, 30, 20)
        }

        form.addView(tv("Forma de Pagamento:", 14f, dark = true, bold = true))
        val methodSpinner = Spinner(this)
        val methods = arrayOf("DINHEIRO", "PIX", "CARTAO_DEBITO", "CARTAO_CREDITO", "A_PRAZO")
        methodSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, methods)
        form.addView(methodSpinner)

        form.addView(tv("Valor em Dinheiro Recebido (R$):", 14f, dark = true, bold = true))
        val cashInput = EditText(this).apply {
            hint = "0,00"
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL
        }
        form.addView(cashInput)

        val trocoLabel = tv("Troco a devolver: R$ 0,00", 15f, dark = true, bold = true)
        form.addView(trocoLabel)

        cashInput.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
            override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) {
                val received = s.toString().toDoubleOrNull() ?: 0.0
                val troco = maxOf(0.0, received - total)
                trocoLabel.text = "Troco a devolver: R$ ${"%.2f".format(troco)}"
            }
            override fun afterTextChanged(e: android.text.Editable?) {}
        })

        form.addView(tv("Observação do Pedido (opcional):", 14f, dark = true))
        val obsInput = EditText(this).apply { hint = "Ex.: Pago com desconto balcão" }
        form.addView(obsInput)

        d.setView(form)

        d.setPositiveButton("Confirmar e Emitir") { _, _ ->
            val payMethod = methodSpinner.selectedItem.toString()
            val obs = obsInput.text.toString().trim()
            submitPdvOrder(c, total, payMethod, obs)
        }
        d.setNegativeButton("Cancelar", null)
        d.show()
    }

    private fun submitPdvOrder(c: JSONObject, total: Double, payMethod: String, obs: String) {
        val items = JSONArray()
        cart.forEach { (id, q) -> items.put(JSONObject().put("produto_id", id).put("quantidade", q)) }

        val data = JSONObject().apply {
            put("cliente_id", c.optString("id"))
            put("itens", items)
            put("origem", "BALCAO")
            put("modalidade_entrega", "RETIRADA")
            put("observacoes", "PDV Caixa · $payMethod${if (obs.isNotBlank()) " · $obs" else ""}")
        }

        val id = UUID.randomUUID().toString()
        val payload = JSONObject().put("data", data).put("idempotency_key", "PDV-$id")

        if (online()) {
            Thread {
                try {
                    val r = Api.request("/api/orders", "POST", token, data.toString(), mapOf("Idempotency-Key" to "PDV-$id"))
                    val num = JSONObject(r).getJSONObject("item").optString("numero")
                    db.put("orders", JSONObject(r).getJSONObject("item"))
                    runOnUiThread {
                        Toast.makeText(this, "Venda $num finalizada com sucesso no caixa!", Toast.LENGTH_LONG).show()
                        home()
                    }
                } catch (e: Exception) {
                    db.enqueue("ORDER", payload, id)
                    runOnUiThread {
                        Toast.makeText(this, "Venda salva offline; será sincronizada com a Torre.", Toast.LENGTH_LONG).show()
                        home()
                    }
                }
            }.start()
        } else {
            db.enqueue("ORDER", payload, id)
            Toast.makeText(this, "Venda registrada offline no caixa. Será sincronizada quando a rede voltar.", Toast.LENGTH_LONG).show()
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

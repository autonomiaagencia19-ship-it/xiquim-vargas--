# Blueprint de Atualização dos Aplicativos Nativos (APKs)

Com base nas modificações recentes na lógica de precificação (Tabelas de Preços com Quantidade Mínima), foi realizada uma análise profunda nos repositórios nativos Android do ERP (`seller-native` e `driver-native`).

## 1. Aplicativo Vendedor (`seller-native`)

### Estado Atual
Atualmente, no arquivo `MainActivity.kt` (em `renderOrder` e renderização do carrinho local), o cálculo do valor dos itens no carrinho e a exibição do catálogo funcionam da seguinte forma:
- Ele busca o preço unitário através de `p.optDouble("preco_aplicado", p.optDouble("preco_base"))`.
- Ele multiplica cegamente pela quantidade `q` escolhida no carrinho para obter o subtotal da linha.
- Ele **não** tem ciência de limites de quantidade mínima, ignorando completamente os campos `preco_tabela` e `quantidade_minima` que a API passou a enviar.

### Mudanças Necessárias (Blueprint)
Para alinhar o aplicativo offline do Vendedor ao ERP, o `MainActivity.kt` precisará das seguintes alterações no escopo da função `renderOrder()`:

**A. Na Listagem do Catálogo (Busca):**
Ao montar a UI do produto (`val card = LinearLayout(...)`), será necessário alterar a linha que exibe o preço:
```kotlin
val precoNormal = p.optDouble("preco_aplicado", p.optDouble("preco_base", 0.0))
if (p.has("preco_tabela") && p.optInt("quantidade_minima", 1) > 1) {
    val precoTab = p.optDouble("preco_tabela")
    val qtdMin = p.optInt("quantidade_minima")
    card.addView(tv("Varejo: R$ ${"%.2f".format(precoNormal)}", 14f, true))
    card.addView(tv("Atacado: R$ ${"%.2f".format(precoTab)} (a partir de $qtdMin un.)", 15f, true))
} else {
    card.addView(tv("R$ ${"%.2f".format(precoNormal)} · estoque ${p.optInt("quantidade_disponivel")}", 15f, true))
}
```

**B. Na Renderização e Cálculo do Carrinho (`renderLocal`):**
Ao montar as linhas do carrinho e calcular o `Total dos itens`, a lógica matemática precisa avaliar condicionalmente a quantidade `q` escolhida em tempo real:
```kotlin
// Dentro do for((id,q) in cart) ...
val precoNormal = p.optDouble("preco_aplicado", p.optDouble("preco_base", 0.0))
val hasTable = p.has("preco_tabela") && p.optInt("quantidade_minima", 1) > 1
val isWholesale = hasTable && q >= p.optInt("quantidade_minima")
val precoUnidade = if (isWholesale) p.optDouble("preco_tabela") else precoNormal

cartBox.addView(tv("${p.optString("nome")} · R$ ${"%.2f".format(precoUnidade)} · $q un.", 15f))
```

E no somatório do rodapé:
```kotlin
val total = cart.entries.sumOf { (id, q) ->
    val p = orderProducts.find { it.optString("id") == id }
    if (p != null) {
        val pn = p.optDouble("preco_aplicado", p.optDouble("preco_base", 0.0))
        val isWh = p.has("preco_tabela") && p.optInt("quantidade_minima", 1) > 1 && q >= p.optInt("quantidade_minima")
        q * (if (isWh) p.optDouble("preco_tabela") else pn)
    } else 0.0
}
```

**C. Banco de Dados Local (`LocalDb.kt`):**
**Nenhuma alteração é necessária.** O banco SQLite armazena os produtos e respostas da API em colunas do tipo `TEXT` contendo os `JSONObjects` completos (`json TEXT NOT NULL`). As chaves `preco_tabela` e `quantidade_minima` já estarão embutidas automaticamente ao sincronizar o catálogo!

---

## 2. Aplicativo Motorista (`driver-native`)

### Estado Atual
O `driver-native` consome os endpoints logísticos (`/api/logistics/routes` e os pedidos em si via `/api/orders`) e exibe UI de endereços, acionando o envio do canhoto fotográfico e concluindo os pedidos.

### Mudanças Necessárias (Blueprint)
**Nenhuma alteração é necessária!** 
A lógica de precificação e total de um pedido é "congelada" e resolvida no momento da criação da venda (origens WEB, BALCAO ou VENDEDOR). O aplicativo do motorista não recalcula valores em tempo real, limitando-se apenas à operação logística das entregas já montadas pelo ERP.

---

## Compilação Local

Verifiquei se é possível compilar localmente o repositório agora, e a resposta é **Não**, pelos seguintes motivos:
- Os pacotes dependem de todo o ambiente Android e da _toolchain_ Java.
- O utilitário `gradle` (ou o Wrapper `gradlew`) **não** está presente no path nem no diretório atual deste workspace virtual.
- Sem o SDK (Android Platform 35 e afins) instalado na máquina, a build falha.

A documentação incluída no próprio repositório (`README.md`) aponta que existe um **Workflow no GitHub Actions** pronto para isso. A solução ideal para gerar os `.apk` finais de release/debug é submeter os _commits_ das alterações do Kotlin e deixar o pipeline de integração contínua (CI/CD) gerar os binários na nuvem limpa.

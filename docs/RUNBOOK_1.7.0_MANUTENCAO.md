# RUNBOOK DE MANUTENÇÃO — Xiquim Vargas ERP 1.7.0

## 1. Princípio operacional

O ERP deve ser tratado como cinco superfícies independentes:

1. Catálogo — informação comercial.
2. Estoque — saldo físico/operacional.
3. Pedidos — transação.
4. Logística — execução.
5. Governança — usuários, auditoria, relatórios e configurações.

**Nunca corrigir estoque editando produto.**

## 2. Inicialização

```powershell
npm install
npm start
```

Verificação:

```powershell
Invoke-WebRequest http://localhost:3000/health | Select-Object -ExpandProperty Content
```

## 3. Backup

```powershell
npm run backup
```

O backup deve ser copiado para mídia externa em produção.

## 4. Diagnóstico

```powershell
npm run qa
npm run qa:50:v17
npm run qa:redteam:v17
npm run qa:pdf:v17
```

## 5. Catálogo

Para alterar:

`Torre de Controle → Catálogo`

É permitido:
- nome;
- SKU;
- código de barras;
- marca;
- sabor;
- tamanho;
- unidade;
- categoria/subcategoria;
- descrição;
- preço base;
- fotos;
- promoções.

Não é permitido usar o catálogo para alterar:
- quantidade disponível;
- quantidade reservada;
- estoque mínimo;
- movimentações.

## 6. Estoque

Para alterar:

`Torre de Controle → Estoque Inteligente`

Tipos:
- ENTRADA;
- SAIDA;
- AJUSTE;
- INVENTARIO.

Toda movimentação deve possuir observação quando não for autoexplicativa.

## 7. Fotos

Estrutura:

```text
storage/
└── product-images/
    └── <produto-id>/
        ├── <imagem-id>.jpg
        ├── <imagem-id>.png
        └── ...
```

O SQLite armazena apenas metadados e o caminho do arquivo.

Nunca apagar manualmente uma imagem sem remover seu registro correspondente.

## 8. Promoções

Promoções não alteram estoque.

O preço efetivo é resolvido pelo backend. Se existir promoção válida, ela tem precedência sobre a tabela de preço/base.

## 9. PDF

Se um PDF de pedido não estiver disponível:

```text
Torre de Controle → Pedidos → PDF
```

O backend tenta reconstruí-lo quando necessário.

Para reconstrução administrativa em lote:

```text
POST /api/admin/rebuild-pdfs
```

## 10. Câmera/canhoto

No Android, o botão `Canhoto` solicita a câmera traseira quando o navegador/dispositivo suporta `capture="environment"`.

Fallback: seleção de imagem da galeria.

## 11. Vendedor

O vendedor pode consultar:

```text
Vendedor → Estoque
```

Apenas:
- produto;
- SKU;
- descrição;
- quantidade existente.

Não possui permissão de alteração.

## 12. Falhas comuns

### Login com erro de FormData
Confirmar que `role.js` usa:

```javascript
new FormData(e.currentTarget)
```

### Tela sem acentos
1. Confirmar `meta charset="utf-8"`.
2. Confirmar `styles.css?v=1.7.0`.
3. Fazer `Ctrl+F5`.
4. Confirmar que os arquivos estão salvos em UTF-8.

### Foto não aparece
1. Verificar existência do arquivo em `storage/product-images`.
2. Consultar `produto_imagens`.
3. Testar `/media/product-images/...`.
4. Não trocar para URL externa como workaround.

### Estoque divergente
Executar:

```text
GET /api/admin/reconcile
```

Não corrigir manualmente a tabela `estoque` sem registrar a movimentação correspondente.

## 13. Integridade SQLite

```sql
PRAGMA integrity_check;
PRAGMA foreign_key_check;
```

Resultado esperado:

```text
ok
0 linhas
```

## 14. Rollback

Em caso de release problemática:

1. parar servidor;
2. preservar logs e banco atual;
3. restaurar backup consistente;
4. voltar ao pacote anterior;
5. executar `npm run qa`;
6. só então liberar operação.

## 15. Regra de ouro

Antes de adicionar complexidade, perguntar:

> A operação realmente precisa disso ou estamos criando uma nova fonte de falhas?

O ERP deve permanecer pequeno, determinístico e observável.

## 16. Gestão da Loja Online

Na Torre:

`Loja Online`

É possível editar:
- título;
- subtítulo;
- texto principal;
- rodapé.

A separação é intencional:

```text
Loja Online
   ├── conteúdo editorial → painel Loja Online
   ├── produtos → Catálogo
   ├── fotos → Fotos do produto
   ├── promoções → Promoções
   └── estoque → Estoque Inteligente
```

Isso evita que uma alteração editorial ou comercial modifique acidentalmente o saldo físico.

# AUTONOMIA SYSTEMS — RUNBOOK OPERACIONAL
**Rotinas Diárias, Protocolos de Controle, Gestão de Devoluções e Contingência**  
**Versão:** 2.2.1 / 1.8.2 Delivery Hardened | **APKs Nativos:** v1.8.3  
**Ambiente:** https://xiquim-vargas-erp.onrender.com | **Data:** Outubro de 2026

---

## 1. OBJETIVO E ESCOPO OPERACIONAL
Este Runbook Operacional constitui o manual padrão de procedimentos (SOP - Standard Operating Procedures) para as equipes da Torre de Controle, Expedição, Caixas do PDV, Encarregados de Estoque, Vendedores e Motoristas do Xiquim Vargas.

---

## 2. ROTINA DE ABERTURA DE TURNO (CHECKLIST MATINAL)
Trinta minutos antes do início do expediente, o encarregado deve cumprir o checklist:
1. **Verificação de Saúde do Servidor:** Acessar `https://xiquim-vargas-erp.onrender.com/ready`. O retorno HTTP 200 `{ status: "ready", db: "ok", storage: "ok" }` atesta que a aplicação, o SQLite e o disco de 10GB em `/var/data` estão operacionais.
2. **Conexão em Tempo Real:** Abrir a Torre de Controle e confirmar o indicador visual verde de SSE ativo no topo da tela.
3. **Triagem de Pedidos Pendentes:** Validar pedidos emitidos via Loja Online durante a noite ou recebidos dos vendedores externos, liberando-os para separação.
4. **Escala Logística e Cargas:** Confirmar os motoristas escalados para as rotas do dia e conferir a disponibilidade dos veículos.

---

## 3. INSTALAÇÃO E DISTRIBUIÇÃO DOS 4 APKS NATIVOS
Os aplicativos móveis encontram-se compilados na pasta local `/dist-apks/` da entrega:
* `XiquimVargas-Vendedor-1.8.3.apk`
* `XiquimVargas-Motorista-1.8.3.apk`
* `XiquimVargas-PDV-1.8.3.apk`
* `XiquimVargas-TorreControle-1.8.3.apk`

### 3.1 Procedimento de Instalação no Dispositivo Android:
1. Envie o arquivo APK correspondente ao celular do colaborador (via cabo USB, WhatsApp Web ou download direto).
2. Toque no arquivo APK e confirme a permissão "Instalar aplicativos de fontes desconhecidas".
3. Ao abrir o aplicativo, o ícone oficial HD (`01_Logo_Xiquim_Vargas_HD`) será exibido.
4. **Não é necessário configurar nenhuma URL:** o endereço de produção (`https://xiquim-vargas-erp.onrender.com`) e os arquivos locais já estão embutidos.
5. O aplicativo abre instantaneamente com ou sem internet.

---

## 4. PROTOCOLO DE DEVOLUÇÕES E REVERSÃO LOGÍSTICA
Quando o motorista não consegue realizar a entrega de uma parada:
1. No app do motorista, ele seleciona a ocorrência e clica em **"Registrar Retorno"**.
2. **Reversão Automática:** O pedido retorna de `ROTA` diretamente para `SEPARACAO`, desvinculando-se da carga do veículo e restaurando o saldo do romaneio.
3. **Painel de Retornos na Torre:** A Torre de Controle recebe o evento SSE imediatamente no painel "Pedidos que Retornaram", permitindo recontato com o cliente e re-roteamento para o turno seguinte.

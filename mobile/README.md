# Apps nativos — operação online/offline

Há dois aplicativos Android nativos:

- `seller-native`: Vendedor Externo
- `driver-native`: Motorista

Eles usam o mesmo backend do ERP, mas possuem banco SQLite local para continuidade operacional.

## Vendedor

Após o primeiro login online, o aplicativo mantém localmente:
- clientes da carteira;
- catálogo necessário;
- estoque conhecido;
- pedidos;
- fila de operações pendentes.

Sem internet, o vendedor pode continuar cadastrando clientes e emitindo pedidos. As operações ficam na fila local e são enviadas quando a conexão voltar.

## Motorista

Após sincronizar a rota, o aplicativo mantém localmente:
- rotas;
- pedidos da rota;
- status das paradas;
- comprovantes de entrega;
- fila de sincronização.

Uma entrega pode ser registrada sem internet. O comprovante é guardado no aparelho e enviado antes da conclusão ser sincronizada.

## Persistência

Atualização do APK preserva o banco local do aplicativo. Os projetos ativam o backup/restauração oficial do Android para banco, preferências e comprovantes. A restauração após desinstalação depende do backup disponível no dispositivo/conta.

O banco central do ERP continua sendo a fonte oficial dos dados.

## Fallback web

Se o APK apresentar falha e houver internet, o administrador pode enviar a URL da interface web do Vendedor ou Motorista. O usuário entra com as mesmas credenciais e continua a operação.

## Build

O projeto usa Android nativo/Kotlin e não depende de Expo Go.

Com Android Studio/SDK e Gradle disponíveis:

```bash
cd mobile
./gradlew -PapiBaseUrl=https://SEU-RENDER-URL.onrender.com :seller-native:assembleRelease :driver-native:assembleRelease
```

Também existe workflow de build no GitHub Actions para gerar os APKs em ambiente limpo, sem depender do computador do cliente.

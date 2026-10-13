# Build Android APKs

Os apps são projetos Gradle independentes: `seller-native` e `driver-native`. Requerem JDK 17, Android SDK Platform 35 e Gradle compatível.

No PowerShell, com `ANDROID_HOME` apontando ao SDK e Gradle no PATH:

```powershell
gradle --no-daemon --max-workers=1 "-Dorg.gradle.jvmargs=-Xmx768m -XX:MaxMetaspaceSize=384m" -p mobile/seller-native assembleDebug
gradle --no-daemon --max-workers=1 "-Dorg.gradle.jvmargs=-Xmx768m -XX:MaxMetaspaceSize=384m" -p mobile/driver-native assembleDebug
```

Builds sequenciais limitam o uso de memória. Não compile `mobile` como projeto raiz. Não inclua `local.properties`, `.gradle`, `.kotlin` ou `app/build` no controle de versão.

A URL padrão aponta ao emulador Android `10.0.2.2:3000`. Em dispositivo/produção, abra Configurar URL do servidor no APK e informe a URL HTTPS do ERP. `-PapiBaseUrl=https://erp.exemplo.com` também pode definir a URL no build.

Para distribuição comercial, incremente `versionCode`, configure assinatura corporativa em armazenamento seguro e compile a variante release. Os APKs incluídos neste pacote estão assinados com Android Debug e não usam keystore do cliente.

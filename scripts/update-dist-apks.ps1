# Update all distribution and root APKs with the freshly compiled debug APKs

$map = @{
    'TorreControle' = 'mobile\tower-native\app\build\outputs\apk\debug\app-debug.apk'
    'Motorista'     = 'mobile\driver-native\app\build\outputs\apk\debug\app-debug.apk'
    'PDV'           = 'mobile\pdv-native\app\build\outputs\apk\debug\app-debug.apk'
    'Vendedor'      = 'mobile\seller-native\app\build\outputs\apk\debug\app-debug.apk'
}

$dirs = @('dist-apks', 'mobile\apks', 'apks versao final')
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

foreach ($item in $map.GetEnumerator()) {
    $name = $item.Key
    $src = $item.Value
    
    if (-not (Test-Path $src)) {
        Write-Error "Arquivo de origem não encontrado: $src"
        continue
    }

    Write-Host "Atualizando APKs de $name a partir de $src..."

    # dist-apks
    Copy-Item -Path $src -Destination "dist-apks\XiquimVargas-$name-1.8.3.apk" -Force

    # mobile\apks
    Copy-Item -Path $src -Destination "mobile\apks\XiquimVargas-$name.apk" -Force

    # apks versao final
    Copy-Item -Path $src -Destination "apks versao final\XiquimVargas-$name.apk" -Force

    # pasta raiz
    Copy-Item -Path $src -Destination "XiquimVargas-$name-1.8.3.apk" -Force
    Copy-Item -Path $src -Destination "XiquimVargas-$name.apk" -Force

    if ($name -eq 'PDV') {
        Copy-Item -Path $src -Destination "dist-apks\XiquimVargas-Caixa-1.8.3.apk" -Force
        Copy-Item -Path $src -Destination "mobile\apks\XiquimVargas-Caixa.apk" -Force
        Copy-Item -Path $src -Destination "apks versao final\XiquimVargas-Caixa.apk" -Force
        Copy-Item -Path $src -Destination "XiquimVargas-Caixa-1.8.3.apk" -Force
        Copy-Item -Path $src -Destination "XiquimVargas-Caixa.apk" -Force
    }
}

Write-Host "Todos os APKs foram atualizados com sucesso com o novo build!"

# Recompilar APENAS Vendedor e Torre de Controle
$ErrorActionPreference = "Stop"

$rootDir = (Get-Location).Path

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " RECOMPILANDO APENAS: VENDEDOR E TORRE DE CONTROLE" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Sincronizar assets
Write-Host "`n=== 1. Sincronizando Assets Web ==="
& powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\sync-mobile-assets.ps1"

# 2. Compilar Vendedor
Write-Host "`n=== 2. Compilando APK do Vendedor (mobile\seller-native) ==="
Set-Location (Join-Path $rootDir "mobile\seller-native")
Remove-Item "C:\Users\edini\.gradle\caches\journal-1\*.lock" -Force -ErrorAction SilentlyContinue
cmd /c "gradlew.bat assembleDebug --no-daemon"
if ($LASTEXITCODE -ne 0) {
    Set-Location $rootDir
    throw "Falha ao compilar o APK do Vendedor."
}
Write-Host "[OK] Vendedor compilado com sucesso!" -ForegroundColor Green

# 3. Compilar Torre de Controle
Write-Host "`n=== 3. Compilando APK da Torre de Controle (mobile\tower-native) ==="
Set-Location (Join-Path $rootDir "mobile\tower-native")
Remove-Item "C:\Users\edini\.gradle\caches\journal-1\*.lock" -Force -ErrorAction SilentlyContinue
cmd /c "gradlew.bat assembleDebug --no-daemon"
if ($LASTEXITCODE -ne 0) {
    Set-Location $rootDir
    throw "Falha ao compilar o APK da Torre de Controle."
}
Write-Host "[OK] Torre de Controle compilada com sucesso!" -ForegroundColor Green

Set-Location $rootDir

# 4. Distribuir os APKs gerados
Write-Host "`n=== 4. Atualizando APKs de Distribuicao e Raiz ==="

$map = @{
    'Vendedor'      = 'mobile\seller-native\app\build\outputs\apk\debug\app-debug.apk'
    'TorreControle' = 'mobile\tower-native\app\build\outputs\apk\debug\app-debug.apk'
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
        Write-Error "Arquivo de origem nao encontrado: $src"
        continue
    }

    Write-Host "Atualizando distribuicao para $name..."
    Copy-Item -Path $src -Destination "dist-apks\XiquimVargas-$name-1.8.5.apk" -Force
    Copy-Item -Path $src -Destination "dist-apks\XiquimVargas-$name-1.8.4.apk" -Force
    Copy-Item -Path $src -Destination "dist-apks\XiquimVargas-$name-1.8.3.apk" -Force
    Copy-Item -Path $src -Destination "mobile\apks\XiquimVargas-$name.apk" -Force
    Copy-Item -Path $src -Destination "apks versao final\XiquimVargas-$name.apk" -Force
    Copy-Item -Path $src -Destination "XiquimVargas-$name-1.8.5.apk" -Force
    Copy-Item -Path $src -Destination "XiquimVargas-$name-1.8.4.apk" -Force
    Copy-Item -Path $src -Destination "XiquimVargas-$name-1.8.3.apk" -Force
    Copy-Item -Path $src -Destination "XiquimVargas-$name.apk" -Force
    Write-Host "[OK] $name distribuido em todas as pastas e raiz!" -ForegroundColor Green
}

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " RECOMPILACAO E ATUALIZACAO CONCLUIDA COM SUCESSO!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green


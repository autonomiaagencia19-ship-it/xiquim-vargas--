# Build all 4 native apps and update distribution APKs
$ErrorActionPreference = "Stop"

Write-Host "=== 1. Sincronizando Assets Web para Aplicativos Nativos ==="
& powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\sync-mobile-assets.ps1"

$apps = @(
    @{ Name = "Torre de Controle"; Path = "mobile\tower-native" },
    @{ Name = "Vendedor";          Path = "mobile\seller-native" },
    @{ Name = "Caixa";             Path = "mobile\pdv-native" },
    @{ Name = "Motorista";         Path = "mobile\driver-native" }
)

$rootDir = (Get-Location).Path

foreach ($item in $apps) {
    $appName = $item["Name"]
    $appRel = $item["Path"]
    $appFull = Join-Path $rootDir $appRel

    Write-Host "`n=== Compilando APK: $appName em $appRel ==="
    Set-Location $appFull

    Remove-Item "C:\Users\edini\.gradle\caches\journal-1\*.lock" -Force -ErrorAction SilentlyContinue

    cmd /c "gradlew.bat assembleDebug --no-daemon"
    if ($LASTEXITCODE -ne 0) {
        Set-Location $rootDir
        Write-Error "Falha ao compilar $appName"
        exit 1
    }
    Write-Host "[OK] Compilado com sucesso: $appName"
}

Set-Location $rootDir

Write-Host "`n=== 3. Atualizando APKs de Distribuicao e Raiz ==="
& powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\update-dist-apks.ps1"

Write-Host "`n[OK] Todos os 4 APKs compilados e distribuidos com sucesso!"

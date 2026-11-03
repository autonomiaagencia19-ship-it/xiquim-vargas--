# Recompile Torre de Controle APK and replace previous version
$ErrorActionPreference = "Stop"

$rootDir = (Get-Location).Path
Write-Host "=== 1. Sincronizando Assets da Torre ==="
& powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\sync-mobile-assets.ps1"

Write-Host "`n=== 2. Compilando Torre de Controle ==="
Set-Location (Join-Path $rootDir "mobile\tower-native")

Remove-Item "C:\Users\edini\.gradle\caches\journal-1\*.lock" -Force -ErrorAction SilentlyContinue

cmd /c "gradlew.bat assembleDebug --no-daemon"
if ($LASTEXITCODE -ne 0) {
    Set-Location $rootDir
    Write-Error "Falha na compilacao do gradle da Torre de Controle."
    exit 1
}

Set-Location $rootDir

$src = "mobile\tower-native\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $src)) {
    Write-Error "Arquivo compilado nao encontrado: $src"
    exit 1
}

$destinations = @(
    "dist-apks\XiquimVargas-TorreControle-1.8.5.apk",
    "dist-apks\XiquimVargas-TorreControle-1.8.4.apk",
    "dist-apks\XiquimVargas-TorreControle-1.8.3.apk",
    "mobile\apks\XiquimVargas-TorreControle.apk",
    "apks versao final\XiquimVargas-TorreControle.apk",
    "XiquimVargas-TorreControle-1.8.5.apk",
    "XiquimVargas-TorreControle-1.8.4.apk",
    "XiquimVargas-TorreControle-1.8.3.apk",
    "XiquimVargas-TorreControle.apk"
)

Write-Host "`n=== 3. Substituindo versao anterior pelos novos APKs ==="
foreach ($dst in $destinations) {
    $parent = Split-Path $dst -Parent
    if ($parent -and (-not (Test-Path $parent))) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item -Path $src -Destination $dst -Force
    Write-Host "[OK Substituido] $dst"
}

Write-Host "`n[SUCESSO] Torre de Controle recompilada e todas as versoes anteriores foram substituidas com sucesso!"


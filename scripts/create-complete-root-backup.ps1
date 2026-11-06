param(
    [string]$DestinationPath = ""
)

$ErrorActionPreference = "Stop"

$root = (Get-Item -Path ".").FullName
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop -or -not (Test-Path $desktop)) {
    $desktop = 'C:\Users\edini\Desktop'
}

if (-not $DestinationPath) {
    $DestinationPath = Join-Path $desktop "ERP AUTONOMIA SYSTEM VERSAO FINAL.zip"
}

$rootCopyPath = Join-Path $root "ERP AUTONOMIA SYSTEM VERSAO FINAL.zip"
$tempZip = Join-Path $desktop "erp_temp_pack.zip"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " CRIACAO DO BACKUP COMPLETO DA PASTA RAIZ (SEM EXCLUSOES)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Origem:  $root"
Write-Host "Destino: $DestinationPath"
Write-Host "Regra:   TODOS os arquivos e subpastas serao incluidos (exceto .zip)"
Write-Host ""

if (Test-Path $tempZip) { Remove-Item -Force $tempZip }
if (Test-Path $DestinationPath) { Remove-Item -Force $DestinationPath }
if (Test-Path $rootCopyPath) { Remove-Item -Force $rootCopyPath }

# Coleta todos os itens da raiz para incluir
$itemsToInclude = Get-ChildItem -Path $root -Force | Where-Object {
    $_.Extension -ne '.zip' -and $_.Name -notmatch '^backup_temp_' -and $_.Name -notmatch '^erp_temp_'
} | ForEach-Object { $_.Name }

Write-Host "Itens mapeados na raiz ($($itemsToInclude.Count) itens principais):"
foreach ($it in $itemsToInclude) {
    Write-Host "  - $it"
}
Write-Host ""

Write-Host "Iniciando compactacao completa via bsdtar..." -ForegroundColor Yellow
$startTime = Get-Date

# Executa tar.exe chamando cada item da raiz
Push-Location $root
try {
    & tar.exe -a -c -f $tempZip --exclude="*.zip" $itemsToInclude
    if ($LASTEXITCODE -ne 0) {
        throw "Erro na execucao do tar.exe. Codigo: $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

if (-not (Test-Path $tempZip)) {
    throw "Erro: O arquivo temporario $tempZip nao foi gerado."
}

# Move para o destino final no Desktop
Move-Item -Path $tempZip -Destination $DestinationPath -Force

# Copia tambem para a pasta raiz do projeto
Copy-Item -Path $DestinationPath -Destination $rootCopyPath -Force

$finalItem = Get-Item $DestinationPath
$zipMB = [math]::Round($finalItem.Length / 1MB, 2)
$elapsed = (Get-Date) - $startTime

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " BACKUP COMPLETO CONCLUIDO COM SUCESSO!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Arquivo (Desktop):     $($finalItem.FullName)"
Write-Host "Arquivo (Pasta Raiz):  $rootCopyPath"
Write-Host "Tamanho do ZIP final:  $zipMB MB"
Write-Host "Tempo decorrido:       $([math]::Round($elapsed.TotalSeconds, 1)) segundos"
Write-Host "Data de conclusao:     $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""

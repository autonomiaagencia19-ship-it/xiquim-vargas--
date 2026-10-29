param(
    [string]$DestinationPath = ""
)

$ErrorActionPreference = "Stop"

$root = (Get-Item -Path ".").FullName
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'

if (-not $DestinationPath) {
    $DestinationPath = Join-Path $root "BACKUP_XIQUIM_VARGAS_FINAL_29-10-2026.zip"
}

$tempZip = Join-Path $root "backup_temp_$timestamp.zip"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " CRIACAO DE BACKUP COMPLETO E FUNCIONAL (SEM DUPLICATAS)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Origem:  $root"
Write-Host "Destino: $DestinationPath"
Write-Host ""

function ShouldExclude([string]$fullPath, [string]$name) {
    if ($name -match '\.zip$' -or $name -match '\.log$' -or $name -match '\.tmp$') { return $true }
    if ($fullPath -match '\\\.git(\\|$)' -or
        $fullPath -match '\\node_modules(\\|$)' -or
        $fullPath -match '\\coverage(\\|$)' -or
        $fullPath -match '\\build(\\|$)' -or
        $fullPath -match '\\\.gradle(\\|$)' -or
        $fullPath -match '\\\.kotlin(\\|$)' -or
        $fullPath -match '\\storage\\backups(\\|$)' -or
        $fullPath -match '\\\.system_generated(\\|$)') {
        return $true
    }
    return $false
}

# Prioridade de caminho para que arquivos essenciais (public/, src/, storage/, raiz) NUNCA sejam descartados em favor de copias secundarias
function Get-PathPriority([string]$relPath) {
    # 1. Arquivos na pasta public/, src/, storage/, catalog/, scripts/, tests/, cypress/, ops/ tem prioridade maxima
    if ($relPath -match '^(public|src|storage|catalog|scripts|tests|cypress|ops|\.github)/') { return 1 }
    # 2. Arquivos na raiz (incluindo os APKs principais na raiz, exceto PDV que e copia de Caixa)
    if ($relPath -notmatch '/') {
        if ($relPath -eq 'XiquimVargas-PDV.apk') { return 5 }
        return 2
    }
    # 3. Documentacao e manuais
    if ($relPath -match '^(docs|xiquimvargasmanuais)/') { return 3 }
    # 4. Codigo fonte nativo mobile (fora de assets/www e fora de mobile/apks)
    if ($relPath -match '^mobile/' -and $relPath -notmatch '/assets/www/' -and $relPath -notmatch '^mobile/apks/') { return 4 }
    # 5. Copias secundarias (mobile/*/assets/www, dist-apks, apks versao final, mobile/apks, imagens_institucionais_hd)
    return 10
}

Write-Host "1. Mapeando todos os arquivos do projeto..."
$allFiles = Get-ChildItem -Path $root -Recurse -File -Force | Where-Object {
    -not (ShouldExclude $_.FullName $_.Name)
}

Write-Host "   Total de arquivos escaneados: $($allFiles.Count)"

Write-Host "2. Detectando duplicatas (preservando 100% de public/, src/, storage/ e APKs mais recentes na raiz)..."
$sizeGroups = $allFiles | Group-Object Length
$selectedFiles = @()
$duplicatesIgnored = 0
$savedBytes = 0

foreach ($sg in $sizeGroups) {
    if ($sg.Count -eq 1) {
        $selectedFiles += $sg.Group[0]
    } else {
        $hashGroups = $sg.Group | Group-Object { (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash }
        foreach ($hg in $hashGroups) {
            # Se houver arquivos obrigatorios do funcionamento do servidor (prioridade 1), mantem TODOS os de prioridade 1
            $withMeta = $hg.Group | ForEach-Object {
                $rel = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
                [PSCustomObject]@{
                    File     = $_
                    Rel      = $rel
                    Priority = (Get-PathPriority $rel)
                }
            }
            $mandatory = @($withMeta | Where-Object { $_.Priority -eq 1 })
            if ($mandatory.Count -gt 0) {
                foreach ($m in $mandatory) {
                    $selectedFiles += $m.File
                }
                $othersCount = $withMeta.Count - $mandatory.Count
                if ($othersCount -gt 0) {
                    $duplicatesIgnored += $othersCount
                    $savedBytes += ($othersCount * $mandatory[0].File.Length)
                }
            } else {
                $sorted = $withMeta | Sort-Object Priority, @{Expression={$_.File.LastWriteTime}; Descending=$true}
                $kept = $sorted[0].File
                $selectedFiles += $kept

                if ($hg.Count -gt 1) {
                    $ignoredCount = $hg.Count - 1
                    $duplicatesIgnored += $ignoredCount
                    $savedBytes += ($ignoredCount * $kept.Length)
                }
            }
        }
    }
}

Write-Host "   Arquivos selecionados para o backup: $($selectedFiles.Count)"
Write-Host "   Arquivos duplicados ignorados: $duplicatesIgnored"
Write-Host "   Espaco economizado (dados brutos): $([math]::Round($savedBytes / 1MB, 2)) MB"
Write-Host ""

Write-Host "3. Gerando pacote ZIP..."
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $tempZip) { Remove-Item -Force $tempZip }
if (Test-Path $DestinationPath) { Remove-Item -Force $DestinationPath }

$archive = [System.IO.Compression.ZipFile]::Open($tempZip, [System.IO.Compression.ZipArchiveMode]::Create)

$totalFiles = $selectedFiles.Count
$processed = 0
$totalRawBytes = 0

try {
    foreach ($f in $selectedFiles) {
        $rel = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
        $totalRawBytes += $f.Length

        $fileStream = [System.IO.File]::Open($f.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        try {
            $entry = $archive.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
            $entry.LastWriteTime = $f.LastWriteTime
            $entryStream = $entry.Open()
            try {
                $fileStream.CopyTo($entryStream)
            } finally {
                $entryStream.Close()
            }
        } finally {
            $fileStream.Close()
        }

        $processed++
        if ($processed % 200 -eq 0 -or $processed -eq $totalFiles) {
            Write-Host "   Compactando: $processed / $totalFiles arquivos..."
        }
    }
} finally {
    $archive.Dispose()
}

$tempItem = Get-Item $tempZip
if ($tempItem.Length -lt 100000) {
    Remove-Item -Force $tempZip
    throw "Erro: Arquivo zip gerado parece invalido ou muito pequeno ($($tempItem.Length) bytes)."
}

Move-Item -Path $tempZip -Destination $DestinationPath -Force
$finalItem = Get-Item $DestinationPath
$rawMB = [math]::Round($totalRawBytes / 1MB, 2)
$zipMB = [math]::Round($finalItem.Length / 1MB, 2)

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " BACKUP CONCLUIDO COM SUCESSO!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Arquivo:               $($finalItem.FullName)"
Write-Host "Tamanho original:      $rawMB MB"
Write-Host "Tamanho do ZIP final:  $zipMB MB"
Write-Host "Total de arquivos no zip: $totalFiles"
Write-Host "Duplicatas descartadas:   $duplicatesIgnored"
Write-Host "Data de conclusao:     $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"
Write-Host ""

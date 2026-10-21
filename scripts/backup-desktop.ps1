# Backup do ERP Xiquim Vargas diretamente para a Area de Trabalho
$ErrorActionPreference = 'Stop'

$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not (Test-Path $desktop)) {
    $desktop = 'C:\Users\edini\Desktop'
}

$destZip = Join-Path $desktop "BACKUP_ERP_XiquimVargas_$timestamp.zip"
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$tempZip = Join-Path $root "backup_temp_$timestamp.zip"

Write-Host "Iniciando criacao do backup super leve e otimizado..." -ForegroundColor Cyan
Write-Host "Pasta raiz: $root"
Write-Host "Arquivo de destino: $destZip"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $tempZip) { Remove-Item -Force $tempZip }
if (Test-Path $destZip) { Remove-Item -Force $destZip }

$archive = [System.IO.Compression.ZipFile]::Open($tempZip, [System.IO.Compression.ZipArchiveMode]::Create)

function ShouldExclude([string]$fullPath, [string]$name) {
    if ($name -match '\.zip$' -or $name -match '\.log$' -or $name -match '\.tmp$') { return $true }
    if ($fullPath -match '\\\.git(\\|$)' -or
        $fullPath -match '\\node_modules(\\|$)' -or
        $fullPath -match '\\coverage(\\|$)' -or
        $fullPath -match '\\xiquim_imagens_renomeadas(\\|$)' -or
        $fullPath -match '\\max_atendente' -or
        $fullPath -match '\\descri' -or
        $fullPath -match '\\build(\\|$)' -or
        $fullPath -match '\\\.gradle(\\|$)' -or
        $fullPath -match '\\\.kotlin(\\|$)' -or
        $fullPath -match '\\storage\\backups(\\|$)' -or
        $fullPath -match '\\storage\\pdfs(\\|$)') {
        return $true
    }
    return $false
}

try {
    Write-Host "Mapeando diretorios..."
    $dirs = Get-ChildItem -Path $root -Recurse -Force -Directory | Where-Object {
        -not (ShouldExclude $_.FullName $_.Name)
    }

    foreach ($d in $dirs) {
        $rel = $d.FullName.Substring($root.Length + 1).Replace('\', '/') + '/'
        $null = $archive.CreateEntry($rel)
    }

    Write-Host "Compactando arquivos do ERP..."
    $files = Get-ChildItem -Path $root -Recurse -Force | Where-Object {
        -not $_.PSIsContainer -and -not (ShouldExclude $_.FullName $_.Name)
    }

    $totalFiles = $files.Count
    $processed = 0
    $totalRawBytes = 0

    foreach ($f in $files) {
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
        if ($processed % 400 -eq 0 -or $processed -eq $totalFiles) {
            Write-Host "Processados $processed de $totalFiles arquivos..."
        }
    }
} finally {
    $archive.Dispose()
}

$tempItem = Get-Item $tempZip
if ($tempItem.Length -lt 500000) {
    Remove-Item -Force $tempZip
    throw "Erro: Arquivo zip muito pequeno ($($tempItem.Length) bytes)."
}

Move-Item -Path $tempZip -Destination $destZip -Force
$finalItem = Get-Item $destZip
$rawMB = [math]::Round($totalRawBytes / 1MB, 2)
$zipMB = [math]::Round($finalItem.Length / 1MB, 2)

Write-Host ""
Write-Host "SUCESSO: Backup criado com sucesso na Area de Trabalho!" -ForegroundColor Green
Write-Host "Arquivo: $($finalItem.FullName)"
Write-Host "Tamanho original: $rawMB MB"
Write-Host "Tamanho compactado: $zipMB MB"
Write-Host "Total de arquivos incluidos: $totalFiles"
Write-Host "Data/Hora: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"

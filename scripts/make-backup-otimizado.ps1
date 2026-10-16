param(
    [string]$OutputFile = "backup_ERP_XiquimVargasERP_otimizado.zip"
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$destination = Join-Path $root $OutputFile
$tempZip = Join-Path $root "$OutputFile.tmp-$([guid]::NewGuid().ToString('N')).zip"

Write-Host "Iniciando criacao do backup super leve e otimizado..." -ForegroundColor Cyan
Write-Host "Pasta raiz: $root"
Write-Host "Arquivo de destino: $destination"

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (Test-Path $tempZip) {
    Remove-Item -Force $tempZip
}

$archive = [System.IO.Compression.ZipFile]::Open($tempZip, [System.IO.Compression.ZipArchiveMode]::Create)

# Filtro de exclusao centralizado
function ShouldExclude([string]$fullPath, [string]$name) {
    if ($name -match '\.zip$' -or $name -match '\.log$' -or $name -match '\.tmp') { return $true }
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
    # 1. Coleta diretorios validos
    Write-Host "Mapeando estrutura de diretorios limpa..."
    $dirs = Get-ChildItem -Path $root -Recurse -Force -Directory | Where-Object {
        -not (ShouldExclude $_.FullName $_.Name)
    }

    foreach ($d in $dirs) {
        $rel = $d.FullName.Substring($root.Length + 1).Replace('\', '/') + '/'
        $null = $archive.CreateEntry($rel)
    }

    # 2. Coleta arquivos essenciais do ERP
    Write-Host "Mapeando e compactando arquivos do sistema..."
    $files = Get-ChildItem -Path $root -Recurse -Force | Where-Object {
        -not $_.PSIsContainer -and -not (ShouldExclude $_.FullName $_.Name)
    }

    $totalFiles = $files.Count
    $processed = 0
    $totalRawBytes = 0

    foreach ($f in $files) {
        $rel = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
        $totalRawBytes += $f.Length

        # Ler usando FileShare.ReadWrite para arquivos que possam estar em uso
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
        if ($processed % 300 -eq 0 -or $processed -eq $totalFiles) {
            Write-Host "Compactados $processed de $totalFiles arquivos..."
        }
    }
} finally {
    $archive.Dispose()
}

# 3. Validacao do arquivo zip gerado
$tempItem = Get-Item $tempZip
if ($tempItem.Length -lt 500000) {
    Remove-Item -Force $tempZip
    throw "Erro: O arquivo zip gerado e muito pequeno ($($tempItem.Length) bytes). Operacao abortada para seguranca."
}

# 4. Substituicao atomica
if (Test-Path $destination) {
    Remove-Item -Force $destination
}
Move-Item -Path $tempZip -Destination $destination -Force

$finalItem = Get-Item $destination
$rawMB = [math]::Round($totalRawBytes / 1MB, 2)
$zipMB = [math]::Round($finalItem.Length / 1MB, 2)

Write-Host "`nBackup super leve e otimizado gerado com sucesso!" -ForegroundColor Green
Write-Host "Arquivo: $($finalItem.Name)"
Write-Host "Tamanho original total: $rawMB MB"
Write-Host "Tamanho compactado (.zip): $zipMB MB"
Write-Host "Total de arquivos incluidos: $totalFiles"
Write-Host "Data/Hora de atualizacao: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"

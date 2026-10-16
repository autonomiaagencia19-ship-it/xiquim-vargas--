$ErrorActionPreference = 'Stop'

$rootDir = (Get-Item -Path ".").FullName
$zipName = "inauguracao.zip"
$zipPath = Join-Path -Path $rootDir -ChildPath $zipName
$backupDirZipPath = Join-Path -Path $rootDir -ChildPath "storage\backups\inauguracao.zip"

Write-Host "=== Criando Arquivo ZIP de Backup: $zipName ==="

if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
    Write-Host "Arquivo $zipName anterior removido."
}

# Carrega assemblies de compactação .NET
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Pastas e arquivos a serem incluídos
$includedRoots = @(
    "src",
    "public",
    "scripts",
    "catalog",
    "docs",
    "mobile",
    "storage",
    "xiquim_imagens_renomeadas",
    "descriçoes corretas",
    "xiquimvargasmanuais",
    "tests",
    "max_atendente_certificado"
)

$includedFiles = @(
    "server.js",
    "package.json",
    "README.md",
    "match_products.cjs"
)

# Cria o arquivo ZIP
$zipFileStream = [System.IO.File]::Create($zipPath)
$archive = New-Object System.IO.Compression.ZipArchive($zipFileStream, [System.IO.Compression.ZipArchiveMode]::Create)

$totalFiles = 0
$totalBytes = 0

function Add-FileToZip($filePath, $relativeZipPath) {
    # Normaliza caminho no zip usando barras normais
    $entryName = $relativeZipPath.Replace("\", "/")
    
    $compressionLevel = [System.IO.Compression.CompressionLevel]::Optimal
    $entry = $archive.CreateEntry($entryName, $compressionLevel)
    
    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::OpenRead($filePath)
    
    try {
        $fileStream.CopyTo($entryStream)
        $global:totalBytes += $fileStream.Length
        $global:totalFiles++
    } finally {
        $fileStream.Close()
        $entryStream.Close()
    }
}

# 1. Adicionar arquivos da raiz
foreach ($fName in $includedFiles) {
    $fullPath = Join-Path $rootDir $fName
    if (Test-Path $fullPath) {
        Add-FileToZip $fullPath $fName
    }
}

# 2. Adicionar diretórios selecionados com filtros de exclusão
foreach ($folder in $includedRoots) {
    $folderPath = Join-Path $rootDir $folder
    if (-not (Test-Path $folderPath)) { continue }

    Write-Host "Compactando pasta: $folder..."

    Get-ChildItem -Path $folderPath -Recurse -File | ForEach-Object {
        $file = $_
        $relPath = $file.FullName.Substring($rootDir.Length + 1)

        # Regras de exclusão
        if ($relPath -like "*node_modules*" -or
            $relPath -like "*coverage*" -or
            $relPath -like "*.tmp*" -or
            $relPath -like "*.git*" -or
            $relPath -like "*storage\backups\inauguracao.zip*" -or
            $relPath -like "*storage\backups\pre-import*" -or
            $relPath -like "*storage\backups\pre-clean*" -or
            $relPath -like "*storage\backups\clean-db*" -or
            $relPath -like "*storage\backups\live-clean*" -or
            $relPath -like "*scripts\clean-db-inauguracao.mjs*") {
            return
        }

        Add-FileToZip $file.FullName $relPath
    }
}

# Fecha o arquivo ZIP
$archive.Dispose()
$zipFileStream.Dispose()

$zipSize = (Get-Item $zipPath).Length
$zipSizeMB = [math]::Round($zipSize / 1MB, 2)
$uncompressedMB = [math]::Round($totalBytes / 1MB, 2)

Write-Host "`n=== Backup Concluído com Sucesso! ==="
Write-Host "Arquivo ZIP: $zipPath"
Write-Host "Total de arquivos compactados: $totalFiles"
Write-Host "Tamanho original: $uncompressedMB MB"
Write-Host "Tamanho do ZIP: $zipSizeMB MB"

# Cria também uma cópia no diretório storage/backups/
Copy-Item -Path $zipPath -Destination $backupDirZipPath -Force
Write-Host "Cópia preservada em: $backupDirZipPath"

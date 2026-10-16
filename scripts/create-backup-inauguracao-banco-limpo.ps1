$ErrorActionPreference = 'Stop'

$rootDir = (Get-Item -Path ".").FullName
$zipName = "inauguraçao banco limpo.zip"
$zipPath = Join-Path -Path $rootDir -ChildPath $zipName
$tempZipPath = Join-Path -Path $rootDir -ChildPath "inauguracao_banco_limpo.tmp.zip"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Criando Backup: $zipName" -ForegroundColor Cyan
Write-Host "Raiz do projeto: $rootDir" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

# Remove arquivos temporarios ou anteriores se existirem
if (Test-Path $tempZipPath) {
    Remove-Item -Path $tempZipPath -Force
}
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
    Write-Host "Arquivo '$zipName' anterior removido para recriacao limpa." -ForegroundColor Yellow
}

# Carrega assemblies .NET de compressao
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Pastas e arquivos essenciais
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
    "max_atendente_certificado",
    "cypress",
    "ops"
)

$includedFiles = @(
    "server.js",
    "package.json",
    "package-lock.json",
    "README.md",
    "match_products.cjs",
    ".env",
    ".env.example",
    ".gitignore",
    "cypress.config.js",
    "jest.config.js",
    "render.yaml",
    "QA_REPORT.md",
    "RAIO_X_ENGENHARIA_AUTONOMIA_ERP_2.2.1.md"
)

# Funcao de filtro de exclusao rigorosa
# Regras:
# 1. NAO adicionar nenhum arquivo .zip ("nao adicione outros zips")
# 2. NAO adicionar copias de seguranca de versoes antigas do banco de dados ("nem copias de segurança de versoes antigas do banco de dados")
# 3. NAO adicionar node_modules, .git, coverage, caches
function Should-Exclude([string]$relPath) {
    $norm = $relPath.Replace('/', '\').ToLower()

    # Excluir QUALQUER arquivo .zip
    if ($norm -like "*.zip*") {
        return $true
    }

    # Excluir pastas de controle de versao, dependencias e caches
    if ($norm -like "*\.git\*" -or
        $norm -like "*node_modules\*" -or
        $norm -like "*coverage\*" -or
        $norm -like "*\.gradle\*" -or
        $norm -like "*\.kotlin\*" -or
        $norm -like "*\.idea\*" -or
        $norm -like "*\.vscode\*" -or
        $norm -like "*\build\*" -or
        $norm -like "*.tmp*" -or
        $norm -like "*.log") {
        return $true
    }

    # Excluir copias de seguranca de versoes antigas do banco de dados
    # (Exclui todo o conteudo de storage\backups e backups temporarios)
    if ($norm -like "*storage\backups\*" -or
        $norm -like "*pre-clean*" -or
        $norm -like "*live-clean*" -or
        $norm -like "*pre-import*" -or
        $norm -like "*clean-db*" -or
        $norm -like "*.db-wal" -or
        $norm -like "*.db-shm") {
        return $true
    }

    return $false
}

$zipFileStream = [System.IO.File]::Create($tempZipPath)
$archive = New-Object System.IO.Compression.ZipArchive($zipFileStream, [System.IO.Compression.ZipArchiveMode]::Create)

$totalFiles = 0
$totalBytes = 0

function Add-FileToArchive([string]$filePath, [string]$relativeZipPath) {
    $entryName = $relativeZipPath.Replace("\", "/")
    $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)

    $item = Get-Item $filePath
    $entry.LastWriteTime = $item.LastWriteTime

    $entryStream = $entry.Open()
    $fileStream = [System.IO.File]::Open($filePath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
        $fileStream.CopyTo($entryStream)
        $script:totalBytes += $fileStream.Length
        $script:totalFiles++
    } finally {
        $fileStream.Close()
        $entryStream.Close()
    }
}

try {
    # 1. Adicionar arquivos individuais da raiz
    Write-Host "`n[1/3] Adicionando arquivos raiz..." -ForegroundColor Yellow
    foreach ($fName in $includedFiles) {
        $fullPath = Join-Path $rootDir $fName
        if (Test-Path $fullPath) {
            if (-not (Should-Exclude $fName)) {
                Add-FileToArchive $fullPath $fName
            }
        }
    }

    # 2. Adicionar pastas selecionadas
    Write-Host "[2/3] Adicionando diretorios do projeto com filtros aplicados..." -ForegroundColor Yellow
    foreach ($folder in $includedRoots) {
        $folderPath = Join-Path $rootDir $folder
        if (-not (Test-Path $folderPath)) { continue }

        Write-Host "  -> Processando pasta: $folder" -ForegroundColor Gray
        $files = Get-ChildItem -Path $folderPath -Recurse -File -Force

        foreach ($file in $files) {
            $relPath = $file.FullName.Substring($rootDir.Length + 1)
            if (Should-Exclude $relPath) {
                continue
            }
            Add-FileToArchive $file.FullName $relPath
        }
    }
} finally {
    $archive.Dispose()
    $zipFileStream.Dispose()
}

# 3. Finalizacao e renomeacao atomica
Write-Host "[3/3] Finalizando arquivo ZIP..." -ForegroundColor Yellow
Move-Item -Path $tempZipPath -Destination $zipPath -Force

$zipInfo = Get-Item $zipPath
$zipSizeMB = [math]::Round($zipInfo.Length / 1MB, 2)
$rawSizeMB = [math]::Round($totalBytes / 1MB, 2)

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "BACKUP CONCLUIDO COM SUCESSO!" -ForegroundColor Green
Write-Host "Arquivo gerado: $($zipInfo.FullName)" -ForegroundColor White
Write-Host "Tamanho compactado: $zipSizeMB MB" -ForegroundColor White
Write-Host "Tamanho original: $rawSizeMB MB" -ForegroundColor White
Write-Host "Total de arquivos incluidos: $totalFiles" -ForegroundColor White
Write-Host "Banco de dados ativo e limpo incluido: storage/xiquim-vargas.db" -ForegroundColor White
Write-Host "Outros zips e backups antigos ignorados conforme solicitado." -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Green

param(
  [Parameter(Mandatory=$true)][string]$Service,
  [Parameter(Mandatory=$true)][string]$SshKeyPath,
  [Parameter(Mandatory=$true)][string]$DestinationPath,
  [string]$KnownHostsFile = (Join-Path $env:USERPROFILE '.ssh\known_hosts'),
  [int]$RetentionDays = 30
)
$ErrorActionPreference='Stop'
$ssh=(Get-Command ssh.exe -ErrorAction Stop).Source
$scp=(Get-Command scp.exe -ErrorAction Stop).Source
if(-not (Test-Path -LiteralPath $SshKeyPath -PathType Leaf)){throw "Chave SSH não encontrada: $SshKeyPath"}
if(-not (Test-Path -LiteralPath $KnownHostsFile -PathType Leaf)){throw "known_hosts não encontrado. Valide a chave SSH oficial da região Render antes de agendar."}
New-Item -ItemType Directory -Force -Path $DestinationPath | Out-Null
$destination=(Resolve-Path -LiteralPath $DestinationPath).Path
$listing=& $ssh -i $SshKeyPath -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KnownHostsFile $Service 'ls -1 /var/data/backups'
if($LASTEXITCODE -ne 0){throw 'Não foi possível listar os backups do Render.'}
$day=@($listing | Where-Object {$_ -match '^\d{4}-\d{2}-\d{2}$'} | Sort-Object -Descending | Select-Object -First 1)[0]
if(-not $day){throw 'Nenhum backup diário foi encontrado no serviço.'}
$final=Join-Path $destination $day
if(Test-Path -LiteralPath $final -PathType Container){Write-Output "Backup $day já existe no dispositivo; nada a atualizar.";exit 0}
$partialRoot=Join-Path $destination ('.partial-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $partialRoot | Out-Null
try{
  & $scp -s -r -i $SshKeyPath -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=$KnownHostsFile "${Service}:/var/data/backups/$day" $partialRoot
  if($LASTEXITCODE -ne 0){throw 'A cópia SCP/SFTP do snapshot falhou.'}
  $staged=Join-Path $partialRoot $day
  $manifest=Join-Path $staged 'manifest.sha256'
  if(-not (Test-Path -LiteralPath $manifest -PathType Leaf)){throw 'Manifesto de integridade ausente no snapshot.'}
  foreach($line in Get-Content -LiteralPath $manifest){
    if($line -notmatch '^([0-9a-f]{64})  (.+)$'){throw 'Linha inválida no manifesto de integridade.'}
    $expected=$Matches[1];$relative=$Matches[2].Replace('/',[IO.Path]::DirectorySeparatorChar)
    $file=[IO.Path]::GetFullPath((Join-Path $staged $relative))
    $stagedPrefix=([IO.Path]::GetFullPath($staged).TrimEnd('\')+'\')
    if(-not $file.StartsWith($stagedPrefix,[StringComparison]::OrdinalIgnoreCase)){throw 'Caminho fora do snapshot no manifesto.'}
    if(-not (Test-Path -LiteralPath $file -PathType Leaf)){throw "Arquivo ausente no backup: $relative"}
    $actual=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    if($actual -ne $expected){throw "Falha de integridade SHA-256: $relative"}
  }
  Move-Item -LiteralPath $staged -Destination $final
  Write-Output "Backup completo $day copiado e validado em $final"
}finally{
  if(Test-Path -LiteralPath $partialRoot){
    $resolvedPartial=(Resolve-Path -LiteralPath $partialRoot).Path
    if([IO.Path]::GetDirectoryName($resolvedPartial) -eq $destination){Remove-Item -LiteralPath $resolvedPartial -Recurse -Force}
  }
}
$cutoff=(Get-Date).Date.AddDays(-$RetentionDays)
Get-ChildItem -LiteralPath $destination -Directory | Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}$' -and [datetime]::ParseExact($_.Name,'yyyy-MM-dd',$null) -lt $cutoff } | ForEach-Object {
  $candidate=(Resolve-Path -LiteralPath $_.FullName).Path
  if([IO.Path]::GetDirectoryName($candidate) -eq $destination){Remove-Item -LiteralPath $candidate -Recurse -Force}
}


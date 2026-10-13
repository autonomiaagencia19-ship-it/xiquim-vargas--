$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$node = (Get-Command node.exe -ErrorAction Stop).Source
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop()
$temp = Join-Path ([IO.Path]::GetTempPath()) ('xiquim-qa-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temp | Out-Null
$old = @{}; foreach($name in 'PORT','STORAGE_DIR','NODE_ENV','JWT_SECRET','DISABLE_AUTOMATIC_BACKUP'){ $old[$name]=[Environment]::GetEnvironmentVariable($name) }
$env:PORT=[string]$port; $env:STORAGE_DIR=$temp; $env:NODE_ENV='production'; $env:JWT_SECRET='qa-only-secret-never-use-in-production'; $env:DISABLE_AUTOMATIC_BACKUP='1'
$server = Start-Process -WindowStyle Hidden -PassThru -FilePath $node -ArgumentList 'server.js' -WorkingDirectory $root -RedirectStandardOutput (Join-Path $temp 'server.log') -RedirectStandardError (Join-Path $temp 'server-error.log')
try {
  Start-Sleep -Seconds 2
  & $node (Join-Path $PSScriptRoot 'qa_release.mjs')
  $result=$LASTEXITCODE
} finally {
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  foreach($name in $old.Keys){[Environment]::SetEnvironmentVariable($name,$old[$name])}
  if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Recurse -Force}
}
exit $result

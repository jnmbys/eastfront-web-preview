param([int]$Port=4192)
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue){throw "Port $Port is already in use; do not stop another preview."}
Push-Location $taskRoot
try {
  & node ai/local/build.mjs
  if($LASTEXITCODE -ne 0){throw 'Build failed'}
  $node=(Get-Command node).Source
  $logDir=Join-Path $env:LOCALAPPDATA 'EastfrontPreview'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $server=Join-Path $taskRoot 'experiments/grand-campaign-001/server.mjs'
  $process=Start-Process -FilePath $node -ArgumentList @(('"'+$server+'"'),$Port) -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'officer002.out.log') -RedirectStandardError (Join-Path $logDir 'officer002.err.log') -PassThru
  @{pid=$process.Id;port=$Port;root=$taskRoot;started=$process.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'officer002-process.json')
  Write-Output "OFFICER-002 local preview: http://127.0.0.1:$Port/"
} finally {Pop-Location}

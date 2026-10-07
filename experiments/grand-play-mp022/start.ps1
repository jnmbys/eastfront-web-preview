param([int]$Port=4220)
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue){throw "Port $Port is occupied. No other process will be stopped."}
Push-Location $taskRoot
try {
 & node ai/local/build.mjs
 if($LASTEXITCODE -ne 0){throw 'Build failed'}
 $node=(Get-Command node).Source
 $logDir=Join-Path $env:LOCALAPPDATA 'EastfrontPreview'
 New-Item -ItemType Directory -Force -Path $logDir | Out-Null
 $scriptPath=Join-Path $taskRoot 'experiments/grand-play-mp022/server.mjs'
 $process=Start-Process -FilePath $node -ArgumentList @(('"'+$scriptPath+'"'),$Port) -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'grandplaymp022.out.log') -RedirectStandardError (Join-Path $logDir 'grandplaymp022.err.log') -PassThru
 @{pid=$process.Id;port=$Port;root=$taskRoot;started=$process.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot 'grandplaymp022-process.json')
 Write-Output "GRAND-PLAY MP022 http://127.0.0.1:$Port/"
} finally {Pop-Location}

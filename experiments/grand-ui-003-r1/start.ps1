$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$listener=Get-NetTCPConnection -State Listen -LocalPort 4255 -ErrorAction SilentlyContinue
if($listener){throw '4255 已被使用；不会覆盖现有服务。'}
$runtimeDir=Join-Path $env:USERPROFILE '.eastfront/grand-ui-003-r1/4255'
New-Item -ItemType Directory -Force $runtimeDir | Out-Null
$p=Start-Process -FilePath (Get-Command node).Source -ArgumentList 'experiments/grand-ui-003-r1/server.mjs normal' -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDir 'stdout.log') -RedirectStandardError (Join-Path $runtimeDir 'stderr.log')
Write-Output "http://127.0.0.1:4255/ PID $($p.Id)"

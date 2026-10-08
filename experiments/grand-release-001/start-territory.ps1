$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskPort=4247
if(Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue){throw '4247 already in use; no service replaced'}
$taskBase=Join-Path $env:USERPROFILE '.eastfront/grand-release-territory-1/4247'
New-Item -ItemType Directory -Path $taskBase -Force | Out-Null
$env:RELEASE_MID_FILE='';$env:RELEASE_LOCAL='1';$env:HOST='127.0.0.1';$env:PORT='4247';$env:PUBLIC_ORIGIN='http://127.0.0.1:4247';$env:SAVE_DIR=$taskBase;$env:RELEASE_MID='0'
$taskProc=Start-Process -FilePath (Get-Command node).Source -ArgumentList 'experiments/grand-release-001/server.mjs' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskBase 'stdout.log') -RedirectStandardError (Join-Path $taskBase 'stderr.log') -PassThru
Write-Output "4247 PID $($taskProc.Id); saves $taskBase"

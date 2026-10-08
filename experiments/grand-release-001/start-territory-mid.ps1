$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskPort=4248
if(Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue){throw '4248 already in use; no service replaced'}
$taskBase=Join-Path $env:USERPROFILE '.eastfront/grand-release-territory-1/4248'
New-Item -ItemType Directory -Path $taskBase -Force | Out-Null
$env:RELEASE_MID_FILE=Join-Path $taskRoot 'evidence/grand-release-001/territory/natural-save.json.gz';$env:RELEASE_LOCAL='1';$env:HOST='127.0.0.1';$env:PORT='4248';$env:PUBLIC_ORIGIN='http://127.0.0.1:4248';$env:SAVE_DIR=$taskBase;$env:RELEASE_MID='0'
$taskProc=Start-Process -FilePath (Get-Command node).Source -ArgumentList 'experiments/grand-release-001/server.mjs' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskBase 'stdout.log') -RedirectStandardError (Join-Path $taskBase 'stderr.log') -PassThru
Write-Output "4248 PID $($taskProc.Id); saves $taskBase"

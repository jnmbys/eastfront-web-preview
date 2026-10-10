param([ValidateSet('normal','mid')][string]$Mode='normal',[int]$Port=4267)
$ErrorActionPreference='Stop'
$candidateRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtimeRoot=Join-Path $env:LOCALAPPDATA ('Eastfront/grand-division-002-'+$Mode)
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw "Port $Port already in use; no process was stopped"}
$env:PORT="$Port";$env:RELEASE_LOCAL='1';$env:SAVE_DIR=$runtimeRoot
Remove-Item Env:RELEASE_MID_FILE -ErrorAction SilentlyContinue
if($Mode -eq 'mid'){$env:RELEASE_MID_FILE=Join-Path $candidateRoot 'evidence/grand-division-002/operation-chain/earned.json.gz'}
$node=(Get-Command node).Source
$candidate=Start-Process -FilePath $node -ArgumentList 'experiments/grand-division-002/server.mjs' -WorkingDirectory $candidateRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeRoot 'server.out.log') -RedirectStandardError (Join-Path $runtimeRoot 'server.err.log') -PassThru
$candidate.Id | Set-Content (Join-Path $runtimeRoot 'server.pid')
Write-Output "PID $($candidate.Id); http://127.0.0.1:$Port/ ; saves: $runtimeRoot"

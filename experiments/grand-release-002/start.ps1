param([int]$Port=4269)
$ErrorActionPreference='Stop'
$candidateRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtimeRoot=Join-Path $env:LOCALAPPDATA 'Eastfront/grand-release-002-preview'
if(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue){throw "Port $Port is in use; existing services left running"}
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
$env:PORT="$Port";$env:HOST='127.0.0.1';$env:PUBLIC_ORIGIN="http://127.0.0.1:$Port";$env:SAVE_DIR=$runtimeRoot;$env:NODE_ENV='development';$env:REQUIRE_PERSISTENT_DISK='0'
Remove-Item Env:RELEASE_LOCAL,Env:RELEASE_MID_FILE,Env:RELEASE_DIVISION_ENABLED -ErrorAction SilentlyContinue
$candidate=Start-Process -FilePath (Get-Command node).Source -ArgumentList 'experiments/grand-release-002/server.mjs' -WorkingDirectory $candidateRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeRoot 'server.out.log') -RedirectStandardError (Join-Path $runtimeRoot 'server.err.log') -PassThru
$candidate.Id | Set-Content (Join-Path $runtimeRoot 'server.pid')
Write-Output "PID $($candidate.Id); http://127.0.0.1:$Port/ ; saves: $runtimeRoot"

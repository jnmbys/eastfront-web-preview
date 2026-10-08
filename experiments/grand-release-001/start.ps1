$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (Get-NetTCPConnection -State Listen -LocalPort 4245,4246 -ErrorAction SilentlyContinue) { throw '4245 or 4246 is in use; no service replaced.' }
$taskNode = (Get-Command node).Source
$taskBase = Join-Path $env:USERPROFILE '.eastfront/grand-release-001'
New-Item -ItemType Directory -Path $taskBase -Force | Out-Null
foreach ($taskPort in @(4245,4246)) {
 $env:RELEASE_LOCAL='1'; $env:HOST='127.0.0.1'; $env:PORT="$taskPort"; $env:PUBLIC_ORIGIN="http://127.0.0.1:$taskPort"; $env:SAVE_DIR=Join-Path $taskBase "$taskPort"; $env:RELEASE_MID=if($taskPort -eq 4246){'1'}else{'0'}
 $taskProc=Start-Process -FilePath $taskNode -ArgumentList 'experiments/grand-release-001/server.mjs' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskBase "$taskPort.out.log") -RedirectStandardError (Join-Path $taskBase "$taskPort.err.log") -PassThru
 Write-Output "Started local $taskPort PID $($taskProc.Id)"
}

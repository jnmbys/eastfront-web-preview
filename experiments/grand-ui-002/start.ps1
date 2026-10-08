$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (Get-NetTCPConnection -State Listen -LocalPort 4228 -ErrorAction SilentlyContinue) { throw '4228 is already listening; preserve the existing service.' }
$taskNode = (Get-Command node).Source
$taskLogs = Join-Path $env:LOCALAPPDATA 'EastfrontSaves/grand-ui-002'
New-Item -ItemType Directory -Path $taskLogs -Force | Out-Null
$taskProcess = Start-Process -FilePath $taskNode -ArgumentList 'experiments/grand-ui-002/server.mjs','4228' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskLogs 'stdout.log') -RedirectStandardError (Join-Path $taskLogs 'stderr.log') -PassThru
Write-Output "Started PID $($taskProcess.Id); http://127.0.0.1:4228/ (local only)."

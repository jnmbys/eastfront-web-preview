$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (Get-NetTCPConnection -State Listen -LocalPort 4233,4234 -ErrorAction SilentlyContinue) { throw '4233 or 4234 is already listening; preserve the existing service.' }
$taskNode = (Get-Command node).Source
$taskLogs = Join-Path $env:LOCALAPPDATA 'EastfrontSaves/grand-officer-002-r1'
New-Item -ItemType Directory -Path $taskLogs -Force | Out-Null
$taskProcess = Start-Process -FilePath $taskNode -ArgumentList 'experiments/grand-officer-002-r1/server.mjs','4233' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskLogs 'stdout.log') -RedirectStandardError (Join-Path $taskLogs 'stderr.log') -PassThru
Write-Output "Started PID $($taskProcess.Id); http://127.0.0.1:4233/ (local only)."

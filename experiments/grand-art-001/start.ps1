$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (Get-NetTCPConnection -State Listen -LocalPort 4243,4244 -ErrorAction SilentlyContinue) { throw '4243 or 4244 is already listening; preserve the existing service.' }
$taskNode = (Get-Command node).Source
$taskLogs = Join-Path $env:LOCALAPPDATA 'EastfrontSaves/grand-art-001'
New-Item -ItemType Directory -Path $taskLogs -Force | Out-Null
$taskProcess = Start-Process -FilePath $taskNode -ArgumentList 'experiments/grand-art-001/server.mjs','4243' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskLogs 'stdout.log') -RedirectStandardError (Join-Path $taskLogs 'stderr.log') -PassThru
Write-Output "Started PID $($taskProcess.Id); http://127.0.0.1:4243/ (local only)."

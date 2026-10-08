$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (Get-NetTCPConnection -State Listen -LocalPort 4241,4242 -ErrorAction SilentlyContinue) { throw '4241 or 4242 is already listening; preserve the existing service.' }
$taskNode = (Get-Command node).Source
$taskLogs = Join-Path $env:LOCALAPPDATA 'EastfrontSaves/grand-economy-002-r1'
New-Item -ItemType Directory -Path $taskLogs -Force | Out-Null
$taskProcess = Start-Process -FilePath $taskNode -ArgumentList 'experiments/grand-economy-002-r1/server.mjs','4241' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskLogs 'stdout.log') -RedirectStandardError (Join-Path $taskLogs 'stderr.log') -PassThru
Write-Output "Started PID $($taskProcess.Id); http://127.0.0.1:4241/ (local only)."

$ErrorActionPreference='Stop'
$runtimeRoot=Join-Path $env:LOCALAPPDATA 'Eastfront/grand-release-002-preview'
$servicePid=[int](Get-Content (Join-Path $runtimeRoot 'server.pid'))
$process=Get-CimInstance Win32_Process -Filter "ProcessId=$servicePid"
if(!$process -or $process.CommandLine -notmatch 'grand-release-002[/\\]server.mjs'){throw 'Saved PID is not this candidate; nothing stopped'}
# Save and leave campaign first. Forced Windows termination restores the last
# durable checkpoint; it does not claim to flush unacknowledged in-memory work.
Stop-Process -Id $servicePid

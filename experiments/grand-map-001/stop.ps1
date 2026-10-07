$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$record=Get-Content -LiteralPath (Join-Path $taskRoot 'grandmap001-process.json') -Raw | ConvertFrom-Json
if($record.root -ne $taskRoot){throw 'Recorded root differs'}
$process=Get-Process -Id $record.pid -ErrorAction SilentlyContinue
if(!$process){Write-Output 'Already stopped';exit}
$command=Get-CimInstance Win32_Process -Filter "ProcessId=$($record.pid)"
if([Math]::Abs(($process.StartTime.ToUniversalTime()-([datetime]$record.started).ToUniversalTime()).TotalMilliseconds) -gt 1 -or $command.CommandLine.Replace('\','/') -notlike '*experiments/grand-map-001/server.mjs*'){throw 'Process identity differs; refusing to stop'}
Stop-Process -Id $record.pid

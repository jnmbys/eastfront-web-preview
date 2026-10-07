$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$record=Join-Path $taskRoot 'grandux001-process.json'
if(!(Test-Path -LiteralPath $record)){Write-Output 'No candidate process record.';exit}
$saved=Get-Content -LiteralPath $record -Raw | ConvertFrom-Json
$process=Get-Process -Id $saved.pid -ErrorAction SilentlyContinue
if(!$process){Write-Output 'Candidate already stopped.';exit}
if(!$saved.started -or $process.ProcessName -ne 'node' -or $process.StartTime.ToUniversalTime().ToString('o') -ne $saved.started -or (Resolve-Path $saved.root).Path -ne $taskRoot){throw 'Process identity differs; refusing to stop it.'}
Stop-Process -Id $saved.pid
Write-Output 'GRAND-UX-001 stopped. In-memory games ended; other previews unchanged.'

$ErrorActionPreference = 'Stop'
$playableRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$record = Join-Path $playableRoot 'playable003-process.json'
if (!(Test-Path -LiteralPath $record)) { Write-Output 'No PLAYABLE-003 process record.'; exit }
$saved = Get-Content -LiteralPath $record -Raw | ConvertFrom-Json
$processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$saved.pid)"
$expectedScript = Join-Path $PSScriptRoot 'server.py'
if ($processInfo -and $processInfo.CommandLine.Contains($expectedScript) -and $processInfo.CommandLine.Contains([string]$saved.port)) {
  Stop-Process -Id ([int]$saved.pid)
  Remove-Item -LiteralPath $record
  Write-Output 'PLAYABLE-003 stopped. Its local in-memory game has ended.'
} elseif ($processInfo) { throw 'Process identity changed; nothing was stopped.' }
else { Remove-Item -LiteralPath $record; Write-Output 'PLAYABLE-003 is already stopped.' }

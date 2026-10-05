$ErrorActionPreference = 'Stop'
$playableRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$record = Join-Path $playableRoot 'officer001-process.json'
if (!(Test-Path -LiteralPath $record)) { Write-Output 'No OFFICER-001 process record.'; exit }
$saved = Get-Content -LiteralPath $record -Raw | ConvertFrom-Json
$processInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$saved.pid)"
$expectedScript = Join-Path $playableRoot 'experiments/playable-004/server.py'
if ($processInfo -and $processInfo.CommandLine.Replace('/','\').Contains($expectedScript.Replace('/','\')) -and $processInfo.CommandLine.Contains([string]$saved.port)) {
  Stop-Process -Id ([int]$saved.pid)
  Remove-Item -LiteralPath $record
  Write-Output 'OFFICER-001 stopped. Its local in-memory game has ended.'
} elseif ($processInfo) { throw 'Process identity changed; nothing was stopped.' }
else { Remove-Item -LiteralPath $record; Write-Output 'OFFICER-001 is already stopped.' }

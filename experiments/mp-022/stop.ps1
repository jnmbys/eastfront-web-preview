$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$record=Get-Content -Raw -LiteralPath (Join-Path $repo 'mp022-process.json') | ConvertFrom-Json
if ($record.repo -ne $repo -or $record.port -in @(4197,4198) -or $record.script -ne [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'server.mjs'))) {throw 'Lifecycle identity mismatch'}
$p=Get-CimInstance Win32_Process -Filter "ProcessId = $($record.pid)"
if ($p) {
 if ([Math]::Abs(($p.CreationDate.ToUniversalTime()-([DateTime]$record.startedAt).ToUniversalTime()).TotalSeconds) -gt 1 -or -not $p.CommandLine.Contains($record.script)) {throw 'PID reused; refusing stop'}
 Stop-Process -Id $record.pid
 Start-Sleep -Milliseconds 500
}
if (Get-NetTCPConnection -State Listen -LocalPort $record.port -ErrorAction SilentlyContinue) {throw 'Listener remains; do not stop its owner without verification'}
Write-Host 'MP022 local listener closed; no public entry was opened. In-memory experimental match ended.'

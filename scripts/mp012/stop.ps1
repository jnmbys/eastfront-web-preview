$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')))
$mp12State = Get-Content .mp010-build/mp012/processes.json -Raw | ConvertFrom-Json
foreach ($mp12Target in @(@{id=$mp12State.pid; script='scripts/mp012/serve.mjs'}, @{id=$mp12State.childPid; script='scripts/mp010/serve.mjs'})) {
  $mp12Process = Get-CimInstance Win32_Process -Filter "ProcessId = $($mp12Target.id)"
  if ($mp12Process) {
    if (-not $mp12Process.CommandLine.Contains($mp12Target.script)) { throw 'Unexpected process, not stopping' }
    Stop-Process -Id $mp12Target.id
  }
}
$mp12Listeners = @(Get-NetTCPConnection -State Listen -LocalPort 4190,4192 -ErrorAction SilentlyContinue)
if ($mp12Listeners.Count) { throw 'Local diagnostic listeners remain' }
Write-Host 'MP012 local diagnostic processes stopped.'

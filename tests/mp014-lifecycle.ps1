# Local fixture only: exercise the real launcher with a random in-memory test password.
# This does not use -PublicTunnel and does not publish or persist the test credential.
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $repo
$root=Join-Path $repo '.mp010-build/mp014'
$before=@(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | ForEach-Object FullName)
function Read-Host {
  param([string]$Prompt,[switch]$AsSecureString)
  $random=[byte[]]::new(32);[Security.Cryptography.RandomNumberGenerator]::Fill($random)
  $value=[Convert]::ToBase64String($random)
  try { ConvertTo-SecureString $value -AsPlainText -Force }
  finally { [Array]::Clear($random,0,$random.Length);$value=$null }
}
$run=$null
try {
  & ./scripts/mp014/start.ps1 -Origin 'https://127.0.0.1:4193' -CheckOnly
  & ./scripts/mp014/start.ps1 -Origin 'https://127.0.0.1:4193'
  $runs=@(Get-ChildItem -LiteralPath $root -Directory | Where-Object {$before -notcontains $_.FullName})
  if ($runs.Count -ne 1) { throw 'Expected one new lifecycle directory' };$run=$runs[0].FullName
  $state=Get-Content -LiteralPath (Join-Path $run 'processes.json') -Raw | ConvertFrom-Json
  if ($state.publicOpened -or $state.processes.Count -ne 1) { throw 'Unexpected public process' }
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 4180,4181,4184)
  if ($listeners.Count -ne 3 -or @($listeners | Where-Object LocalAddress -ne '127.0.0.1').Count) { throw 'Unexpected listener exposure' }
  $status=& curl.exe --silent --max-time 5 --output NUL --write-out '%{http_code}' -H 'Host: 127.0.0.1:4193' http://127.0.0.1:4181/mp013/config.json
  if ($status -ne '303') { throw 'Local anonymous boundary failed' }
  & ./scripts/mp014/stop.ps1 -RunDir $run -FailedValidation
  # Idempotent close also refuses to kill a process if the recorded PID is reused.
  & ./scripts/mp014/stop.ps1 -RunDir $run -FailedValidation
  $closed=Get-Content -LiteralPath (Join-Path $run 'closure-mp014.json') -Raw | ConvertFrom-Json
  if (-not $closed.localClosureVerified -or $closed.publicOpened) { throw 'Closure failed' }
  @{kind='Local PowerShell launcher/stop fixture; random in-memory password, no tunnel';launchPassed=$true;loopbackListeners=3;anonymousHTTP=303;stopPassed=$true;idempotentStopPassed=$true;localListenersAfter=$closed.localListeners.count;publicOpened=$false;processExitVerified=$closed.processExitVerified;publicProbe=$closed.publicProbe.outcome;publicUnavailableVerified=$closed.publicUnavailableVerified} | ConvertTo-Json | Set-Content evidence/mp-014/lifecycle.json -Encoding utf8
} finally {
  if (-not $run) { $run=(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object {$before -notcontains $_.FullName} | Select-Object -First 1).FullName }
  if ($run) { & ./scripts/mp014/stop.ps1 -RunDir $run -FailedValidation }
  Remove-Item Function:Read-Host
}

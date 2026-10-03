# Fault injection is confined to the curl command in this test's PowerShell scope.
# No tunnel or network request is made; the actual stop script must persist UNKNOWN.
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'));Set-Location -LiteralPath $repo
$dir=Join-Path $repo ('.mp010-build/mp014/probe-fixture-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $dir | Out-Null
$child=Start-Process -FilePath (Get-Command node).Source -ArgumentList @('-e','process.exit(0)') -WindowStyle Hidden -PassThru
$child.WaitForExit()
@{publicOpened=$true;origin='https://mp014.invalid';processes=@(@{name='exited-test-child';pid=$child.Id;startedAt=[DateTime]::UtcNow.ToString('o');script='process.exit(0)'})} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $dir 'processes.json')
function curl.exe { $global:LASTEXITCODE=28; return '000' }
try {
  $threw=$false
  try { & ./scripts/mp014/stop.ps1 -RunDir $dir -FailedValidation } catch { $threw=$true }
  if (-not $threw) { throw 'Unknown public probe was incorrectly accepted' }
  $report=Get-Content -LiteralPath (Join-Path $dir 'closure-mp014.json') -Raw | ConvertFrom-Json
  if (-not $report.processExitVerified -or -not $report.localClosureVerified -or $report.publicProbe.outcome -ne 'UNKNOWN' -or $report.publicUnavailableVerified -or $report.overall -ne 'PUBLIC_NOT_VERIFIED') { throw 'Independent closure evidence was not retained' }
  $evidence=@{kind='Artificial timeout injected into real stop script; no public tunnel or probe occurred';pass=$true;stopReportedIncomplete=$threw;report=$report}
  [IO.File]::WriteAllText((Join-Path $repo 'evidence/mp-014/stop-timeout-fixture.json'),(($evidence | ConvertTo-Json -Depth 10).Replace("`r`n","`n")+"`n"))
  Write-Host 'Stop integration passed: process/local verified, public UNKNOWN, non-success result and evidence retained'
} finally { Remove-Item Function:curl.exe }

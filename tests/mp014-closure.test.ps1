$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/mp014/closure-policy.ps1')
$rows=@()
foreach ($case in @(
  @{name='timeout';code=28;http='000';expected='UNKNOWN'},
  @{name='DNS failure';code=6;http='000';expected='UNKNOWN'},
  @{name='TLS handshake';code=35;http='000';expected='UNKNOWN'},
  @{name='certificate failure';code=60;http='000';expected='UNKNOWN'},
  @{name='connect failure';code=7;http='000';expected='UNKNOWN'},
  @{name='empty HTTP';code=0;http='';expected='UNKNOWN'},
  @{name='zero HTTP';code=0;http='000';expected='UNKNOWN'},
  @{name='partial response then timeout';code=28;http='502';expected='UNKNOWN'},
  @{name='HTTP 502';code=0;http='502';expected='HTTP_UNAVAILABLE'},
  @{name='HTTP 500';code=0;http='500';expected='HTTP_UNAVAILABLE'},
  @{name='login redirect';code=0;http='303';expected='HTTP_RESPONDING'},
  @{name='HTTP forbidden';code=0;http='403';expected='HTTP_RESPONDING'},
  @{name='HTTP OK';code=0;http='200';expected='HTTP_RESPONDING'}
)) {
  $probe=Convert-PublicProbe -Attempted $true -ExitCode $case.code -HttpCode $case.http
  $report=New-ClosureReport -Processes @(@{outcome='EXITED'}) -Listeners @{outcome='CLOSED'} -PublicProbe $probe -PublicOpened $true
  if ($probe.outcome -ne $case.expected -or $report.publicUnavailableVerified -ne ($case.expected -eq 'HTTP_UNAVAILABLE')) { throw "Classification failed: $($case.name)" }
  $rows += @{case=$case.name;probe=$probe.outcome;processExit=$report.processExitVerified;localClosure=$report.localClosureVerified;publicVerified=$report.publicUnavailableVerified;overall=$report.overall}
}
$unavailable=Convert-PublicProbe -Attempted $true -HttpCode '502'
foreach ($process in @('UNKNOWN','IDENTITY_MISMATCH','STILL_RUNNING')) {
  $r=New-ClosureReport -Processes @(@{outcome=$process}) -Listeners @{outcome='CLOSED'} -PublicProbe $unavailable -PublicOpened $true
  if ($r.localClosureVerified -or $r.publicUnavailableVerified) {throw 'Public failure must not mask a process failure'}
  $rows += @{case="process $process";overall=$r.overall}
}
foreach ($listener in @('UNKNOWN','LISTENING')) {
  $r=New-ClosureReport -Processes @(@{outcome='EXITED'}) -Listeners @{outcome=$listener} -PublicProbe $unavailable -PublicOpened $true
  if ($r.publicUnavailableVerified) {throw 'Unverified listeners cannot prove closure'}
  $rows += @{case="listeners $listener";overall=$r.overall}
}
$local=New-ClosureReport -Processes @(@{outcome='ALREADY_EXITED'}) -Listeners @{outcome='CLOSED'} -PublicProbe (Convert-PublicProbe -Attempted $false) -PublicOpened $false
if (-not $local.localClosureVerified -or $local.publicUnavailableVerified -or $local.publicProbe.outcome -ne 'NOT_ATTEMPTED') {throw 'Local-only must not assert public closure'}
$rows += @{case='local only';overall=$local.overall;publicVerified=$local.publicUnavailableVerified}
$dir=Join-Path $PSScriptRoot '../evidence/mp-014';New-Item -ItemType Directory -Path $dir -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $dir 'closure-policy-tests.json'),((@{kind='Synthetic classification checks, not real public probes';passed=$rows.Count;rows=$rows} | ConvertTo-Json -Depth 8).Replace("`r`n","`n")+"`n"))
Write-Host "$($rows.Count) closure classification checks passed"

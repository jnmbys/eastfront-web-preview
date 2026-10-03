param([Parameter(Mandatory=$true)][string]$RunDir, [switch]$ResultsSaved, [switch]$FailedValidation)
$ErrorActionPreference='Stop'
if (-not ($ResultsSaved -or $FailedValidation)) { throw 'Export first: use -ResultsSaved or -FailedValidation' }
. (Join-Path $PSScriptRoot 'closure-policy.ps1')
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$dir=[IO.Path]::GetFullPath($RunDir)
$allowed=@('mp013','mp014') | Where-Object {$dir.StartsWith(([IO.Path]::GetFullPath((Join-Path $repo ".mp010-build/$_")) + [IO.Path]::DirectorySeparatorChar),[StringComparison]::OrdinalIgnoreCase)}
if (-not $allowed) { throw 'RunDir must be inside an MP013 or MP014 lifecycle directory' }
$state=Get-Content -LiteralPath (Join-Path $dir 'processes.json') -Raw | ConvertFrom-Json
function Stop-Checked($target) {
  $row=@{name=$target.name;pid=$target.pid;outcome='UNKNOWN'}
  try {
    $process=Get-CimInstance Win32_Process -Filter "ProcessId = $($target.pid)" -ErrorAction Stop
    if (-not $process) { $row.outcome='ALREADY_EXITED';return $row }
    if ([Math]::Abs(($process.CreationDate.ToUniversalTime()-([DateTime]$target.startedAt).ToUniversalTime()).TotalSeconds) -gt 1 -or -not $process.CommandLine -or -not $process.CommandLine.Contains($target.script)) { $row.outcome='IDENTITY_MISMATCH';return $row }
    Stop-Process -Id $target.pid -ErrorAction Stop
    $deadline=[DateTime]::UtcNow.AddSeconds(10)
    do { $remaining=Get-CimInstance Win32_Process -Filter "ProcessId = $($target.pid)" -ErrorAction Stop;if (-not $remaining) {break};Start-Sleep -Milliseconds 100 } while ([DateTime]::UtcNow -lt $deadline)
    $row.outcome=if ($remaining) {'STILL_RUNNING'} else {'EXITED'}
  } catch { $row.outcome='UNKNOWN';$row.reason='PROCESS_OPERATION_ERROR' }
  return $row
}
$rows=@()
foreach ($target in ($state.processes | Sort-Object @{Expression={if ($_.name -eq 'tunnel') {0} else {1}}})) { $rows += Stop-Checked $target }
$fixtureFile=Join-Path $dir 'fixture.json'
if (Test-Path -LiteralPath $fixtureFile) {
  $fixture=Get-Content -LiteralPath $fixtureFile -Raw | ConvertFrom-Json
  $rows += Stop-Checked @{name='fixture';pid=$fixture.pid;startedAt=$fixture.spawnedAt;script='scripts/mp010/serve.mjs'}
} elseif (@($state.processes | Where-Object name -eq 'stack').Count) { $rows += @{name='fixture';pid=$null;outcome='UNKNOWN';reason='MISSING_LIFECYCLE_RECORD'} }
try {
  $ports=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object {$_.LocalPort -in @(4180,4181,4184)})
  $listeners=@{outcome=$(if ($ports.Count) {'LISTENING'} else {'CLOSED'});count=$ports.Count;ports=@($ports | Select-Object -ExpandProperty LocalPort)}
} catch { $listeners=@{outcome='UNKNOWN';count=$null;ports=$null;reason='LISTENER_QUERY_ERROR'} }
$probe=Convert-PublicProbe -Attempted $false
if ($state.publicOpened) {
  $watch=[Diagnostics.Stopwatch]::StartNew()
  try { $status=& curl.exe --silent --max-time 20 --output NUL --write-out '%{http_code}' $state.origin;$code=$LASTEXITCODE }
  catch { $status='';$code=-1 }
  $watch.Stop()
  $probe=Convert-PublicProbe -Attempted $true -ExitCode $code -HttpCode ([string]$status) -ElapsedMs $watch.Elapsed.TotalMilliseconds
}
$report=New-ClosureReport -Processes $rows -Listeners $listeners -PublicProbe $probe -PublicOpened ([bool]$state.publicOpened)
$report.resultsSaved=[bool]$ResultsSaved;$report.failedValidation=[bool]$FailedValidation
[IO.File]::WriteAllText((Join-Path $dir 'closure-mp014.json'),(($report | ConvertTo-Json -Depth 8).Replace("`r`n","`n")+"`n"))
Write-Host "Process exit: $($report.processExitVerified); local listeners: $($listeners.outcome); public probe: $($probe.outcome); overall: $($report.overall)"
if (-not $report.localClosureVerified -or ($state.publicOpened -and -not $report.publicUnavailableVerified)) { throw 'Closure not fully verified; inspect separate states in closure-mp014.json. UNKNOWN is not a pass.' }

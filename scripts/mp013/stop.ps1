param([Parameter(Mandatory=$true)][string]$RunDir, [switch]$ResultsSaved, [switch]$FailedValidation)
$ErrorActionPreference='Stop'
if (-not ($ResultsSaved -or $FailedValidation)) { throw 'Export first: use -ResultsSaved or -FailedValidation' }
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$root=[IO.Path]::GetFullPath((Join-Path $repo '.mp010-build/mp013')) + [IO.Path]::DirectorySeparatorChar
$dir=[IO.Path]::GetFullPath($RunDir)
if (-not $dir.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)) { throw 'RunDir must be inside the MP013 lifecycle directory' }
$state=Get-Content -LiteralPath (Join-Path $dir 'processes.json') -Raw | ConvertFrom-Json
$stopped=@()
function Stop-Checked($target) {
  $process=Get-Process -Id $target.pid -ErrorAction SilentlyContinue
  if ($process) {
    if ([Math]::Abs(($process.StartTime.ToUniversalTime()-([DateTime]$target.startedAt).ToUniversalTime()).TotalSeconds) -gt 1) { throw "PID identity changed: $($target.name)" }
    $command=(Get-CimInstance Win32_Process -Filter "ProcessId = $($target.pid)").CommandLine
    if (-not $command -or -not $command.Contains($target.script)) { throw "Unexpected process: $($target.name)" }
    Stop-Process -Id $target.pid
    Wait-Process -Id $target.pid -Timeout 10 -ErrorAction SilentlyContinue
  }
}
# Tunnel first; then the process containing both boundary and overlay.
foreach ($target in ($state.processes | Sort-Object @{Expression={if ($_.name -eq 'tunnel') {0} else {1}}})) { Stop-Checked $target; $stopped += $target.name }
$fixtureFile=Join-Path $dir 'fixture.json'
if (Test-Path -LiteralPath $fixtureFile) {
  $fixture=Get-Content -LiteralPath $fixtureFile -Raw | ConvertFrom-Json
  Stop-Checked @{name='fixture';pid=$fixture.pid;startedAt=$fixture.spawnedAt;script='scripts/mp010/serve.mjs'}
  $stopped += 'fixture'
}
$listeners=@(Get-NetTCPConnection -State Listen -LocalPort 4180,4181,4184 -ErrorAction SilentlyContinue)
$httpStatus=$null
if ($state.publicOpened) {
  $status=& curl.exe --silent --max-time 20 --output NUL --write-out '%{http_code}' $state.origin
  if ($LASTEXITCODE -eq 0) { $httpStatus=[int]$status }
}
$closed=$listeners.Count -eq 0 -and (-not $state.publicOpened -or $null -eq $httpStatus -or $httpStatus -ge 500)
@{at=[DateTime]::UtcNow.ToString('o');stopped=$stopped;localListeners=$listeners.Count;publicOpened=$state.publicOpened;publicStatus=$httpStatus;closed=$closed;resultsSaved=[bool]$ResultsSaved;failedValidation=[bool]$FailedValidation} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $dir 'closure.json') -Encoding utf8
if (-not $closed) { throw 'Closure verification incomplete' }
Write-Host 'MP013 processes stopped and loopback ports closed. Lifecycle evidence retained.'

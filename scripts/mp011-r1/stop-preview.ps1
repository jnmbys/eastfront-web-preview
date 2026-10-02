param([switch]$ResultsSaved, [switch]$FailedValidation)
$ErrorActionPreference = 'Stop'
if (-not ($ResultsSaved -or $FailedValidation)) { throw 'Export results before stopping; use -ResultsSaved, or -FailedValidation for a failed gate.' }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $repo
$state = Get-Content .mp010-build/mp011-r1/processes.json -Raw | ConvertFrom-Json
$ownerFile = '.mp010-build/mp011-r1/owner-process.json'
$targets = @(@{name='tunnel'; pid=$state.tunnelPid; startedAt=$state.tunnelStartedAt; script='cloudflared.exe'})
if (Test-Path -LiteralPath $ownerFile) {
  $owner = Get-Content -LiteralPath $ownerFile -Raw | ConvertFrom-Json
  $targets += @{name='owner'; pid=$owner.pid; startedAt=$owner.startedAt; script='scripts/mp011-r1/owner-preview.mjs'}
}
$targets += @{name='lab'; pid=$state.labPid; startedAt=$state.labStartedAt; script='scripts/mp010/serve.mjs'}
$stopped = @()
foreach ($target in $targets) {
  if (-not $target.pid) { continue }
  $process = Get-Process -Id $target.pid -ErrorAction SilentlyContinue
  if ($process) {
    if ([Math]::Abs(($process.StartTime.ToUniversalTime() - ([DateTime]$target.startedAt).ToUniversalTime()).TotalSeconds) -gt 1) { throw "PID reused: $($target.name)" }
    $command = (Get-CimInstance Win32_Process -Filter "ProcessId = $($target.pid)").CommandLine
    if (-not $command.Contains($target.script)) { throw "Unexpected process: $($target.name)" }
    Stop-Process -Id $target.pid
    Wait-Process -Id $target.pid -Timeout 10 -ErrorAction SilentlyContinue
  }
  $stopped += $target.name
}
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort 4180,4181 -ErrorAction SilentlyContinue)
$status = & curl.exe --silent --show-error --max-time 20 --output NUL --write-out '%{http_code}' $state.origin 2>$null
$httpStatus = if ($LASTEXITCODE -eq 0) { [int]$status } else { $null }
$closed = $listeners.Count -eq 0 -and ($null -eq $httpStatus -or $httpStatus -ge 500)
@{at=[DateTime]::UtcNow.ToString('o'); stopped=$stopped; localListeners=$listeners.Count; publicStatus=$httpStatus; closed=$closed; resultsSaved=[bool]$ResultsSaved; failedValidation=[bool]$FailedValidation} | ConvertTo-Json | Set-Content evidence/mp-011-r1/closure.json
if (-not $closed) { throw 'Closure verification incomplete; inspect entry before claiming closed' }
Write-Host 'Tunnel, owner boundary and lab stopped; entry unavailable.'

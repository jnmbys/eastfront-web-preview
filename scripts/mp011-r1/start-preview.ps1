param([int]$Attempt=1)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $repo
if ($env:COMPUTERNAME -ne 'LAPTOP-G2NEE96G') { throw 'Unexpected host' }
if (Get-NetTCPConnection -State Listen -LocalPort 4180,4181 -ErrorAction SilentlyContinue) { throw 'Preview ports occupied' }
$fixed='1052f31d686f71a975d3c0c79b42aeae6633386a'
git diff --quiet $fixed -- scripts/mp010 src server package.json package-lock.json
if ($LASTEXITCODE -ne 0) { throw 'Pinned runtime source changed' }
$zip=(Get-FileHash .mp010-build/mp010-r1-artifacts.zip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($zip -ne 'f5adf77f6b160463a315ad920920cf408f4e755305c8d015bbf7f15fcf420714') { throw 'Archive mismatch' }
node scripts/mp011-r1/integrity.mjs
if ($LASTEXITCODE -ne 0) { throw 'Integrity check failed' }
$exe=Join-Path $repo '.mp010-build/tools/cloudflared.exe'
if ((Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'f096265ec2fcbe9bb6e2d64268db167ced3fcbb83d894bdb9e2fcdb26f2ea7e2') { throw 'cloudflared mismatch' }
$dir=Join-Path $repo '.mp010-build/mp011-r1'
$stateFile=Join-Path $dir 'processes.json'
if (Test-Path -LiteralPath $stateFile) { throw 'Archive previous local lifecycle files before a new attempt' }
$tunnel=Start-Process -FilePath $exe -ArgumentList @('tunnel','--url','http://127.0.0.1:4181','--no-autoupdate','--protocol','quic') -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dir 'tunnel.stdout.log') -RedirectStandardError (Join-Path $dir 'tunnel.stderr.log') -PassThru
$state=@{attempt=$Attempt; fixedCommit=$fixed; revisionBase='3e8d78a67e039ac10ea2eb2943d70fc4138ec9df'; transport='quic'; denialMode='original'; tunnelPid=$tunnel.Id; tunnelStartedAt=$tunnel.StartTime.ToUniversalTime().ToString('o'); target='http://127.0.0.1:4181'}
$state | ConvertTo-Json | Set-Content -LiteralPath $stateFile
try {
  $origin=''
  for ($i=0; $i -lt 25; $i++) {
    $log=Get-Content -LiteralPath (Join-Path $dir 'tunnel.stderr.log') -Raw -ErrorAction SilentlyContinue
    if ($log) { $origin=[regex]::Match($log,'https://[a-z0-9-]+\.trycloudflare\.com').Value }
    if ($origin) { break }
    Start-Sleep -Seconds 1
  }
  if (-not $origin) { throw 'No tunnel origin returned' }
  $state.origin=$origin
  $env:MP010_ORIGIN=$origin; $env:MP010_HOST='127.0.0.1'; $env:MP010_PORT='4180'; $env:MP010_BEHIND_TLS='1'
  $lab=Start-Process -FilePath (Get-Command node).Source -ArgumentList @('scripts/mp010/serve.mjs') -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dir 'lab.stdout.log') -RedirectStandardError (Join-Path $dir 'lab.stderr.log') -PassThru
  $state.labPid=$lab.Id; $state.labStartedAt=$lab.StartTime.ToUniversalTime().ToString('o')
  $state | ConvertTo-Json | Set-Content -LiteralPath $stateFile
} catch {
  if ($lab -and -not $lab.HasExited) { Stop-Process -Id $lab.Id }
  if (-not $tunnel.HasExited) { Stop-Process -Id $tunnel.Id }
  throw
} finally {
  Remove-Item Env:MP010_ORIGIN,Env:MP010_HOST,Env:MP010_PORT,Env:MP010_BEHIND_TLS -ErrorAction SilentlyContinue
}
Start-Process -FilePath (Get-Command pwsh).Source -ArgumentList @('-NoProfile','-File',(Join-Path $PSScriptRoot 'start-owner.ps1')) -WorkingDirectory $repo -WindowStyle Normal
Write-Host 'Local masked password window opened. Public entry is still gated; validate before device use.'

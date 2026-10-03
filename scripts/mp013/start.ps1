param([string]$Origin, [switch]$PublicTunnel, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $repo
if ($env:COMPUTERNAME -ne 'LAPTOP-G2NEE96G') { throw 'Unexpected host' }
node scripts/mp013/verify.mjs
if ($LASTEXITCODE -ne 0) { throw 'Integrity check failed' }
if (Get-NetTCPConnection -State Listen -LocalPort 4180,4181,4184 -ErrorAction SilentlyContinue) { throw 'Preview ports occupied' }
if ($PublicTunnel -and $Origin) { throw 'Do not supply an origin with a generated temporary tunnel' }
if (-not $PublicTunnel) {
  $uri = [uri]$Origin
  if (-not $uri.IsAbsoluteUri -or $uri.Scheme -ne 'https' -or $uri.GetLeftPart([UriPartial]::Authority) -cne $Origin -or $uri.UserInfo) { throw 'Supply one exact HTTPS origin without trailing slash' }
}
$exe = Join-Path $repo '.mp010-build/tools/cloudflared.exe'
if ($PublicTunnel -and (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'f096265ec2fcbe9bb6e2d64268db167ced3fcbb83d894bdb9e2fcdb26f2ea7e2') { throw 'Pinned cloudflared mismatch' }
if ($CheckOnly) { Write-Host 'MP013 preflight passed; no process or tunnel started'; return }
$dir = Join-Path $repo ('.mp010-build/mp013/run-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $dir | Out-Null
$state = @{origin=$Origin; publicOpened=[bool]$PublicTunnel; target='http://127.0.0.1:4181'; processes=@()}
$stateFile = Join-Path $dir 'processes.json'
function Save-State { $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $stateFile -Encoding utf8 }
function Track-Process($process, $name, $script) {
  $state.processes += @{name=$name; pid=$process.Id; startedAt=$process.StartTime.ToUniversalTime().ToString('o'); script=$script}
  Save-State
}
Save-State
try {
  # Default mode never starts a tunnel. The explicit switch is for a later authorized run.
  if ($PublicTunnel) {
    $tunnel=Start-Process -FilePath $exe -ArgumentList @('tunnel','--url','http://127.0.0.1:4181','--no-autoupdate','--protocol','quic') -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dir 'tunnel.stdout.log') -RedirectStandardError (Join-Path $dir 'tunnel.stderr.log') -PassThru
    Track-Process $tunnel 'tunnel' 'cloudflared.exe'
    for ($i=0; $i -lt 30; $i++) {
      if ($tunnel.HasExited) { throw 'Tunnel exited before configuration' }
      $log=Get-Content -LiteralPath (Join-Path $dir 'tunnel.stderr.log') -Raw -ErrorAction SilentlyContinue
      if ($log) { $Origin=[regex]::Match($log,'https://[a-z0-9-]+\.trycloudflare\.com').Value }
      if ($Origin) { break }; Start-Sleep -Seconds 1
    }
    if (-not $Origin) { throw 'No exact temporary origin returned' }
    $state.origin=$Origin; Save-State
  }
  $secure=Read-Host 'Enter and retain a temporary 24-256 character owner password (never send it to chat)' -AsSecureString
  $bstr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    if ($plain.Length -lt 24 -or $plain.Length -gt 256) { throw 'Password must have 24-256 characters' }
    $bytes=[Text.Encoding]::UTF8.GetBytes($plain)
    $sha=[Security.Cryptography.SHA256]::Create()
    try { $env:MP013_PASSWORD_SHA256=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose(); [Array]::Clear($bytes,0,$bytes.Length) }
  } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); $plain=$null; $secure.Dispose() }
  $env:MP013_ORIGIN=$Origin; $env:MP013_RUN_DIR=$dir
  try {
    $stack=Start-Process -FilePath (Get-Command node).Source -ArgumentList @('scripts/mp013/stack.mjs') -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $dir 'stack.stdout.log') -RedirectStandardError (Join-Path $dir 'stack.stderr.log') -PassThru
    Track-Process $stack 'stack' 'scripts/mp013/stack.mjs'
  } finally { Remove-Item Env:MP013_PASSWORD_SHA256,Env:MP013_ORIGIN,Env:MP013_RUN_DIR -ErrorAction SilentlyContinue }
  for ($i=0; $i -lt 30; $i++) {
    if ($stack.HasExited) { throw 'Local stack exited; inspect local noncredential logs' }
    if (Test-Path -LiteralPath (Join-Path $dir 'stack.json')) { break }; Start-Sleep -Seconds 1
  }
  if (-not (Test-Path -LiteralPath (Join-Path $dir 'stack.json'))) { throw 'Local stack startup timed out' }
  Write-Host "Origin: $Origin"
  Write-Host "RunDir: $dir"
  Write-Host 'Local stack ready. Public access, if requested, still requires anonymous and owner validation before device use.'
} catch {
  & (Join-Path $PSScriptRoot 'stop.ps1') -RunDir $dir -FailedValidation
  throw
} finally { Remove-Item Env:MP013_PASSWORD_SHA256,Env:MP013_ORIGIN,Env:MP013_RUN_DIR -ErrorAction SilentlyContinue }

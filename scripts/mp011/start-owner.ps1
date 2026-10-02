$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$stateDir = Join-Path $repo '.mp010-build/mp011'
Set-Location -LiteralPath $repo
if ($env:COMPUTERNAME -ne 'LAPTOP-G2NEE96G') { throw 'Unexpected host' }
$state = Get-Content -LiteralPath (Join-Path $stateDir 'processes.json') -Raw | ConvertFrom-Json
$origin = [Uri]$state.origin
if ($origin.Scheme -ne 'https' -or $origin.Host -notlike '*.trycloudflare.com' -or $origin.AbsolutePath -ne '/') { throw 'Unexpected origin' }
if (Get-NetTCPConnection -State Listen -LocalPort 4181 -ErrorAction SilentlyContinue) { throw '4181 already occupied' }
Write-Host 'MP-011: enter a new random temporary password locally (24-256 characters).'
Write-Host 'Keep it for your device login. Do not send it to chat. Input is masked.'
$secret = Read-Host 'Temporary password' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  if ($plain.Length -lt 24 -or $plain.Length -gt 256) { throw 'Password must be 24-256 characters' }
  $bytes = [Text.Encoding]::UTF8.GetBytes($plain)
  $env:MP010_OWNER_PASSWORD_SHA256 = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  $plain = $null
  if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
  $secret.Dispose()
}
try {
  $env:MP010_ORIGIN = $state.origin
  $owner = Start-Process -FilePath (Get-Command node).Source -ArgumentList @('scripts/mp010/owner-preview.mjs') -WorkingDirectory $repo -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDir 'owner.stdout.log') -RedirectStandardError (Join-Path $stateDir 'owner.stderr.log') -PassThru
  @{ pid=$owner.Id; startedAt=$owner.StartTime.ToUniversalTime().ToString('o'); executable=$owner.Path; script='scripts/mp010/owner-preview.mjs' } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stateDir 'owner-process.json')
} finally {
  Remove-Item Env:MP010_OWNER_PASSWORD_SHA256 -ErrorAction SilentlyContinue
  Remove-Item Env:MP010_ORIGIN -ErrorAction SilentlyContinue
}
Write-Host 'Access boundary launched. You may close this window. Never share the password in chat.'
Read-Host 'Press Enter to close'

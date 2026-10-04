param(
  [string]$Archive = '../startup-003-r1/.startup003/r1/startup-003-r1-candidate-b9927e072d30fac8b732b815c0d817ce490d7d6e.zip'
)
$ErrorActionPreference = 'Stop'
$expected = '78c8169d8dd264d37fb93a07d33bb0810cd84a80111f723797466719df4d5d38'
$archivePath = (Resolve-Path -LiteralPath $Archive).Path
if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Wrong frozen archive' }
$workspace = (Get-Location).Path
$target = [IO.Path]::GetFullPath((Join-Path $workspace '.startup004/candidate'))
if (-not $target.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Outside workspace' }
if (Test-Path -LiteralPath $target) { throw 'Candidate already exists; verify it without overwriting' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
try {
  foreach ($entry in $zip.Entries) {
    $destination = [IO.Path]::GetFullPath((Join-Path $target $entry.FullName))
    if (-not $destination.StartsWith($target + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escapes candidate' }
  }
} finally { $zip.Dispose() }
[IO.Compression.ZipFile]::ExtractToDirectory($archivePath, $target)
node --input-type=module -e 'import {verify} from "./scripts/startup004/integrity.mjs"; console.log(JSON.stringify(verify(),null,2))'
if ($LASTEXITCODE -ne 0) { throw 'Candidate manifest verification failed' }

param([string]$Python = '', [int]$Port = 4186)
$ErrorActionPreference = 'Stop'
$playableRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Set-Location -LiteralPath $playableRoot
if (!$Python) {
  $existingPython = [IO.Path]::GetFullPath((Join-Path $playableRoot '../../ef-venv/Scripts/python.exe'))
  if (Test-Path -LiteralPath $existingPython) { $Python = $existingPython } else { $Python = 'python' }
}
& $Python -c 'import scipy; assert tuple(map(int,scipy.__version__.split(chr(46)))) == (1,17,0)'
if ($LASTEXITCODE) { throw 'Verified Python/SciPy environment is required; no packages were installed.' }
& $Python -X utf8 experiments/playable-002/prepare-runtime.py
if ($LASTEXITCODE) { throw 'Pinned runtime verification failed.' }
node experiments/playable-004/build.mjs
if ($LASTEXITCODE) { throw 'Build failed.' }
& $Python -u -X utf8 (Join-Path $PSScriptRoot 'server.py') $Port

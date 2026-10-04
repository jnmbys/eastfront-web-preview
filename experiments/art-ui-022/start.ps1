param([int]$Port=8822,[string]$BackendPath='',[string]$Python='',[switch]$Check)
$ErrorActionPreference='Stop'
$UiPath=Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $BackendPath) { $BackendPath=$env:INDUSTRY018_PATH }
if (-not $BackendPath) { throw 'Supply -BackendPath for the pinned 018 experiments/industry-integrate-018 directory.' }
$BackendPath=(Resolve-Path -LiteralPath $BackendPath).Path
if (-not $Python) { $Python=$env:INDUSTRY_PYTHON }
if (-not $Python) { $Python=(Get-Command python -ErrorAction Stop).Source }
& $Python -c 'import numpy, scipy'
if ($LASTEXITCODE -ne 0) { throw 'Use existing Python with NumPy/SciPy; no packages installed.' }
$CandidateArguments=@((Join-Path $UiPath 'server.py'),'--backend',$BackendPath,'--port',$Port)
if ($Check) { $CandidateArguments+='--check' }
& $Python @CandidateArguments
exit $LASTEXITCODE

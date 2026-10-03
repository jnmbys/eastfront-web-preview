param([int]$Port = 8817, [string]$Python = '', [switch]$Prepare)
$ErrorActionPreference = 'Stop'
$ExperimentPath = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Python) { $Python = $env:INDUSTRY_PYTHON }
if (-not $Python) {
    $GitCommonPath = (& git -C $ExperimentPath rev-parse --path-format=absolute --git-common-dir).Trim()
    $RepositoryPath = Split-Path -Parent $GitCommonPath
    $ExistingPython = Join-Path $RepositoryPath '.venv/Scripts/python.exe'
    if (Test-Path -LiteralPath $ExistingPython) { $Python = $ExistingPython }
    else { $Python = (Get-Command python -ErrorAction Stop).Source }
}
& $Python -c 'import numpy, scipy'
if ($LASTEXITCODE -ne 0) { throw 'Choose Python with NumPy/SciPy using -Python. No packages were installed.' }
if ($Prepare -or -not (Test-Path -LiteralPath (Join-Path $ExperimentPath '.runtime/owner/adapter.py'))) {
    & $Python (Join-Path $ExperimentPath 'prepare.py')
    if ($LASTEXITCODE -ne 0) { throw 'Preparation failed. Service was not started.' }
}
& $Python (Join-Path $ExperimentPath 'server.py') --port $Port
exit $LASTEXITCODE

param([int]$Port = 8818, [string]$BackendPath = '', [string]$Python = '', [switch]$Check)
$ErrorActionPreference = 'Stop'
$UiPath = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $BackendPath) { $BackendPath = $env:INDUSTRY018_PATH }
if (-not $BackendPath) {
    $CandidateBackend = Join-Path (Split-Path -Parent $UiPath) 'industry-integrate-018'
    if (Test-Path -LiteralPath $CandidateBackend) { $BackendPath = $CandidateBackend }
    else { throw 'Supply -BackendPath for the pinned 018 experiments/industry-integrate-018 directory.' }
}
$BackendPath = (Resolve-Path -LiteralPath $BackendPath).Path
if (-not $Python) { $Python = $env:INDUSTRY_PYTHON }
if (-not $Python) {
    $GitCommonPath = (& git -C $BackendPath rev-parse --path-format=absolute --git-common-dir 2>$null)
    if ($LASTEXITCODE -eq 0 -and $GitCommonPath) {
        $ExistingPython = Join-Path (Split-Path -Parent $GitCommonPath.Trim()) '.venv/Scripts/python.exe'
        if (Test-Path -LiteralPath $ExistingPython) { $Python = $ExistingPython }
    }
    if (-not $Python) { $Python = (Get-Command python -ErrorAction Stop).Source }
}
& $Python -c 'import numpy, scipy'
if ($LASTEXITCODE -ne 0) { throw 'Choose Python with NumPy/SciPy via -Python. No packages installed.' }
$LaunchArguments = @((Join-Path $UiPath 'workbench_018_server.py'), '--backend', $BackendPath, '--port', $Port)
if ($Check) { $LaunchArguments += '--check' }
& $Python @LaunchArguments
exit $LASTEXITCODE


param([string]$Python=$env:INDUSTRY_PYTHON,[int]$Port=8818)
$ErrorActionPreference='Stop'
if (-not $Python) {
    $common = & git -C $PSScriptRoot rev-parse --path-format=absolute --git-common-dir
    $candidate = Join-Path (Split-Path $common -Parent) '.venv/Scripts/python.exe'
    $Python = if (Test-Path -LiteralPath $candidate) { $candidate } else { 'python' }
}
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.runtime/compat017/bridge.py'))) {
    & $Python (Join-Path $PSScriptRoot 'prepare.py')
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
& $Python (Join-Path $PSScriptRoot 'local_server.py') --port $Port
exit $LASTEXITCODE

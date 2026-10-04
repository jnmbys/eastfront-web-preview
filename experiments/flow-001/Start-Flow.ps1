param([int]$Port = 4180)
$ErrorActionPreference = 'Stop'
Write-Host 'FLOW-001: original map and local Core. Stop with Ctrl+C.'
& node (Join-Path $PSScriptRoot 'serve.mjs') $Port
exit $LASTEXITCODE

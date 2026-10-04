param([int]$Port = 4190)
$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'serve.mjs') $Port
exit $LASTEXITCODE

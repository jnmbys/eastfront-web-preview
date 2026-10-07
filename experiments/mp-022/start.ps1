param([int]$Port=4210)
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if ($Port -in @(4197,4198) -or $Port -lt 1024 -or $Port -gt 65535) { throw 'Reserved or invalid port' }
if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {throw 'Port occupied; no process will be stopped'}
if (-not (Test-Path -LiteralPath (Join-Path $repo '.ai003-preview/server/gameplay.js'))) {throw 'Build first: npm ci; node ai/local/build.mjs'}
$script=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'server.mjs'))
$process=Start-Process -FilePath (Get-Command node).Source -ArgumentList @('"'+$script+'"',"$Port") -WorkingDirectory $repo -WindowStyle Hidden -PassThru
$record=@{pid=$process.Id;startedAt=$process.StartTime.ToUniversalTime().ToString('o');script=$script;repo=$repo;port=$Port;host='127.0.0.1';publicOpened=$false}
$record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $repo 'mp022-process.json')
Start-Sleep -Milliseconds 1200
if (-not (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object OwningProcess -eq $process.Id)) {throw 'Startup not yet verified; inspect recorded process, do not kill unrelated services'}
Write-Host "A: http://127.0.0.1:$Port/a/"
Write-Host "B: http://127.0.0.1:$Port/b/"

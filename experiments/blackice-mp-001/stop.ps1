$ErrorActionPreference = 'Stop'
$taskData = Join-Path $env:LOCALAPPDATA 'Eastfront/blackice-mp-001'
$taskRun = Get-Content -Raw -LiteralPath (Join-Path $taskData 'runtime.json') | ConvertFrom-Json
$taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($taskRun.pid)"
if (-not $taskProcess -or $taskProcess.CommandLine -notlike '*experiments/blackice-mp-001/server.mjs*') { throw '任务进程不匹配，未停止任何进程。' }
New-Item -ItemType File -Path (Join-Path $taskData 'stop.request') -Force | Out-Null
Write-Output '已请求本任务服务保存并正常关闭；没有停止其他 Node 服务。'

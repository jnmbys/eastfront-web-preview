$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskData = Join-Path $env:LOCALAPPDATA 'Eastfront/blackice-mp-001'
$taskRecord = Join-Path $taskData 'runtime.json'
if (Test-Path -LiteralPath $taskRecord) {
    $taskPrevious = Get-Content -Raw -LiteralPath $taskRecord | ConvertFrom-Json
    if (Get-NetTCPConnection -State Listen -LocalPort $taskPrevious.port -ErrorAction SilentlyContinue | Where-Object OwningProcess -eq $taskPrevious.pid) { throw '本任务服务仍在运行；不能并发打开同一存档目录。' }
}
$taskPort = @(4277,4278,4279) | Where-Object { -not (Get-NetTCPConnection -State Listen -LocalPort $_ -ErrorAction SilentlyContinue) } | Select-Object -First 1
if (-not $taskPort) { throw '4277–4279 均被占用，未停止任何进程。' }
New-Item -ItemType Directory -Force -Path $taskData | Out-Null
$env:PORT = "$taskPort"
$env:SAVE_DIR = $taskData
$env:STOP_FILE = Join-Path $taskData 'stop.request'
if (Test-Path -LiteralPath $env:STOP_FILE) { throw '存在旧关闭请求，请核对后再启动。' }
$taskNode = (Get-Command node).Source
$taskProcess = Start-Process -FilePath $taskNode -ArgumentList 'experiments/blackice-mp-001/server.mjs' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskData 'stdout.log') -RedirectStandardError (Join-Path $taskData 'stderr.log') -PassThru
@{pid=$taskProcess.Id;port=$taskPort;workspace=$taskRoot;stopFile=$env:STOP_FILE} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskData 'runtime.json')
Write-Output "本任务进程 $($taskProcess.Id)，入口 http://127.0.0.1:$taskPort/rooms"

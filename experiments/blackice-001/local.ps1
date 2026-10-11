param([ValidateSet('start','stop','status')][string]$Action='status')
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtimeDir=Join-Path $env:LOCALAPPDATA 'Eastfront/blackice-001'
$pidFile=Join-Path $runtimeDir 'server.pid'
$listeners=@(Get-NetTCPConnection -LocalPort 4275 -State Listen -ErrorAction SilentlyContinue)
if($Action -eq 'status') { $listeners | Select-Object LocalAddress,LocalPort,OwningProcess; return }
if($Action -eq 'stop') {
 if(!(Test-Path -LiteralPath $pidFile)){throw 'Missing task PID file'}
 $taskProcessId=[int](Get-Content -LiteralPath $pidFile)
 $process=Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
 if(!$process -or $process.Name -ne 'node.exe' -or $process.CommandLine -notmatch 'blackice-001[/\\]server\.mjs' -or !($listeners.OwningProcess -contains $taskProcessId)){throw 'Process/port verification failed; nothing stopped'}
 Stop-Process -Id $taskProcessId
 Write-Output 'Stopped only BLACKICE 4275; saves retained';return
}
if($listeners.Count){throw '4275 occupied; existing process preserved'}
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$env:PORT='4275';$env:HOST='127.0.0.1';$env:SAVE_DIR=$runtimeDir;$env:PUBLIC_ORIGIN='http://127.0.0.1:4275';$env:RELEASE_LOCAL='1'
$taskProcess=Start-Process -FilePath (Get-Command node).Source -ArgumentList 'experiments/blackice-001/server.mjs' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'server.out.log') -RedirectStandardError (Join-Path $runtimeDir 'server.err.log') -PassThru
$taskProcess.Id | Set-Content -LiteralPath $pidFile
Write-Output "BLACKICE process $($taskProcess.Id): http://127.0.0.1:4275/campaigns"

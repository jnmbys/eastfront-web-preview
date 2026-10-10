param([ValidateSet('start','stop','status')][string]$Action='status')
$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$runtimeDir=Join-Path $env:LOCALAPPDATA 'Eastfront/grand-division-003'
$pidFile=Join-Path $runtimeDir 'server.pid'
$listeners=@(Get-NetTCPConnection -LocalPort 4273 -State Listen -ErrorAction SilentlyContinue)
if($Action -eq 'status') { $listeners | Select-Object LocalAddress,LocalPort,OwningProcess; return }
if($Action -eq 'stop') {
 if(!(Test-Path -LiteralPath $pidFile)){throw 'Missing task PID file; no process was stopped.'}
 $taskProcessId=[int](Get-Content -LiteralPath $pidFile)
 $process=Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
 if(!$process -or $process.Name -ne 'node.exe' -or $process.CommandLine -notmatch 'grand-release-002[/\\]server\.mjs' -or !($listeners.OwningProcess -contains $taskProcessId)){throw 'Task process/port verification failed; no process was stopped.'}
 Stop-Process -Id $taskProcessId
 Write-Output 'Stopped only the verified 4273 candidate. Saved campaigns remain on disk.'
 return
}
if($listeners.Count){throw '4273 is already in use; existing process preserved.'}
New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
$env:PORT='4273';$env:HOST='127.0.0.1';$env:SAVE_DIR=$runtimeDir;$env:PUBLIC_ORIGIN='http://127.0.0.1:4273';$env:RELEASE_LOCAL='1'
$node=(Get-Command node).Source
$taskProcess=Start-Process -FilePath $node -ArgumentList 'experiments/grand-release-002/server.mjs' -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir 'server.out.log') -RedirectStandardError (Join-Path $runtimeDir 'server.err.log') -PassThru
$taskProcess.Id | Set-Content -LiteralPath $pidFile
Write-Output "Candidate process $($taskProcess.Id), http://127.0.0.1:4273/?campaign=combined"

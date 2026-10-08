$ErrorActionPreference = 'Stop'
# Pause and save in the page first. Only the task-owned loopback process may be stopped.
$taskListener = Get-NetTCPConnection -LocalPort 4249 -State Listen -ErrorAction SilentlyContinue
if (-not $taskListener) { Write-Output '4249 is already stopped.'; exit 0 }
$taskOwner = $taskListener | Select-Object -First 1 -ExpandProperty OwningProcess
$taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskOwner"
if ($taskProcess.Name -ne 'node.exe' -or $taskProcess.CommandLine -notmatch 'experiments[\\/]grand-ui-003[\\/]server\.mjs') { throw '4249 is not the expected GRAND-UI-003 process; no process stopped.' }
if ($taskListener.LocalAddress | Where-Object { $_ -ne '127.0.0.1' }) { throw 'Unexpected binding; no process stopped.' }
Stop-Process -Id $taskOwner
Write-Output 'Only GRAND-UI-003 port 4249 stopped. Its saved campaign and backups are retained.'

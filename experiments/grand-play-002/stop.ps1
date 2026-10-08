$taskListener = Get-NetTCPConnection -State Listen -LocalPort 4235 -ErrorAction SilentlyContinue
if (!$taskListener) { Write-Output '4235 has no listening service.'; exit }
foreach ($taskProcessId in ($taskListener.OwningProcess | Select-Object -Unique)) {
  $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
  if ($taskProcess.CommandLine -notmatch 'experiments[/\\]grand-play-002[/\\]server\.mjs') { throw '4235 belongs to another service; stopped nothing.' }
  Stop-Process -Id $taskProcessId
  Write-Output "Stopped GRAND-PLAY-002 PID $taskProcessId only."
}

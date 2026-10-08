$taskListener = Get-NetTCPConnection -State Listen -LocalPort 4224 -ErrorAction SilentlyContinue
if (!$taskListener) { Write-Output '4224 has no listening service.'; exit }
foreach ($taskProcessId in ($taskListener.OwningProcess | Select-Object -Unique)) {
  $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
  if ($taskProcess.CommandLine -notmatch 'experiments[/\\]grand-map-002[/\\]server\.mjs') { throw '4224 belongs to another service; stopped nothing.' }
  Stop-Process -Id $taskProcessId
  Write-Output "Stopped GRAND-MAP-002 PID $taskProcessId only."
}

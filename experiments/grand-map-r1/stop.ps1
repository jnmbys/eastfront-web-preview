$taskListener = Get-NetTCPConnection -State Listen -LocalPort 4222 -ErrorAction SilentlyContinue
if (!$taskListener) { Write-Output '4222 has no listening service.'; exit }
foreach ($taskProcessId in ($taskListener.OwningProcess | Select-Object -Unique)) {
  $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
  if ($taskProcess.CommandLine -notmatch 'experiments[/\\]grand-map-r1[/\\]server\.mjs') { throw '4222 belongs to another service; stopped nothing.' }
  Stop-Process -Id $taskProcessId
  Write-Output "Stopped GRAND-MAP-R1 PID $taskProcessId only."
}

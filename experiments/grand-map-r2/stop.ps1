$taskListener = Get-NetTCPConnection -State Listen -LocalPort 4223 -ErrorAction SilentlyContinue
if (!$taskListener) { Write-Output '4223 has no listening service.'; exit }
foreach ($taskProcessId in ($taskListener.OwningProcess | Select-Object -Unique)) {
  $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
  if ($taskProcess.CommandLine -notmatch 'experiments[/\\]grand-map-r2[/\\]server\.mjs') { throw '4223 belongs to another service; stopped nothing.' }
  Stop-Process -Id $taskProcessId
  Write-Output "Stopped GRAND-MAP-R2 PID $taskProcessId only."
}

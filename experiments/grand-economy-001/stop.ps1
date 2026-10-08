$taskListener = Get-NetTCPConnection -State Listen -LocalPort 4237 -ErrorAction SilentlyContinue
if (!$taskListener) { Write-Output '4237 has no listening service.'; exit }
foreach ($taskProcessId in ($taskListener.OwningProcess | Select-Object -Unique)) {
  $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
  if ($taskProcess.CommandLine -notmatch 'experiments[/\\]grand-economy-001[/\\]server\.mjs') { throw '4237 belongs to another service; stopped nothing.' }
  Stop-Process -Id $taskProcessId
  Write-Output "Stopped GRAND-ECONOMY-001 PID $taskProcessId only."
}

$taskListener = Get-NetTCPConnection -State Listen -LocalPort 4243 -ErrorAction SilentlyContinue
if (!$taskListener) { Write-Output '4243 has no listening service.'; exit }
foreach ($taskProcessId in ($taskListener.OwningProcess | Select-Object -Unique)) {
  $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
  if ($taskProcess.CommandLine -notmatch 'experiments[/\\]grand-art-001[/\\]server\.mjs') { throw '4243 belongs to another service; stopped nothing.' }
  Stop-Process -Id $taskProcessId
  Write-Output "Stopped GRAND-ART-001 PID $taskProcessId only."
}

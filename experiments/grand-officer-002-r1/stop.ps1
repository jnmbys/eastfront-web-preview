$taskListener = Get-NetTCPConnection -State Listen -LocalPort 4233 -ErrorAction SilentlyContinue
if (!$taskListener) { Write-Output '4233 has no listening service.'; exit }
foreach ($taskProcessId in ($taskListener.OwningProcess | Select-Object -Unique)) {
  $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
  if ($taskProcess.CommandLine -notmatch 'experiments[/\\]grand-officer-002-r1[/\\]server\.mjs') { throw '4233 belongs to another service; stopped nothing.' }
  Stop-Process -Id $taskProcessId
  Write-Output "Stopped GRAND-OFFICER-002-R1 PID $taskProcessId only."
}

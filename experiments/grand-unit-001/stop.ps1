$taskListener = Get-NetTCPConnection -State Listen -LocalPort 4225 -ErrorAction SilentlyContinue
if (!$taskListener) { Write-Output '4225 has no listening service.'; exit }
foreach ($taskProcessId in ($taskListener.OwningProcess | Select-Object -Unique)) {
  $taskProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
  if ($taskProcess.CommandLine -notmatch 'experiments[/\\]grand-unit-001[/\\]server\.mjs') { throw '4225 belongs to another service; stopped nothing.' }
  Stop-Process -Id $taskProcessId
  Write-Output "Stopped GRAND-UNIT-001 PID $taskProcessId only."
}

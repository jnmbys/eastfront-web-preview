# Save/pause in the page first. This never targets older services.
foreach ($taskPort in @(4247,4248)) {
 foreach ($taskPid in (Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique) {
  $taskProc=Get-CimInstance Win32_Process -Filter "ProcessId=$taskPid"
  if ($taskProc.CommandLine -notmatch 'experiments[/\\]grand-release-001[/\\]server\.mjs') { throw "Port $taskPort belongs to another service." }
  Stop-Process -Id $taskPid
 }
}

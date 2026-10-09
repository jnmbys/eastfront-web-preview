$ErrorActionPreference='Stop'
$listener=Get-NetTCPConnection -State Listen -LocalPort 4255 -ErrorAction SilentlyContinue
if(!$listener){Write-Output '4255 未运行';exit}
foreach($taskProcessId in ($listener.OwningProcess | Select-Object -Unique)){
 $taskProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$taskProcessId"
 if($taskProcess.CommandLine -notmatch 'grand-ui-003-r1[/\\]server.mjs normal'){throw '端口进程并非此候选，未停止。'}
 Stop-Process -Id $taskProcessId
}
Write-Output '仅已关闭4255；存档保留。关闭前请在网页暂停并保存。'

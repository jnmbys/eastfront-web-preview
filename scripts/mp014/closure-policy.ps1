function Convert-PublicProbe {
  param([bool]$Attempted, [int]$ExitCode=0, [string]$HttpCode='', [double]$ElapsedMs=0)
  if (-not $Attempted) { return @{outcome='NOT_ATTEMPTED';httpStatus=$null;exitCode=$null;reason='LOCAL_ONLY';elapsedMs=$null;unavailableObserved=$false} }
  $httpStatus=$null
  if ($HttpCode -match '^[1-5][0-9][0-9]$') { $httpStatus=[int]$HttpCode }
  if ($ExitCode -ne 0 -or $null -eq $httpStatus) {
    $reason=switch ($ExitCode) { 6 {'DNS_ERROR'} 28 {'TIMEOUT'} 35 {'TLS_ERROR'} 60 {'TLS_ERROR'} 7 {'CONNECT_ERROR'} 0 {'NO_HTTP_RESPONSE'} default {'TRANSPORT_ERROR'} }
    return @{outcome='UNKNOWN';httpStatus=$httpStatus;exitCode=$ExitCode;reason=$reason;elapsedMs=$ElapsedMs;unavailableObserved=$false}
  }
  $unavailable=$httpStatus -ge 500
  return @{outcome=$(if ($unavailable) {'HTTP_UNAVAILABLE'} else {'HTTP_RESPONDING'});httpStatus=$httpStatus;exitCode=$ExitCode;reason='HTTP_RESPONSE';elapsedMs=$ElapsedMs;unavailableObserved=$unavailable}
}
function New-ClosureReport {
  param([array]$Processes, [hashtable]$Listeners, [hashtable]$PublicProbe, [bool]$PublicOpened)
  $processesExited=$Processes.Count -gt 0 -and @($Processes | Where-Object {$_.outcome -notin @('EXITED','ALREADY_EXITED')}).Count -eq 0
  $localVerified=$processesExited -and $Listeners.outcome -eq 'CLOSED'
  $publicVerified=$PublicOpened -and $PublicProbe.outcome -eq 'HTTP_UNAVAILABLE' -and $localVerified
  $overall=if (-not $localVerified) {'LOCAL_NOT_VERIFIED'} elseif (-not $PublicOpened) {'LOCAL_ONLY_VERIFIED'} elseif ($publicVerified) {'VERIFIED_AT_PROBE'} else {'PUBLIC_NOT_VERIFIED'}
  return @{schema='MP014-closure-v1';at=[DateTime]::UtcNow.ToString('o');processes=$Processes;processExitVerified=$processesExited;localListeners=$Listeners;localClosureVerified=$localVerified;publicOpened=$PublicOpened;publicProbe=$PublicProbe;publicUnavailableVerified=$publicVerified;overall=$overall;limits='HTTP_UNAVAILABLE means an HTTP 5xx response at this probe only, not permanent DNS removal; UNKNOWN never verifies public closure.'}
}

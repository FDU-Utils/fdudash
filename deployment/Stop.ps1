$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:5173'
try { $health = Invoke-RestMethod -Uri "$base/bridge/health" -TimeoutSec 2 } catch { Write-Output 'The local connector is not running.'; exit 0 }
if ($health.service -ne 'fdudash-connector') { throw 'The service on port 5173 is not FDUDash. No process was stopped.' }
if (-not $health.shutdown) { throw 'This connector does not support Stop.cmd. Update the connector or stop its original terminal process.' }
$state = Invoke-RestMethod -Uri "$base/api/session" -SessionVariable connectorSession -TimeoutSec 5
$result = Invoke-RestMethod -Uri "$base/bridge/stop" -Method Post -WebSession $connectorSession -Headers @{ 'X-CSRF-Token' = $state.csrf } -TimeoutSec 5
if (-not $result.stopping) { throw 'The connector did not acknowledge the shutdown request.' }
Write-Output 'FDUDash connector stopped. Saved accounts have been retained.'

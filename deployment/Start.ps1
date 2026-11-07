$ErrorActionPreference = 'Stop'
$connectorRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$stateDir = Join-Path $env:LOCALAPPDATA 'FDUDash'
New-Item -ItemType Directory -Force -Path $stateDir | Out-Null
$config = Get-Content -Raw -LiteralPath (Join-Path $connectorRoot 'connector-config.json') | ConvertFrom-Json
$health = $null
try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5173/bridge/health' -TimeoutSec 2 } catch {}
if ($health -and $health.service -ne 'fdudash-connector') { throw 'Port 5173 is occupied by another service.' }
if (-not $health) {
    Start-Process -FilePath (Join-Path $connectorRoot 'runtime/node.exe') -ArgumentList 'server.mjs' -WorkingDirectory $connectorRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDir 'connector-out.log') -RedirectStandardError (Join-Path $stateDir 'connector-error.log') | Out-Null
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        Start-Sleep -Milliseconds 500
        try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5173/bridge/health' -TimeoutSec 1; break } catch {}
    }
}
if (-not $health) { throw 'The local connector could not start. Check the FDUDash logs in LOCALAPPDATA.' }
if ($health.origins -notcontains $config.webOrigins[0]) { throw 'An older connector is already running. Stop it and start this version.' }
Start-Process 'http://127.0.0.1:5173/connect'

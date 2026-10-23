[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$statePath = Join-Path $root '.run\netmind-processes.json'

function Stop-TrackedProcess([object]$entry) {
    try {
        $process = Get-Process -Id $entry.Id -ErrorAction Stop
        if ([int64]$process.StartTime.ToFileTimeUtc() -ne [int64]$entry.StartTimeUtc) {
            Write-Warning "Not stopping PID $($entry.Id): it is no longer the process started by NetMind."
            return
        }
        & taskkill.exe /PID $entry.Id /T /F 2>$null | Out-Null
        Write-Host "Stopped $($entry.Name)."
    } catch {
        Write-Host "$($entry.Name) is already stopped."
    }
}

 $startedByLauncher = Test-Path $statePath
if ($startedByLauncher) {
    $state = Get-Content -Raw $statePath | ConvertFrom-Json
    foreach ($entry in @($state.Processes)) { Stop-TrackedProcess $entry }
    Remove-Item -LiteralPath $statePath -Force
} else {
    Write-Host 'No NetMind launcher process state was found; unrelated processes were not touched.'
}

if ($startedByLauncher) {
    Push-Location $root
    try {
        & docker compose stop postgres 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { Write-Host 'Stopped NetMind PostgreSQL (data preserved).' }
    } finally { Pop-Location }
}

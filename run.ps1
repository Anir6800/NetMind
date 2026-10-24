[CmdletBinding()]
param(
    [switch]$Check,
    [switch]$Reset,
    [switch]$NoBrowser,
    [switch]$Stop,
    [switch]$Lab
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$logs = Join-Path $root 'logs'
$stateDir = Join-Path $root '.run'
$statePath = Join-Path $stateDir 'netmind-processes.json'
$frontendPort = 5173
$ports = @(
    @{ Name = 'PostgreSQL'; Port = 5432 }, @{ Name = 'API'; Port = 8000 },
    @{ Name = 'Firebase Auth'; Port = 9099 },
    @{ Name = 'Controller'; Port = 8765 }
)

function Fail([string]$message) { throw "NetMind setup stopped: $message" }
function Require-Command([string]$name, [string]$fix) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { Fail "$name was not found. Fix: $fix" }
}
function Get-PortProcess([int]$port) {
    $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) { return Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue }
    return $null
}
function Test-NetMindPostgresRunning {
    $container = (& docker compose ps -q postgres 2>$null | Select-Object -First 1).Trim()
    return -not [string]::IsNullOrWhiteSpace($container)
}
function Assert-PortsFree {
    foreach ($item in $ports) {
        $owner = Get-PortProcess $item.Port
        if ($item.Port -eq 5432 -and $owner -and (Test-NetMindPostgresRunning)) {
            Write-Host 'NetMind PostgreSQL is already running; reusing the local Compose container.'
            continue
        }
        if ($owner) { Fail "port $($item.Port) ($($item.Name)) is in use by $($owner.ProcessName) (PID $($owner.Id)). Fix: close that process or run .\stop.ps1 if it is a previous NetMind run." }
    }
}
function Resolve-FrontendPort {
    $owner = Get-PortProcess 5173
    if (-not $owner) { return 5173 }
    $fallback = Get-PortProcess 5174
    if ($fallback) { Fail "port 5173 is in use by $($owner.ProcessName) (PID $($owner.Id)), and fallback port 5174 is in use by $($fallback.ProcessName) (PID $($fallback.Id)). Fix: close either process, then rerun." }
    Write-Host "Frontend port 5173 is in use by $($owner.ProcessName) (PID $($owner.Id)); using NetMind fallback http://127.0.0.1:5174."
    return 5174
}
function Wait-Port([int]$port, [string]$name, [int]$seconds = 45) {
    $until = (Get-Date).AddSeconds($seconds)
    do {
        if (Get-PortProcess $port) { return }
        Start-Sleep -Milliseconds 300
    } while ((Get-Date) -lt $until)
    Fail "$name did not listen on 127.0.0.1:$port within $seconds seconds. Read logs\$($name.ToLower().Replace(' ', '-')).log."
}
function Wait-Http([string]$url, [string]$name, [int]$seconds = 45) {
    $until = (Get-Date).AddSeconds($seconds)
    do {
        try { if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $url).StatusCode -ge 200) { return } } catch {}
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $until)
    Fail "$name did not become healthy at $url within $seconds seconds. Read its log in logs\."
}
function Get-PythonVersion {
    $text = (& python --version 2>&1).ToString()
    if ($text -notmatch 'Python (\d+)\.(\d+)') { Fail 'Python version could not be read. Fix: install Python 3.10 or newer from https://www.python.org/downloads/ and reopen PowerShell.' }
    if (([int]$Matches[1] -lt 3) -or (([int]$Matches[1] -eq 3) -and ([int]$Matches[2] -lt 10))) { Fail "Python $text is unsupported. Fix: install Python 3.10 or newer from https://www.python.org/downloads/." }
}
function Get-NodeVersion {
    $text = (& node --version).Trim()
    if ($text -notmatch '^v(\d+)') { Fail 'Node version could not be read. Fix: install Node LTS from https://nodejs.org/.' }
    if ([int]$Matches[1] -lt 20) { Fail "Node $text is unsupported. Fix: install current Node LTS from https://nodejs.org/." }
}
function Test-AlreadyRunning {
    if (-not (Test-Path $statePath)) { return $false }
    try {
        $state = Get-Content -Raw $statePath | ConvertFrom-Json
        foreach ($entry in @($state.Processes)) {
            $process = Get-Process -Id $entry.Id -ErrorAction Stop
            if ([int64]$process.StartTime.ToFileTimeUtc() -ne [int64]$entry.StartTimeUtc) { return $false }
        }
        $savedFrontendPort = if ($state.FrontendPort) { [int]$state.FrontendPort } else { 5173 }
        return ($null -ne (Get-PortProcess 8000)) -and ($null -ne (Get-PortProcess $savedFrontendPort)) -and ($null -ne (Get-PortProcess 9099)) -and ($null -ne (Get-PortProcess 8765))
    } catch { return $false }
}
function Set-EnvLine([string]$path, [string]$key, [string]$value) {
    $lines = @(Get-Content -LiteralPath $path -ErrorAction SilentlyContinue)
    $found = $false
    $out = foreach ($line in $lines) {
        if ($line -match "^$([regex]::Escape($key))=") { $found = $true; "$key=$value" } else { $line }
    }
    if (-not $found) { $out += "$key=$value" }
    Set-Content -LiteralPath $path -Value $out -Encoding utf8
}
function Ensure-Env {
    $envPath = Join-Path $root '.env'
    if (-not (Test-Path $envPath)) { Copy-Item (Join-Path $root '.env.example') $envPath }
    $gemini = (Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^GEMINI_API_KEY=' } | Select-Object -First 1)
    $nvidia = (Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^NVIDIA_API_KEY=' } | Select-Object -First 1)
    if ($nvidia -and $nvidia -ne 'NVIDIA_API_KEY=') { Set-EnvLine $envPath 'NETMIND_NVIDIA_FIXTURE_MODE' 'false' }
    if ((-not $gemini -or $gemini -eq 'GEMINI_API_KEY=') -and (-not $nvidia -or $nvidia -eq 'NVIDIA_API_KEY=')) {
        $secure = Read-Host 'Optional GEMINI_API_KEY (press Enter for labelled offline fallback)' -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try { $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
        if ($value) { Set-EnvLine $envPath 'GEMINI_API_KEY' $value } else { Set-EnvLine $envPath 'NETMIND_NVIDIA_FIXTURE_MODE' 'true' }
    }
}
function Start-Tracked([string]$name, [string]$file, [string[]]$arguments) {
    $out = Join-Path $logs "$name.log"; $err = Join-Path $logs "$name.err.log"
    $process = Start-Process -FilePath $file -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Minimized -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
    Start-Sleep -Milliseconds 200
    return [pscustomobject]@{ Name = $name; Id = $process.Id; StartTimeUtc = [int64](Get-Process -Id $process.Id).StartTime.ToFileTimeUtc() }
}
function Write-LauncherState([object[]]$processes) {
    @{ Processes = $processes; StartedAt = (Get-Date).ToString('o'); Mode = 'SIMULATED'; FrontendPort = $frontendPort } | ConvertTo-Json -Depth 4 | Set-Content $statePath -Encoding utf8
}
function Seed-DemoUsers([string]$python) {
    & $python (Join-Path $root 'scripts\seed_demo_users.py')
    if ($LASTEXITCODE -ne 0) { Fail 'Firebase demo-user seeding failed. Read logs\firebase.err.log and rerun after the emulator is healthy.' }
}

if ($Stop) { & (Join-Path $root 'stop.ps1'); exit $LASTEXITCODE }
Push-Location $root
try {
    Require-Command python 'install Python 3.10+ from https://www.python.org/downloads/.'
    Require-Command node 'install Node LTS from https://nodejs.org/.'
    Require-Command npm 'install Node LTS from https://nodejs.org/.'
    Require-Command git 'install Git from https://git-scm.com/download/win.'
    Require-Command docker 'install Docker Desktop from https://www.docker.com/products/docker-desktop/.'
    Get-PythonVersion; Get-NodeVersion
    if ($Lab) { Fail '-Lab is not configured in this repository. This Windows host uses the clearly-labelled SIMULATED controller mode; do not claim Mininet support.' }
    & docker version --format '{{.Server.Version}}' | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail 'Docker Desktop is installed but not running. Fix: start Docker Desktop and wait for "Engine running".' }
    if (Test-AlreadyRunning) { $saved = Get-Content -Raw $statePath | ConvertFrom-Json; $url = "http://127.0.0.1:$($saved.FrontendPort)"; Write-Host "NetMind is already running (idempotent start): $url"; if (-not $NoBrowser) { Start-Process $url }; exit 0 }
    if (Test-Path $statePath) { & (Join-Path $root 'stop.ps1') }
    Assert-PortsFree
    $frontendPort = Resolve-FrontendPort
    if ($Check) { Write-Host 'Preflight passed. No services were started. Mode: SIMULATED (Windows host).'; exit 0 }
    if ($Reset) {
        $answer = Read-Host 'Reset deletes local NetMind PostgreSQL demo data. Type RESET to continue'
        if ($answer -ne 'RESET') { Fail 'Reset cancelled; no data was deleted.' }
        & docker compose down -v
        if ($LASTEXITCODE -ne 0) { Fail 'Could not reset the local Compose project.' }
    }
    New-Item -ItemType Directory -Force $logs, $stateDir | Out-Null
    Ensure-Env
    $venvPython = Join-Path $root '.venv\Scripts\python.exe'
    if (-not (Test-Path $venvPython)) { & python -m venv .venv; & $venvPython -m pip install -r backend\requirements.lock }
    if (-not (Test-Path (Join-Path $root 'frontend\node_modules'))) { & npm ci --prefix frontend }
    if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) { & npm install -g firebase-tools }
    $env:NETMIND_CONTROLLER_TOKEN = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
    $env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
    $env:NETMIND_LAB_MODE = 'SIMULATED'
    & docker compose up -d postgres
    if ($LASTEXITCODE -ne 0) { Fail 'PostgreSQL could not start. Read Docker Desktop and run docker compose logs postgres.' }
    Write-LauncherState @()
    $deadline = (Get-Date).AddSeconds(60)
    do { & docker compose exec -T postgres pg_isready -U netmind_admin -d netmind 2>$null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep -Seconds 1 } while ((Get-Date) -lt $deadline)
    if ($LASTEXITCODE -ne 0) { Fail 'PostgreSQL was not healthy in 60 seconds. Fix: docker compose logs postgres.' }
    Push-Location (Join-Path $root 'backend')
    try { & $venvPython -m alembic upgrade head } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { Fail 'Database migration failed. Fix: read the migration output above and docker compose logs postgres.' }
    & $venvPython (Join-Path $root 'scripts\seed_demo_data.py')
    if ($LASTEXITCODE -ne 0) { Fail 'Demo data seeding failed. Fix: read the output above, then rerun after checking PostgreSQL.' }
    $tracked = @()
    $tracked += Start-Tracked 'firebase' 'cmd.exe' @('/c', 'firebase emulators:start --only auth --project demo-netmind')
    Write-LauncherState $tracked
    Wait-Port 9099 'Firebase Auth'; Seed-DemoUsers $venvPython
    $tracked += Start-Tracked 'backend' $venvPython @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000','--app-dir','backend')
    Write-LauncherState $tracked
    Wait-Http 'http://127.0.0.1:8000/health' 'API'
    $tracked += Start-Tracked 'frontend' 'cmd.exe' @('/d','/c',"npm run dev --prefix frontend -- --host 127.0.0.1 --port $frontendPort --strictPort")
    Write-LauncherState $tracked
    Wait-Http "http://127.0.0.1:$frontendPort/" 'Frontend'
    $tracked += Start-Tracked 'controller' $venvPython @('simulation-controller/topology/controller.py')
    Write-LauncherState $tracked
    Wait-Port 8765 'Controller'
    Write-LauncherState $tracked
    Write-Host "`nNetMind is ready (SIMULATED mode)."
    @(
        [pscustomobject]@{ Service='Frontend'; URL="http://127.0.0.1:$frontendPort"; Status='healthy' },
        [pscustomobject]@{ Service='API'; URL='http://127.0.0.1:8000/health'; Status='healthy' },
        [pscustomobject]@{ Service='Firebase Auth'; URL='http://127.0.0.1:9099'; Status='listening' },
        [pscustomobject]@{ Service='Controller'; URL='127.0.0.1:8765'; Status='listening' }
    ) | Format-Table -AutoSize
    if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$frontendPort" }
} catch {
    Write-Error $_
    if (Test-Path $statePath) { & (Join-Path $root 'stop.ps1') }
    exit 1
} finally { Pop-Location }

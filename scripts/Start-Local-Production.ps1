param([switch]$Build)
$ErrorActionPreference = 'Stop'
$frontendRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (Get-NetTCPConnection -LocalPort 4240 -State Listen -ErrorAction SilentlyContinue) {
    throw 'Port 4240 is in use. Stop the existing Thaikana frontend before starting this preview.'
}
$apiReady=$false
for($attempt=0;$attempt -lt 4;$attempt++){
    try {
        Invoke-WebRequest -Uri 'http://127.0.0.1:5248/health/ready' -UseBasicParsing -TimeoutSec 10 | Out-Null
        $apiReady=$true
        break
    } catch { Start-Sleep -Milliseconds 500 }
}
if(!$apiReady){throw 'Local API is not ready; inspect its logs. No frontend container was started.'}
if ($Build) {
    docker build --build-arg BUILD_CONFIGURATION=production,workspace -t thaikana-workspace:local $frontendRoot
    if ($LASTEXITCODE -ne 0) { throw 'Production image build failed.' }
}
$existing = docker ps -aq --filter 'name=^/thaikana-workspace-local$'
if ($existing) { throw 'Container thaikana-workspace-local already exists; inspect and remove it before restarting.' }
docker run -d --name thaikana-workspace-local -p 127.0.0.1:4240:8080 -e API_UPSTREAM=http://host.docker.internal:5248 thaikana-workspace:local
if ($LASTEXITCODE -ne 0) { throw 'Local production container failed to start.' }
Write-Output 'Thaikana production frontend: http://localhost:4240 (existing local API on port 5248).'

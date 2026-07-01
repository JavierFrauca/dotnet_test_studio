#requires -Version 5.1
<#
.SYNOPSIS
    Genera el instalador de escritorio de Dotnet Test Studio (Electron + sidecar .NET).

.DESCRIPTION
    Publica el sidecar DotnetTest.Engine como ejecutable framework-dependent (usa el runtime de
    .NET ya instalado en la máquina, no lo embebe), lo copia a la app, compila el bundle de
    Electron y produce el instalador NSIS en apps/desktop/dist.

    Equivale a 'npm run dist', pero además:
      - Mata procesos DotnetTest.Engine colgados que bloquean el exe (evita EPERM al republicar).
      - Instala las dependencias de npm si faltan.
      - Detecta el RID (win-x64 / win-arm64) automáticamente.

.PARAMETER Runtime
    RID del sidecar (p.ej. win-x64, win-arm64). Si se omite, se detecta automáticamente.

.PARAMETER SkipDeps
    No ejecuta 'npm install' aunque falte node_modules.

.PARAMETER EngineOnly
    Solo publica el sidecar en resources/engine (sin generar el instalador).

.EXAMPLE
    .\build.ps1
    .\build.ps1 -Runtime win-arm64
    .\build.ps1 -EngineOnly
#>
[CmdletBinding()]
param(
    [string]$Runtime = '',
    [switch]$SkipDeps,
    [switch]$EngineOnly
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    $msg" -ForegroundColor Yellow }

$appDir = $PSScriptRoot
Set-Location $appDir

# 1) Requisitos
foreach ($tool in 'dotnet', 'node', 'npm') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "No se encontró '$tool' en el PATH. Necesitas .NET SDK 10+ y Node.js 18+."
    }
}

# 2) Detectar RID (sin depender de tipos .NET; funciona en PowerShell 5.1 y 7)
if ([string]::IsNullOrWhiteSpace($Runtime)) {
    $arch = if ("$env:PROCESSOR_ARCHITECTURE" -match 'ARM64') { 'arm64' } else { 'x64' }
    $Runtime = "win-$arch"
}

# 3) Liberar el exe del sidecar si quedó un proceso colgado (evita EPERM al republicar)
$stray = Get-Process -Name 'DotnetTest.Engine' -ErrorAction SilentlyContinue
if ($stray) {
    Write-Step "Cerrando procesos DotnetTest.Engine colgados…"
    $stray | ForEach-Object { try { Stop-Process -Id $_.Id -Force; Write-Ok "PID $($_.Id) cerrado" } catch {} }
    Start-Sleep -Milliseconds 600
}

# 4) Dependencias de npm
if (-not $SkipDeps -and -not (Test-Path (Join-Path $appDir 'node_modules'))) {
    Write-Step "Instalando dependencias de npm…"
    & npm install
    if ($LASTEXITCODE -ne 0) { throw "npm install falló." }
}

# 5) Publicar el sidecar (lo usa también 'npm run dist', pero así controlamos el RID)
Write-Step "Publicando sidecar framework-dependent ($Runtime)…"
$env:RID = $Runtime
& npm run build:engine
if ($LASTEXITCODE -ne 0) { throw "La publicación del sidecar falló." }

$engineExe = Join-Path $appDir 'resources\engine\DotnetTest.Engine.exe'
if (Test-Path $engineExe) {
    $mb = [math]::Round((Get-Item $engineExe).Length / 1MB, 1)
    Write-Ok "Sidecar: $engineExe ($mb MB)"
}

if ($EngineOnly) {
    Write-Host ""
    Write-Host "Sidecar publicado (sin instalador, -EngineOnly)." -ForegroundColor Green
    return
}

# 6) Bundle de Electron + instalador NSIS
Write-Step "Compilando el bundle de Electron…"
& npm run build
if ($LASTEXITCODE -ne 0) { throw "electron-vite build falló." }

Write-Step "Generando el instalador (electron-builder)…"
& npx electron-builder
if ($LASTEXITCODE -ne 0) { throw "electron-builder falló." }

# 7) Reportar el artefacto
$installer = Get-ChildItem -Path (Join-Path $appDir 'dist') -Filter '*setup*.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
Write-Host ""
if ($installer) {
    $mb = [math]::Round($installer.Length / 1MB, 1)
    Write-Host "Instalador generado:" -ForegroundColor Green
    Write-Host "  $($installer.FullName) ($mb MB)"
}
else {
    Write-Warn2 "No se encontró el instalador en dist\. Revisa la salida de electron-builder."
}

#requires -Version 5.1
<#
.SYNOPSIS
    Arranque llave en mano de dotnet test studio: comprueba requisitos, compila la solución
    y genera el instalador de la app de escritorio.

.DESCRIPTION
    Pensado para que un compañero clone el repo y, con un solo comando, le funcione.
    Verifica .NET SDK 10+, Node 18+ y git; compila la solución (incluido el sidecar que la
    app lanza en 'npm run dev'); y construye el instalador NSIS de la app de escritorio.

.PARAMETER Test
    Ejecuta los tests unitarios tras compilar.

.EXAMPLE
    .\setup.ps1            # compila la solución + instalador de escritorio
    .\setup.ps1 -Test      # además ejecuta los tests unitarios
#>
[CmdletBinding()]
param(
    [switch]$Test
)

$ErrorActionPreference = 'Stop'

function Write-Step($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Write-Ok($m)   { Write-Host "    $m" -ForegroundColor Green }
function Write-Bad($m)  { Write-Host "    $m" -ForegroundColor Red }
function Write-Hint($m) { Write-Host "    $m" -ForegroundColor Yellow }

$root = $PSScriptRoot
Set-Location $root

# ── 1) Requisitos ──────────────────────────────────────────────────────────────
Write-Step "Comprobando requisitos…"
$ok = $true

$dotnet = Get-Command dotnet -ErrorAction SilentlyContinue
if (-not $dotnet) {
    Write-Bad "Falta el SDK de .NET. Instala .NET SDK 10+: https://dotnet.microsoft.com/download"
    $ok = $false
}
else {
    $sdks = (& dotnet --list-sdks) -join "`n"
    $hasNet10 = ($sdks -split "`n" | Where-Object { $_ -match '^\s*10\.' }).Count -gt 0
    if ($hasNet10) { Write-Ok ".NET SDK 10 detectado" }
    else { Write-Bad "Se requiere .NET SDK 10+. SDKs encontrados:`n$sdks"; $ok = $false }
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Bad "Falta Node.js (para la app de escritorio). Instala Node 18+: https://nodejs.org"
    $ok = $false
}
else {
    $nodeMajor = [int](((& node --version) -replace '[^\d.]', '') -split '\.')[0]
    if ($nodeMajor -ge 18) { Write-Ok "Node.js $(& node --version) detectado" }
    else { Write-Bad "Se requiere Node 18+ (tienes $(& node --version))"; $ok = $false }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Hint "git no está en el PATH: la selección de rama y el worktree aislado no funcionarán."
}

if (-not $ok) { Write-Host ""; throw "Faltan requisitos. Instálalos y vuelve a ejecutar." }

# ── 2) Compilar la solución .NET ───────────────────────────────────────────────
Write-Step "Compilando la solución .NET…"
& dotnet build (Join-Path $root 'dotnettest.slnx') -c Debug --nologo -v minimal
if ($LASTEXITCODE -ne 0) { throw "La compilación de la solución falló." }
Write-Ok "Solución compilada (incluye el sidecar para 'npm run dev')."

# ── 3) Tests (opcional) ─────────────────────────────────────────────────────────
if ($Test) {
    Write-Step "Ejecutando tests unitarios…"
    & dotnet test (Join-Path $root 'tests\DotnetTest.Core.Tests\DotnetTest.Core.Tests.csproj') --nologo -v quiet
    if ($LASTEXITCODE -ne 0) { throw "Fallaron los tests." }
    Write-Ok "Tests OK."
}

# ── 4) Instalador de la app de escritorio ───────────────────────────────────────
Write-Step "Generando el instalador de la app de escritorio…"
& (Join-Path $root 'apps\desktop\build.ps1')

# ── 5) Resumen ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Listo." -ForegroundColor Green
Write-Host "Siguientes pasos:" -ForegroundColor Green
$installer = Get-ChildItem -Path (Join-Path $root 'apps\desktop\dist') -Filter '*setup*.exe' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($installer) { Write-Host "  · Instalador de escritorio:  $($installer.FullName)" }
Write-Host "  · App en modo desarrollo:    cd apps/desktop; npm run dev"

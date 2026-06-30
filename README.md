# Dotnet Test Studio

App de escritorio (Windows) para ejecutar tests de .NET con un **árbol navegable en vivo** y la
posibilidad de probar **otra rama** sin tocar tu working tree, usando `git worktree`.

Resuelve dos molestias de `dotnet test`:

1. El **scroll infinito** de salida: aquí ves un árbol Proyecto → Clase → Test que se colorea en
   vivo (verde/rojo/amarillo) conforme terminan los tests, con filtros por estado y por
   decoradores (`[Category]`, `[Feature]`, `[Trait]`) y un panel de detalle con el stack trace y
   el contexto git del fallo.
2. Probar **otra rama** mientras tu HEAD está en otra distinta, sin `git stash` ni `checkout`,
   en un worktree aislado y reutilizable.

## Arranque rápido (llave en mano)

Clona el repo y, en una terminal PowerShell, ejecuta:

```powershell
.\setup.ps1            # comprueba requisitos, compila la solución y genera el instalador
.\setup.ps1 -Test      # además ejecuta los tests unitarios
```

`setup.ps1` comprueba los requisitos (**.NET SDK 10+**, **Node 18+**, git) con mensajes claros si
falta algo, compila la solución y deja el instalador en `apps/desktop/dist/`. Eso es todo.

## La app de escritorio

Una app Electron con las comodidades de escritorio: selección de carpeta nativa, dropdown de
rama, worktree aislado persistente (Create/Recreate/Destroy), prefiltros, selección de proyectos,
árbol de tests en vivo con filtros (búsqueda, estado y decoradores) y panel de detalle con el
stack trace y los cambios vs la rama base del test seleccionado.

### Desarrollo

```powershell
cd apps/desktop
npm install
dotnet build ../../src/DotnetTest.Engine   # el sidecar que la app lanza en dev
npm run dev                                  # arranca la app en modo desarrollo
```

### Generar el instalador

```powershell
cd apps/desktop
.\build.ps1                    # publica el sidecar self-contained, compila y crea el instalador NSIS
.\build.ps1 -Runtime win-arm64 # otro RID
.\build.ps1 -EngineOnly        # solo publica el sidecar self-contained
```

El script libera procesos del sidecar colgados, instala dependencias si faltan y deja el
instalador en `apps/desktop/dist/`.

## Cómo funciona

- **Resultados en vivo**: usa la *TranslationLayer* de VSTest (`VsTestConsoleWrapper`) para descubrir
  y ejecutar los tests recibiendo callbacks por cada resultado, igual que un IDE. No depende de
  parsear texto ni de esperar a un `.trx` final.
- **Decoradores**: VSTest no serializa los traits de xUnit, así que se leen por reflexión de
  metadatos (`MetadataLoadContext`) sin ejecutar código — soporta `[Trait("Nombre","Valor")]` y
  atributos de trait personalizados (`ITraitAttribute` / `[TraitDiscoverer]`).
- **Otras ramas**: `git worktree add --detach` crea un checkout temporal de la rama en una carpeta
  aparte; tu working tree y tu HEAD no se tocan. El worktree es persistente y reutilizable entre
  exploraciones/ejecuciones, y se elimina con `git worktree remove` al destruirlo.
- **Arquitectura**: la app lanza el sidecar `DotnetTest.Engine` (que reutiliza `DotnetTest.Core`)
  en `127.0.0.1` con un token efímero, y habla con él por **JSON-RPC sobre WebSocket** recibiendo
  los resultados de los tests en streaming.

## Estructura

```
src/DotnetTest.Core/     Motor compartido (sin UI)
  Model/                 Árbol de resultados y estado
  Running/               Build + TranslationLayer (descubrir/ejecutar en vivo) + probe de traits
  Git/                   Worktrees y diffs
  Filters/               Prefiltros guardados
  Orchestration/         RunService (worktree + run reutilizable)
src/DotnetTest.Engine/   Sidecar JSON-RPC/WebSocket para la app de escritorio
apps/desktop/            App Electron + React (Dotnet Test Studio)
tests/Sample.Tests/      Tests de ejemplo para dogfooding (con decoradores)
tests/DotnetTest.Core.Tests/  Tests unitarios del motor
```

## Requisitos

- .NET SDK 10+ (necesario para ejecutar tests: la herramienta usa el `vstest.console` del SDK)
- Node.js 18+ (para compilar/empaquetar la app de escritorio)
- `git` en el PATH (para la selección de rama y el worktree aislado)
- Proyectos de test basados en VSTest (`Microsoft.NET.Test.Sdk`): xUnit, NUnit, MSTest.

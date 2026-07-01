import { execSync } from 'node:child_process'
import { rmSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const engineProj = join(here, '..', '..', '..', 'src', 'DotnetTest.Engine', 'DotnetTest.Engine.csproj')
const out = join(here, '..', 'resources', 'engine')
const rid = process.env.RID || 'win-x64'

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// Framework-dependent: usa el runtime de .NET ya instalado en la máquina en vez de embeberlo.
// No añade ningún requisito nuevo — ejecutar tests ya exige el SDK de .NET 10+ instalado, y el
// instalador del SDK incluye el runtime de ASP.NET Core y el de .NET. Resultado: exe mucho más
// pequeño (sin el runtime embebido) sin coste real para el usuario.
console.log(`Publicando engine (${rid}) framework-dependent en ${out}…`)
execSync(
  [
    'dotnet publish',
    `"${engineProj}"`,
    '-c Release',
    `-r ${rid}`,
    '--self-contained false',
    '-p:PublishSingleFile=true',
    '-p:DebugType=none',
    `-o "${out}"`,
    '--nologo',
  ].join(' '),
  { stdio: 'inherit' },
)
console.log('Engine listo.')

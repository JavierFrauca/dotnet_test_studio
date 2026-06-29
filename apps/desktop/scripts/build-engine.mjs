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

console.log(`Publicando engine (${rid}) self-contained en ${out}…`)
execSync(
  [
    'dotnet publish',
    `"${engineProj}"`,
    '-c Release',
    `-r ${rid}`,
    '--self-contained true',
    '-p:PublishSingleFile=true',
    '-p:IncludeNativeLibrariesForSelfExtract=true',
    '-p:EnableCompressionInSingleFile=true',
    '-p:DebugType=none',
    `-o "${out}"`,
    '--nologo',
  ].join(' '),
  { stdio: 'inherit' },
)
console.log('Engine listo.')

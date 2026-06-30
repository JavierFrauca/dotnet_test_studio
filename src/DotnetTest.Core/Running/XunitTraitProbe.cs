using System.Reflection;
using System.Runtime.InteropServices;

namespace DotnetTest.Core.Running;

/// <summary>
/// Lee los decoradores/traits (Category, Feature, …) de los ensamblados de test por reflexión de
/// metadatos (sin ejecutar código). Maneja el atributo nativo de xUnit [Trait("Name","Value")] y
/// los atributos personalizados de trait (los que implementan ITraitAttribute o llevan
/// [TraitDiscoverer]), tomando como nombre del trait el del atributo sin el sufijo "Attribute".
/// </summary>
public static class XunitTraitProbe
{
    /// <summary>Mapa FQN (namespace.clase.método) → traits (Name,Value).</summary>
    public static Dictionary<string, List<KeyValuePair<string, string>>> Collect(
        IEnumerable<string> assemblyPaths, CancellationToken ct = default, Action<string>? log = null)
    {
        var byFqn = new Dictionary<string, List<KeyValuePair<string, string>>>(StringComparer.Ordinal);
        int probed = 0, failed = 0;
        foreach (var asm in assemblyPaths)
        {
            if (ct.IsCancellationRequested) break;
            try { ProbeAssembly(asm, byFqn); probed++; }
            catch (Exception ex)
            {
                // Antes se tragaba en silencio: ahora se reporta para poder diagnosticar.
                failed++;
                log?.Invoke($"trait probe: '{Path.GetFileName(asm)}' skipped ({ex.GetType().Name}: {ex.Message})");
            }
        }
        log?.Invoke($"trait probe: {probed} assemblies read, {failed} failed, {byFqn.Count} tests with decorators.");
        return byFqn;
    }

    private static void ProbeAssembly(string assemblyPath, Dictionary<string, List<KeyValuePair<string, string>>> byFqn)
    {
        if (!File.Exists(assemblyPath)) return;

        var asmDir = Path.GetDirectoryName(assemblyPath)!;
        // Deduplica por NOMBRE de ensamblado, no por ruta: si el bin del test y el runtime
        // traen el mismo dll (System.Runtime, etc.), PathAssemblyResolver revienta por identidad
        // duplicada y el probe fallaría en silencio. Gana el del bin del test (la versión que el
        // propio test referencia).
        var byName = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var p in Directory.GetFiles(ResolveRuntimeDir(), "*.dll")) byName[Path.GetFileName(p)] = p;
        foreach (var p in Directory.GetFiles(asmDir, "*.dll")) byName[Path.GetFileName(p)] = p;

        using var mlc = new MetadataLoadContext(new PathAssemblyResolver(byName.Values));
        var assembly = mlc.LoadFromAssemblyPath(assemblyPath);

        foreach (var type in SafeGetTypes(assembly))
        {
            if (!type.IsClass || type.IsAbstract && !type.IsSealed) continue;

            var classTraits = ReadTraits(type.GetCustomAttributesData());

            foreach (var method in type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                if (!IsTestMethod(method)) continue;

                var traits = new List<KeyValuePair<string, string>>(classTraits);
                traits.AddRange(ReadTraits(method.GetCustomAttributesData()));
                if (traits.Count == 0) continue;

                var fqn = type.FullName + "." + method.Name;
                byFqn[fqn] = traits;
            }
        }
    }

    private static string? _runtimeDir;

    /// <summary>
    /// Devuelve un directorio de runtime que realmente contenga el BCL en disco, para que
    /// MetadataLoadContext pueda resolver System.Private.CoreLib y compañía.
    /// En dev (framework-dependent) el runtime "actual" ya vale. En el engine self-contained
    /// single-file el BCL va embebido (no hay DLLs sueltos), así que se recurre al framework
    /// compartido (Microsoft.NETCore.App) instalado en la máquina — presente porque ejecutar
    /// tests requiere el SDK de .NET.
    /// </summary>
    private static string ResolveRuntimeDir()
    {
        if (_runtimeDir is not null) return _runtimeDir;

        var current = RuntimeEnvironment.GetRuntimeDirectory();
        if (HasBcl(current)) return _runtimeDir = current;

        foreach (var root in DotnetRoots())
        {
            var shared = Path.Combine(root, "shared", "Microsoft.NETCore.App");
            if (!Directory.Exists(shared)) continue;
            var best = Directory.GetDirectories(shared)
                .Select(d => (dir: d, ver: ParseVersion(Path.GetFileName(d))))
                .Where(x => x.ver is not null && HasBcl(x.dir))
                .OrderByDescending(x => x.ver)
                .Select(x => x.dir)
                .FirstOrDefault();
            if (best is not null) return _runtimeDir = best;
        }

        return _runtimeDir = current; // mejor esfuerzo
    }

    private static bool HasBcl(string? dir) =>
        !string.IsNullOrEmpty(dir) && File.Exists(Path.Combine(dir, "System.Private.CoreLib.dll"));

    private static IEnumerable<string> DotnetRoots()
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var candidates = new[]
        {
            Environment.GetEnvironmentVariable("DOTNET_ROOT"),
            Environment.GetEnvironmentVariable("DOTNET_ROOT(x86)"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "dotnet"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "dotnet"),
            WhereDotnet(),
        };
        foreach (var c in candidates)
            if (!string.IsNullOrEmpty(c) && Directory.Exists(c) && seen.Add(c))
                yield return c;
    }

    /// <summary>Directorio del 'dotnet' del PATH (donde suele colgar shared/Microsoft.NETCore.App).</summary>
    private static string? WhereDotnet()
    {
        var path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (var dir in path.Split(Path.PathSeparator))
        {
            try
            {
                if (!string.IsNullOrWhiteSpace(dir) &&
                    (File.Exists(Path.Combine(dir, "dotnet.exe")) || File.Exists(Path.Combine(dir, "dotnet"))))
                    return dir;
            }
            catch { /* entrada de PATH inválida */ }
        }
        return null;
    }

    private static Version? ParseVersion(string name)
    {
        var dash = name.IndexOf('-'); // descarta sufijo de preview ("10.0.0-rc.1")
        if (dash >= 0) name = name[..dash];
        return Version.TryParse(name, out var v) ? v : null;
    }

    private static Type[] SafeGetTypes(Assembly assembly)
    {
        try { return assembly.GetTypes(); }
        catch (ReflectionTypeLoadException ex) { return ex.Types.Where(t => t is not null).ToArray()!; }
    }

    private static bool IsTestMethod(MethodInfo method)
    {
        foreach (var attr in method.GetCustomAttributesData())
            if (InheritsFrom(attr.AttributeType, "FactAttribute") || InheritsFrom(attr.AttributeType, "TheoryAttribute"))
                return true;
        return false;
    }

    private static List<KeyValuePair<string, string>> ReadTraits(IList<CustomAttributeData> attrs)
    {
        var result = new List<KeyValuePair<string, string>>();
        foreach (var attr in attrs)
        {
            var typeName = attr.AttributeType.Name;

            // [Trait("Name", "Value")] nativo de xUnit.
            if (typeName == "TraitAttribute" && attr.ConstructorArguments.Count == 2)
            {
                if (attr.ConstructorArguments[0].Value is string name && attr.ConstructorArguments[1].Value is string value)
                    result.Add(new KeyValuePair<string, string>(name, value));
                continue;
            }

            // Atributos de trait personalizados (ITraitAttribute / [TraitDiscoverer]).
            if (IsTraitAttribute(attr.AttributeType))
            {
                var key = typeName.EndsWith("Attribute", StringComparison.Ordinal)
                    ? typeName[..^"Attribute".Length]
                    : typeName;
                foreach (var value in FlattenStringArgs(attr.ConstructorArguments))
                    result.Add(new KeyValuePair<string, string>(key, value));
            }
        }
        return result;
    }

    private static bool IsTraitAttribute(Type attrType)
    {
        try
        {
            foreach (var i in attrType.GetInterfaces())
                if (i.Name == "ITraitAttribute") return true;
            foreach (var a in attrType.GetCustomAttributesData())
                if (a.AttributeType.Name == "TraitDiscovererAttribute") return true;
        }
        catch { /* tipo no resoluble */ }
        return false;
    }

    private static IEnumerable<string> FlattenStringArgs(IList<CustomAttributeTypedArgument> args)
    {
        foreach (var arg in args)
        {
            if (arg.Value is string s)
            {
                yield return s;
            }
            else if (arg.Value is IEnumerable<CustomAttributeTypedArgument> array)
            {
                foreach (var el in array)
                    if (el.Value is string es)
                        yield return es;
            }
        }
    }

    private static bool InheritsFrom(Type? type, string baseSimpleName)
    {
        for (var t = type; t is not null; t = SafeBase(t))
            if (t.Name == baseSimpleName)
                return true;
        return false;
    }

    private static Type? SafeBase(Type t)
    {
        try { return t.BaseType; }
        catch { return null; }
    }
}

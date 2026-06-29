namespace DotnetTest.Core.Running;

/// <summary>Localiza el vstest.console.dll del SDK de .NET instalado.</summary>
public static class VsTestLocator
{
    public static string Locate()
    {
        var root = ResolveDotnetRoot();
        var sdkRoot = Path.Combine(root, "sdk");
        if (!Directory.Exists(sdkRoot))
            throw new InvalidOperationException($"SDK directory not found at '{sdkRoot}'.");

        var candidates = Directory.GetDirectories(sdkRoot)
            .Select(d => (Dir: d, Dll: Path.Combine(d, "vstest.console.dll")))
            .Where(c => File.Exists(c.Dll))
            .OrderByDescending(c => ParseVersion(Path.GetFileName(c.Dir)))
            .ToList();

        if (candidates.Count == 0)
            throw new InvalidOperationException(
                $"vstest.console.dll not found in any SDK under '{sdkRoot}'.");

        return candidates[0].Dll;
    }

    private static string ResolveDotnetRoot()
    {
        var env = Environment.GetEnvironmentVariable("DOTNET_ROOT");
        if (!string.IsNullOrEmpty(env) && Directory.Exists(env))
            return env;

        // Resolver la ruta del ejecutable 'dotnet' en el PATH.
        var exe = OperatingSystem.IsWindows() ? "dotnet.exe" : "dotnet";
        var pathDirs = (Environment.GetEnvironmentVariable("PATH") ?? "")
            .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries);
        foreach (var dir in pathDirs)
        {
            try
            {
                var full = Path.Combine(dir, exe);
                if (File.Exists(full))
                {
                    // En Windows el muxer está junto a la carpeta sdk/.
                    var resolved = ResolveSymlink(full);
                    return Path.GetDirectoryName(resolved)!;
                }
            }
            catch { /* ignora entradas de PATH inválidas */ }
        }

        // Último recurso: ubicaciones por defecto.
        var defaults = OperatingSystem.IsWindows()
            ? new[] { @"C:\Program Files\dotnet" }
            : new[] { "/usr/share/dotnet", "/usr/local/share/dotnet" };
        foreach (var d in defaults)
            if (Directory.Exists(d)) return d;

        throw new InvalidOperationException("No se pudo localizar la instalación de .NET (DOTNET_ROOT).");
    }

    private static string ResolveSymlink(string path)
    {
        try
        {
            var info = new FileInfo(path);
            return info.LinkTarget is { } target
                ? (Path.IsPathRooted(target) ? target : Path.Combine(info.DirectoryName!, target))
                : path;
        }
        catch { return path; }
    }

    private static Version ParseVersion(string name)
    {
        // Quita sufijos de preview: "10.0.301-preview" → "10.0.301".
        var dash = name.IndexOf('-');
        if (dash >= 0) name = name[..dash];
        return Version.TryParse(name, out var v) ? v : new Version(0, 0);
    }
}

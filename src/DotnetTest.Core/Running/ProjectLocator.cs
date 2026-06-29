using System.Text.Json;
using DotnetTest.Core.Infra;

namespace DotnetTest.Core.Running;

public sealed record TestProject(string ProjectPath, string TargetPath, string TargetFramework);

/// <summary>
/// Resuelve, a partir de una ruta (sln/csproj/carpeta), los proyectos de test
/// y la ruta del ensamblado compilado de cada uno (TargetPath), vía MSBuild.
/// </summary>
public static class ProjectLocator
{
    public static string ResolveEntryPath(string? input)
    {
        var path = input is null ? Environment.CurrentDirectory : Path.GetFullPath(input);

        if (File.Exists(path)) return path; // .sln o .csproj explícito

        if (Directory.Exists(path))
        {
            var sln = Directory.GetFiles(path, "*.sln").FirstOrDefault()
                      ?? Directory.GetFiles(path, "*.slnx").FirstOrDefault();
            if (sln is not null) return sln;
            var proj = Directory.GetFiles(path, "*.csproj").FirstOrDefault();
            if (proj is not null) return proj;
            throw new FileNotFoundException($"No .sln or .csproj found in '{path}'.");
        }

        throw new FileNotFoundException($"Path '{path}' does not exist.");
    }

    public static async Task<IReadOnlyList<string>> GetProjectsAsync(string entryPath, CancellationToken ct)
    {
        if (entryPath.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase))
            return new[] { entryPath };

        // Solución: listar proyectos.
        var result = await ProcessRunner.RunAsync(
            "dotnet", new[] { "sln", entryPath, "list" }, ct: ct).ConfigureAwait(false);

        var dir = Path.GetDirectoryName(entryPath)!;
        var projects = result.StdOut
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(l => l.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase))
            .Select(l => Path.GetFullPath(Path.Combine(dir, l)))
            .ToList();

        return projects;
    }

    /// <summary>Filtra los proyectos de test y devuelve su TargetPath para la configuración dada.</summary>
    public static async Task<IReadOnlyList<TestProject>> GetTestProjectsAsync(
        IEnumerable<string> projects, string configuration, CancellationToken ct)
    {
        var testProjects = new List<TestProject>();
        foreach (var proj in projects)
        {
            var res = await ProcessRunner.RunAsync(
                "dotnet",
                new[]
                {
                    "msbuild", proj,
                    "-getProperty:IsTestProject",
                    "-getProperty:TargetPath",
                    "-getProperty:TargetFramework",
                    "-getProperty:TargetFrameworks",
                    $"-p:Configuration={configuration}",
                    "-nologo",
                },
                ct: ct).ConfigureAwait(false);

            if (!res.Success) continue;
            if (!TryParseProperties(res.StdOut, out var props)) continue;

            var isTest = props.GetValueOrDefault("IsTestProject", "");
            if (!string.Equals(isTest, "true", StringComparison.OrdinalIgnoreCase)) continue;

            var targetPath = props.GetValueOrDefault("TargetPath", "");
            var tfm = props.GetValueOrDefault("TargetFramework", "");
            if (string.IsNullOrWhiteSpace(targetPath)) continue;

            testProjects.Add(new TestProject(proj, targetPath, tfm));
        }
        return testProjects;
    }

    private static bool TryParseProperties(string json, out Dictionary<string, string> props)
    {
        props = new(StringComparer.OrdinalIgnoreCase);
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("Properties", out var p)) return false;
            foreach (var prop in p.EnumerateObject())
                props[prop.Name] = prop.Value.GetString() ?? "";
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}

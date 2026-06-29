using System.Text.Json;

namespace DotnetTest.Core.Filters;

/// <summary>
/// Persiste los prefiltros del usuario en %APPDATA%/dotnettest/filters.json.
/// En el primer uso siembra un par de ejemplos que el usuario puede borrar.
/// </summary>
public sealed class FilterStore
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public string Path { get; }

    public FilterStore(string? path = null)
    {
        Path = path ?? DefaultPath();
    }

    public static string DefaultPath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return System.IO.Path.Combine(appData, "dotnettest", "filters.json");
    }

    public List<FilterPreset> Load()
    {
        if (!File.Exists(Path))
        {
            var seed = SeedExamples();
            TrySave(seed);
            return seed;
        }
        try
        {
            var json = File.ReadAllText(Path);
            var list = JsonSerializer.Deserialize<List<FilterPreset>>(json, JsonOpts);
            return list ?? new List<FilterPreset>();
        }
        catch
        {
            return new List<FilterPreset>();
        }
    }

    public FilterPreset? Get(string name)
    {
        return Load().FirstOrDefault(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>Crea o actualiza un prefiltro por nombre. Devuelve la lista resultante.</summary>
    public List<FilterPreset> Save(FilterPreset preset)
    {
        var list = Load();
        list.RemoveAll(p => string.Equals(p.Name, preset.Name, StringComparison.OrdinalIgnoreCase));
        list.Add(preset);
        list.Sort((a, b) => string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase));
        TrySave(list);
        return list;
    }

    /// <summary>Elimina un prefiltro por nombre. Devuelve true si existía.</summary>
    public bool Delete(string name)
    {
        var list = Load();
        var removed = list.RemoveAll(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase)) > 0;
        if (removed) TrySave(list);
        return removed;
    }

    private void TrySave(List<FilterPreset> list)
    {
        try
        {
            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(Path)!);
            File.WriteAllText(Path, JsonSerializer.Serialize(list, JsonOpts));
        }
        catch { /* sin permisos de escritura: se opera en memoria */ }
    }

    private static List<FilterPreset> SeedExamples() => new()
    {
        new FilterPreset
        {
            Name = "Solo unitarios",
            Expression = "FullyQualifiedName~UnitTest",
            Description = "Ejemplo: tests cuyo nombre contiene 'UnitTest'",
        },
        new FilterPreset
        {
            Name = "Solo integración",
            Expression = "FullyQualifiedName~Integration",
            Description = "Ejemplo: tests cuyo nombre contiene 'Integration'",
        },
    };
}

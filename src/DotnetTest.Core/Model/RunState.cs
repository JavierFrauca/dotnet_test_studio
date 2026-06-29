namespace DotnetTest.Core.Model;

public enum RunPhase { Preparing, Building, Discovering, Running, Completed, Failed }

/// <summary>Estado global de una ejecución, observado por el TUI.</summary>
public sealed class RunState
{
    public TestTree Tree { get; } = new();
    public RunPhase Phase { get; set; } = RunPhase.Building;
    public string? Label { get; set; }          // nota libre (p.ej. "re-run fallidos")
    public string? StatusLine { get; set; }      // mensaje libre (build output, etc.)
    public DateTime StartedUtc { get; set; }
    public int TotalDiscovered { get; set; }

    // Contexto de la ejecución (cabecera del TUI).
    public string? RepoName { get; set; }
    public string? Branch { get; set; }
    public string? ProjectName { get; set; }
    public string Configuration { get; set; } = "Debug";
    public string? Filter { get; set; }

    /// <summary>Ensamblados de test resueltos en esta ejecución (para cachear entre explorar y ejecutar).</summary>
    public List<string> Sources { get; set; } = new();

    /// <summary>Duración total: en curso si está ejecutando, congelada al terminar.</summary>
    public TimeSpan Elapsed => StartedUtc == default ? TimeSpan.Zero : DateTime.UtcNow - StartedUtc;

    /// <summary>Tests completados por segundo (0 si aún no hay datos).</summary>
    public double Throughput
    {
        get
        {
            var secs = Elapsed.TotalSeconds;
            return secs > 0.05 ? Done / secs : 0;
        }
    }

    /// <summary>Catálogo de facetas: nombre de trait → valores distintos (ordenados).</summary>
    public Dictionary<string, List<string>> CollectFacets()
    {
        var acc = new Dictionary<string, SortedSet<string>>(StringComparer.OrdinalIgnoreCase);
        lock (Tree.SyncRoot)
            foreach (var leaf in Tree.Root.Leaves())
                if (leaf.Traits is not null)
                    foreach (var t in leaf.Traits)
                    {
                        if (!acc.TryGetValue(t.Key, out var set))
                            acc[t.Key] = set = new SortedSet<string>(StringComparer.OrdinalIgnoreCase);
                        if (!string.IsNullOrEmpty(t.Value)) set.Add(t.Value);
                    }
        return acc.ToDictionary(kv => kv.Key, kv => kv.Value.ToList(), StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>El test más lento ejecutado (para el resumen).</summary>
    public TestNode? SlowestTest()
    {
        TestNode? slowest = null;
        lock (Tree.SyncRoot)
            foreach (var leaf in Tree.Root.Leaves())
                if (leaf.OwnStatus is TestStatus.Passed or TestStatus.Failed &&
                    (slowest is null || leaf.Duration > slowest.Duration))
                    slowest = leaf;
        return slowest;
    }

    public int Passed => Tree.Root.CountLeaves(n => n.OwnStatus == TestStatus.Passed);
    public int Failed => Tree.Root.CountLeaves(n => n.OwnStatus == TestStatus.Failed);
    public int Skipped => Tree.Root.CountLeaves(n => n.OwnStatus == TestStatus.Skipped);
    public int Running => Tree.Root.CountLeaves(n => n.OwnStatus == TestStatus.Running);
    public int Done => Passed + Failed + Skipped;

    public bool HasFailures => Failed > 0;
}

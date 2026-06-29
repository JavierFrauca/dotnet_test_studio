namespace DotnetTest.Core.Running;

public sealed class RunOptions
{
    public string? Path { get; init; }
    public string? Filter { get; init; }
    public string Configuration { get; init; } = "Debug";
    public bool NoBuild { get; init; }
    public string? Label { get; init; }          // nota libre para la cabecera
    public string? BranchOverride { get; init; }    // rama a mostrar (modo --branch: worktree detached)
    public string? RepoNameOverride { get; init; }  // repo a mostrar (modo --branch: worktree temporal)

    /// <summary>Nombres de proyecto de test a ejecutar; si null/vacío, todos.</summary>
    public IReadOnlyList<string>? Projects { get; init; }

    /// <summary>Si true, solo descubre (compila + lista tests + traits) sin ejecutar.</summary>
    public bool DiscoverOnly { get; init; }

    /// <summary>Si true, omite el descubrimiento y va directo a ejecutar (tras una exploración previa).</summary>
    public bool SkipDiscovery { get; init; }

    /// <summary>Ensamblados de test ya resueltos; si se indican, no se relocalizan los proyectos.</summary>
    public IReadOnlyList<string>? Sources { get; init; }
}

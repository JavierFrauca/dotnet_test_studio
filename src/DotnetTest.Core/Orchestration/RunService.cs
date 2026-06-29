using DotnetTest.Core.Git;
using DotnetTest.Core.Model;
using DotnetTest.Core.Running;

namespace DotnetTest.Core.Orchestration;

public sealed class RunRequest
{
    public string? Path { get; init; }
    public string? Filter { get; init; }
    public string Configuration { get; init; } = "Debug";
    public bool NoBuild { get; init; }
    public string? Branch { get; init; }   // si != null, crea+destruye un worktree efímero
    public string? Label { get; init; }    // badge (p.ej. nombre de preset)
    public IReadOnlyList<string>? Projects { get; init; }  // proyectos de test (por nombre); null = todos
    public bool DiscoverOnly { get; init; }                // solo descubrir (no ejecuta)
    public bool SkipDiscovery { get; init; }               // ejecutar directo, sin redescubrir
    public IReadOnlyList<string>? Sources { get; init; }   // ensamblados cacheados
    // Para un worktree YA creado (persistente): Path ya viene mapeado; estos alimentan la cabecera.
    public string? BranchOverride { get; init; }
    public string? RepoNameOverride { get; init; }
}

/// <summary>
/// Orquestación reutilizable (sin UI): resuelve worktree opcional, ejecuta y limpia.
/// La usan el CLI y el sidecar de Electron con su propio IRunObserver.
/// </summary>
public sealed class RunService
{
    private readonly TestRunner _runner = new();

    public async Task RunAsync(
        RunRequest req, RunState state, IRunObserver observer, Action<string>? log, CancellationToken ct)
    {
        Worktree? worktree = null;
        try
        {
            var path = req.Path;
            string? branchOverride = req.BranchOverride;
            string? repoOverride = req.RepoNameOverride;

            if (!string.IsNullOrEmpty(req.Branch))
            {
                var baseDir = ResolveBaseDir(path);
                if (!await WorktreeManager.IsGitRepoAsync(baseDir, ct).ConfigureAwait(false))
                {
                    observer.OnPhase(RunPhase.Failed, $"'{baseDir}' is not a git repository.");
                    return;
                }
                var root = await WorktreeManager.GetRepoRootAsync(baseDir, ct).ConfigureAwait(false);
                if (!await WorktreeManager.RefExistsAsync(root, req.Branch!, ct).ConfigureAwait(false))
                {
                    observer.OnPhase(RunPhase.Failed, $"Ref '{req.Branch}' does not exist.");
                    return;
                }
                observer.OnPhase(RunPhase.Preparing, $"Creating isolated worktree for '{req.Branch}'…");
                log?.Invoke($"Creating isolated worktree for '{req.Branch}'…");
                worktree = await WorktreeManager.CreateAsync(root, req.Branch!, ct).ConfigureAwait(false);
                observer.OnPhase(RunPhase.Preparing, "Worktree ready.");
                log?.Invoke($"Worktree ready at {worktree.Path}");
                path = WorktreeManager.MapPathInto(req.Path, root, worktree.Path);
                branchOverride = req.Branch;
                repoOverride = Path.GetFileName(root.TrimEnd('/', '\\'));
            }

            await _runner.RunAsync(new RunOptions
            {
                Path = path,
                Filter = req.Filter,
                Configuration = req.Configuration,
                NoBuild = req.NoBuild,
                Label = req.Label,
                BranchOverride = branchOverride,
                RepoNameOverride = repoOverride,
                Projects = req.Projects,
                DiscoverOnly = req.DiscoverOnly,
                SkipDiscovery = req.SkipDiscovery,
                // Los sources cacheados solo valen sin worktree (el worktree es efímero por ejecución).
                Sources = string.IsNullOrEmpty(req.Branch) ? req.Sources : null,
            }, state, observer, ct).ConfigureAwait(false);
        }
        finally
        {
            if (worktree is not null)
            {
                log?.Invoke("Cleaning up temporary worktree…");
                await worktree.DisposeAsync().ConfigureAwait(false);
            }
        }
    }

    private static string ResolveBaseDir(string? path)
    {
        if (path is null) return Directory.GetCurrentDirectory();
        if (Directory.Exists(path)) return path;
        if (File.Exists(path)) return Path.GetDirectoryName(Path.GetFullPath(path))!;
        return Directory.GetCurrentDirectory();
    }
}

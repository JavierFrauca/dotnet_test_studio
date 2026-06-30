using DotnetTest.Core.Filters;
using DotnetTest.Core.Git;
using DotnetTest.Core.Infra;
using DotnetTest.Core.Model;
using DotnetTest.Core.Orchestration;
using DotnetTest.Core.Running;
using StreamJsonRpc;

namespace DotnetTest.Engine;

/// <summary>Superficie JSON-RPC que consume Electron. Una instancia por conexión WebSocket.</summary>
public sealed class EngineApi : IDisposable
{
    private readonly FilterStore _filters = new();
    private readonly RunService _runService = new();
    private JsonRpc _rpc = null!;
    private CancellationTokenSource? _runCts;

    // Caché de ensamblados resueltos en la última exploración (para que Ejecutar no relocalice).
    private string? _cacheKey;
    private string[]? _cachedSources;

    // Worktree aislado PERSISTENTE de la sesión (se crea/destruye a mano y se reutiliza).
    private Worktree? _worktree;
    private string? _worktreeBranch;

    public void Attach(JsonRpc rpc) => _rpc = rpc;

    private static string CacheKey(RunArgs a) =>
        string.Join("|", a.Path, a.Configuration, a.UseWorktree ? "wt:" + a.Branch : "",
            string.Join(",", a.Projects ?? Array.Empty<string>()));

    // ── Worktree aislado persistente ────────────────────────────────────────
    [JsonRpcMethod("createWorktree")]
    public async Task<WorktreeStatusDto> CreateWorktree(string path, string branch)
    {
        await DestroyWorktreeInternal();
        try
        {
            var entry = ProjectLocator.ResolveEntryPath(path);
            var dir = File.Exists(entry) ? Path.GetDirectoryName(entry)! : entry;
            var repoRoot = await WorktreeManager.GetRepoRootAsync(dir, CancellationToken.None);
            if (!await WorktreeManager.RefExistsAsync(repoRoot, branch, CancellationToken.None))
                return new WorktreeStatusDto(false, null, null, false, null, $"Branch '{branch}' does not exist.");

            _ = _rpc.NotifyAsync("log", new { line = $"Creating isolated worktree for '{branch}'…" });
            _worktree = await WorktreeManager.CreateAsync(repoRoot, branch, CancellationToken.None);
            _worktreeBranch = branch;
            _ = _rpc.NotifyAsync("log", new { line = $"Worktree ready at {_worktree.Path}" });
            return await StatusAsync();
        }
        catch (Exception ex)
        {
            return new WorktreeStatusDto(false, null, null, false, null, ex.Message);
        }
    }

    [JsonRpcMethod("destroyWorktree")]
    public async Task<WorktreeStatusDto> DestroyWorktree()
    {
        await DestroyWorktreeInternal();
        return new WorktreeStatusDto(false, null, null, false, null, null);
    }

    [JsonRpcMethod("worktreeStatus")]
    public async Task<WorktreeStatusDto> WorktreeStatus() => await StatusAsync();

    private async Task<WorktreeStatusDto> StatusAsync()
    {
        if (_worktree is null || _worktreeBranch is null)
            return new WorktreeStatusDto(false, null, null, false, null, null);

        string? head = null;
        var outdated = false;
        try
        {
            var wtHead = await ProcessRunner.RunAsync("git",
                new[] { "-C", _worktree.Path, "rev-parse", "HEAD" });
            var tip = await ProcessRunner.RunAsync("git",
                new[] { "-C", _worktree.RepoRoot, "rev-parse", _worktreeBranch });
            if (wtHead.Success) head = wtHead.StdOut.Trim();
            if (wtHead.Success && tip.Success) outdated = wtHead.StdOut.Trim() != tip.StdOut.Trim();
        }
        catch { /* best effort */ }

        return new WorktreeStatusDto(true, _worktreeBranch,
            head is { Length: >= 7 } ? head[..7] : head, outdated, _worktree.Path, null);
    }

    private async Task DestroyWorktreeInternal()
    {
        _cacheKey = null;
        _cachedSources = null;
        if (_worktree is not null)
        {
            try { await _worktree.DisposeAsync(); } catch { }
            _worktree = null;
            _worktreeBranch = null;
        }
    }

    [JsonRpcMethod("openSolution")]
    public async Task<SolutionInfoDto> OpenSolution(string path)
    {
        var entry = ProjectLocator.ResolveEntryPath(path);
        var dir = File.Exists(entry) ? Path.GetDirectoryName(entry)! : entry;

        var repo = await WorktreeManager.TryGetRepoNameAsync(dir, CancellationToken.None)
                   ?? new DirectoryInfo(dir).Name;
        var branch = await WorktreeManager.TryGetBranchAsync(dir, CancellationToken.None);
        var branches = await WorktreeManager.ListBranchesAsync(dir, CancellationToken.None);

        return new SolutionInfoDto(entry, repo, branch, Path.GetFileName(entry), branches.ToArray());
    }

    [JsonRpcMethod("checkout")]
    public async Task<CheckoutResultDto> Checkout(string path, string branch)
    {
        var root = TryRepoRoot(path);
        if (root is null) return new CheckoutResultDto(false, false, "Not a git repository.");

        var status = await ProcessRunner.RunAsync("git", new[] { "-C", root, "status", "--porcelain" });
        var wasDirty = status.Success && !string.IsNullOrWhiteSpace(status.StdOut);

        var res = await ProcessRunner.RunAsync("git", new[] { "-C", root, "checkout", branch });
        if (!res.Success)
        {
            var msg = res.StdErr.Trim();
            if (string.IsNullOrEmpty(msg)) msg = res.StdOut.Trim();
            return new CheckoutResultDto(false, wasDirty, string.IsNullOrEmpty(msg) ? "git checkout failed." : msg);
        }
        return new CheckoutResultDto(true, wasDirty, null);
    }

    [JsonRpcMethod("listBranches")]
    public async Task<string[]> ListBranches(string path)
    {
        var entry = ProjectLocator.ResolveEntryPath(path);
        var dir = File.Exists(entry) ? Path.GetDirectoryName(entry)! : entry;
        return (await WorktreeManager.ListBranchesAsync(dir, CancellationToken.None)).ToArray();
    }

    [JsonRpcMethod("branchChanges")]
    public async Task<BranchChangesDto> BranchChanges(string path, string? baseRef)
    {
        var repoRoot = TryRepoRoot(path);
        if (repoRoot is null) return new BranchChangesDto(false, null, Array.Empty<GitChangedFileDto>());

        var resolved = await DiffService.ResolveBaseAsync(repoRoot, baseRef, CancellationToken.None);
        if (resolved is null) return new BranchChangesDto(true, null, Array.Empty<GitChangedFileDto>());

        var files = await DiffService.ChangedFilesAsync(repoRoot, resolved, CancellationToken.None);
        return new BranchChangesDto(true, resolved,
            files.Select(f => new GitChangedFileDto(f.Path, f.Status)).ToArray());
    }

    [JsonRpcMethod("testGitContext")]
    public async Task<GitContextDto> TestGitContext(string path, string? stack, string? baseRef)
    {
        var repoRoot = TryRepoRoot(path);
        if (repoRoot is null) return new GitContextDto(false, null, Array.Empty<GitFrameDto>());

        var resolved = await DiffService.ResolveBaseAsync(repoRoot, baseRef, CancellationToken.None);
        var frames = StackTraceParser.Parse(stack);

        var changed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (resolved is not null)
            foreach (var f in await DiffService.ChangedFilesAsync(repoRoot, resolved, CancellationToken.None))
                changed.Add(f.Path);

        var dtos = new List<GitFrameDto>();
        foreach (var frame in frames)
        {
            string? rel = null;
            try
            {
                var r = Path.GetRelativePath(repoRoot, frame.File).Replace('\\', '/');
                if (!r.StartsWith("../", StringComparison.Ordinal) && !Path.IsPathRooted(r)) rel = r;
            }
            catch { /* ruta fuera del repo */ }

            var isChanged = rel is not null && resolved is not null && changed.Contains(rel);
            GitBlameDto? blame = null;
            string? diff = null;
            if (isChanged && rel is not null && resolved is not null)
            {
                diff = await DiffService.FileDiffAsync(repoRoot, resolved, rel, CancellationToken.None);
                var b = await DiffService.BlameLineAsync(repoRoot, rel, frame.Line, resolved, CancellationToken.None);
                if (b is not null) blame = new GitBlameDto(b.Commit, b.Author, b.Date, b.Summary, b.OnBranch);
            }
            dtos.Add(new GitFrameDto(frame.File, rel, frame.Line, isChanged, blame, diff));
        }

        return new GitContextDto(true, resolved, dtos.ToArray());
    }

    private static string? TryRepoRoot(string path)
    {
        try
        {
            var entry = ProjectLocator.ResolveEntryPath(path);
            var dir = File.Exists(entry) ? Path.GetDirectoryName(entry)! : entry;
            return WorktreeManager.GetRepoRootAsync(dir, CancellationToken.None).GetAwaiter().GetResult();
        }
        catch { return null; }
    }

    [JsonRpcMethod("listTestProjects")]
    public async Task<ProjectInfoDto[]> ListTestProjects(string path, string? configuration)
    {
        var entry = ProjectLocator.ResolveEntryPath(path);
        var projects = await ProjectLocator.GetProjectsAsync(entry, CancellationToken.None);
        var test = await ProjectLocator.GetTestProjectsAsync(
            projects, string.IsNullOrEmpty(configuration) ? "Debug" : configuration!, CancellationToken.None);
        return test
            .Select(p => new ProjectInfoDto(Path.GetFileNameWithoutExtension(p.ProjectPath), p.ProjectPath))
            .OrderBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    [JsonRpcMethod("run")]
    public async Task<RunSummaryDto> Run(RunArgs args)
    {
        _runCts?.Cancel();
        _runCts = new CancellationTokenSource();
        var ct = _runCts.Token;

        var filter = args.Filter;
        string? label = null;
        if (!string.IsNullOrEmpty(args.Preset))
        {
            var preset = _filters.Get(args.Preset!);
            if (preset is not null && string.IsNullOrEmpty(filter))
            {
                filter = preset.Expression;
                label = preset.Name;
            }
        }

        // Compone el filtro de traits (facetas) con el filtro de texto/preset.
        var traitExpr = TraitFilter.Build(ToFacetMap(args.Traits));
        filter = TraitFilter.Combine(filter, traitExpr);

        var state = new RunState();
        var observer = new JsonRpcObserver(_rpc);

        var (effPath, brOverride, repoOverride, wtError) = ResolveTarget(args);
        if (wtError is not null)
        {
            observer.OnPhase(RunPhase.Failed, wtError);
            return new RunSummaryDto(0, 0, 0, 0, 0, null, null, null,
                string.IsNullOrEmpty(args.Configuration) ? "Debug" : args.Configuration!);
        }

        // Reutiliza los sources cacheados de la exploración (mismo objetivo) → no relocaliza.
        string[]? sources = null;
        if (args.NoDiscover && _cacheKey == CacheKey(args))
            sources = _cachedSources;

        var request = new RunRequest
        {
            Path = effPath,
            Filter = filter,
            BranchOverride = brOverride,
            RepoNameOverride = repoOverride,
            Configuration = string.IsNullOrEmpty(args.Configuration) ? "Debug" : args.Configuration!,
            NoBuild = args.NoBuild,
            Label = label,
            Projects = args.Projects,
            SkipDiscovery = args.NoDiscover,
            Sources = sources,
        };

        await _runService.RunAsync(request, state, observer,
            log: msg => _ = _rpc.NotifyAsync("log", new { line = msg }), ct);

        return new RunSummaryDto(
            state.Done, state.Passed, state.Failed, state.Skipped, state.Elapsed.TotalMilliseconds,
            state.RepoName, state.Branch, state.ProjectName, state.Configuration);
    }

    /// <summary>Resuelve la ruta efectiva y los overrides según si se usa el worktree persistente.</summary>
    private (string? Path, string? Branch, string? Repo, string? Error) ResolveTarget(RunArgs args)
    {
        if (!args.UseWorktree) return (args.Path, null, null, null);
        if (_worktree is null)
            return (null, null, null, "No isolated worktree. Create it first (Isolated ▸ Create).");

        var mapped = WorktreeManager.MapPathInto(args.Path, _worktree.RepoRoot, _worktree.Path);
        var repo = Path.GetFileName(_worktree.RepoRoot.TrimEnd('/', '\\'));
        return (mapped, _worktreeBranch, repo, null);
    }

    public void Dispose()
    {
        try { DestroyWorktreeInternal().GetAwaiter().GetResult(); } catch { }
    }

    [JsonRpcMethod("discover")]
    public async Task<DiscoverResultDto> Discover(RunArgs args)
    {
        _runCts?.Cancel();
        _runCts = new CancellationTokenSource();
        var ct = _runCts.Token;

        var state = new RunState();
        var observer = new JsonRpcObserver(_rpc);

        var (effPath, brOverride, repoOverride, wtError) = ResolveTarget(args);
        if (wtError is not null)
        {
            observer.OnPhase(RunPhase.Failed, wtError);
            return new DiscoverResultDto(new(), 0, new());
        }

        var request = new RunRequest
        {
            Path = effPath,
            BranchOverride = brOverride,
            RepoNameOverride = repoOverride,
            Configuration = string.IsNullOrEmpty(args.Configuration) ? "Debug" : args.Configuration!,
            NoBuild = args.NoBuild,
            Projects = args.Projects,
            DiscoverOnly = true,
        };

        await _runService.RunAsync(request, state, observer,
            log: msg => _ = _rpc.NotifyAsync("log", new { line = msg }), ct);

        // Cachea los ensamblados resueltos para que el Ejecutar posterior no relocalice.
        _cacheKey = CacheKey(args);
        _cachedSources = state.Sources.ToArray();

        // Los traits ya los rellenó el TestRunner (mientras el worktree existía). Construimos
        // facetas (catálogo) y el mapa fqn→traits a partir del árbol.
        var facets = state.CollectFacets().ToDictionary(kv => kv.Key, kv => kv.Value.ToArray());
        var traitsDto = new Dictionary<string, TraitDto[]>(StringComparer.Ordinal);
        lock (state.Tree.SyncRoot)
            foreach (var leaf in state.Tree.Root.Leaves())
                if (leaf.Traits is { Count: > 0 } && !traitsDto.ContainsKey(leaf.FullName))
                    traitsDto[leaf.FullName] = leaf.Traits
                        .Select(t => new TraitDto(t.Key, t.Value)).Distinct().ToArray();
        return new DiscoverResultDto(facets, state.TotalDiscovered, traitsDto);
    }

    private static IReadOnlyDictionary<string, IReadOnlyList<string>>? ToFacetMap(Dictionary<string, string[]>? traits)
    {
        if (traits is null || traits.Count == 0) return null;
        return traits.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<string>)kv.Value);
    }

    [JsonRpcMethod("cancel")]
    public void Cancel() => _runCts?.Cancel();

    [JsonRpcMethod("listPresets")]
    public PresetDto[] ListPresets()
        => _filters.Load().Select(p => new PresetDto(p.Name, p.Expression, p.Description)).ToArray();

    [JsonRpcMethod("savePreset")]
    public void SavePreset(PresetDto preset)
        => _filters.Save(new FilterPreset { Name = preset.Name, Expression = preset.Expression, Description = preset.Description });

    [JsonRpcMethod("deletePreset")]
    public bool DeletePreset(string name) => _filters.Delete(name);
}

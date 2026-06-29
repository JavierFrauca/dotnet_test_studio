using DotnetTest.Core.Git;
using DotnetTest.Core.Model;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Client;
using Microsoft.TestPlatform.VsTestConsole.TranslationLayer;

namespace DotnetTest.Core.Running;

/// <summary>Orquesta build → discover → run usando la TranslationLayer de VSTest.</summary>
public sealed class TestRunner
{
    private const string RunSettings =
        "<?xml version=\"1.0\" encoding=\"utf-8\"?><RunSettings><RunConfiguration /></RunSettings>";

    public async Task RunAsync(RunOptions options, RunState state, IRunObserver observer, CancellationToken ct)
    {
        state.Label = options.Label;

        state.Configuration = options.Configuration;
        state.Filter = options.Filter;

        string entry;
        try
        {
            entry = ProjectLocator.ResolveEntryPath(options.Path);
        }
        catch (Exception ex)
        {
            observer.OnPhase(RunPhase.Failed, ex.Message);
            return;
        }

        await PopulateContextAsync(entry, options, state, ct).ConfigureAwait(false);

        if (!options.NoBuild)
        {
            var built = await Builder.BuildAsync(entry, options.Configuration, observer, ct).ConfigureAwait(false);
            if (!built) return;
        }

        List<string> sources;
        if (options.Sources is { Count: > 0 })
        {
            // Sources ya resueltos en una exploración previa: no relocalizamos proyectos.
            sources = options.Sources.Where(File.Exists).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }
        else
        {
            observer.OnPhase(RunPhase.Discovering, "Locating test projects…");
            var projects = await ProjectLocator.GetProjectsAsync(entry, ct).ConfigureAwait(false);
            var testProjects = await ProjectLocator.GetTestProjectsAsync(projects, options.Configuration, ct)
                .ConfigureAwait(false);

            // Subconjunto seleccionado por el usuario (por nombre de proyecto).
            if (options.Projects is { Count: > 0 })
            {
                var wanted = new HashSet<string>(options.Projects, StringComparer.OrdinalIgnoreCase);
                testProjects = testProjects
                    .Where(p => wanted.Contains(Path.GetFileNameWithoutExtension(p.ProjectPath)))
                    .ToList();
            }

            sources = testProjects
                .Select(p => p.TargetPath)
                .Where(File.Exists)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        state.Sources = sources;

        if (sources.Count == 0)
        {
            observer.OnPhase(RunPhase.Failed,
                "No test assemblies found. Does the project reference Microsoft.NET.Test.Sdk?");
            return;
        }

        string consolePath;
        try
        {
            consolePath = VsTestLocator.Locate();
        }
        catch (Exception ex)
        {
            observer.OnPhase(RunPhase.Failed, ex.Message);
            return;
        }

        var wrapper = new VsTestConsoleWrapper(consolePath);
        try
        {
            wrapper.StartSession();
            var tpOptions = new TestPlatformOptions { TestCaseFilter = options.Filter };

            // Descubrimiento (puebla el árbol en estado NotRun). Se omite cuando ya se exploró.
            if (!options.SkipDiscovery)
            {
                observer.OnPhase(RunPhase.Discovering, "Discovering tests…");
                var discovery = new DiscoveryHandler(state, observer);
                using (ct.Register(() => { try { wrapper.CancelDiscovery(); } catch { } }))
                    await Task.Run(() => wrapper.DiscoverTests(sources, RunSettings, tpOptions, discovery))
                        .ConfigureAwait(false);

                ct.ThrowIfCancellationRequested();

                // Solo descubrir: enriquecemos con decoradores/traits (xUnit) AQUÍ, mientras los
                // ensamblados existen (importante en modo worktree, que se borra al terminar).
                if (options.DiscoverOnly)
                {
                    try
                    {
                        var traitsByFqn = XunitTraitProbe.Collect(sources, ct);
                        lock (state.Tree.SyncRoot)
                            foreach (var leaf in state.Tree.Root.Leaves())
                                if (traitsByFqn.TryGetValue(leaf.FullName, out var traits))
                                    leaf.Traits = traits;
                    }
                    catch { /* ensamblados no-xUnit: sin decoradores */ }

                    observer.OnPhase(RunPhase.Completed);
                    observer.OnRunComplete();
                    return;
                }
            }

            // Ejecución con resultados en vivo. CancelTestRun aborta de verdad la ejecución.
            observer.OnPhase(RunPhase.Running, "Running tests…");
            state.StartedUtc = DateTime.UtcNow;
            var runHandler = new RunHandler(state, observer);
            using (ct.Register(() => { try { wrapper.CancelTestRun(); } catch { } }))
                await Task.Run(() => wrapper.RunTests(sources, RunSettings, tpOptions, runHandler))
                    .ConfigureAwait(false);

            observer.OnPhase(RunPhase.Completed);
            observer.OnRunComplete();
        }
        catch (OperationCanceledException)
        {
            observer.OnPhase(RunPhase.Failed, "Run cancelled.");
        }
        catch (Exception ex)
        {
            observer.OnPhase(RunPhase.Failed, ex.Message);
        }
        finally
        {
            try { wrapper.EndSession(); } catch { /* best effort */ }
        }
    }

    /// <summary>Rellena repo / rama / proyecto para la cabecera del TUI.</summary>
    private static async Task PopulateContextAsync(
        string entry, RunOptions options, RunState state, CancellationToken ct)
    {
        state.ProjectName = Path.GetFileName(entry);
        var dir = File.Exists(entry) ? Path.GetDirectoryName(entry)! : entry;

        // En modo --branch el worktree está "detached": usamos la rama solicitada.
        if (options.BranchOverride is { } b)
        {
            state.Branch = b;
        }
        else
        {
            try { state.Branch = await WorktreeManager.TryGetBranchAsync(dir, ct).ConfigureAwait(false); }
            catch { /* sin git */ }
        }

        if (options.RepoNameOverride is { } r)
        {
            state.RepoName = r;
        }
        else
        {
            try { state.RepoName = await WorktreeManager.TryGetRepoNameAsync(dir, ct).ConfigureAwait(false); }
            catch { /* sin git */ }
            // Si no es repo git, al menos el nombre de la carpeta contenedora.
            state.RepoName ??= new DirectoryInfo(dir).Name;
        }
    }
}

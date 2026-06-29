using DotnetTest.Core.Infra;

namespace DotnetTest.Core.Git;

/// <summary>Un git worktree temporal que se elimina al liberarse.</summary>
public sealed class Worktree : IAsyncDisposable
{
    public string Path { get; }
    public string RepoRoot { get; }
    public string Reference { get; }

    internal Worktree(string path, string repoRoot, string reference)
    {
        Path = path;
        RepoRoot = repoRoot;
        Reference = reference;
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            await ProcessRunner.RunAsync("git",
                new[] { "-C", RepoRoot, "worktree", "remove", "--force", Path }).ConfigureAwait(false);
        }
        catch { /* best effort */ }

        try
        {
            if (Directory.Exists(Path)) Directory.Delete(Path, recursive: true);
        }
        catch { /* best effort */ }

        // Garantiza que no queda registro administrativo del worktree (entradas "prunable").
        try
        {
            await ProcessRunner.RunAsync("git",
                new[] { "-C", RepoRoot, "worktree", "prune" }).ConfigureAwait(false);
        }
        catch { /* best effort */ }
    }
}

public static class WorktreeManager
{
    public static async Task<bool> IsGitRepoAsync(string dir, CancellationToken ct)
    {
        var res = await ProcessRunner.RunAsync("git",
            new[] { "-C", dir, "rev-parse", "--is-inside-work-tree" }, ct: ct).ConfigureAwait(false);
        return res.Success && res.StdOut.Trim().Equals("true", StringComparison.OrdinalIgnoreCase);
    }

    public static async Task<string> GetRepoRootAsync(string dir, CancellationToken ct)
    {
        var res = await ProcessRunner.RunAsync("git",
            new[] { "-C", dir, "rev-parse", "--show-toplevel" }, ct: ct).ConfigureAwait(false);
        if (!res.Success)
            throw new InvalidOperationException($"'{dir}' no es un repositorio git.");
        return res.StdOut.Trim();
    }

    /// <summary>Nombre de la rama actual en <paramref name="dir"/>, o null si no es git / detached.</summary>
    public static async Task<string?> TryGetBranchAsync(string dir, CancellationToken ct)
    {
        try
        {
            var res = await ProcessRunner.RunAsync("git",
                new[] { "-C", dir, "rev-parse", "--abbrev-ref", "HEAD" }, ct: ct).ConfigureAwait(false);
            if (!res.Success) return null;
            var branch = res.StdOut.Trim();
            return string.IsNullOrEmpty(branch) || branch == "HEAD" ? null : branch;
        }
        catch { return null; }
    }

    /// <summary>Lista las ramas locales del repo en <paramref name="dir"/> (vacío si no es git).</summary>
    public static async Task<IReadOnlyList<string>> ListBranchesAsync(string dir, CancellationToken ct)
    {
        try
        {
            var res = await ProcessRunner.RunAsync("git",
                new[] { "-C", dir, "branch", "--format=%(refname:short)" }, ct: ct).ConfigureAwait(false);
            if (!res.Success) return Array.Empty<string>();
            return res.StdOut
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();
        }
        catch { return Array.Empty<string>(); }
    }

    /// <summary>Nombre de la carpeta raíz del repo en <paramref name="dir"/>, o null si no es git.</summary>
    public static async Task<string?> TryGetRepoNameAsync(string dir, CancellationToken ct)
    {
        try
        {
            var root = await GetRepoRootAsync(dir, ct).ConfigureAwait(false);
            return System.IO.Path.GetFileName(root.TrimEnd('/', '\\'));
        }
        catch { return null; }
    }

    /// <summary>Verifica que la ref (rama/tag/commit) existe.</summary>
    public static async Task<bool> RefExistsAsync(string repoRoot, string reference, CancellationToken ct)
    {
        var res = await ProcessRunner.RunAsync("git",
            new[] { "-C", repoRoot, "rev-parse", "--verify", "--quiet", $"{reference}^{{commit}}" },
            ct: ct).ConfigureAwait(false);
        return res.Success;
    }

    /// <summary>
    /// Crea un worktree temporal (detached) apuntando a <paramref name="reference"/>.
    /// No toca el working tree ni el HEAD actual del repositorio.
    /// </summary>
    public static async Task<Worktree> CreateAsync(string repoRoot, string reference, CancellationToken ct)
    {
        var safe = Sanitize(reference);
        if (safe.Length > 40) safe = safe[..40];
        var dir = System.IO.Path.Combine(
            System.IO.Path.GetTempPath(),
            "dotnettest-wt",
            $"{safe}-{Guid.NewGuid():N}"[..Math.Min(64, safe.Length + 9)]);
        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(dir)!);

        var res = await ProcessRunner.RunAsync("git",
            new[] { "-C", repoRoot, "worktree", "add", "--detach", dir, reference },
            ct: ct).ConfigureAwait(false);

        if (!res.Success)
            throw new InvalidOperationException(
                $"No se pudo crear el worktree para '{reference}': {res.StdErr.Trim()}");

        return new Worktree(dir, repoRoot, reference);
    }

    /// <summary>
    /// Traduce una ruta del usuario a su equivalente dentro del worktree, para acotar el build
    /// a ese proyecto/carpeta en lugar de a toda la solución.
    /// </summary>
    public static string MapPathInto(string? userPath, string repoRoot, string worktreePath)
    {
        if (userPath is null) return worktreePath;

        var full = System.IO.Path.GetFullPath(userPath);
        var repoFull = System.IO.Path.GetFullPath(repoRoot);
        var rel = full.StartsWith(repoFull, StringComparison.OrdinalIgnoreCase)
            ? System.IO.Path.GetRelativePath(repoFull, full)
            : userPath;

        var mapped = System.IO.Path.GetFullPath(System.IO.Path.Combine(worktreePath, rel));
        return File.Exists(mapped) || Directory.Exists(mapped) ? mapped : worktreePath;
    }

    private static string Sanitize(string reference)
    {
        var chars = reference.Select(c => char.IsLetterOrDigit(c) || c is '-' or '_' or '.' ? c : '-').ToArray();
        return new string(chars);
    }
}

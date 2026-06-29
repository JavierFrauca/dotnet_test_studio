using DotnetTest.Core.Infra;

namespace DotnetTest.Core.Git;

public sealed record ChangedFile(string Path, string Status);
public sealed record BlameInfo(string Commit, string Author, string Date, string Summary, bool OnBranch);

/// <summary>Operaciones de git para mostrar cambios respecto a una base (master/main) y blame.</summary>
public static class DiffService
{
    private const string ZeroSha = "0000000000000000000000000000000000000000";

    private static Task<ProcessResult> Git(string repoRoot, IEnumerable<string> args, CancellationToken ct)
        => ProcessRunner.RunAsync("git", new[] { "-C", repoRoot }.Concat(args), ct: ct);

    /// <summary>Detecta la rama base (preferida, origin/HEAD, main, master). Null si no hay.</summary>
    public static async Task<string?> ResolveBaseAsync(string repoRoot, string? preferred, CancellationToken ct)
    {
        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(preferred)) candidates.Add(preferred!.Trim());

        var head = await Git(repoRoot, new[] { "symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD" }, ct)
            .ConfigureAwait(false);
        if (head.Success && head.StdOut.Trim().Length > 0) candidates.Add(head.StdOut.Trim());

        candidates.AddRange(new[] { "origin/main", "origin/master", "main", "master" });

        foreach (var c in candidates.Distinct(StringComparer.Ordinal))
            if (await RefExistsAsync(repoRoot, c, ct).ConfigureAwait(false))
                return c;
        return null;
    }

    public static async Task<bool> RefExistsAsync(string repoRoot, string reference, CancellationToken ct)
    {
        var res = await Git(repoRoot, new[] { "rev-parse", "--verify", "--quiet", $"{reference}^{{commit}}" }, ct)
            .ConfigureAwait(false);
        return res.Success;
    }

    /// <summary>Ficheros cambiados respecto a la base (desde el merge-base, incluye sin commitear).</summary>
    public static async Task<IReadOnlyList<ChangedFile>> ChangedFilesAsync(string repoRoot, string baseRef, CancellationToken ct)
    {
        var res = await Git(repoRoot, new[] { "diff", "--merge-base", baseRef, "--name-status" }, ct).ConfigureAwait(false);
        if (!res.Success) return Array.Empty<ChangedFile>();

        var list = new List<ChangedFile>();
        foreach (var line in res.StdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var parts = line.Split('\t', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length < 2) continue;
            var status = parts[0].Trim();
            var path = parts[^1].Trim();          // en renames (R100) el último es el destino
            list.Add(new ChangedFile(path, status));
        }
        return list;
    }

    public static async Task<string> FileDiffAsync(string repoRoot, string baseRef, string relPath, CancellationToken ct)
    {
        var res = await Git(repoRoot, new[] { "diff", "--merge-base", baseRef, "--", relPath }, ct).ConfigureAwait(false);
        return res.StdOut;
    }

    /// <summary>Blame de una línea concreta, con si el commit se introdujo en esta rama.</summary>
    public static async Task<BlameInfo?> BlameLineAsync(string repoRoot, string relPath, int line, string baseRef, CancellationToken ct)
    {
        var res = await Git(repoRoot,
            new[] { "blame", "-L", $"{line},{line}", "--porcelain", "--", relPath }, ct).ConfigureAwait(false);
        if (!res.Success) return null;

        var lines = res.StdOut.Split('\n');
        if (lines.Length == 0) return null;

        var sha = lines[0].Split(' ', 2)[0].Trim();
        string author = "", summary = "", date = "";
        foreach (var l in lines)
        {
            if (l.StartsWith("author ", StringComparison.Ordinal)) author = l[7..].Trim();
            else if (l.StartsWith("summary ", StringComparison.Ordinal)) summary = l[8..].Trim();
            else if (l.StartsWith("author-time ", StringComparison.Ordinal) && long.TryParse(l[12..].Trim(), out var t))
                date = DateTimeOffset.FromUnixTimeSeconds(t).ToString("yyyy-MM-dd");
        }

        var uncommitted = sha.TrimStart('^') == ZeroSha || string.Equals(author, "Not Committed Yet", StringComparison.OrdinalIgnoreCase);
        var onBranch = uncommitted || await IsOnBranchAsync(repoRoot, sha.TrimStart('^'), baseRef, ct).ConfigureAwait(false);

        return new BlameInfo(
            uncommitted ? "(uncommitted)" : sha.TrimStart('^')[..Math.Min(7, sha.TrimStart('^').Length)],
            uncommitted ? "you (working tree)" : author,
            date,
            uncommitted ? "" : summary,
            onBranch);
    }

    /// <summary>true si el commit NO está en la base (= introducido en esta rama).</summary>
    private static async Task<bool> IsOnBranchAsync(string repoRoot, string commit, string baseRef, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(commit) || commit == ZeroSha) return true;
        var res = await Git(repoRoot, new[] { "merge-base", "--is-ancestor", commit, baseRef }, ct).ConfigureAwait(false);
        return !res.Success; // éxito (0) = es ancestro de la base = está en la base = NO es de la rama
    }
}

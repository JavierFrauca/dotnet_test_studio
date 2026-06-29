namespace DotnetTest.Engine;

public sealed record RunArgs(
    string? Path,
    string? Filter,
    string? Branch,
    string? Configuration,
    bool NoBuild,
    string? Preset,
    string[]? Projects,
    Dictionary<string, string[]>? Traits,
    bool NoDiscover,
    bool UseWorktree);

public sealed record WorktreeStatusDto(
    bool Exists, string? Branch, string? Head, bool Outdated, string? Path, string? Error);

public sealed record ProjectInfoDto(string Name, string Path);

public sealed record TraitDto(string Name, string Value);

public sealed record DiscoverResultDto(
    Dictionary<string, string[]> Facets,
    int Total,
    Dictionary<string, TraitDto[]> Traits);

public sealed record PhaseDto(string Phase, string? Message);

public sealed record TestEventDto(
    string Kind,        // discovered | started | completed
    string Project,
    string ClassName,
    string Name,
    string Fqn,
    string Status,      // notrun | running | passed | failed | skipped
    double DurationMs,
    string? Error,
    string? Stack);

public sealed record RunSummaryDto(
    int Total, int Passed, int Failed, int Skipped, double ElapsedMs,
    string? Repo, string? Branch, string? Project, string? Config);

public sealed record SolutionInfoDto(
    string Path, string? Repo, string? Branch, string? Project, string[] Branches);

public sealed record PresetDto(string Name, string Expression, string? Description);

// ── Contexto git ────────────────────────────────────────────────────────────
public sealed record GitChangedFileDto(string Path, string Status);

public sealed record GitBlameDto(string Commit, string Author, string Date, string Summary, bool OnBranch);

public sealed record GitFrameDto(
    string File, string? RelPath, int Line, bool Changed, GitBlameDto? Blame, string? Diff);

public sealed record GitContextDto(bool IsRepo, string? Base, GitFrameDto[] Frames);

public sealed record BranchChangesDto(bool IsRepo, string? Base, GitChangedFileDto[] Files);

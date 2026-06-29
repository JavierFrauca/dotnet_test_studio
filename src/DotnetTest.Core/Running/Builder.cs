using DotnetTest.Core.Infra;
using DotnetTest.Core.Model;

namespace DotnetTest.Core.Running;

public static class Builder
{
    /// <summary>Compila la solución/proyecto. Devuelve true si tuvo éxito.</summary>
    public static async Task<bool> BuildAsync(
        string entryPath, string configuration, IRunObserver observer, CancellationToken ct)
    {
        observer.OnPhase(RunPhase.Building, $"Building ({configuration})…");

        var res = await ProcessRunner.RunAsync(
            "dotnet",
            new[] { "build", entryPath, "-c", configuration, "--nologo", "-v", "quiet" },
            workingDirectory: Path.GetDirectoryName(entryPath),
            onStdOut: line =>
            {
                var trimmed = line.Trim();
                if (trimmed.Length > 0) observer.OnBuildOutput(trimmed);
            },
            ct: ct).ConfigureAwait(false);

        if (!res.Success)
        {
            observer.OnPhase(RunPhase.Failed, "Build failed.");
            observer.OnLog(res.StdErr.Trim());
        }
        return res.Success;
    }
}

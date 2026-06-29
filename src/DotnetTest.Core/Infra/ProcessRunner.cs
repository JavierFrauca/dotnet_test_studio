using System.Diagnostics;
using System.Text;

namespace DotnetTest.Core.Infra;

public sealed record ProcessResult(int ExitCode, string StdOut, string StdErr)
{
    public bool Success => ExitCode == 0;
}

public static class ProcessRunner
{
    /// <summary>Ejecuta un proceso esperando a su fin; captura stdout/stderr y opcionalmente
    /// invoca <paramref name="onStdOut"/> por cada línea en streaming.</summary>
    public static async Task<ProcessResult> RunAsync(
        string fileName,
        IEnumerable<string> args,
        string? workingDirectory = null,
        Action<string>? onStdOut = null,
        IDictionary<string, string>? env = null,
        CancellationToken ct = default)
    {
        var utf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            WorkingDirectory = workingDirectory ?? Environment.CurrentDirectory,
            // dotnet/git emiten UTF-8 al redirigir; sin esto se leería con el codepage OEM
            // y se vería "Compilaci├│n" en lugar de "Compilación".
            StandardOutputEncoding = utf8,
            StandardErrorEncoding = utf8,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        if (env is not null)
            foreach (var kv in env) psi.Environment[kv.Key] = kv.Value;

        using var process = new Process { StartInfo = psi, EnableRaisingEvents = true };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data is null) return;
            stdout.AppendLine(e.Data);
            onStdOut?.Invoke(e.Data);
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data is not null) stderr.AppendLine(e.Data);
        };

        if (!process.Start())
            throw new InvalidOperationException($"Could not start process '{fileName}'.");

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await using (ct.Register(() => { try { if (!process.HasExited) process.Kill(true); } catch { } }))
        {
            await process.WaitForExitAsync(ct).ConfigureAwait(false);
        }

        return new ProcessResult(process.ExitCode, stdout.ToString(), stderr.ToString());
    }
}

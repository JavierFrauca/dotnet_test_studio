using System.Text.RegularExpressions;

namespace DotnetTest.Core.Running;

public sealed record StackFrameRef(string File, int Line);

/// <summary>Extrae ficheros y líneas de un stack trace de .NET ("at X() in &lt;ruta&gt;:line N").</summary>
public static partial class StackTraceParser
{
    // Soporta "in"/"en" (localización) y "line"/"línea". Captura ruta (con o sin letra de unidad).
    [GeneratedRegex(@"(?:\bin\b|\ben\b)\s+(.+?):(?:line|l[ií]nea)\s+(\d+)", RegexOptions.IgnoreCase)]
    private static partial Regex FrameRegex();

    public static IReadOnlyList<StackFrameRef> Parse(string? stackTrace)
    {
        if (string.IsNullOrEmpty(stackTrace)) return Array.Empty<StackFrameRef>();

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var result = new List<StackFrameRef>();
        foreach (Match m in FrameRegex().Matches(stackTrace))
        {
            var file = m.Groups[1].Value.Trim();
            if (file.Length == 0 || !int.TryParse(m.Groups[2].Value, out var line)) continue;
            if (seen.Add(file + ":" + line))
                result.Add(new StackFrameRef(file, line));
        }
        return result;
    }
}

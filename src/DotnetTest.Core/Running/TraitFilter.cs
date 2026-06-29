namespace DotnetTest.Core.Running;

/// <summary>
/// Construye expresiones de TestCaseFilter de VSTest a partir de facetas de traits.
/// Dentro de un mismo trait, los valores se combinan con OR; entre traits, con AND.
/// </summary>
public static class TraitFilter
{
    public static string? Build(IReadOnlyDictionary<string, IReadOnlyList<string>>? facets)
    {
        if (facets is null) return null;

        var groups = new List<string>();
        foreach (var (name, values) in facets)
        {
            var vals = values.Where(v => !string.IsNullOrEmpty(v)).ToList();
            if (vals.Count == 0) continue;

            var ors = string.Join("|", vals.Select(v => $"{Escape(name)}={Escape(v)}"));
            groups.Add(vals.Count > 1 ? $"({ors})" : ors);
        }

        return groups.Count == 0 ? null : string.Join("&", groups);
    }

    /// <summary>Combina dos expresiones de filtro con AND (cualquiera puede ser null/vacía).</summary>
    public static string? Combine(string? a, string? b)
    {
        if (string.IsNullOrEmpty(a)) return b;
        if (string.IsNullOrEmpty(b)) return a;
        return $"({a})&({b})";
    }

    // Escapa los caracteres con significado en la gramática de TestCaseFilter.
    private static string Escape(string s)
    {
        var sb = new System.Text.StringBuilder(s.Length);
        foreach (var c in s)
        {
            if (c is '(' or ')' or '&' or '|' or '=' or '!' or '~' or '\\') sb.Append('\\');
            sb.Append(c);
        }
        return sb.ToString();
    }
}

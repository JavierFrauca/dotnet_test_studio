namespace DotnetTest.Core.Filters;

/// <summary>Un prefiltro con nombre: una expresión de TestCaseFilter reutilizable.</summary>
public sealed class FilterPreset
{
    public string Name { get; set; } = "";
    public string Expression { get; set; } = "";
    public string? Description { get; set; }
}

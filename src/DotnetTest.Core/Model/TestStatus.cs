namespace DotnetTest.Core.Model;

/// <summary>Estado de un test individual o agregado de un grupo.</summary>
public enum TestStatus
{
    NotRun,
    Running,
    Passed,
    Failed,
    Skipped,
}

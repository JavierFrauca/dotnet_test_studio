namespace DotnetTest.Core.Model;

public enum NodeKind { Root, Project, Class, Test }

/// <summary>
/// Nodo del árbol de resultados: Root → Project → Class → Test.
/// Los grupos (Root/Project/Class) calculan su estado y contadores agregando los hijos.
/// </summary>
public sealed class TestNode
{
    public NodeKind Kind { get; }
    public string Name { get; }
    public string FullName { get; }
    public TestNode? Parent { get; }
    public List<TestNode> Children { get; } = new();

    // Estado propio (solo relevante para nodos Test).
    public TestStatus OwnStatus { get; set; } = TestStatus.NotRun;
    public TimeSpan Duration { get; set; }
    public string? ErrorMessage { get; set; }
    public string? StackTrace { get; set; }
    public string? StandardOutput { get; set; }

    /// <summary>Traits del test (Category, Feature, …), capturados en el descubrimiento.</summary>
    public IReadOnlyList<KeyValuePair<string, string>>? Traits { get; set; }

    // Estado de UI.
    public bool Expanded { get; set; } = true;

    public TestNode(NodeKind kind, string name, string fullName, TestNode? parent)
    {
        Kind = kind;
        Name = name;
        FullName = fullName;
        Parent = parent;
    }

    public bool IsLeaf => Kind == NodeKind.Test;

    /// <summary>Estado agregado: el de un test, o el "peor" de sus descendientes.</summary>
    public TestStatus Status
    {
        get
        {
            if (IsLeaf) return OwnStatus;
            var any = false;
            var allPassed = true;
            var anyRunning = false;
            var anyNotRun = false;
            foreach (var c in Children)
            {
                any = true;
                switch (c.Status)
                {
                    case TestStatus.Failed: return TestStatus.Failed; // el fallo gana
                    case TestStatus.Running: anyRunning = true; break;
                    case TestStatus.NotRun: anyNotRun = true; allPassed = false; break;
                    case TestStatus.Skipped: allPassed = false; break;
                    case TestStatus.Passed: break;
                }
            }
            if (!any) return TestStatus.NotRun;
            if (anyRunning) return TestStatus.Running;
            if (anyNotRun) return TestStatus.NotRun;
            return allPassed ? TestStatus.Passed : TestStatus.Skipped;
        }
    }

    public int CountLeaves(Func<TestNode, bool> predicate)
    {
        if (IsLeaf) return predicate(this) ? 1 : 0;
        var total = 0;
        foreach (var c in Children) total += c.CountLeaves(predicate);
        return total;
    }

    public IEnumerable<TestNode> Leaves()
    {
        if (IsLeaf) { yield return this; yield break; }
        foreach (var c in Children)
            foreach (var l in c.Leaves())
                yield return l;
    }
}

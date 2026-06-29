namespace DotnetTest.Core.Model;

/// <summary>
/// Construye y mantiene el árbol de resultados conforme van llegando los tests
/// (descubrimiento y ejecución en vivo). Thread-safe para actualizaciones puntuales.
/// </summary>
public sealed class TestTree
{
    private readonly object _lock = new();
    public TestNode Root { get; } = new(NodeKind.Root, "Tests", "", null);

    /// <summary>Índice por Id único del TestCase (distingue casos de [Theory]).</summary>
    private readonly Dictionary<string, TestNode> _byId = new(StringComparer.Ordinal);

    public object SyncRoot => _lock;

    /// <summary>
    /// Asegura que existe el nodo Test identificado por <paramref name="id"/>, bajo su
    /// proyecto/clase (creándolos si hace falta). Devuelve el nodo Test.
    /// </summary>
    public TestNode EnsureTest(string id, string fullyQualifiedName, string displayName, string source)
    {
        lock (_lock)
        {
            if (_byId.TryGetValue(id, out var existing))
                return existing;

            var projectName = string.IsNullOrEmpty(source)
                ? "(desconocido)"
                : Path.GetFileNameWithoutExtension(source);
            var projectNode = FindOrAddChild(Root, NodeKind.Project, projectName, projectName);

            var className = ExtractClassName(fullyQualifiedName);
            var classFull = projectName + "::" + className;
            var classNode = FindOrAddChild(projectNode, NodeKind.Class, className, classFull);

            var leafName = string.IsNullOrEmpty(displayName)
                ? ExtractMethodName(fullyQualifiedName)
                : LeafLabel(className, displayName, fullyQualifiedName);
            var testNode = new TestNode(NodeKind.Test, leafName, fullyQualifiedName, classNode);
            classNode.Children.Add(testNode);
            _byId[id] = testNode;
            return testNode;
        }
    }

    /// <summary>Etiqueta corta del test: quita el prefijo de clase del DisplayName si lo lleva.</summary>
    private static string LeafLabel(string className, string displayName, string fqn)
    {
        var prefix = className + ".";
        if (displayName.StartsWith(prefix, StringComparison.Ordinal))
            return displayName[prefix.Length..];
        return displayName;
    }

    private static TestNode FindOrAddChild(TestNode parent, NodeKind kind, string name, string fullName)
    {
        foreach (var c in parent.Children)
            if (c.Kind == kind && c.FullName == fullName)
                return c;
        var node = new TestNode(kind, name, fullName, parent);
        parent.Children.Add(node);
        return node;
    }

    /// <summary>Clase = todo lo previo al último segmento del FQN (sin paréntesis de datos).</summary>
    internal static string ExtractClassName(string fqn)
    {
        var name = StripDataArgs(fqn);
        var lastDot = name.LastIndexOf('.');
        return lastDot <= 0 ? name : name[..lastDot];
    }

    internal static string ExtractMethodName(string fqn)
    {
        var name = StripDataArgs(fqn);
        var lastDot = name.LastIndexOf('.');
        return lastDot < 0 ? name : name[(lastDot + 1)..];
    }

    private static string StripDataArgs(string fqn)
    {
        var paren = fqn.IndexOf('(');
        return paren < 0 ? fqn : fqn[..paren];
    }
}

using Xunit.Sdk;

namespace Other.Tests.Traits;

/// <summary>
/// Atributo de trait personalizado al estilo xUnit v2: marca ITraitAttribute y delega en un
/// ITraitDiscoverer vía [TraitDiscoverer]. Patrón genérico (no atado a ningún repo) para validar
/// que el probe reconoce decoradores custom, no solo [Trait("...","...")] nativo.
/// </summary>
[TraitDiscoverer("Other.Tests.Traits.FeatureDiscoverer", "Other.Tests")]
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class FeatureAttribute : Attribute, ITraitAttribute
{
    public FeatureAttribute(params string[] features) => Features = features;
    public string[] Features { get; }
}

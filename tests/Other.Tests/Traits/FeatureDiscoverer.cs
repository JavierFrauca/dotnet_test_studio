using Xunit.Abstractions;
using Xunit.Sdk;

namespace Other.Tests.Traits;

/// <summary>Discoverer xUnit v2: emite el trait "Feature" por cada string del params string[].</summary>
public sealed class FeatureDiscoverer : ITraitDiscoverer
{
    private const string Key = "Feature";

    public IEnumerable<KeyValuePair<string, string>> GetTraits(IAttributeInfo traitAttribute)
    {
        foreach (var argument in traitAttribute.GetConstructorArguments())
        {
            // El parámetro params string[] llega como un único argumento de tipo array.
            if (argument is IEnumerable<object> values)
            {
                foreach (var value in values)
                    if (value is not null)
                        yield return new KeyValuePair<string, string>(Key, value.ToString()!);
            }
            else if (argument is string single)
            {
                yield return new KeyValuePair<string, string>(Key, single);
            }
        }
    }
}

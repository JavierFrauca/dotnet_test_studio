using Other.Tests.Traits;

namespace Other.Tests;

// Decorador CUSTOM (ITraitAttribute + [TraitDiscoverer]) con valor distintivo "Loans".
// Si el probe lo reconoce, la faceta "Feature" debe incluir "Loans".
[Trait("Category", "Unit")]
[Feature("Loans")]
public class LoansFeatureTests
{
    [Fact]
    public void Calculates_Loan()
    {
        Assert.Equal(3, 1 + 2);
    }

    [Fact]
    public void Validates_Loan()
    {
        Assert.True(true);
    }
}

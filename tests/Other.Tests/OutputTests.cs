using Xunit.Abstractions;

namespace Other.Tests;

[Trait("Category", "Unit")]
public class OutputTests
{
    private readonly ITestOutputHelper _out;

    public OutputTests(ITestOutputHelper output) => _out = output;

    [Fact]
    public void Writes_Output()
    {
        _out.WriteLine("hello from the test output");
        Assert.True(true);
    }
}

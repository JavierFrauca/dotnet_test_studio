namespace Sample.Tests;

[Trait("Category", "Unit")]
[Trait("Feature", "Calculator")]
public class CalculatorTests
{
    [Fact]
    public void Add_TwoNumbers_ReturnsSum()
    {
        Assert.Equal(4, 2 + 2);
    }

    [Fact]
    public void Subtract_Numbers_ReturnsDifference()
    {
        Assert.Equal(1, 3 - 2);
    }

    [Theory]
    [InlineData(2, 3, 5)]
    [InlineData(10, 5, 15)]
    [InlineData(0, 0, 0)]
    public void Add_DataDriven_Works(int a, int b, int expected)
    {
        Assert.Equal(expected, a + b);
    }

    [Fact]
    public void Divide_ByZero_Throws()
    {
        Assert.Throws<DivideByZeroException>(() => Compute(1, 0));
    }

    private static int Compute(int a, int b) => a / b;
}

[Trait("Category", "Unit")]
[Trait("Feature", "Calculator")]
public class FailingTests
{
    [Fact]
    public void Expected_Five_But_Got_Four()
    {
        var result = 2 + 2;
        Assert.Equal(5, result); // falla a propósito
    }

    [Fact]
    public async Task Async_Operation_Throws()
    {
        await Task.Delay(10);
        throw new InvalidOperationException("algo salió mal en la operación async");
    }
}

[Trait("Category", "Integration")]
[Trait("Feature", "Misc")]
public class SkippedTests
{
    [Fact(Skip = "pendiente de implementar la feature")]
    public void Not_Yet_Implemented()
    {
        Assert.True(false);
    }

    [Fact]
    public void Slow_Test_StillPasses()
    {
        Thread.Sleep(150);
        Assert.True(true);
    }
}

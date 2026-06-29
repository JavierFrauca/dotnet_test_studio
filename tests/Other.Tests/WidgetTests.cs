namespace Other.Tests;

[Trait("Category", "Unit")]
[Trait("Feature", "Widgets")]
public class WidgetTests
{
    [Fact]
    public void Render_ReturnsNonEmpty()
    {
        Assert.False(string.IsNullOrEmpty("widget"));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public void Scale_IsPositive(int factor)
    {
        Assert.True(factor > 0);
    }

    [Fact]
    public void Compose_AddsUp()
    {
        Assert.Equal(2, 1 + 1);
    }
}

[Trait("Category", "Integration")]
[Trait("Feature", "Reports")]
public class ReportIntegrationTests
{
    [Fact]
    public void Generate_Report_Works()
    {
        Assert.True(true);
    }

    [Fact]
    public void Export_Pdf_Works()
    {
        Assert.True(true);
    }
}

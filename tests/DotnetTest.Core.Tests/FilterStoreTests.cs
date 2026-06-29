using DotnetTest.Core.Filters;

namespace DotnetTest.Core.Tests;

public class FilterStoreTests : IDisposable
{
    private readonly string _path;

    public FilterStoreTests()
    {
        _path = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"dt-filters-{Guid.NewGuid():N}.json");
    }

    public void Dispose()
    {
        if (File.Exists(_path)) File.Delete(_path);
    }

    [Fact]
    public void Load_FirstTime_SeedsExamples()
    {
        var store = new FilterStore(_path);
        var presets = store.Load();
        Assert.Contains(presets, p => p.Name == "Solo unitarios");
        Assert.True(File.Exists(_path));
    }

    [Fact]
    public void Save_Then_Get_RoundTrips()
    {
        var store = new FilterStore(_path);
        store.Save(new FilterPreset { Name = "API", Expression = "FullyQualifiedName~Api" });

        var fresh = new FilterStore(_path);
        var got = fresh.Get("api"); // case-insensitive
        Assert.NotNull(got);
        Assert.Equal("FullyQualifiedName~Api", got!.Expression);
    }

    [Fact]
    public void Save_SameName_Overwrites()
    {
        var store = new FilterStore(_path);
        store.Save(new FilterPreset { Name = "X", Expression = "a" });
        store.Save(new FilterPreset { Name = "X", Expression = "b" });
        Assert.Equal("b", store.Get("X")!.Expression);
        Assert.Single(store.Load().Where(p => p.Name == "X"));
    }

    [Fact]
    public void Delete_RemovesPreset()
    {
        var store = new FilterStore(_path);
        store.Save(new FilterPreset { Name = "Temp", Expression = "z" });
        Assert.True(store.Delete("temp"));
        Assert.Null(store.Get("Temp"));
        Assert.False(store.Delete("noexiste"));
    }
}

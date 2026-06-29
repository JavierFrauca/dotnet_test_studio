using DotnetTest.Core.Model;

namespace DotnetTest.Core.Tests;

public class TreeModelTests
{
    private const string Source = @"C:\repo\bin\MyApp.UnitTests.dll";

    [Fact]
    public void EnsureTest_GroupsByProjectAndClass()
    {
        var tree = new TestTree();
        tree.EnsureTest("id1", "MyApp.Tests.FooTests.Bar", "Bar", Source);

        var project = Assert.Single(tree.Root.Children);
        Assert.Equal("MyApp.UnitTests", project.Name);
        Assert.Equal(NodeKind.Project, project.Kind);

        var cls = Assert.Single(project.Children);
        Assert.Equal("MyApp.Tests.FooTests", cls.Name);

        var test = Assert.Single(cls.Children);
        Assert.Equal("Bar", test.Name);
        Assert.Equal(NodeKind.Test, test.Kind);
    }

    [Fact]
    public void EnsureTest_TheoryCases_AreDistinctById_ButShareClass()
    {
        var tree = new TestTree();
        tree.EnsureTest("id1", "N.C.Theory", "N.C.Theory(x: 1)", Source);
        tree.EnsureTest("id2", "N.C.Theory", "N.C.Theory(x: 2)", Source);

        var cls = tree.Root.Children[0].Children[0];
        Assert.Equal(2, cls.Children.Count);
        Assert.Equal("Theory(x: 1)", cls.Children[0].Name);
        Assert.Equal("Theory(x: 2)", cls.Children[1].Name);
    }

    [Fact]
    public void EnsureTest_SameId_ReturnsSameNode()
    {
        var tree = new TestTree();
        var a = tree.EnsureTest("id1", "N.C.M", "M", Source);
        var b = tree.EnsureTest("id1", "N.C.M", "M", Source);
        Assert.Same(a, b);
    }

    [Fact]
    public void Status_Group_FailWins()
    {
        var tree = new TestTree();
        var t1 = tree.EnsureTest("1", "N.C.A", "A", Source);
        var t2 = tree.EnsureTest("2", "N.C.B", "B", Source);
        t1.OwnStatus = TestStatus.Passed;
        t2.OwnStatus = TestStatus.Failed;

        var cls = tree.Root.Children[0].Children[0];
        Assert.Equal(TestStatus.Failed, cls.Status);
        Assert.Equal(TestStatus.Failed, tree.Root.Status);
    }

    [Fact]
    public void Status_Group_RunningWhenSomeRunning()
    {
        var tree = new TestTree();
        var t1 = tree.EnsureTest("1", "N.C.A", "A", Source);
        var t2 = tree.EnsureTest("2", "N.C.B", "B", Source);
        t1.OwnStatus = TestStatus.Passed;
        t2.OwnStatus = TestStatus.Running;
        Assert.Equal(TestStatus.Running, tree.Root.Status);
    }

    [Fact]
    public void Status_Group_AllPassed()
    {
        var tree = new TestTree();
        tree.EnsureTest("1", "N.C.A", "A", Source).OwnStatus = TestStatus.Passed;
        tree.EnsureTest("2", "N.C.B", "B", Source).OwnStatus = TestStatus.Passed;
        Assert.Equal(TestStatus.Passed, tree.Root.Status);
    }

    [Fact]
    public void CountLeaves_CountsByPredicate()
    {
        var tree = new TestTree();
        tree.EnsureTest("1", "N.C.A", "A", Source).OwnStatus = TestStatus.Passed;
        tree.EnsureTest("2", "N.C.B", "B", Source).OwnStatus = TestStatus.Failed;
        tree.EnsureTest("3", "N.C.D", "D", Source).OwnStatus = TestStatus.Passed;

        Assert.Equal(3, tree.Root.CountLeaves(_ => true));
        Assert.Equal(2, tree.Root.CountLeaves(n => n.OwnStatus == TestStatus.Passed));
        Assert.Equal(1, tree.Root.CountLeaves(n => n.OwnStatus == TestStatus.Failed));
    }
}

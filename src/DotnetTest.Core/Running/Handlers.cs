using DotnetTest.Core.Model;
using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Client;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;

namespace DotnetTest.Core.Running;

/// <summary>Recibe los tests descubiertos y los inserta en el árbol (estado NotRun).</summary>
internal sealed class DiscoveryHandler : ITestDiscoveryEventsHandler2
{
    private readonly RunState _state;
    private readonly IRunObserver _observer;
    private readonly TaskCompletionSource _completed = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public Task Completed => _completed.Task;

    public DiscoveryHandler(RunState state, IRunObserver observer)
    {
        _state = state;
        _observer = observer;
    }

    public void HandleDiscoveredTests(IEnumerable<TestCase>? discoveredTestCases)
    {
        if (discoveredTestCases is null) return;
        foreach (var tc in discoveredTestCases)
        {
            var node = _state.Tree.EnsureTest(tc.Id.ToString(), tc.FullyQualifiedName, tc.DisplayName, tc.Source);
            if (node.Traits is null && tc.Traits is not null)
                node.Traits = tc.Traits
                    .Select(t => new KeyValuePair<string, string>(t.Name, t.Value))
                    .ToList();
            _state.TotalDiscovered = _state.Tree.Root.CountLeaves(_ => true);
            _observer.OnTestDiscovered(node);
        }
    }

    public void HandleDiscoveryComplete(DiscoveryCompleteEventArgs args, IEnumerable<TestCase>? lastChunk)
    {
        HandleDiscoveredTests(lastChunk);
        _completed.TrySetResult();
    }

    public void HandleRawMessage(string rawMessage) { }

    public void HandleLogMessage(TestMessageLevel level, string? message)
    {
        if (level >= TestMessageLevel.Warning && !string.IsNullOrWhiteSpace(message))
            _observer.OnLog(message!);
    }
}

/// <summary>Recibe los resultados en vivo durante la ejecución y actualiza el árbol.</summary>
internal sealed class RunHandler : ITestRunEventsHandler
{
    private readonly RunState _state;
    private readonly IRunObserver _observer;
    private readonly TaskCompletionSource _completed = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public Task Completed => _completed.Task;

    public RunHandler(RunState state, IRunObserver observer)
    {
        _state = state;
        _observer = observer;
    }

    public void HandleTestRunStatsChange(TestRunChangedEventArgs? e)
    {
        if (e is null) return;

        if (e.ActiveTests is not null)
        {
            foreach (var tc in e.ActiveTests)
            {
                var node = _state.Tree.EnsureTest(tc.Id.ToString(), tc.FullyQualifiedName, tc.DisplayName, tc.Source);
                if (node.OwnStatus is TestStatus.NotRun)
                {
                    node.OwnStatus = TestStatus.Running;
                    _observer.OnTestStarted(node);
                }
            }
        }

        if (e.NewTestResults is not null)
            foreach (var r in e.NewTestResults)
                Apply(r);
    }

    public void HandleTestRunComplete(
        TestRunCompleteEventArgs args,
        TestRunChangedEventArgs? lastChunk,
        ICollection<AttachmentSet>? attachments,
        ICollection<string>? executorUris)
    {
        if (lastChunk?.NewTestResults is not null)
            foreach (var r in lastChunk.NewTestResults)
                Apply(r);
        _completed.TrySetResult();
    }

    private void Apply(TestResult r)
    {
        var tc = r.TestCase;
        var node = _state.Tree.EnsureTest(tc.Id.ToString(), tc.FullyQualifiedName, tc.DisplayName, tc.Source);
        node.OwnStatus = Map(r.Outcome);
        node.Duration = r.Duration;
        node.ErrorMessage = r.ErrorMessage;
        node.StackTrace = r.ErrorStackTrace;
        node.StandardOutput = ExtractStdout(r);
        _observer.OnTestCompleted(node);
    }

    private static string? ExtractStdout(TestResult r)
    {
        if (r.Messages is null || r.Messages.Count == 0) return null;
        var texts = r.Messages
            .Where(m => !string.IsNullOrEmpty(m.Text))
            .Select(m => m.Text);
        var joined = string.Join(Environment.NewLine, texts);
        return string.IsNullOrWhiteSpace(joined) ? null : joined;
    }

    private static TestStatus Map(TestOutcome outcome) => outcome switch
    {
        TestOutcome.Passed => TestStatus.Passed,
        TestOutcome.Failed => TestStatus.Failed,
        _ => TestStatus.Skipped,
    };

    public void HandleRawMessage(string rawMessage) { }

    public void HandleLogMessage(TestMessageLevel level, string? message)
    {
        if (level >= TestMessageLevel.Warning && !string.IsNullOrWhiteSpace(message))
            _observer.OnLog(message!);
    }

    public int LaunchProcessWithDebuggerAttached(TestProcessStartInfo testProcessStartInfo) => -1;
}

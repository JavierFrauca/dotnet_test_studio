using DotnetTest.Core.Model;
using DotnetTest.Core.Running;
using StreamJsonRpc;

namespace DotnetTest.Engine;

/// <summary>Implementa IRunObserver enviando eventos al cliente (Electron) por JSON-RPC.</summary>
public sealed class JsonRpcObserver : IRunObserver
{
    private readonly JsonRpc _rpc;
    public JsonRpcObserver(JsonRpc rpc) => _rpc = rpc;

    private void Notify(string method, object arg)
    {
        // Fire-and-forget: el orden lo garantiza el canal WebSocket subyacente.
        _ = _rpc.NotifyAsync(method, arg);
    }

    public void OnPhase(RunPhase phase, string? message = null)
        => Notify("phase", new PhaseDto(phase.ToString().ToLowerInvariant(), message));

    public void OnBuildOutput(string line) => Notify("log", new { line });
    public void OnLog(string message) => Notify("log", new { line = message });

    public void OnTestDiscovered(TestNode node) => Notify("test", ToDto("discovered", node));
    public void OnTestStarted(TestNode node) => Notify("test", ToDto("started", node));
    public void OnTestCompleted(TestNode node) => Notify("test", ToDto("completed", node));

    public void OnRunComplete() => Notify("runComplete", new { });

    private static TestEventDto ToDto(string kind, TestNode node) => new(
        Kind: kind,
        Project: node.Parent?.Parent?.Name ?? "",
        ClassName: node.Parent?.Name ?? "",
        Name: node.Name,
        Fqn: node.FullName,
        Status: node.OwnStatus.ToString().ToLowerInvariant(),
        DurationMs: node.Duration.TotalMilliseconds,
        Error: node.ErrorMessage,
        Stack: node.StackTrace,
        Stdout: node.StandardOutput);
}

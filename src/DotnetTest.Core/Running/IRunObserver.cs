using DotnetTest.Core.Model;

namespace DotnetTest.Core.Running;

/// <summary>Notificaciones del runner hacia la capa de presentación (TUI o salida plana).</summary>
public interface IRunObserver
{
    void OnPhase(RunPhase phase, string? message = null);
    void OnBuildOutput(string line);
    void OnTestDiscovered(TestNode node);
    void OnTestStarted(TestNode node);
    void OnTestCompleted(TestNode node);
    void OnLog(string message);
    void OnRunComplete();
}

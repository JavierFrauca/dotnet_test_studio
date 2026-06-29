using System.Text.Json;
using DotnetTest.Engine;
using StreamJsonRpc;

string? GetArg(string name) =>
    args.SkipWhile(a => a != name).Skip(1).FirstOrDefault();

var port = GetArg("--port") ?? Environment.GetEnvironmentVariable("DOTNETTEST_PORT") ?? "0";
var token = GetArg("--token") ?? Environment.GetEnvironmentVariable("DOTNETTEST_TOKEN") ?? "";

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.WebHost.UseUrls($"http://127.0.0.1:{port}");

var app = builder.Build();
app.UseWebSockets();

app.Map("/ws", async context =>
{
    if (!string.IsNullOrEmpty(token) && context.Request.Query["token"] != token)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;
    }
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        return;
    }

    using var ws = await context.WebSockets.AcceptWebSocketAsync();

    var formatter = new SystemTextJsonFormatter
    {
        JsonSerializerOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        },
    };
    var handler = new WebSocketMessageHandler(ws, formatter);

    var api = new EngineApi();
    using var rpc = new JsonRpc(handler);
    rpc.AddLocalRpcTarget(api, new JsonRpcTargetOptions { DisposeOnDisconnect = true });
    api.Attach(rpc);
    rpc.StartListening();

    try { await rpc.Completion; }
    catch { /* desconexión normal */ }
});

// Anuncia el puerto elegido al proceso padre (Electron) por stdout.
app.Lifetime.ApplicationStarted.Register(() =>
{
    var addr = app.Urls.FirstOrDefault() ?? $"http://127.0.0.1:{port}";
    Console.WriteLine($"DOTNETTEST_ENGINE_LISTENING {addr}");
    Console.Out.Flush();
});

app.Run();

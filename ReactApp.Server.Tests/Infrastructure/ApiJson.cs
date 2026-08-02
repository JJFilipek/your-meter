using System.Text.Json;
using System.Text.Json.Serialization;

namespace ReactApp.Server.Tests.Infrastructure;

/// <summary>Deserialization options mirroring what ASP.NET Core's default JSON output uses (camelCase, string enums).</summary>
public static class ApiJson
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new JsonStringEnumConverter() },
    };
}

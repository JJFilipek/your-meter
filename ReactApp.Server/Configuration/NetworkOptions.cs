namespace ReactApp.Server.Configuration;

/// <summary>
/// Physical parameters of the connection used to turn measured current into real
/// resistive energy losses (I²R). These are properties of the installation, not tuning
/// factors, and are configurable per deployment.
/// </summary>
public sealed class NetworkOptions
{
    public const string SectionName = "Network";

    /// <summary>Effective series resistance of the supply conductors, in ohms.</summary>
    public double LineResistanceOhms { get; set; } = 0.35;
}

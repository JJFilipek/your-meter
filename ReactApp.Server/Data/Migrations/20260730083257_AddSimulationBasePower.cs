using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReactApp.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSimulationBasePower : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "SimulationBasePowerKw",
                table: "Meters",
                type: "REAL",
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE "Meters"
                SET "SimulationBasePowerKw" = CASE "Tariff"
                    WHEN 'G11' THEN 2.4
                    WHEN 'G12' THEN 4.8
                    WHEN 'G12W' THEN 3.6
                    WHEN 'C11' THEN 9.5
                    WHEN 'A23' THEN 72.0
                    ELSE 2.4
                END
                WHERE "IsSimulated" = 1
                  AND "SimulationBasePowerKw" IS NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SimulationBasePowerKw",
                table: "Meters");
        }
    }
}

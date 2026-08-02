using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReactApp.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddGenerationRegisters : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "LatestActiveGenerationKwh",
                table: "Meters",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "LatestGenerationPowerKw",
                table: "Meters",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "ActiveGenerationKwh",
                table: "MeterReadings",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<double>(
                name: "GenerationPowerKw",
                table: "MeterReadings",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LatestActiveGenerationKwh",
                table: "Meters");

            migrationBuilder.DropColumn(
                name: "LatestGenerationPowerKw",
                table: "Meters");

            migrationBuilder.DropColumn(
                name: "ActiveGenerationKwh",
                table: "MeterReadings");

            migrationBuilder.DropColumn(
                name: "GenerationPowerKw",
                table: "MeterReadings");
        }
    }
}

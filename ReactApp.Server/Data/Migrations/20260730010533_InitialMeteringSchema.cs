using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReactApp.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialMeteringSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Meters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SerialNumber = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 160, nullable: false),
                    Manufacturer = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    Model = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    FirmwareVersion = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    Tariff = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                    SamplingIntervalSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    City = table.Column<string>(type: "TEXT", maxLength: 120, nullable: false),
                    Site = table.Column<string>(type: "TEXT", maxLength: 160, nullable: false),
                    Latitude = table.Column<double>(type: "REAL", nullable: false),
                    Longitude = table.Column<double>(type: "REAL", nullable: false),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    LastSeenAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastReadingQuality = table.Column<string>(type: "TEXT", nullable: true),
                    LatestActiveImportKwh = table.Column<double>(type: "REAL", nullable: true),
                    LatestActiveExportKwh = table.Column<double>(type: "REAL", nullable: true),
                    LatestActivePowerKw = table.Column<double>(type: "REAL", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Meters", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MeterReadings",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    MeterId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TimestampUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ActiveImportKwh = table.Column<double>(type: "REAL", nullable: false),
                    ActiveExportKwh = table.Column<double>(type: "REAL", nullable: false),
                    ActivePowerKw = table.Column<double>(type: "REAL", nullable: false),
                    ReactivePowerKvar = table.Column<double>(type: "REAL", nullable: true),
                    Voltage = table.Column<double>(type: "REAL", nullable: true),
                    Current = table.Column<double>(type: "REAL", nullable: true),
                    FrequencyHz = table.Column<double>(type: "REAL", nullable: true),
                    Quality = table.Column<string>(type: "TEXT", nullable: false),
                    ReceivedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeterReadings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MeterReadings_Meters_MeterId",
                        column: x => x.MeterId,
                        principalTable: "Meters",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MeterReadings_MeterId_TimestampUtc",
                table: "MeterReadings",
                columns: new[] { "MeterId", "TimestampUtc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MeterReadings_TimestampUtc",
                table: "MeterReadings",
                column: "TimestampUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Meters_SerialNumber",
                table: "Meters",
                column: "SerialNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MeterReadings");

            migrationBuilder.DropTable(
                name: "Meters");
        }
    }
}

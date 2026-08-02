using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReactApp.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddMeterAlertThreshold : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "AlertThresholdKw",
                table: "Meters",
                type: "REAL",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AlertThresholdKw",
                table: "Meters");
        }
    }
}

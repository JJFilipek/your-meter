using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ReactApp.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSimulatedMeterFlag : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsSimulated",
                table: "Meters",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsSimulated",
                table: "Meters");
        }
    }
}

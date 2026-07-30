using Microsoft.EntityFrameworkCore;
using ReactApp.Server.Models;

namespace ReactApp.Server.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Meter> Meters => Set<Meter>();
    public DbSet<MeterReading> MeterReadings => Set<MeterReading>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var meter = modelBuilder.Entity<Meter>();
        meter.HasKey(x => x.Id);
        meter.HasIndex(x => x.SerialNumber).IsUnique();
        meter.Property(x => x.SerialNumber).HasMaxLength(64);
        meter.Property(x => x.Name).HasMaxLength(160);
        meter.Property(x => x.Manufacturer).HasMaxLength(120);
        meter.Property(x => x.Model).HasMaxLength(120);
        meter.Property(x => x.FirmwareVersion).HasMaxLength(64);
        meter.Property(x => x.Tariff).HasMaxLength(32);
        meter.Property(x => x.City).HasMaxLength(120);
        meter.Property(x => x.Site).HasMaxLength(160);
        meter.Property(x => x.LastReadingQuality).HasConversion<string>();

        var reading = modelBuilder.Entity<MeterReading>();
        reading.HasKey(x => x.Id);
        reading.HasIndex(x => new { x.MeterId, x.TimestampUtc }).IsUnique();
        reading.HasIndex(x => x.TimestampUtc);
        reading.Property(x => x.Quality).HasConversion<string>();
        reading.HasOne(x => x.Meter)
            .WithMany(x => x.Readings)
            .HasForeignKey(x => x.MeterId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

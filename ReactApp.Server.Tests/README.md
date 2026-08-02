# ReactApp.Server.Tests

Test suite for the backend's calculation logic.

## Layout

- `Services/` — pure unit tests (no HTTP, no database) for `EnergyPricingService`: contracted/connection
  power formulas and tariff zone-rate resolution.
- `Simulation/` — unit tests for `MeterSimulationWorker.CreateReading`, the deterministic generator
  behind every simulated meter. Accessed via `internal` (`InternalsVisibleTo` in
  `ReactApp.Server.csproj`), not reflection.
- `Controllers/` — integration tests that boot the real ASP.NET Core pipeline against an in-memory
  SQLite database (`Infrastructure/TestApiFactory.cs`) and assert on the JSON returned by
  `/api/meters/{id}/analytics`, `/insights` and `/tariff-simulation`. Every reading is seeded with
  round numbers chosen so the expected energy, loss, cost and forecast values can be checked by
  hand arithmetic — the tests do not re-derive expectations by calling the code under test.
- `Infrastructure/` — test-only plumbing: `TestApiFactory` (in-memory DB + fake authentication),
  `TestAuthHandler`/`TestAuthState` (always-authenticated user, toggleable read-only flag),
  `MeterSeedBuilder` (fluent meter + reading construction), `ApiJson` (response deserialization
  options matching the API's camelCase output).

## Running

```bash
dotnet test ReactApp.sln
```

`TestApiFactory` overrides a handful of settings (line resistance, exceedance penalty rates,
export compensation) to clean round numbers instead of the production `appsettings.json` values,
so tests never depend on that file being discovered on disk.

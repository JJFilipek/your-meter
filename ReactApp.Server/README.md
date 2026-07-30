# ReactApp.Server

Backend aplikacji Twoj Licznik jest zbudowany na ASP.NET Core 8, Entity Framework Core
i SQLite. Obsługuje dane z liczników oraz zarządzane symulatory taryfowe. Wszystkie
odpowiedzi API wynikają z rekordów zapisanych w bazie.

## Uruchomienie

```powershell
dotnet tool restore
dotnet restore ReactApp.Server/ReactApp.Server.csproj
dotnet run --project ReactApp.Server/ReactApp.Server.csproj
```

Przy pierwszym uruchomieniu aplikacja utworzy katalog `App_Data`, bazę SQLite i
automatycznie zastosuje migracje. Swagger jest dostępny w środowisku deweloperskim
pod adresem `/swagger`, a kontrola kondycji pod `/health`.

Łańcuch połączenia można nadpisać zmienną środowiskową:

```powershell
$env:ConnectionStrings__DefaultConnection = "Data Source=C:\data\twoj-licznik.db"
```

## API

- `GET /api/meters` - lista aktywnych liczników.
- `POST /api/meters` - rejestracja licznika.
- `PUT /api/meters/{id}` - aktualizacja konfiguracji.
- `DELETE /api/meters/{id}` - wyłączenie licznika bez usuwania historii.
- `GET /api/meters/{id}/readings` - odczyty z wybranego zakresu.
- `POST /api/ingestion/meters/{serialNumber}/readings` - zapis paczki pomiarów.
- `GET /api/dashboard/summary` - agregaty wyliczone z zapisanych pomiarów.
- `GET /api/simulators` - lista symulatorów wraz z liczbą odczytów.
- `POST /api/simulators` - utworzenie symulatora dla taryfy G11, G12, G12W, C11 lub A23.
- `PUT /api/simulators/{id}/state` - wstrzymanie lub wznowienie symulatora.
- `DELETE /api/simulators/{id}?confirmSerial={serial}` - trwałe usunięcie symulatora
  oraz wszystkich jego odczytów.

Nowy symulator można utworzyć również skryptem:

```powershell
.\scripts\create-simulator.ps1 `
  -Name "Biuro testowe" `
  -Tariff G11 `
  -BasePowerKw 2.4 `
  -StartAt (Get-Date).AddDays(-30) `
  -InitialImportKwh 1250 `
  -InitialExportKwh 20 `
  -HistoricalIntervalMinutes 15 `
  -SamplingIntervalSeconds 30
```

Wartości początkowe są zapisywane dokładnie dla `StartAt`. Backend wylicza kolejne
pomiary zgodnie z profilem taryfy aż do bieżącej chwili, a następnie kontynuuje
generowanie z interwałem bieżącym. Zakres historii jest ograniczony do 365 dni.

## Połączenie z frontendem

W trybie deweloperskim Vite przekazuje ścieżki `/api` i `/health` do serwera
ASP.NET Core. Jeżeli frontend i API będą hostowane na różnych domenach, podczas
budowania frontendu trzeba ustawić `VITE_API_BASE_URL` na publiczny adres API,
czyli obecnie `https://licznik-api.jfilipek.com`. Przykład znajduje się w
`reactapp.client/.env.example`.

Frontend działa na Cloudflare Pages pod adresem `https://licznik.jfilipek.com`,
a produkcyjne API pod adresem `https://licznik-api.jfilipek.com`.

## Migracje

Po zmianie modelu danych nową migrację tworzy się poleceniem:

```powershell
dotnet tool run dotnet-ef migrations add NazwaMigracji `
  --project ReactApp.Server/ReactApp.Server.csproj `
  --startup-project ReactApp.Server/ReactApp.Server.csproj `
  --output-dir Data/Migrations
```

Migracje są stosowane automatycznie przy starcie serwera.

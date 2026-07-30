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

Przy pierwszym uruchomieniu trzeba podać dane początkowego administratora:

```powershell
$env:Authentication__BootstrapUsername = "admin"
$env:Authentication__BootstrapEmail = "admin@example.com"
$env:Authentication__BootstrapPassword = "SilneHasloTymczasowe123"
```

Hasło jest używane wyłącznie do utworzenia pierwszego konta i trafia do bazy jako
hash. Kolejne uruchomienia korzystają z istniejącego użytkownika. Po utworzeniu
konta warto usunąć wartość `Authentication__BootstrapPassword` z konfiguracji.

Opcjonalne konto demonstracyjne jest tworzone i utrzymywane na podstawie ustawień
`Authentication__DemoUsername`, `Authentication__DemoEmail` oraz
`Authentication__DemoPassword`. Ma ono wymuszony tryb tylko do odczytu: może
przeglądać dane, ale nie może tworzyć, zmieniać ani usuwać rekordów, a także
zmieniać własnego profilu lub hasła.

Łańcuch połączenia można nadpisać zmienną środowiskową:

```powershell
$env:ConnectionStrings__DefaultConnection = "Data Source=C:\data\your-meter.db"
```

## API

- `GET /api/meters` - lista aktywnych liczników.
- `POST /api/meters` - rejestracja licznika.
- `PUT /api/meters/{id}` - aktualizacja konfiguracji.
- `DELETE /api/meters/{id}` - wyłączenie licznika bez usuwania historii.
- `GET /api/meters/{id}/readings` - odczyty z wybranego zakresu.
- `POST /api/ingestion/meters/{serialNumber}/readings` - zapis paczki pomiarów.
- `GET /api/dashboard/summary` - agregaty wyliczone z zapisanych pomiarów.
- `POST /api/auth/login` - utworzenie sesji w bezpiecznym cookie `HttpOnly`.
- `GET /api/auth/me` - dane aktualnie zalogowanego użytkownika.
- `POST /api/auth/logout` - zakończenie sesji.
- `PUT /api/auth/profile` - aktualizacja nazwy użytkownika i adresu email.
- `PUT /api/auth/password` - zmiana hasła i zakończenie bieżącej sesji.
- `GET /api/simulators` - lista symulatorów wraz z liczbą odczytów.
- `POST /api/simulators` - utworzenie symulatora dla taryfy G11, G12, G12W, C11 lub A23.
- `PUT /api/simulators/{id}/state` - wstrzymanie lub wznowienie symulatora.
- `DELETE /api/simulators/{id}?confirmSerial={serial}` - trwałe usunięcie symulatora
  oraz wszystkich jego odczytów.

Poza logowaniem wszystkie endpointy kontrolerów wymagają aktywnej sesji. Żądania
`POST`, `PUT`, `PATCH` i `DELETE` kierowane do `/api` muszą dodatkowo zawierać
nagłówek `X-App-Request: Your-Meter`. Własny nagłówek wraz z ograniczeniem CORS
chroni operacje modyfikujące przed wywołaniem przez formularz z obcej strony.

Nowy symulator można utworzyć również skryptem:

```powershell
.\scripts\create-simulator.ps1 `
  -Username "admin" `
  -Password (Read-Host -AsSecureString) `
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

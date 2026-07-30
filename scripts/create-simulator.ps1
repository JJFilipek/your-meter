param(
    [string]$ApiUrl = "https://licznik-api.jfilipek.com",
    [string]$Username = "jakub.filipek",
    [Parameter(Mandatory = $true)]
    [securestring]$Password,
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [ValidateSet("G11", "G12", "G12W", "C11", "A23")]
    [string]$Tariff = "G11",
    [double]$BasePowerKw = 2.4,
    [string]$City = "Warszawa",
    [string]$Site = "Obiekt testowy",
    [string]$SerialNumber = "",
    [ValidateRange(5, 3600)]
    [int]$SamplingIntervalSeconds = 30,
    [datetime]$StartAt = (Get-Date).AddDays(-30),
    [ValidateSet(5, 10, 15, 30, 60)]
    [int]$HistoricalIntervalMinutes = 15,
    [double]$InitialImportKwh = 0,
    [double]$InitialExportKwh = 0
)

$plainPassword = [System.Net.NetworkCredential]::new("", $Password).Password
$session = [Microsoft.PowerShell.Commands.WebRequestSession]::new()
$appHeaders = @{ "X-App-Request" = "Your-Meter" }
$loginBody = @{
    username = $Username
    password = $plainPassword
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "$($ApiUrl.TrimEnd('/'))/api/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Headers $appHeaders `
    -Body $loginBody `
    -WebSession $session | Out-Null

$body = @{
    name = $Name
    tariff = $Tariff
    basePowerKw = $BasePowerKw
    samplingIntervalSeconds = $SamplingIntervalSeconds
    city = $City
    site = $Site
    lat = 52.2297
    lng = 21.0122
    initialImportKwh = $InitialImportKwh
    initialExportKwh = $InitialExportKwh
    startAtUtc = $StartAt.ToUniversalTime().ToString("o")
    historicalIntervalMinutes = $HistoricalIntervalMinutes
}

if (-not [string]::IsNullOrWhiteSpace($SerialNumber)) {
    $body.serialNumber = $SerialNumber.ToUpperInvariant()
}

$result = Invoke-RestMethod `
    -Uri "$($ApiUrl.TrimEnd('/'))/api/simulators" `
    -Method Post `
    -ContentType "application/json" `
    -Headers $appHeaders `
    -Body ($body | ConvertTo-Json) `
    -WebSession $session

$result | Format-List

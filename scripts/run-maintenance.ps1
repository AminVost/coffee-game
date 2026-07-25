param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$Secret = $env:MAINTENANCE_SECRET
)
$ErrorActionPreference = "Stop"
if (-not $Secret) { throw "MAINTENANCE_SECRET is required" }
Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/internal/maintenance" -Headers @{ Authorization = "Bearer $Secret" }

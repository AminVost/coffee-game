$ErrorActionPreference = "Stop"
Write-Host "Coffee Game Satarkhan - Local Setup" -ForegroundColor Green
if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
npm install
Write-Host "Setup complete. Run: npm run dev" -ForegroundColor Green

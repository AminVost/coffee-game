param(
  [string]$OutputDirectory = ".\backups\database"
)
$ErrorActionPreference = "Stop"
if (-not (Test-Path ".env.local")) { throw ".env.local not found" }
$line = Get-Content .env.local | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $line) { throw "DATABASE_URL not found in .env.local" }
$url = ($line -replace '^DATABASE_URL=', '').Trim('"')
$uri = [System.Uri]$url
$dbName = $uri.AbsolutePath.TrimStart('/')
$userInfo = $uri.UserInfo.Split(':',2)
$user = [Uri]::UnescapeDataString($userInfo[0])
$password = if ($userInfo.Count -gt 1) { [Uri]::UnescapeDataString($userInfo[1]) } else { "" }
$hostName = $uri.Host
$port = if ($uri.Port -gt 0) { $uri.Port } else { 3306 }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path $OutputDirectory "$dbName-$stamp.sql"
$args = @("-h",$hostName,"-P",$port,"-u",$user,"--single-transaction","--routines","--triggers","--events","--default-character-set=utf8mb4",$dbName)
$env:MYSQL_PWD = $password
try {
  & mysqldump @args | Out-File -FilePath $output -Encoding utf8
  if ($LASTEXITCODE -ne 0) { throw "mysqldump failed with exit code $LASTEXITCODE" }
} finally { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
Write-Host "Database backup created: $output" -ForegroundColor Green

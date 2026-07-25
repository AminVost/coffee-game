param(
    [string]$ProjectRoot = (Get-Location).Path,
    [string]$OutputDirectory = "$env:USERPROFILE\Downloads",
    [int]$MaximumFileSizeMB = 5
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$projectName = Split-Path $ProjectRoot -Leaf
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputZip = Join-Path $OutputDirectory "$projectName-source-$timestamp.zip"
$tempRoot = Join-Path $env:TEMP ("ai-source-export-" + [guid]::NewGuid())
$stagingRoot = Join-Path $tempRoot $projectName
$maximumFileSize = $MaximumFileSizeMB * 1MB

# These folders are runtime/build/generated/private data and are not useful for AI source review.
$excludedDirectories = @(
    ".git",
    ".next",
    "node_modules",
    ".turbo",
    ".vercel",
    ".idea",
    ".vscode",
    "dist",
    "build",
    "coverage",
    "logs",
    "log",
    "tmp",
    "temp",
    "backups",
    "patch-backups",
    "uploads",
    "runtime",
    "storage",
    "cache",
    "database"
)

# Binary/generated files do not help code review and are the main reason source ZIPs become large.
$excludedExtensions = @(
    ".zip", ".rar", ".7z", ".tar", ".gz",
    ".bak", ".log", ".tmp", ".tsbuildinfo",
    ".exe", ".dll", ".bin", ".iso",
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".ico", ".svg",
    ".mp3", ".wav", ".ogg", ".mp4", ".mov", ".avi", ".mkv",
    ".woff", ".woff2", ".ttf", ".otf",
    ".pt", ".pth", ".onnx", ".safetensors",
    ".sql"
)

$excludedFileNames = @(
    "Thumbs.db",
    ".DS_Store"
)

function Test-IsExcludedDirectory {
    param([string]$RelativePath)

    $segments = $RelativePath -split "[\\/]" | Where-Object { $_ }
    foreach ($segment in $segments) {
        if ($excludedDirectories -contains $segment) {
            return $true
        }
    }
    return $false
}

function Test-IsSecretEnvFile {
    param([System.IO.FileInfo]$File)

    if ($File.Name -in @(".env.example", "GENERATED_ENV_KEYS.example")) {
        return $false
    }

    return $File.Name -eq ".env" -or $File.Name -like ".env.*"
}

try {
    if (-not (Test-Path -LiteralPath $OutputDirectory)) {
        New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
    }

    New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

    $copiedCount = 0
    $excludedCount = 0
    $copiedBytes = [int64]0

    Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -Force | ForEach-Object {
        $file = $_
        $relativePath = $file.FullName.Substring($ProjectRoot.Length).TrimStart("\", "/")

        $exclude =
            (Test-IsExcludedDirectory $relativePath) -or
            (Test-IsSecretEnvFile $file) -or
            ($excludedFileNames -contains $file.Name) -or
            ($excludedExtensions -contains $file.Extension.ToLowerInvariant()) -or
            ($file.Length -gt $maximumFileSize)

        if ($exclude) {
            $excludedCount++
            return
        }

        $destination = Join-Path $stagingRoot $relativePath
        $destinationDirectory = Split-Path $destination -Parent
        New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force

        $copiedCount++
        $copiedBytes += $file.Length
    }

    @"
AI source export
Project: $projectName
Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Excluded intentionally:
- database/ and all SQL files (upload the current database dump separately)
- .env and .env.* secrets; .env.example is retained
- node_modules, .next, Git metadata, caches, backups, storage and uploads
- binary images/media/fonts/model files
- generated TypeScript build info

The ZIP is intended for code review and patch generation, not direct deployment.
"@ | Set-Content -LiteralPath (Join-Path $stagingRoot "AI_SOURCE_EXPORT_INFO.txt") -Encoding UTF8

    if (Test-Path -LiteralPath $outputZip) {
        Remove-Item -LiteralPath $outputZip -Force
    }

    # tar.exe is available on current Windows 10/11 and produces standard ZIP paths.
    $tar = Get-Command tar.exe -ErrorAction SilentlyContinue
    if ($tar) {
        Push-Location $tempRoot
        try {
            & $tar.Source -a -c -f $outputZip $projectName
            if ($LASTEXITCODE -ne 0) {
                throw "tar.exe failed with exit code $LASTEXITCODE."
            }
        }
        finally {
            Pop-Location
        }
    }
    else {
        Compress-Archive -LiteralPath $stagingRoot -DestinationPath $outputZip -CompressionLevel Optimal -Force
    }

    $zipInfo = Get-Item -LiteralPath $outputZip
    Write-Host ""
    Write-Host "AI source ZIP created successfully." -ForegroundColor Green
    Write-Host "Output: $outputZip" -ForegroundColor Cyan
    Write-Host "Copied files: $copiedCount"
    Write-Host "Excluded files: $excludedCount"
    Write-Host "Copied source size: $([math]::Round($copiedBytes / 1MB, 2)) MB"
    Write-Host "ZIP size: $([math]::Round($zipInfo.Length / 1MB, 2)) MB"
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}

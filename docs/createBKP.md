$source = "C:\wamp64\www\coffee-game-satarkhan"
$temp   = "C:\wamp64\www\coffee-game-satarkhan-source"
$zip    = "C:\Users\Amin\Desktop\coffee-game-satarkhan-source.zip"

Remove-Item $temp -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $zip -Force -ErrorAction SilentlyContinue

robocopy $source $temp /E `
  /XD node_modules .next .git patch-backups `
      storage\receipts storage\logs `
  /XF .env *.log *.zip *.rar *.7z

Compress-Archive `
  -Path "$temp\*" `
  -DestinationPath $zip `
  -CompressionLevel Optimal

Remove-Item $temp -Recurse -Force

Write-Host "ZIP created: $zip"
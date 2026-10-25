# Sync public assets into each native app's assets/www directory

$apps = @(
    "mobile\seller-native\app\src\main\assets\www",
    "mobile\driver-native\app\src\main\assets\www",
    "mobile\pdv-native\app\src\main\assets\www",
    "mobile\tower-native\app\src\main\assets\www"
)

foreach ($dest in $apps) {
    if (Test-Path $dest) {
        Remove-Item -Path $dest -Recurse -Force
    }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    
    # Copy essential public files
    Copy-Item -Path "public\styles.css" -Destination "$dest\styles.css" -Force
    Copy-Item -Path "public\role.js" -Destination "$dest\role.js" -Force
    Copy-Item -Path "public\app.js" -Destination "$dest\app.js" -Force
    Copy-Item -Path "public\sw.js" -Destination "$dest\sw.js" -Force
    Copy-Item -Path "public\vendedor.html" -Destination "$dest\vendedor.html" -Force
    Copy-Item -Path "public\motorista.html" -Destination "$dest\motorista.html" -Force
    Copy-Item -Path "public\pdv.html" -Destination "$dest\pdv.html" -Force
    Copy-Item -Path "public\admin.html" -Destination "$dest\admin.html" -Force
    Copy-Item -Path "public\loja.html" -Destination "$dest\loja.html" -Force
    
    # Copy assets folder (logos, brands)
    if (Test-Path "public\assets") {
        Copy-Item -Path "public\assets" -Destination "$dest\assets" -Recurse -Force
    }
    
    Write-Host "Synced offline assets to $dest"
}

Write-Host "All native app offline assets synchronized successfully!"

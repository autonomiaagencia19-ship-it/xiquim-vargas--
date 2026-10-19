Add-Type -AssemblyName System.Drawing

$logoPath = "public\assets\institucional\01_Logo_Xiquim_Vargas_HD.png"
if (-not (Test-Path $logoPath)) {
    Write-Error "Logo not found at $logoPath"
    exit 1
}

$src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $logoPath).Path)

$apps = @(
    "mobile\seller-native\app\src\main\res\drawable",
    "mobile\driver-native\app\src\main\res\drawable",
    "mobile\pdv-native\app\src\main\res\drawable",
    "mobile\tower-native\app\src\main\res\drawable"
)

# 1. Square Icon (512x512)
$square = New-Object System.Drawing.Bitmap 512, 512
$g = [System.Drawing.Graphics]::FromImage($square)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 7, 12, 24))
$g.FillRectangle($bgBrush, 0, 0, 512, 512)

# Subtle rounded border inside square
$borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 30, 42, 60)), 4
$g.DrawRectangle($borderPen, 2, 2, 508, 508)
$borderPen.Dispose()

# Scale logo to fit nicely with padding (width 440)
$destW = 440
$destH = [int]($src.Height * ($destW / $src.Width))
$destX = [int]((512 - $destW) / 2)
$destY = [int]((512 - $destH) / 2)
$g.DrawImage($src, $destX, $destY, $destW, $destH)
$g.Dispose()

# 2. Round Icon (512x512 with circular clipping)
$round = New-Object System.Drawing.Bitmap 512, 512
$gr = [System.Drawing.Graphics]::FromImage($round)
$gr.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gr.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(6, 6, 500, 500)
$gr.FillPath($bgBrush, $path)

$roundBorderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 253, 94, 2)), 4
$gr.DrawPath($roundBorderPen, $path)
$roundBorderPen.Dispose()

# Draw logo inside circle
$gr.SetClip($path)
$destWRound = 400
$destHRound = [int]($src.Height * ($destWRound / $src.Width))
$destXRound = [int]((512 - $destWRound) / 2)
$destYRound = [int]((512 - $destHRound) / 2)
$gr.DrawImage($src, $destXRound, $destYRound, $destWRound, $destHRound)
$path.Dispose()
$gr.Dispose()

foreach ($app in $apps) {
    if (Test-Path $app) {
        $square.Save("$app\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
        $round.Save("$app\ic_launcher_round.png", [System.Drawing.Imaging.ImageFormat]::Png)
        Copy-Item -Path $logoPath -Destination "$app\logo_transparent.png" -Force
        Write-Host "Updated icons for $app"
    }
}

$src.Dispose()
$square.Dispose()
$round.Dispose()
$bgBrush.Dispose()
Write-Host "All icons generated successfully with 01_Logo_Xiquim_Vargas_HD!"

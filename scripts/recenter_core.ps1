param(
    [string]$ImagePath,
    [string]$OutputPath = ""
)

Add-Type -AssemblyName System.Drawing

$fullPath = (Resolve-Path $ImagePath).Path
if (-not $OutputPath) { $OutputPath = $fullPath }

$img = [System.Drawing.Image]::FromFile($fullPath)
$bmp = New-Object System.Drawing.Bitmap($img)

$w = $bmp.Width
$h = $bmp.Height

# Function to test if pixel is truly a product pixel (not white background or JPEG compression noise)
function IsProductPixel($p) {
    if ($p.A -lt 30) { return $false }
    # Anything with any channel below 235, or sum of (255-R)+(255-G)+(255-B) > 35 is product
    $diff = (255 - [int]$p.R) + (255 - [int]$p.G) + (255 - [int]$p.B)
    return ($diff -gt 35)
}

# Require at least 4% of image height / width or min 15 consecutive/total pixels to count as real content column/row
$minContentPixelsH = [Math]::Max(15, [int]($h * 0.04))
$minContentPixelsW = [Math]::Max(15, [int]($w * 0.04))

# Scan MinX
$minX = 0
for ($x = 0; $x -lt $w; $x++) {
    $count = 0
    for ($y = 0; $y -lt $h; $y++) {
        if (IsProductPixel $bmp.GetPixel($x, $y)) { $count++ }
    }
    if ($count -ge $minContentPixelsH) { $minX = $x; break }
}

# Scan MaxX
$maxX = $w - 1
for ($x = $w - 1; $x -ge 0; $x--) {
    $count = 0
    for ($y = 0; $y -lt $h; $y++) {
        if (IsProductPixel $bmp.GetPixel($x, $y)) { $count++ }
    }
    if ($count -ge $minContentPixelsH) { $maxX = $x; break }
}

# Scan MinY
$minY = 0
for ($y = 0; $y -lt $h; $y++) {
    $count = 0
    for ($x = 0; $x -lt $w; $x++) {
        if (IsProductPixel $bmp.GetPixel($x, $y)) { $count++ }
    }
    if ($count -ge $minContentPixelsW) { $minY = $y; break }
}

# Scan MaxY
$maxY = $h - 1
for ($y = $h - 1; $y -ge 0; $y--) {
    $count = 0
    for ($x = 0; $x -lt $w; $x++) {
        if (IsProductPixel $bmp.GetPixel($x, $y)) { $count++ }
    }
    if ($count -ge $minContentPixelsW) { $maxY = $y; break }
}

$contentW = $maxX - $minX + 1
$contentH = $maxY - $minY + 1

Write-Host "File: $([System.IO.Path]::GetFileName($ImagePath))"
Write-Host "Original: ${w}x${h} -> Content: ${contentW}x${contentH} (X: $minX..$maxX, Y: $minY..$maxY)"

$maxDim = [Math]::Max($contentW, $contentH)
# Add 6% margin around content
$padding = [int]($maxDim * 0.06)
$targetSide = $maxDim + ($padding * 2)
if ($targetSide -lt 600) { $targetSide = 600 }

$canvas = New-Object System.Drawing.Bitmap($targetSide, $targetSide, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$destX = [int](($targetSide - $contentW) / 2)
$destY = [int](($targetSide - $contentH) / 2)

$srcRect = New-Object System.Drawing.Rectangle($minX, $minY, $contentW, $contentH)
$destRect = New-Object System.Drawing.Rectangle($destX, $destY, $contentW, $contentH)

$g.DrawImage($bmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$tempOut = [System.IO.Path]::GetTempFileName() + ".jpg"
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]93)

$canvas.Save($tempOut, $jpegCodec, $encoderParams)

$g.Dispose()
$canvas.Dispose()
$bmp.Dispose()
$img.Dispose()

Copy-Item -Path $tempOut -Destination $OutputPath -Force
Remove-Item -Path $tempOut -Force
Write-Host "Done: Saved perfectly centered square image to $OutputPath"

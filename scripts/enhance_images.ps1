Add-Type -AssemblyName System.Drawing

function Enhance-Image {
    param(
        [string]$InputPath,
        [string]$OutputPath,
        [int]$ScaleFactor = 3
    )

    $src = [System.Drawing.Bitmap]::FromFile($InputPath)
    $newWidth = [int]($src.Width * $ScaleFactor)
    $newHeight = [int]($src.Height * $ScaleFactor)

    $dest = New-Object System.Drawing.Bitmap($newWidth, $newHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $dest.SetResolution(300, 300)

    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $rect = New-Object System.Drawing.Rectangle(0, 0, $newWidth, $newHeight)
    $g.DrawImage($src, $rect, 0, 0, $src.Width, $src.Height, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $src.Dispose()

    # Save as high quality PNG
    $dest.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $dest.Dispose()

    Write-Host "Sucesso: $OutputPath ($newWidth x $newHeight)"
}

$uploadedDir = 'C:\Users\edini\.gemini\antigravity-ide\brain\43424e73-bdd0-4f67-8d2c-36be021dc7c0\.user_uploaded'
$outDir = 'C:\Users\edini\Desktop\ERP_XiquimVargasERP_1.8.2_DELIVERY\imagens_institucionais_hd'

Enhance-Image -InputPath "$uploadedDir\media_1792164069740.jpg" -OutputPath "$outDir\01_Logo_Xiquim_Vargas_HD.png" -ScaleFactor 4
Enhance-Image -InputPath "$uploadedDir\media_1792164135299.jpg" -OutputPath "$outDir\02_Horarios_de_Atendimento_HD.png" -ScaleFactor 3
Enhance-Image -InputPath "$uploadedDir\media_1792164139895.jpg" -OutputPath "$outDir\03_Nossa_Localizacao_Fachada_HD.png" -ScaleFactor 3
Enhance-Image -InputPath "$uploadedDir\media_1792164145745.jpg" -OutputPath "$outDir\04_Rotas_de_Entrega_Dias_HD.png" -ScaleFactor 3

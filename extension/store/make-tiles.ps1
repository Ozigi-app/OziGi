# Generates the Chrome Web Store promo tiles.
#
#   Small promo tile  440x280  — shown in browse/search listings
#   Marquee tile     1400x560  — only used if Google considers you for featuring
#
# Both are optional. Google rejects tiles that contain screenshots, calls to
# action ("Install now"), or small text, so these stay deliberately plain: the
# mark, the name, one short line. Tiles render small, so nothing here is below
# ~18px.

param([string]$Out = "$PSScriptRoot")

Add-Type -AssemblyName System.Drawing

$logo = [System.Drawing.Image]::FromFile((Resolve-Path "$PSScriptRoot\..\..\public\android-chrome-512x512.png"))
$crop = New-Object System.Drawing.Rectangle 66, 46, 384, 384   # the mark, minus its baked-in tagline

$ink    = [System.Drawing.Color]::FromArgb(15, 23, 42)
$accent = [System.Drawing.Color]::FromArgb(232, 50, 10)
$muted  = [System.Drawing.Color]::FromArgb(100, 116, 139)
$paper  = [System.Drawing.Color]::FromArgb(248, 250, 252)

function New-Tile($w, $h, $markSize, $markX, $markY, $titleSize, $titleY, $subSize, $subY, $path) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.Clear($paper)

  # A thin accent rule at the bottom keeps the tile from reading as a blank card
  # without adding text.
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $accent), 0, ($h - [int]($h * 0.018)), $w, [int]($h * 0.018))

  $g.DrawImage($logo, (New-Object System.Drawing.Rectangle $markX, $markY, $markSize, $markSize), $crop, [System.Drawing.GraphicsUnit]::Pixel)

  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = [System.Drawing.StringAlignment]::Center

  $titleFont = New-Object System.Drawing.Font 'Segoe UI', $titleSize, ([System.Drawing.FontStyle]::Bold)
  $g.DrawString('Ozigi for LinkedIn', $titleFont, (New-Object System.Drawing.SolidBrush $ink),
    (New-Object System.Drawing.RectangleF 0, $titleY, $w, ($titleSize * 2.2)), $fmt)

  $subFont = New-Object System.Drawing.Font 'Segoe UI', $subSize, ([System.Drawing.FontStyle]::Regular)
  $g.DrawString('Personalised connection requests, sent from your own browser', $subFont,
    (New-Object System.Drawing.SolidBrush $muted),
    (New-Object System.Drawing.RectangleF 0, $subY, $w, ($subSize * 2.4)), $fmt)

  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $i = [System.Drawing.Image]::FromFile($path); "$([IO.Path]::GetFileName($path)): $($i.Width)x$($i.Height)"; $i.Dispose()
}

New-Tile 440 280  84 178  44 15 145 9  196  (Join-Path $Out 'promo-tile-440x280.png')
New-Tile 1400 560 168 616 104 34 300 16 396 (Join-Path $Out 'marquee-1400x560.png')

$logo.Dispose()

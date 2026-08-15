# Fits screenshots to the Chrome Web Store's exact 1280x800 requirement.
#
# The store rejects anything that isn't exactly 1280x800 (or 640x400), and most
# real captures are the wrong ratio -- a full-width dashboard is far wider, the
# extension popup far taller. Stretching them to fit would distort the UI, so
# each image is scaled to FIT and centred on a 1280x800 canvas.
#
# The padding colour is sampled from the image's own corner, so light captures
# get a white surround and the dark popup gets its dark one, instead of every
# shot sitting in a mismatched box.
#
# Usage:
#   ./fit-screenshots.ps1 -Source "$env:USERPROFILE\Downloads" -Out ".\out"
#   ./fit-screenshots.ps1 -Source "C:\shots\popup.png"

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [string]$Out = "$PSScriptRoot\screenshots",
  [int]$Width = 1280,
  [int]$Height = 800
)

Add-Type -AssemblyName System.Drawing

# Note the '\*': -Include matches against the PATH, so on a bare directory it
# silently returns nothing rather than erroring.
$files = if (Test-Path $Source -PathType Container) {
  Get-ChildItem (Join-Path $Source '*') -Include *.png, *.jpg, *.jpeg -File
} else {
  Get-Item $Source
}

if (-not $files) { Write-Error "No images found at $Source"; exit 1 }
New-Item -ItemType Directory -Force $Out | Out-Null

foreach ($file in $files) {
  $src = [System.Drawing.Image]::FromFile($file.FullName)

  # Sample the LEFT EDGE AT MID-HEIGHT for the padding colour, not a corner: the
  # top of a browser capture is title-bar chrome, and sampling it surrounded a
  # white dashboard with a maroon border.
  $srcW = $src.Width; $srcH = $src.Height
  $probe = New-Object System.Drawing.Bitmap 1, 1
  $pg = [System.Drawing.Graphics]::FromImage($probe)
  $pg.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, 1, 1), (New-Object System.Drawing.Rectangle 2, ([int]($srcH / 2)), 1, 1), [System.Drawing.GraphicsUnit]::Pixel)
  $pg.Dispose()
  $bg = $probe.GetPixel(0, 0)
  $probe.Dispose()
  if ($bg.A -lt 250) { $bg = [System.Drawing.Color]::White }

  # Scale to fit, never crop: cropping a dashboard shot loses the thing the
  # screenshot exists to show.
  $scale = [Math]::Min($Width / $srcW, $Height / $srcH)
  $w = [int][Math]::Round($srcW * $scale)
  $h = [int][Math]::Round($srcH * $scale)
  $x = [int](($Width - $w) / 2)
  $y = [int](($Height - $h) / 2)

  $canvas = New-Object System.Drawing.Bitmap $Width, $Height
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear($bg)
  $g.DrawImage($src, $x, $y, $w, $h)
  $g.Dispose()

  $dest = Join-Path $Out ("store-" + [IO.Path]::GetFileNameWithoutExtension($file.Name) + ".png")
  $canvas.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()
  $src.Dispose()

  # $srcW/$srcH captured before Dispose — reading $src.Width here throws.
  "{0}  ->  {1}x{2}  (from {3}x{4}, bg #{5:X2}{6:X2}{7:X2})" -f `
    $file.Name, $Width, $Height, $srcW, $srcH, $bg.R, $bg.G, $bg.B
}

"`nDone. Upload from: $Out"

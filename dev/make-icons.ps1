# Generates the PNG icons for the PWA / APK. Run: powershell -File dev/make-icons.ps1
Add-Type -AssemblyName System.Drawing
$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'public\icons'
New-Item -ItemType Directory -Force $out | Out-Null

function New-Icon([int]$size, [string]$name, [bool]$rounded, [double]$scale, [bool]$mono) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::Transparent)
  if (-not $mono) {
    $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(11, 12, 14))
    if ($rounded) {
      $r = [int]($size * 0.22); $d = $r * 2
      $p = New-Object System.Drawing.Drawing2D.GraphicsPath
      $p.AddArc(0, 0, $d, $d, 180, 90); $p.AddArc($size - $d, 0, $d, $d, 270, 90)
      $p.AddArc($size - $d, $size - $d, $d, $d, 0, 90); $p.AddArc(0, $size - $d, $d, $d, 90, 90); $p.CloseFigure()
      $g.FillPath($bg, $p)
    } else { $g.FillRectangle($bg, 0, 0, $size, $size) }
  }
  $rad = $size * 0.30 * $scale; $c = $size / 2; $w = [single]($size * 0.075 * $scale)
  $track = if ($mono) { [System.Drawing.Color]::FromArgb(90, 255, 255, 255) } else { [System.Drawing.Color]::FromArgb(38, 42, 49) }
  $lime = if ($mono) { [System.Drawing.Color]::White } else { [System.Drawing.Color]::FromArgb(212, 255, 63) }
  $pt = New-Object System.Drawing.Pen $track, $w
  $pl = New-Object System.Drawing.Pen $lime, $w
  $pl.StartCap = 'Round'; $pl.EndCap = 'Round'
  $g.DrawEllipse($pt, [single]($c - $rad), [single]($c - $rad), [single]($rad * 2), [single]($rad * 2))
  $g.DrawArc($pl, [single]($c - $rad), [single]($c - $rad), [single]($rad * 2), [single]($rad * 2), -90, 300)
  if (-not $mono) {
    $font = [System.Drawing.Font]::new('Arial', [single]($size * 0.19 * $scale), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat; $sf.Alignment = 'Center'; $sf.LineAlignment = 'Center'
    $g.DrawString('F21', $font, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(243, 245, 239))), [single]$c, [single]($c + $size * 0.01), $sf)
  }
  $bmp.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
New-Icon 192 'icon-192.png' $true 1.0 $false
New-Icon 512 'icon-512.png' $true 1.0 $false
New-Icon 512 'maskable-512.png' $false 0.78 $false
New-Icon 180 'icon-180.png' $false 0.9 $false
New-Icon 96 'badge.png' $false 1.0 $true
Get-ChildItem $out | Select-Object Name, Length

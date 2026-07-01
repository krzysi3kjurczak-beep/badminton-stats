Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..\icons'
$src = Join-Path $root 'logo-aggressive.png'
$shuttle = Join-Path $root 'logo-shuttle.png'
$bgHex = '#1a222d'
$radiusRatio = 0.18
$blueBase = @(26, 82, 148)
$blueHi = @(72, 148, 220)

function Remove-Background([string]$srcPath, [string]$dstPath) {
  $srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)
  $bmp = New-Object System.Drawing.Bitmap $srcBmp.Width, $srcBmp.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($srcBmp, 0, 0, $srcBmp.Width, $srcBmp.Height)
  $g.Dispose(); $srcBmp.Dispose()

  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, $bmp.PixelFormat)
  $stride = $data.Stride
  $bytes = [Math]::Abs($stride) * $bmp.Height
  $buf = New-Object byte[] $bytes
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $bytes)

  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      $i = $y * $stride + $x * 4
      $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]; $a = $buf[$i + 3]
      $max = [Math]::Max($r, [Math]::Max($g, $b))
      $min = [Math]::Min($r, [Math]::Min($g, $b))
      $sat = if ($max -eq 0) { 0.0 } else { ($max - $min) / [double]$max }
      $lum = ($r + $g + $b) / 3.0
      $transparent = ($a -lt 20) -or ($lum -gt 248) -or ($lum -gt 236 -and $sat -lt 0.05)
      if ($transparent) { $buf[$i + 3] = 0 }
      else { $buf[$i + 3] = 255 }
    }
  }

  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $bytes)
  $bmp.UnlockBits($data)
  $bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Crop-ToContent([string]$srcPath, [string]$dstPath, [int]$pad = 2) {
  $bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
  $minX = $bmp.Width; $minY = $bmp.Height; $maxX = 0; $maxY = 0
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      if ($bmp.GetPixel($x, $y).A -gt 10) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -le $minX) { $bmp.Dispose(); Copy-Item $srcPath $dstPath -Force; return }
  $minX = [Math]::Max(0, $minX - $pad)
  $minY = [Math]::Max(0, $minY - $pad)
  $maxX = [Math]::Min($bmp.Width - 1, $maxX + $pad)
  $maxY = [Math]::Min($bmp.Height - 1, $maxY + $pad)
  $w = $maxX - $minX + 1
  $h = $maxY - $minY + 1
  $crop = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($crop)
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle $minX, $minY, $w, $h), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $bmp.Dispose()
  $crop.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
}

function Recolor-Logo([string]$srcPath, [string]$dstPath) {
  $bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
  $w = $bmp.Width
  $h = $bmp.Height
  $mask = New-Object bool[] ($w * $h)
  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, $bmp.PixelFormat)
  $stride = $data.Stride
  $bytes = [Math]::Abs($stride) * $h
  $buf = New-Object byte[] $bytes
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $bytes)

  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $idx = $y * $w + $x
      $i = $y * $stride + $x * 4
      $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]; $a = $buf[$i + 3]
      if ($a -lt 20) { continue }
      $lum = ($r + $g + $b) / 3.0
      $max = [Math]::Max($r, [Math]::Max($g, $b))
      $min = [Math]::Min($r, [Math]::Min($g, $b))
      $sat = if ($max -eq 0) { 0.0 } else { ($max - $min) / [double]$max }
      $isRedShuttle = ($r -gt 70) -and (($r - $g) -gt 22) -and (($r - $b) -gt 22) -and ($sat -gt 0.12)
      $isDarkRed = ($r -gt 35) -and ($g -lt 90) -and ($b -lt 90) -and (($r - $g) -gt 12) -and (($r - $b) -gt 12) -and ($lum -lt 130)
      if (-not ($isRedShuttle -or $isDarkRed)) { continue }
      $mask[$idx] = $true
      $shade = [Math]::Min(255, [Math]::Max(230, [int]($lum * 1.35 + 100)))
      $buf[$i] = $shade
      $buf[$i + 1] = $shade
      $buf[$i + 2] = $shade
      $buf[$i + 3] = 255
    }
  }

  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $idx = $y * $w + $x
      if ($mask[$idx]) { continue }
      $i = $y * $stride + $x * 4
      $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]; $a = $buf[$i + 3]
      if ($a -lt 20) { continue }
      $lum = ($r + $g + $b) / 3.0
      if ($lum -lt 70) { continue }
      $max = [Math]::Max($r, [Math]::Max($g, $b))
      $min = [Math]::Min($r, [Math]::Min($g, $b))
      $sat = if ($max -eq 0) { 0.0 } else { ($max - $min) / [double]$max }
      $isGreenSwoosh = ($g -ge $r - 4) -and ($g -gt $b + 2) -and ($sat -gt 0.14) -and ($g -gt 80)
      $isCyanSwoosh = ($b -gt $r + 4) -and ($b -ge $g - 10) -and ($sat -gt 0.14) -and ($b -gt 80)
      if ($isGreenSwoosh -or $isCyanSwoosh) { continue }
      $isLightNeutral = ($lum -gt 92) -and ($sat -lt 0.48)
      $isPaleWarm = ($r -gt 130) -and ($g -gt 95) -and ($sat -lt 0.58) -and ($lum -gt 100)
      if (-not ($isLightNeutral -or $isPaleWarm)) { continue }
      $t = [Math]::Min(1.0, [Math]::Max(0.0, ($lum - 80) / 175.0))
      $buf[$i] = [Math]::Min(255, [int]($blueBase[2] + $t * ($blueHi[2] - $blueBase[2])))
      $buf[$i + 1] = [Math]::Min(255, [int]($blueBase[1] + $t * ($blueHi[1] - $blueBase[1])))
      $buf[$i + 2] = [Math]::Min(255, [int]($blueBase[0] + $t * ($blueHi[0] - $blueBase[0])))
      $buf[$i + 3] = 255
    }
  }

  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $idx = $y * $w + $x
      if ($mask[$idx]) { continue }
      $i = $y * $stride + $x * 4
      $b = $buf[$i]; $g = $buf[$i + 1]; $r = $buf[$i + 2]; $a = $buf[$i + 3]
      if ($a -lt 20) { continue }
      $max = [Math]::Max($r, [Math]::Max($g, $b))
      $min = [Math]::Min($r, [Math]::Min($g, $b))
      $sat = if ($max -eq 0) { 0.0 } else { ($max - $min) / [double]$max }
      $isGreenSwoosh = ($g -ge $r - 4) -and ($g -gt $b + 2) -and ($sat -gt 0.14) -and ($g -gt 80)
      $isCyanSwoosh = ($b -gt $r + 4) -and ($b -ge $g - 10) -and ($sat -gt 0.14) -and ($b -gt 80)
      if ($isGreenSwoosh -or $isCyanSwoosh) { continue }
      $isNearWhite = ($r -gt 178) -and ($g -gt 178) -and ($b -gt 178) -and (($max - $min) -lt 55)
      if (-not $isNearWhite) { continue }
      $lum = ($r + $g + $b) / 3.0
      $t = [Math]::Min(1.0, [Math]::Max(0.0, ($lum - 80) / 175.0))
      $buf[$i] = [Math]::Min(255, [int]($blueBase[2] + $t * ($blueHi[2] - $blueBase[2])))
      $buf[$i + 1] = [Math]::Min(255, [int]($blueBase[1] + $t * ($blueHi[1] - $blueBase[1])))
      $buf[$i + 2] = [Math]::Min(255, [int]($blueBase[0] + $t * ($blueHi[0] - $blueBase[0])))
      $buf[$i + 3] = 255
    }
  }

  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $bytes)
  $bmp.UnlockBits($data)
  $bmp.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

function Add-RoundedRect($path, $x, $y, $w, $h, $r) {
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
}

function Save-MarkIcon([string]$shuttlePath, [int]$size, [string]$outPath) {
  $shuttle = [System.Drawing.Image]::FromFile($shuttlePath)
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $bg = [System.Drawing.ColorTranslator]::FromHtml($bgHex)
  $radius = [Math]::Max(2, [int]($size * $radiusRatio))
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect $path 0 0 $size $size $radius
  $g.FillPath((New-Object System.Drawing.SolidBrush $bg), $path)
  $pad = 0
  $inner = $size
  $scale = [Math]::Min($inner / $shuttle.Width, $inner / $shuttle.Height)
  $w = [int]($shuttle.Width * $scale)
  $h = [int]($shuttle.Height * $scale)
  $x = [int](($size - $w) / 2)
  $y = [int](($size - $h) / 2)
  $g.DrawImage($shuttle, $x, $y, $w, $h)
  $g.Dispose(); $path.Dispose(); $shuttle.Dispose()
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

Remove-Background $src (Join-Path $root 'logo-shuttle-raw.png')
Crop-ToContent (Join-Path $root 'logo-shuttle-raw.png') (Join-Path $root 'logo-shuttle-crop.png')
Recolor-Logo (Join-Path $root 'logo-shuttle-crop.png') (Join-Path $root 'logo-shuttle-colored.png')
Crop-ToContent (Join-Path $root 'logo-shuttle-colored.png') $shuttle 0
Remove-Item (Join-Path $root 'logo-shuttle-raw.png'), (Join-Path $root 'logo-shuttle-crop.png'), (Join-Path $root 'logo-shuttle-colored.png') -ErrorAction SilentlyContinue
foreach ($item in @(
  @{ size = 512; name = 'icon-512.png' },
  @{ size = 192; name = 'icon-192.png' },
  @{ size = 180; name = 'icon-180.png' },
  @{ size = 32;  name = 'icon-32.png' },
  @{ size = 16;  name = 'icon-16.png' },
  @{ size = 80;  name = 'logo-mark.png' },
  @{ size = 512; name = 'logo-hero.png' }
)) {
  Save-MarkIcon $shuttle $item.size (Join-Path $root $item.name)
}

$icon32 = Join-Path $root 'icon-32.png'
$favicon = Join-Path (Join-Path $PSScriptRoot '..') 'favicon.ico'
$bmp32 = [System.Drawing.Bitmap]::FromFile($icon32)
$icon = [System.Drawing.Icon]::FromHandle($bmp32.GetHicon())
$stream = [System.IO.File]::Create($favicon)
$icon.Save($stream)
$stream.Close()
$icon.Dispose()
$bmp32.Dispose()

Write-Host 'Logo assets built.'

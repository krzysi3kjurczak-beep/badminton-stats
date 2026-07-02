Add-Type -AssemblyName System.Drawing

$root = Join-Path $PSScriptRoot '..\icons'
$src = Join-Path $root 'tab-matches-src.png'
$out = Join-Path $root 'tab-matches.png'

function Remove-WhiteBackground([string]$srcPath, [string]$dstPath) {
  $srcBmp = [System.Drawing.Bitmap]::FromFile($srcPath)
  $bmp = New-Object System.Drawing.Bitmap $srcBmp.Width, $srcBmp.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
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
      if ($a -lt 20) { $buf[$i + 3] = 0; continue }
      $max = [Math]::Max($r, [Math]::Max($g, $b))
      $min = [Math]::Min($r, [Math]::Min($g, $b))
      $sat = if ($max -eq 0) { 0.0 } else { ($max - $min) / [double]$max }
      $lum = ($r + $g + $b) / 3.0
      $transparent = ($lum -gt 248) -or ($lum -gt 236 -and $sat -lt 0.05)
      if ($transparent) {
        $buf[$i] = 0; $buf[$i + 1] = 0; $buf[$i + 2] = 0; $buf[$i + 3] = 0
      } else {
        $buf[$i] = 0; $buf[$i + 1] = 0; $buf[$i + 2] = 0; $buf[$i + 3] = 255
      }
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
  $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  $g.DrawImage($bmp, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), (New-Object System.Drawing.Rectangle $minX, $minY, $w, $h), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $bmp.Dispose()
  $crop.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
}

$tmp = Join-Path $root 'tab-matches-tmp.png'
Remove-WhiteBackground $src $tmp
Crop-ToContent $tmp $out 4
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
Write-Host "Saved $out"

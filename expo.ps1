# ============================================================
#  EXPO 3.0 - StationSpace (MINIMO)
#  Doble clic en "EXPO - Desplegar Todo.bat" y hace 2 cosas:
#   1. Genera y abre el CODIGO QR de la web global (local, sin internet)
#   2. Abre la PAGINA WEB GLOBAL en el navegador
#  La web del chip (estacion) la muestras con el celular en la IP del OLED.
# ============================================================

$ErrorActionPreference = 'Continue'
$base = "C:\Users\Alejandro\Downloads\StationSpace"
$py = Join-Path $base "venv\Scripts\python.exe"
$nube = "https://stationspace.onrender.com"
$Host.UI.RawUI.WindowTitle = "EXPO - Estacion Ambiental"

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  EXPO 3.0 - STATIONSPACE" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# 1) QR de la web global (generado LOCAL con python; si falla, por internet)
# ------------------------------------------------------------
$qr = Join-Path $env:TEMP "qr_nube.png"
$ok = $false
try {
    & $py -c "import qrcode; q = qrcode.QRCode(box_size=14, border=4); q.add_data('$nube'); q.make(fit=True); q.make_image().save(r'$qr')"
    if ((Test-Path $qr) -and ((Get-Item $qr).Length -gt 300)) { Start-Process $qr; $ok = $true }
} catch {}
if (-not $ok) {
    try {
        Invoke-WebRequest -Uri ("https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=" + [uri]::EscapeDataString($nube)) -OutFile $qr -TimeoutSec 15 -UseBasicParsing
        if ((Test-Path $qr) -and ((Get-Item $qr).Length -gt 300)) { Start-Process $qr; $ok = $true }
    } catch {}
}
if ($ok) {
    Write-Host "  [OK] CODIGO QR de la web global generado y abierto." -ForegroundColor Magenta
} else {
    Write-Host "  QR no generado. Escriba la URL en pantalla: $nube" -ForegroundColor DarkYellow
}

# ------------------------------------------------------------
# 2) Abrir la web global
# ------------------------------------------------------------
Start-Process $nube
Write-Host "  [OK] Web global abierta: $nube" -ForegroundColor Green
Write-Host ""

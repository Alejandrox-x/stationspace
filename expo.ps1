# ============================================================
#  EXPO 2.0 - Despliegue MINIMO StationSpace
#  Doble clic en "EXPO - Desplegar Todo.bat" y hace SOLO esto:
#   1. Sube el servidor local (Flask + SQLite) en ventana minimizada
#   2. Encuentra el ESP32 (candidatos + barrido rapido ~10 s) y abre SU web
#   3. Abre la pagina web en PORTADA (sin pestaña de inicio de sesion)
#   4. Despierta la nube (para que el QR de invitados cargue rapido)
#   5. Genera y abre los 2 CODIGOS QR: invitados (NUBE) + estacion
#  Apagar todo: cerrar la ventana minimizada del servidor.
# ============================================================

$ErrorActionPreference = 'Continue'
$base = "C:\Users\Alejandro\Downloads\StationSpace"
$archIP = Join-Path $base "ip_esp32.txt"
$nube = "https://stationspace.onrender.com"
$Host.UI.RawUI.WindowTitle = "EXPO - Estacion Ambiental"

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  EXPO 2.0 - STATIONSPACE - DESPLIEGUE MINIMO" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# 0. IP actual del PC (solo para el barrido)
# ------------------------------------------------------------
$ipLocal = $null
try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -like '*.*' }
    $ipLocal = ($ips | Select-Object -First 1).IPAddress
} catch {}
if (-not $ipLocal) { $ipLocal = "192.168.18.10" }
$o = $ipLocal.Split('.')
$prefijo = "$($o[0]).$($o[1]).$($o[2])."
Write-Host "PC en red: $ipLocal" -ForegroundColor Gray

function Probar-ESP($ip) {
    if (-not $ip) { return $false }
    try {
        $r = Invoke-WebRequest ("http://" + $ip + "/json") -UseBasicParsing -TimeoutSec 2
        if ($r.Content -match 'temperatura' -and $r.Content -match 'humedad') { return $true }
    } catch {}
    return $false
}

# ------------------------------------------------------------
# 1. Servidor local (Flask + SQLite)
# ------------------------------------------------------------
Write-Host ""
Write-Host "[1/4] Servidor local..." -ForegroundColor Yellow
$py = Join-Path $base "venv\Scripts\python.exe"
$tcp = New-Object System.Net.Sockets.TcpClient
$ya = $false
try {
    $t = $tcp.BeginConnect("127.0.0.1", 5000, $null, $null)
    if ($t.AsyncWaitHandle.WaitOne(500) -and $tcp.Connected) { $ya = $true }
    $tcp.Close()
} catch {}
if ($ya) {
    Write-Host "      Ya estaba arriba. OK." -ForegroundColor Green
} elseif (Test-Path $py) {
    Start-Process -FilePath $py -ArgumentList "backend\app.py" -WorkingDirectory $base -WindowStyle Minimized
    for ($i = 0; $i -lt 10 -and -not $ya; $i++) {
        Start-Sleep 1
        $tcp2 = New-Object System.Net.Sockets.TcpClient
        try {
            $t2 = $tcp2.BeginConnect("127.0.0.1", 5000, $null, $null)
            if ($t2.AsyncWaitHandle.WaitOne(400) -and $tcp2.Connected) { $ya = $true }
            $tcp2.Close()
        } catch {}
    }
    Write-Host "      Arrancado (ventana MINIMIZADA: no cerrar hasta el final)." -ForegroundColor Green
} else {
    Write-Host "      No encontre el python del venv. La portada local puede fallar." -ForegroundColor Red
}

# ------------------------------------------------------------
# 2. ESP32: candidatos rapidos + barrido de la red (~10 s)
# ------------------------------------------------------------
Write-Host ""
Write-Host "[2/4] Buscando el ESP32 (rapido)..." -ForegroundColor Yellow
$ipEsp = $null
# a) ultima IP conocida saved + AP fijo del chip
if (Test-Path $archIP) {
    $ultima = (Get-Content $archIP -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
    if ($ultima -and (Probar-ESP $ultima)) { $ipEsp = $ultima }
}
if (-not $ipEsp -and (Probar-ESP "192.168.4.1")) { $ipEsp = "192.168.4.1" }
# b) barrido rapido del /24 del PC
if (-not $ipEsp) {
    $pyScan = $py
    if (-not (Test-Path $pyScan)) { $pyScan = "python" }
    $salida = (& $pyScan (Join-Path $base "barrido_esp.py") $prefijo) 2>$null
    $hallado = ($salida | Where-Object { $_ -match '^\d+\.\d+\.\d+\.\d+$' } | Select-Object -First 1)
    if ($hallado) { $ipEsp = $hallado }
}
if ($ipEsp) {
    Write-Host "      ESTACION VIVA en http://$ipEsp" -ForegroundColor Green
    Set-Content -Path $archIP -Value $ipEsp -ErrorAction SilentlyContinue
    Start-Process ("http://" + $ipEsp)   # web del ESP32 (anillos)
} else {
    Write-Host "      No visible ahora (chip apagado o red con aislamiento)." -ForegroundColor DarkYellow
    Write-Host "      La nube sigue sirviendo los datos y ya se usara AP del chip si hace falta." -ForegroundColor DarkYellow
}

# ------------------------------------------------------------
# 3. Pagina web local (portada) + despertar la nube
# ------------------------------------------------------------
Write-Host ""
Write-Host "[3/4] Abriendo la web local (portada) y despertando la nube..." -ForegroundColor Yellow
Start-Process "http://localhost:5000"
try {
    Invoke-WebRequest -Uri ($nube + "/salud") -UseBasicParsing -TimeoutSec 60 | Out-Null
    Write-Host "      Nube despierta. El QR de invitados cargara al toque." -ForegroundColor Green
} catch {
    Write-Host "      Nube no respondio ya: el primer escaneo del QR puede tardar ~40 s." -ForegroundColor DarkYellow
}

# ------------------------------------------------------------
# 4. Codigos QR (2)
# ------------------------------------------------------------
Write-Host ""
Write-Host "[4/4] Codigos QR..." -ForegroundColor Yellow
# QR invitados -> NUBE (funciona desde cualquier red)
$qrA = Join-Path $env:TEMP "qr_nube.png"
try {
    Invoke-WebRequest -Uri ("https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" + [uri]::EscapeDataString($nube)) -OutFile $qrA -TimeoutSec 25 -UseBasicParsing
    if ((Get-Item $qrA).Length -gt 300) { Start-Process $qrA; Write-Host "      QR INVITADOS (nube) abierto." -ForegroundColor Magenta }
} catch { Write-Host "      (sin internet para el QR: mostrar URL escrita)" -ForegroundColor DarkGray }
# QR estacion -> IP real del chip si responde
if ($ipEsp) {
    $qrB = Join-Path $env:TEMP "qr_esp32.png"
    try {
        Invoke-WebRequest -Uri ("https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" + [uri]::EscapeDataString("http://" + $ipEsp)) -OutFile $qrB -TimeoutSec 25 -UseBasicParsing
        if ((Get-Item $qrB).Length -gt 300) { Start-Sleep 1; Start-Process $qrB; Write-Host "      QR ESTACION abierto." -ForegroundColor Magenta }
    } catch {}
} else {
    Start-Sleep -Milliseconds 300
}

# ------------------------------------------------------------
# RESUMEN
# ------------------------------------------------------------
Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  LISTO - RESUMEN DE LA EXPO" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Web local    : http://localhost:5000 (portada; login cuando la pidan)"
Write-Host " Panel nube   : $nube/dashboard  |  usuario: expo@stationspace.local  clave: expo2026"
if ($ipEsp) {
    Write-Host (" Estacion     : http://" + $ipEsp + "  (anillos en vivo, sin login)")
} else {
    Write-Host " Estacion     : no visible en esta red"
}
Write-Host ""
Write-Host " APAGAR TODO: cerrar la ventana MINIMIZADA del servidor." -ForegroundColor Yellow
Write-Host ""

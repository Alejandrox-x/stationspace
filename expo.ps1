# ============================================================
#  EXPO - Despliegue automatico Estacion Ambiental IoT
#  Doble clic en "EXPO - Desplegar Todo.bat" y listo.
#  Que hace:
#   1. Levanta el servidor local StationSpace (Flask + SQLite)
#   2. Busca el ESP32 en la red actual y abre su pagina web
#   3. Despierta la nube de Render (stationspace.onrender.com)
#   4. Abre todo en el navegador
# ============================================================

$ErrorActionPreference = 'Continue'
$base = "C:\Users\Alejandro\Downloads\StationSpace"
$archIP = Join-Path $base "ip_esp32.txt"
$Host.UI.RawUI.WindowTitle = "EXPO - Estacion Ambiental"

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  EXPO - ESTACION AMBIENTAL IoT - DESPLIEGUE AUTOMATICO" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# 0. Detectar red actual (WiFi o cable)
# ------------------------------------------------------------
$ipLocal = $null
try {
    $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.IPAddress -like '*.*' }
    $ipLocal = ($ips | Select-Object -First 1).IPAddress
} catch {}
if (-not $ipLocal) { $ipLocal = "192.168.18.10" }
$octetos = $ipLocal.Split('.')
$prefijo = "$($octetos[0]).$($octetos[1]).$($octetos[2])."
$ssid = "?"
try {
    $lineas = netsh wlan show interfaces | Select-String '^\s*SSID\s+:'
    foreach ($l in $lineas) {
        $v = ($l.Line -replace '^\s*SSID\s+:\s*','').Trim()
        if ($v -ne '') { $ssid = $v; break }
    }
    if ($ssid -eq "?") { $ssid = "CABLE/OTRA" }
} catch {}
Write-Host "PC en red: IP $ipLocal  |  WiFi: $ssid" -ForegroundColor Gray
Write-Host ""

# ------------------------------------------------------------
# 1. Servidor local StationSpace (ya incluye base de datos SQLite)
# ------------------------------------------------------------
Write-Host "[1/3] Levantando servidor local StationSpace (Flask + SQLite)..." -ForegroundColor Yellow
$py = Join-Path $base "venv\Scripts\python.exe"
$abre5000 = $false
$tcp5000 = New-Object System.Net.Sockets.TcpClient
try { $r5 = $tcp5000.BeginConnect("127.0.0.1", 5000, $null, $null); if ($r5.AsyncWaitHandle.WaitOne(600) -and $tcp5000.Connected) { $abre5000 = $true } } catch {}
try { $tcp5000.Close() } catch {}

if ($abre5000) {
    Write-Host "      Servidor local YA estaba corriendo en puerto 5000. OK." -ForegroundColor Green
} elseif (Test-Path $py) {
    Start-Process -FilePath $py -ArgumentList "backend\app.py" -WorkingDirectory $base -WindowStyle Minimized
    Write-Host "      Servidor arrancado (ventana minimizada). Esperando..." -ForegroundColor Green
    Start-Sleep -Seconds 6
} else {
    Write-Host "      AVISO: no existe venv en StationSpace. La version local no arrancara." -ForegroundColor Red
    Write-Host "             (la nube de Render si funcionara igual)" -ForegroundColor Yellow
}

# ------------------------------------------------------------
# 2. Buscar la estacion ESP32 en esta red y abrir su pagina
# ------------------------------------------------------------
Write-Host "[2/3] Buscando la estacion ESP32 en la red..." -ForegroundColor Yellow

# Caso especial: PC conectado a la red propia del ESP32 (AP)
if ($ssid -like "*EstacionAmbientalIoT*") {
    Write-Host "      PC conectado a la red propia del ESP32 -> http://192.168.4.1" -ForegroundColor Green
    Start-Process "http://192.168.4.1"
    Set-Content -Path $archIP -Value "192.168.4.1"
    $ipEsp = "192.168.4.1"
}

if (-not $ipEsp) {
    $ipEsp = $null
    $maxRondas = 4
    for ($r = 1; $r -le $maxRondas -and -not $ipEsp; $r++) {
        if ($r -gt 1) {
            Write-Host "      Ronda $r de busqueda (el ESP32 tarda ~1 min en conectar a la WiFi)..." -ForegroundColor DarkGray
            Start-Sleep -Seconds 10
        }
        # Intento directo por nombre (funciona si esta activo el resolver mDNS)
        try {
            $dns = Resolve-DnsName "estacion.local" -ErrorAction SilentlyContinue
            if ($dns -and $dns.IPAddress) { $ipEsp = $dns[0].IPAddress }
        } catch {}
        if ($ipEsp) { break }

        # Barrido de la subred: ping + puerto 80 + verificacion /json
        $tasks = 1..254 | ForEach-Object { (New-Object System.Net.NetworkInformation.Ping).SendPingAsync("$prefijo$_", 200) }
        [void][System.Threading.Tasks.Task]::WaitAll($tasks, 4000)
        for ($i = 0; $i -lt 254; $i++) {
            if ($tasks[$i].Result.Status -ne 'Success') { continue }
            $ip = "$prefijo$($i+1)"
            if ($ip -eq $ipLocal) { continue }
            $tc = New-Object System.Net.Sockets.TcpClient
            $es80 = $false
            try {
                $rr = $tc.BeginConnect($ip, 80, $null, $null)
                if ($rr.AsyncWaitHandle.WaitOne(500) -and $tc.Connected) { $es80 = $true }
            } catch {}
            try { $tc.Close() } catch {}
            if (-not $es80) { continue }
            try {
                $j = Invoke-WebRequest -Uri "http://$ip/json" -TimeoutSec 3 -UseBasicParsing
                if ($j.Content -match 'temperatura' -and $j.Content -match 'humedad') { $ipEsp = $ip }
            } catch {}
            if ($ipEsp) { break }
        }
    }
}

if ($ipEsp) {
    Write-Host "      ESTACION ENCONTRADA en http://$ipEsp  -> abriendo navegador" -ForegroundColor Green
    Set-Content -Path $archIP -Value $ipEsp
    Start-Process "http://$ipEsp"
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:5000"
} else {
    Write-Host "      NO se encontro la estacion en la red '$ssid'." -ForegroundColor Red
    if (Test-Path $archIP) {
        $vieja = (Get-Content $archIP -ErrorAction SilentlyContinue).Trim()
        if ($vieja -match '^\d') {
            Write-Host "      Ultima IP conocida (en otra red): $vieja" -ForegroundColor Yellow
            Write-Host "      Prueba manualmente: http://$vieja (en tu red de casa)" -ForegroundColor Yellow
        }
    }
    Write-Host "      Posibles causas y que decir si preguntan:" -ForegroundColor Yellow
    Write-Host "      - El ESP32 aun se esta conectando: espera 1 min y vuelve a correr este script."
    Write-Host "      - La WiFi del lugar tiene 'aislamiento de clientes' (bloquea ver al ESP32):"
    Write-Host "        entonces la estacion SI empuja datos a la nube -> usa el dashboard de la nube."
    Start-Process "http://localhost:5000"
}

# ------------------------------------------------------------
# 3. Despertar la nube de Render (por si estaba dormida)
# ------------------------------------------------------------
Write-Host "[3/3] Despertando la nube (Render puede tardar ~40-60 s la primera vez)..." -ForegroundColor Yellow
try {
    $nube = Invoke-WebRequest -Uri "https://stationspace.onrender.com/salud" -TimeoutSec 90 -UseBasicParsing
    Write-Host "      Nube RESPONDIENDO: $($nube.Content)" -ForegroundColor Green
    Start-Sleep -Seconds 2
    Start-Process "https://stationspace.onrender.com/dashboard"
} catch {
    Write-Host "      La nube no respondio todavia (se despierta sola, reintenta en 1 min)." -ForegroundColor Yellow
    Write-Host "      URL nube: https://stationspace.onrender.com/dashboard" -ForegroundColor Yellow
}

# ------------------------------------------------------------
# Resumen final
# ------------------------------------------------------------
Write-Host ""
Write-Host ">>> PARA LOS INVITADOS (celular o PC, escaneen los QR en pantalla):" -ForegroundColor Magenta
Write-Host "    Web y panel  : https://stationspace.onrender.com   (NUBE, funciona desde cualquier red)" -ForegroundColor Magenta
Write-Host "                   usuario: expo@stationspace.local   clave: expo2026" -ForegroundColor Magenta
if ($ipEsp) { Write-Host ("    Estacion     : http://" + $ipEsp + "   (sensores en vivo del ESP32, sin login)") -ForegroundColor Magenta }
$qr = Join-Path $env:TEMP "qr_expo.png"
try {
    Invoke-WebRequest -Uri ("https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=https%3A%2F%2Fstationspace.onrender.com") -OutFile $qr -TimeoutSec 25 -UseBasicParsing
    if ((Get-Item $qr).Length -gt 300) { Start-Process $qr; Write-Host "    (QR del PANEL automatico para invitados)" -ForegroundColor DarkMagenta }
    if ($ipEsp) {
        $qr2 = Join-Path $env:TEMP "qr_esp32.png"
        Invoke-WebRequest -Uri ("https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=http%3A%2F%2F" + $ipEsp) -OutFile $qr2 -TimeoutSec 25 -UseBasicParsing
        if ((Get-Item $qr2).Length -gt 300) { Start-Sleep 1; Start-Process $qr2 }
    }
} catch { Write-Host "    (sin QR automatico: muestra la URL escrita de arriba)" -ForegroundColor DarkGray }
Start-Sleep 2
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  DESPLIEGUE COMPLETO - RESUMEN PARA LA EXPO" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Local StationSpace : http://localhost:5000   (Flask + base SQLite)"
if ($ipEsp) {
    Write-Host " Estacion ESP32     : http://${ipEsp} (dashboard sensores en vivo)"
} else {
    Write-Host " Estacion ESP32     : no encontrada en esta red (ver avisos arriba)"
}
Write-Host " Nube Render        : https://stationspace.onrender.com/dashboard (base Postgres + bot IA)"
Write-Host ""
Write-Host " El servidor local queda en una ventana MINIMIZADA."
Write-Host " Para APAGAR TODO al final: cierra esa ventana minimizada."
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

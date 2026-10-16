# StationSpace — Fase 1 (local)

Web con login + SQLite + bot. La estación empuja lecturas por POST.

## Arrancar
Doble clic `iniciar.bat` (crea venv e instala Flask solo la primera vez).
Abrir `http://TU-PC:5000` (esta máquina: `http://192.168.18.10:5000`).

## Estación
En `config.h` del ESP32:
```cpp
const char* API_URL = "http://192.168.18.10:5000/api/lectura";
const char* API_TOKEN = "bf15af76d7c47b85d7f23904bb23e1d4";
```
Empuja cada 5 min solo en modo STA.

## Archivos con secretos (NO subir a GitHub)
- `backend/.env` (SECRET_KEY, API_TOKEN, NVIDIA_API_KEY)
- `EstacionAmbientalIoT/config.h`

## Rutas
- `/` inicio, `/registro`, `/login`, `/dashboard` (con cuenta)
- `/api/ultima`, `/api/historial?horas=24`, `/api/chat` (con cuenta)
- `POST /api/lectura` (cabecera `X-API-Token`)

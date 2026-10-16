@echo off
cd /d "%~dp0"
if not exist venv\Scripts\python.exe (
  echo Creando entorno virtual...
  py -m venv venv
  venv\Scripts\python.exe -m pip install -r backend\requirements.txt
)
echo.
echo Arrancando servidor StationSpace...
start "StationSpace servidor" /min venv\Scripts\python.exe backend\app.py
timeout /t 7 /nobreak >nul
start http://192.168.18.10:5000
echo Listo: se abrio la web. El servidor quedo en una ventana minimizada.
echo Para apagarlo, cierra esa ventana.

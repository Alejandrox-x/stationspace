# StationSpace Fase 2 — Subir a nube gratis (Render)

Ya dejé el código listo: `app.py` usa SQLite en local y Postgres en nube solo, `ESP32` ya soporta `https://`.

## 1. Subir a GitHub (sin secretos)
En `Downloads/StationSpace`:
```
git init
git add Procfile render.yaml backend/requirements.txt backend/app.py backend/.env.example database/schema.sql database/schema_pg.sql frontend/ .gitignore
git commit -m "StationSpace fase 2 nube"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/stationspace.git
git push -u origin main
```
NO subas `backend/.env` ni `database/estacion.db` (ya los bloquea `.gitignore`).

## 2. Crear servicio en Render
1. Entra a render.com con GitHub.
2. `New +` > `Blueprint` > elige repo `stationspace`.
3. Render crea 2 cosas: web `stationspace` + base `stationspace-db` (plan free).
4. En web > `Environment`, pon:
   - `NVIDIA_API_KEY` = tu key de build.nvidia.com
   - `AI_MODEL` = openai/gpt-oss-20b (ya viene)
   - `SECRET_KEY` y `API_TOKEN` se generan solos, no los toques.
   - `DATABASE_URL` la pone sola desde la base.
5. `Deploy`. Primera vez tarda 3-5 min. Prueba: `https://TU-APP.onrender.com/salud` debe dar `{"ok":true,"nube":true}`.

Nota free: si nadie entra en 15 min se duerme y la primera carga tarda ~40s. Normal. La base NO se borra.

## 3. Conectar ESP32 a la nube
1. En Render web > `Environment`, copia `API_TOKEN`.
2. En Arduino, `config.h`:
```cpp
const char* API_URL = "https://TU-APP.onrender.com/api/lectura";
const char* API_TOKEN = "pega-aqui-el-mismo-de-Render";
```
3. Sube el `.ino` (ya trae soporte https con `setInsecure()`).
4. En casa/colegio con WiFi STA, el ESP32 empuja cada 5 min. Revisa Serial: `Push nube: 200`.

## 4. Probar de punta a punta
1. `https://TU-APP.onrender.com/registro` crea cuenta, entra a `/dashboard`.
2. Espera 5 min o reinicia ESP32 para forzar push.
3. `/api/ultima` debe mostrar la lectura. `/api/chat` pregunta "hay alerta?".

Si `/salud` dice `nube:false`, falta `DATABASE_URL` (revisa que la base esté `Available` y la web enlazada).

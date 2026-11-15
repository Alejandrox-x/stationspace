"""StationSpace Fase 2: Flask + SQLite local / Postgres nube + login + bot."""
import csv
import io
import json
import os
import threading
import time
from datetime import datetime, timedelta
import sqlite3
import urllib.request
import urllib.error
from functools import wraps

from flask import Flask, Response, g, jsonify, redirect, render_template, request, session, url_for
from flask import stream_with_context
from werkzeug.security import check_password_hash, generate_password_hash

BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
DB = os.path.join(ROOT, "database", "estacion.db")
SCHEMA_SQLITE = os.path.join(ROOT, "database", "schema.sql")
SCHEMA_PG = os.path.join(ROOT, "database", "schema_pg.sql")
TPL = os.path.join(ROOT, "frontend", "templates")
STA = os.path.join(ROOT, "frontend", "static")


def load_env():
    p = os.path.join(BASE, ".env")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())


load_env()
app = Flask(__name__, template_folder=TPL, static_folder=STA)
# Sin caché agresiva de CSS/JS: el navegador siempre revalida (ETag 304).
# Así los cambios se ven al refrescar normal, sin Ctrl+F5 ni versiones a mano.
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0


@app.context_processor
def version_estatica():
    """?v=fecha de modificación del archivo: si cambia el archivo, cambia la
    URL, y el navegador nunca sirve una copia vieja (local y en Render)."""
    def v(nombre):
        try:
            return int(os.path.getmtime(os.path.join(STA, nombre)))
        except OSError:
            return 0
    return {"v": v}
app.secret_key = os.environ.get("SECRET_KEY", "cambia-esto")
API_TOKEN = os.environ.get("API_TOKEN", "")
NVIDIA_API_KEY = os.environ.get("NVIDIA_API_KEY", "")
AI_MODEL = os.environ.get("AI_MODEL", "openai/gpt-oss-20b")
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
IS_PG = DATABASE_URL.startswith("postgres")

if IS_PG:
    import psycopg2
    import psycopg2.extras


def adapt(sql):
    return sql.replace("?", "%s") if IS_PG else sql


def db():
    if "db" not in g:
        if IS_PG:
            g.db = psycopg2.connect(DATABASE_URL, sslmode="require")
        else:
            os.makedirs(os.path.dirname(DB), exist_ok=True)
            g.db = sqlite3.connect(DB)
            g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_e=None):
    d = g.pop("db", None)
    if d is not None:
        d.close()


def fila(r):
    """Normaliza la fila: Postgres devuelve datetime en `ts`, el front espera texto."""
    d = dict(r)
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.strftime("%Y-%m-%d %H:%M:%S")
    return d


def q_one(sql, params=()):
    con = db()
    if IS_PG:
        cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(adapt(sql), params)
        r = cur.fetchone()
        cur.close()
        return fila(r) if r else None
    r = con.execute(sql, params).fetchone()
    return dict(r) if r else None


def q_all(sql, params=()):
    con = db()
    if IS_PG:
        cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(adapt(sql), params)
        rows = cur.fetchall()
        cur.close()
        return [fila(r) for r in rows]
    return [dict(r) for r in con.execute(sql, params).fetchall()]


def q_exec(sql, params=()):
    con = db()
    if IS_PG:
        cur = con.cursor()
        cur.execute(adapt(sql), params)
        con.commit()
        cur.close()
    else:
        con.execute(sql, params)
        con.commit()


def init_db():
    schema = SCHEMA_PG if IS_PG else SCHEMA_SQLITE
    with open(schema, encoding="utf-8") as f:
        sql = f.read()
    con = db()
    if IS_PG:
        cur = con.cursor()
        cur.execute(sql)
        con.commit()
        cur.close()
    else:
        con.executescript(sql)
        con.commit()


def migrar_columnas():
    """Agrega columnas nuevas a DBs que ya existen (SQLite local y Postgres nube)."""
    con = db()
    if IS_PG:
        cur = con.cursor()
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='lecturas'")
        cols = {r[0] for r in cur.fetchall()}
        for c, ddl in (("ruido_raw", "ALTER TABLE lecturas ADD COLUMN ruido_raw INTEGER"),
                       ("ruido_pct", "ALTER TABLE lecturas ADD COLUMN ruido_pct INTEGER")):
            if c not in cols:
                cur.execute(ddl)
        con.commit()
        cur.close()
    else:
        cur = con.execute("PRAGMA table_info(lecturas)")
        cols = {r[1] for r in cur.fetchall()}
        for c in ("ruido_raw", "ruido_pct"):
            if c not in cols:
                con.execute("ALTER TABLE lecturas ADD COLUMN " + c + " INTEGER")
        con.commit()


with app.app_context():
    init_db()
    migrar_columnas()


def login_required(fn):
    @wraps(fn)
    def w(*a, **kw):
        if "uid" not in session:
            return redirect(url_for("login"))
        return fn(*a, **kw)
    return w


@app.get("/favicon.ico")
def favicon():
    return ("", 204)


@app.get("/salud")
def salud():
    return jsonify({"ok": True, "nube": IS_PG})


@app.get("/")
def index():
    return render_template("index.html", user=session.get("nombre"))


@app.route("/registro", methods=["GET", "POST"])
def registro():
    err = ""
    if request.method == "POST":
        nombre = request.form.get("nombre", "").strip()[:60]
        email = request.form.get("email", "").strip().lower()[:120]
        pw = request.form.get("password", "")
        if not nombre or "@" not in email or len(pw) < 4:
            err = "Revisa los campos (clave minimo 4)."
        else:
            try:
                q_exec("INSERT INTO usuarios(nombre,email,hash) VALUES(?,?,?)",
                       (nombre, email, generate_password_hash(pw)))
                return redirect(url_for("login"))
            except Exception as e:
                msg = str(e).lower()
                if "unique" in msg or "duplicate" in msg:
                    err = "Ese correo ya tiene cuenta."
                else:
                    err = "Error guardando: " + str(e)[:120]
    return render_template("registro.html", err=err)


@app.route("/login", methods=["GET", "POST"])
def login():
    err = ""
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        pw = request.form.get("password", "")
        u = q_one("SELECT * FROM usuarios WHERE email=?", (email,))
        if u and check_password_hash(u["hash"], pw):
            session["uid"] = u["id"]
            session["nombre"] = u["nombre"]
            return redirect(url_for("dashboard"))
        err = "Correo o clave mal."
    return render_template("login.html", err=err)


@app.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


@app.get("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html", nombre=session.get("nombre"))


@app.get("/estadisticas")
@login_required
def estadisticas():
    return render_template("estadisticas.html", nombre=session.get("nombre"))


@app.get("/api/ultima")
@login_required
def api_ultima():
    r = q_one("SELECT * FROM lecturas ORDER BY id DESC LIMIT 1")
    return jsonify(r if r else {})


def nivel_de_estado(estado):
    """0 normal · 1 advertencia · 2 alerta · 3 sin lectura (derivado del texto)."""
    e = (estado or "").lower()
    if "alerta" in e or "fuga" in e:
        return 2
    if "advertencia" in e:
        return 1
    if "sin lectura" in e:
        return 3
    return 0


@app.get("/api/publica")
def api_publica():
    """Última lectura sin login: solo lo que se muestra en la portada."""
    r = q_one("SELECT temperatura,humedad,suelo_pct,lluvia_pct,estado,ts,ruido_pct"
              " FROM lecturas ORDER BY id DESC LIMIT 1")
    d = r if r else {}
    if d:
        d["nivel"] = nivel_de_estado(d.get("estado"))
    resp = jsonify(d)
    resp.headers["Cache-Control"] = "public, max-age=30"
    return resp


@app.get("/api/exportar")
@login_required
def api_exportar():
    """Historial completo como CSV en streaming (informes / tribunal)."""
    def gen():
        buf = io.StringIO()
        w = csv.writer(buf, lineterminator="\n")
        w.writerow(["id", "ts", "temperatura", "humedad", "suelo_raw", "lluvia_raw",
                    "suelo_pct", "lluvia_pct", "ruido_raw", "ruido_pct", "estado"])
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        con = db()
        sql = ("SELECT id,ts,temperatura,humedad,suelo_raw,lluvia_raw,"
               "suelo_pct,lluvia_pct,ruido_raw,ruido_pct,estado FROM lecturas ORDER BY id")
        if IS_PG:
            cur = con.cursor()
            cur.execute(sql, ())
        else:
            cur = con.execute(sql)
        n = 0
        for row in cur:
            w.writerow(["" if v is None else v for v in row])
            n += 1
            if n % 500 == 0:
                yield buf.getvalue()
                buf.seek(0)
                buf.truncate(0)
        yield buf.getvalue()
        if IS_PG:
            cur.close()
    nombre = "stationspace_%s.csv" % datetime.utcnow().strftime("%Y%m%d")
    return Response(stream_with_context(gen()), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=" + nombre})


def limpiar_lecturas():
    """Borra lecturas de mas de 60 dias: la DB nunca crece sin control."""
    try:
        if IS_PG:
            q_exec("DELETE FROM lecturas WHERE ts < now() - INTERVAL '60 days'")
        else:
            q_exec("DELETE FROM lecturas WHERE ts < datetime('now', ?)", ("-60 days",))
    except Exception:
        pass


def limpiador_periodico():
    while True:
        time.sleep(12 * 3600)
        with app.app_context():
            limpiar_lecturas()


threading.Thread(target=limpiador_periodico, daemon=True).start()

with app.app_context():
    limpiar_lecturas()


@app.get("/api/historial")
@login_required
def api_historial():
    try:
        horas = max(1, min(720, int(request.args.get("horas", 24))))
    except ValueError:
        horas = 24
    corte = (datetime.utcnow() - timedelta(hours=horas)).strftime("%Y-%m-%d %H:%M:%S")
    # Muestreo: 1 punto cada N lecturas (1/min). 24h -> todas; 7d -> cada 7;
    # 30d -> cada 30. Asi la respuesta pesa ~50 veces menos en 30 dias y el
    # navegador no se ahoga: el ojo no distingue puntos de 5 en 5 minutos.
    paso = max(1, horas // 24)
    rows = q_all("SELECT * FROM lecturas WHERE ts >= ? AND id % ? = 0 ORDER BY id",
                 (corte, paso))
    # El punto más reciente SIEMPRE entra (si el id no cayó en el muestreo).
    last = q_one("SELECT * FROM lecturas ORDER BY id DESC LIMIT 1")
    if last and (not rows or rows[-1]["id"] != last["id"]):
        rows.append(last)
    return jsonify(rows)


@app.post("/api/lectura")
def api_lectura():
    if not API_TOKEN or request.headers.get("X-API-Token") != API_TOKEN:
        return jsonify({"error": "token invalido"}), 401
    d = request.get_json(force=True, silent=True) or {}
    q_exec(
        "INSERT INTO lecturas(temperatura,humedad,suelo_raw,lluvia_raw,suelo_pct,lluvia_pct,"
        "ruido_raw,ruido_pct,estado)"
        " VALUES(?,?,?,?,?,?,?,?,?)",
        (d.get("temperatura"), d.get("humedad"), d.get("suelo_raw"), d.get("lluvia_raw"),
         d.get("suelo_pct"), d.get("lluvia_pct"), d.get("ruido_raw"), d.get("ruido_pct"),
         str(d.get("estado", ""))[:60]))
    return jsonify({"ok": True})


def preguntar_ia(pregunta, ctx):
    if not NVIDIA_API_KEY:
        return "Bot sin key NVIDIA en el servidor (.env)."
    body = json.dumps({
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": "Eres el Asistente StationSpace: la IA con la que conversa una familia desde su casa equipada con una estacion ambiental IoT. Eres amable, cercano y natural, como ChatGPT, pero miras la casa: puedes responder de casi todo (saludos, dudas, tareas, curiosidad general) y, cuando encaje, usas tu vista de los sensores: DHT11 clima, YL-69 humedad del terreno (detecta filtraciones y fugas) y placa roja lluvia en el techo. No tienes actuadores (no riegas ni apagas cosas). Si preguntan de la casa usa los datos; si es otro tema, responde con confianza e invita a volver a lo de la casa. Espanol con emojis en proporcion, maximo 5 lineas. " + ctx},
            {"role": "user", "content": pregunta[:300]},
        ],
        "temperature": 0.4, "max_tokens": 320}).encode()
    req = urllib.request.Request("https://integrate.api.nvidia.com/v1/chat/completions",
                                 data=body, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + NVIDIA_API_KEY})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            j = json.loads(r.read().decode())
        msg = (j.get("choices") or [{}])[0].get("message", {})
        return (msg.get("content") or "").strip()[:600] or "El modelo no respondio."
    except urllib.error.HTTPError as e:
        return {401: "Key NVIDIA invalida.", 404: "Modelo no habilitado."}.get(e.code, f"NVIDIA devolvio {e.code}.")
    except Exception:
        return "No pude contactar a NVIDIA."


@app.post("/api/chat")
@login_required
def api_chat():
    d = request.get_json(force=True, silent=True) or {}
    pregunta = str(d.get("pregunta", ""))[:300]
    if not pregunta.strip():
        return jsonify({"respuesta": "Escribe una pregunta."})
    r = q_one("SELECT * FROM lecturas ORDER BY id DESC LIMIT 1")
    if r:
        ctx = (f"Datos actuales de los sensores: T={r['temperatura']}C, H={r['humedad']}%, "
               f"suelo_raw={r['suelo_raw']}, lluvia_raw={r['lluvia_raw']}, "
               f"estado={r['estado']}. "
               "Usa estos datos solo si son utiles para la respuesta.")
    else:
        ctx = "Aun no hay lecturas de la estacion."
    return jsonify({"respuesta": preguntar_ia(pregunta, ctx)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))

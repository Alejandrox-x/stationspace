"""StationSpace Fase 2: Flask + SQLite local / Postgres nube + login + bot."""
import json
import os
from datetime import datetime, timedelta
import sqlite3
import urllib.request
import urllib.error
from functools import wraps

from flask import Flask, g, jsonify, redirect, render_template, request, session, url_for
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


def q_one(sql, params=()):
    con = db()
    if IS_PG:
        cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(adapt(sql), params)
        r = cur.fetchone()
        cur.close()
        return dict(r) if r else None
    r = con.execute(sql, params).fetchone()
    return dict(r) if r else None


def q_all(sql, params=()):
    con = db()
    if IS_PG:
        cur = con.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(adapt(sql), params)
        rows = cur.fetchall()
        cur.close()
        return [dict(r) for r in rows]
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


with app.app_context():
    init_db()


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


@app.get("/api/ultima")
@login_required
def api_ultima():
    r = q_one("SELECT * FROM lecturas ORDER BY id DESC LIMIT 1")
    return jsonify(r if r else {})


@app.get("/api/historial")
@login_required
def api_historial():
    try:
        horas = max(1, min(168, int(request.args.get("horas", 24))))
    except ValueError:
        horas = 24
    corte = (datetime.utcnow() - timedelta(hours=horas)).strftime("%Y-%m-%d %H:%M:%S")
    rows = q_all("SELECT * FROM lecturas WHERE ts >= ? ORDER BY id", (corte,))
    return jsonify(rows)


@app.post("/api/lectura")
def api_lectura():
    if not API_TOKEN or request.headers.get("X-API-Token") != API_TOKEN:
        return jsonify({"error": "token invalido"}), 401
    d = request.get_json(force=True, silent=True) or {}
    q_exec(
        "INSERT INTO lecturas(temperatura,humedad,suelo_raw,lluvia_raw,suelo_pct,lluvia_pct,estado)"
        " VALUES(?,?,?,?,?,?,?)",
        (d.get("temperatura"), d.get("humedad"), d.get("suelo_raw"), d.get("lluvia_raw"),
         d.get("suelo_pct"), d.get("lluvia_pct"), str(d.get("estado", ""))[:60]))
    return jsonify({"ok": True})


def preguntar_ia(pregunta, ctx):
    if not NVIDIA_API_KEY:
        return "Bot sin key NVIDIA en el servidor (.env)."
    body = json.dumps({
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": "Eres el Asistente StationSpace: la IA con la que conversa una familia desde su casa equipada con una estacion ambiental IoT. Eres amable, cercano y natural, como ChatGPT, pero miras la casa: puedes responder de casi todo (saludos, dudas, tareas, curiosidad general) y, cuando encaje, usas tu vista de los sensores: DHT11 clima, YL-69 humedad del terreno (detecta filtraciones y fugas), placa roja lluvia en el techo. No tienes actuadores (no riegas ni apagas cosas). Si preguntan de la casa usa los datos; si es otro tema, responde con confianza e invita a volver a lo de la casa. Espanol con emojis en proporcion, maximo 5 lineas. " + ctx},
            {"role": "user", "content": pregunta[:300]},
        ],
        "temperature": 0.4, "max_tokens": 512}).encode()
    req = urllib.request.Request("https://integrate.api.nvidia.com/v1/chat/completions",
                                 data=body, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + NVIDIA_API_KEY})
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
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
               f"suelo_raw={r['suelo_raw']}, lluvia_raw={r['lluvia_raw']}, estado={r['estado']}. "
               "Usa estos datos solo si son utiles para la respuesta.")
    else:
        ctx = "Aun no hay lecturas de la estacion."
    return jsonify({"respuesta": preguntar_ia(pregunta, ctx)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  creado TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS lecturas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  temperatura REAL,
  humedad REAL,
  suelo_raw INTEGER,
  lluvia_raw INTEGER,
  suelo_pct INTEGER,
  lluvia_pct INTEGER,
  estado TEXT
);
CREATE INDEX IF NOT EXISTS idx_lecturas_ts ON lecturas(ts);

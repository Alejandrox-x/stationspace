import socket, concurrent.futures, http.client, sys

# Barrido ultra-rapido: puerto 80 en todo el /24 + 192.168.4.1 (AP del chip)
# Imprime SOLO la IP del ESP32 si alguien responde /json|/plain con "temperatura"+"humedad"

def alive(ip):
    s = socket.socket(); s.settimeout(0.3)
    try:
        s.connect((ip, 80)); return ip
    except Exception:
        return None
    finally:
        s.close()

def es_esp(ip):
    for ruta in ("/json", "/plain"):
        try:
            c = http.client.HTTPConnection(ip, timeout=1.5)
            c.request("GET", ruta)
            d = c.getresponse().read(500).decode("utf-8", "ignore")
            if "temperatura" in d.lower() and "humedad" in d.lower():
                return ip
        except Exception:
            pass
    return None

base = sys.argv[1].rstrip('.') if len(sys.argv) > 1 else "192.168.18"
hosts = [f"{base}.{i}" for i in range(1, 255)] + ["192.168.4.1"]

# Concurrencia BAJA a proposito: el WebServer del ESP32 tiene una cola de
# conexiones minuscula; si golpearemos el /24 con cientos de sockets a la vez,
# el chip descarta los SYNs y el barrido no lo ve. 60 hilos alcanzan en ~6 s.
with concurrent.futures.ThreadPoolExecutor(max_workers=60) as ex:
    abiertos = [r for r in ex.map(alive, hosts) if r]

for ip in abiertos:
    e = es_esp(ip)
    if e:
        print(e)
        sys.exit(0)

sys.exit(1)

"""Havola ko'rib chiqish xizmati — SSRF, qora ro'yxatni chetlab o'tish. O'quv laboratoriyasi.

Xuddi shu konteynerda 127.0.0.1:8080 da faqat ichkaridan ochiladigan boshqaruv xizmati ishlaydi.
"""
import http.client
import ipaddress
import os
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from flask import Flask, render_template_string, request

FLAG = open(os.environ.get('FLAG_FILE', '/flag.txt')).read().strip()
INTERNAL_PORT = int(os.environ.get('INTERNAL_PORT', '8080'))


class InternalAdmin(BaseHTTPRequestHandler):
    """Ichki xizmat: tashqariga chiqarilmagan, faqat 127.0.0.1 da tinglaydi."""

    def do_GET(self):
        routes = {
            '/': 'Ichki boshqaruv xizmati v1.4\nYo\'llar: /status, /admin/secret\n',
            '/status': 'OK: disk 41%, xotira 63%, navbat 0\n',
            '/admin/secret': f'Zaxira kaliti: {FLAG}\n',
        }
        body = routes.get(self.path.split('?')[0])
        self.send_response(200 if body else 404)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.end_headers()
        self.wfile.write((body or 'Not found\n').encode())

    def log_message(self, *args):
        pass


threading.Thread(target=ThreadingHTTPServer(('127.0.0.1', INTERNAL_PORT), InternalAdmin).serve_forever, daemon=True).start()

app = Flask(__name__)

PAGE = """<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LinkPeek — havola ko'rib chiqish</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#fafafa;color:#18181b}
header{padding:18px 24px;background:#fff;border-bottom:1px solid #e4e4e7}header b{color:#7c3aed}
main{max-width:720px;margin:36px auto;padding:0 16px}form{display:flex;gap:8px;flex-wrap:wrap}
input{flex:1;min-width:220px;padding:12px;border:1px solid #d4d4d8;border-radius:10px;font-size:15px}
button{padding:12px 20px;background:#7c3aed;color:#fff;border:0;border-radius:10px;cursor:pointer}
.box{margin-top:20px;background:#fff;border:1px solid #e4e4e7;border-radius:12px;overflow:hidden}
.box h3{margin:0;padding:12px 16px;background:#f4f4f5;font-size:13px;font-family:monospace;word-break:break-all}
pre{margin:0;padding:16px;white-space:pre-wrap;word-break:break-word;max-height:420px;overflow:auto;font-size:13px}
.err{margin-top:16px;padding:12px;border-radius:10px;background:#fef2f2;color:#991b1b}
.muted{color:#71717a;font-size:13px}
</style></head><body><header><b>LinkPeek</b> <span class="muted">— havolani xavfsiz oldindan ko'ring</span></header>
<main><p class="muted">Havolani kiriting — server uni ochib, birinchi 4 KB ni ko'rsatadi. Faqat <code>http://</code>.</p>
<form method="get"><input name="url" placeholder="http://example.com/" value="{{ url }}" required><button>Ko'rish</button></form>
{% if error %}<div class="err">{{ error }}</div>{% endif %}
{% if body is not none %}<div class="box"><h3>{{ status }} · {{ url }}</h3><pre>{{ body }}</pre></div>{% endif %}
</main></body></html>"""

BLOCKED_HOSTS = {'localhost', '127.0.0.1', '0.0.0.0', 'internal', 'admin'}


def blocked(host):
    host = host.lower().strip('[]')
    if host in BLOCKED_HOSTS or host.endswith('.localhost'):
        return True
    # ZAIFLIK: faqat to'liq yozilgan IPv4 tekshiriladi; 127.1, 2130706433, 0x7f000001 kabi yozuvlar o'tib ketadi
    try:
        ip = ipaddress.IPv4Address(host)
    except ValueError:
        return False
    return ip.is_loopback or ip.is_private or ip.is_unspecified or ip.is_link_local


def resolve(host):
    """Haqiqiy manzil. Konteynerning o'z loopback'i (o'quv maqsadi) yoki ochiq internet; host va boshqa ichki tarmoqlar har doim yopiq."""
    try:
        # Raqamli yozuvlar (127.1, 2130706433, 0x7f000001) har qanday OT da bir xil tahlil qilinadi
        address = socket.inet_ntoa(socket.inet_aton(host))
    except OSError:
        address = socket.getaddrinfo(host, None, socket.AF_INET, socket.SOCK_STREAM)[0][4][0]
    ip = ipaddress.IPv4Address(address)
    if ip.is_loopback or ip.is_global:
        return str(ip)
    raise PermissionError(str(ip))


def fetch(parts):
    """So'rov hal qilingan IP ga yuboriladi (DNS rebinding bo'lmasin), redirect kuzatilmaydi."""
    ip = resolve(parts.hostname)
    path = parts.path or '/'
    if parts.query:
        path += '?' + parts.query
    conn = http.client.HTTPConnection(ip, parts.port or 80, timeout=4)
    try:
        conn.request('GET', path, headers={'Host': parts.netloc, 'User-Agent': 'LinkPeek/1.0'})
        res = conn.getresponse()
        return res.status, res.read(4096).decode('utf-8', 'replace')
    finally:
        conn.close()


@app.get('/')
def index():
    url = request.args.get('url', '').strip()
    body = status = error = None
    if url:
        parts = urlsplit(url)
        if parts.scheme != 'http' or not parts.hostname:
            error = "Faqat http:// havolalar qabul qilinadi."
        elif blocked(parts.hostname):
            error = f"Xavfsizlik: «{parts.hostname}» ichki manzil, so'rov to'sildi."
        else:
            try:
                status, body = fetch(parts)
            except PermissionError:
                error = "Tarmoq siyosati: bu manzilga so'rov yuborish taqiqlangan."
            except Exception as exc:
                error = f"Havolani ochib bo'lmadi: {type(exc).__name__}"
    return render_template_string(PAGE, url=url, body=body, status=status, error=error)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

"""Xodimlar portali — JWT 'alg: none'. Imzo algoritmi tokendan olinadi. O'quv laboratoriyasi."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from flask import Flask, make_response, redirect, render_template_string, request
from markupsafe import escape

app = Flask(__name__)
FLAG = open(os.environ.get('FLAG_FILE', '/flag.txt')).read().strip()
SECRET = secrets.token_bytes(32)
COOKIE = 'portal_token'
USERS = {'mehmon': ('mehmon', 'user')}


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))


def sign(payload: dict) -> str:
    head = b64(json.dumps({'alg': 'HS256', 'typ': 'JWT'}, separators=(',', ':')).encode())
    body = b64(json.dumps(payload, separators=(',', ':')).encode())
    sig = b64(hmac.new(SECRET, f'{head}.{body}'.encode(), hashlib.sha256).digest())
    return f'{head}.{body}.{sig}'


def verify(token: str):
    try:
        head_b64, body_b64, sig_b64 = token.split('.')
        header = json.loads(unb64(head_b64))
        payload = json.loads(unb64(body_b64))
    except (ValueError, json.JSONDecodeError):
        return None
    alg = str(header.get('alg', '')).lower()
    # ZAIFLIK: algoritm tokenning o'zidan olinadi va "none" imzosiz qabul qilinadi
    if alg == 'none':
        return payload
    if alg == 'hs256':
        expected = b64(hmac.new(SECRET, f'{head_b64}.{body_b64}'.encode(), hashlib.sha256).digest())
        if hmac.compare_digest(expected, sig_b64):
            return payload
    return None


PAGE = """<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Xodimlar portali</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
header{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;background:#111c34;border-bottom:1px solid #1e293b}
header b{color:#38bdf8}a{color:#38bdf8}main{max-width:620px;margin:40px auto;padding:0 16px}
.card{background:#111c34;border:1px solid #1e293b;border-radius:12px;padding:24px;margin-bottom:16px}
input{width:100%;padding:10px;border-radius:8px;border:1px solid #334155;background:#0b1222;color:#e2e8f0;margin:6px 0 12px}
button{padding:10px 18px;border:0;border-radius:8px;background:#38bdf8;color:#0f172a;font-weight:600;cursor:pointer}
.muted{color:#94a3b8;font-size:13px}.lock{color:#f87171}.ok{background:#052e1a;border:1px solid #166534;padding:14px;border-radius:8px;font-family:monospace;word-break:break-all}
code{background:#0b1222;padding:2px 6px;border-radius:4px}
</style></head><body><header><b>◆ Corp Portal</b>{{ nav|safe }}</header><main>{{ body|safe }}</main></body></html>"""


def page(body, user=None, status=200):
    nav = f'<span class="muted">{escape(user["sub"])} · {escape(user["role"])} · <a href="logout">chiqish</a></span>' if user else ''
    return render_template_string(PAGE, body=body, nav=nav), status


def current_user():
    payload = verify(request.cookies.get(COOKIE, ''))
    if not payload or not isinstance(payload, dict) or 'sub' not in payload or 'role' not in payload:
        return None
    payload['sub'], payload['role'] = str(payload['sub'])[:40], str(payload['role'])[:20]
    return payload


@app.get('/')
def index():
    user = current_user()
    if not user:
        return page('<div class="card"><h2>Kirish</h2><p class="muted">Mehmon hisobi: <code>mehmon</code> / <code>mehmon</code></p>'
                    '<form method="post" action="login"><input name="username" placeholder="login" required>'
                    '<input name="password" type="password" placeholder="parol" required><button>Kirish</button></form></div>')
    return page('<div class="card"><h2>Bosh sahifa</h2><p>Yangiliklar: korporativ tadbir 27-dekabr kuni.</p></div>'
                '<div class="card"><h3>Bo\'limlar</h3><p>📄 <a href="reports">Maxfiy hisobotlar</a> <span class="muted">(faqat admin)</span></p></div>',
                user)


@app.post('/login')
def login():
    record = USERS.get(request.form.get('username', ''))
    if not record or record[0] != request.form.get('password'):
        return page('<div class="card"><p class="lock">Login yoki parol noto\'g\'ri.</p><a href="./">Qaytish</a></div>', status=401)
    token = sign({'sub': request.form['username'], 'role': record[1], 'iat': int(time.time())})
    response = make_response(redirect('./'))
    response.set_cookie(COOKIE, token, httponly=False, samesite='Lax')
    return response


@app.get('/reports')
def reports():
    user = current_user()
    if not user:
        return redirect('./')
    if user['role'] != 'admin':
        return page('<div class="card"><h2 class="lock">403 — Ruxsat yo\'q</h2><p>Bu bo\'lim faqat <b>admin</b> roli uchun.</p></div>', user, 403)
    return page(f'<div class="card"><h2>Maxfiy hisobotlar</h2><p>Q4 moliyaviy hisobot arxivi kaliti:</p><div class="ok">{FLAG}</div></div>', user)


@app.get('/logout')
def logout():
    response = make_response(redirect('./'))
    response.delete_cookie(COOKIE)
    return response


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

"""Qishloq Banki — SQL Injection (login bypass). Zaiflik ataylab qoldirilgan: o'quv laboratoriyasi."""
import os
import secrets
import sqlite3

from flask import Flask, redirect, render_template_string, request, session

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
FLAG = open(os.environ.get('FLAG_FILE', '/flag.txt')).read().strip()

db = sqlite3.connect(':memory:', check_same_thread=False)
db.executescript(f"""
CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, full_name TEXT, role TEXT, balance INTEGER);
INSERT INTO users (username, password, full_name, role, balance) VALUES
  ('admin', '{secrets.token_hex(16)}', 'Bosh administrator', 'admin', 0),
  ('dilnoza', '{secrets.token_hex(16)}', 'Dilnoza Karimova', 'client', 4250000),
  ('jasur', '{secrets.token_hex(16)}', 'Jasur Toshmatov', 'client', 980000);
""")

PAGE = """<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Qishloq Banki</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:Georgia,serif;background:#f4efe6;color:#2b2b2b}
header{background:#0b5d3b;color:#fff;padding:18px 24px;display:flex;justify-content:space-between;align-items:center}
header b{font-size:20px;letter-spacing:.5px}header span{font-size:13px;opacity:.8}
main{max-width:440px;margin:56px auto;padding:0 16px}
.card{background:#fff;border:1px solid #e1d8c6;border-radius:10px;padding:28px;box-shadow:0 8px 24px rgba(0,0,0,.06)}
h1{font-size:22px;margin:0 0 6px}p{color:#666;font-size:14px}
label{display:block;font-size:13px;margin:16px 0 6px;color:#444}
input{width:100%;padding:11px 12px;border:1px solid #cfc5b0;border-radius:6px;font-size:15px}
button{margin-top:22px;width:100%;padding:12px;background:#0b5d3b;color:#fff;border:0;border-radius:6px;font-size:15px;cursor:pointer}
.err{background:#fdecea;color:#8a1c1c;padding:10px 12px;border-radius:6px;font-size:13px;margin-top:14px;font-family:monospace;word-break:break-all}
.ok{background:#e8f5ee;border:1px solid #9fd3b6;padding:14px;border-radius:6px;font-family:monospace;word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:14px;margin-top:12px}td,th{padding:8px;border-bottom:1px solid #eee;text-align:left}
a{color:#0b5d3b}
</style></head><body>
<header><b>🏦 Qishloq Banki</b><span>Mijozlar portali · 1998-yildan beri</span></header>
<main>{{ body|safe }}</main></body></html>"""

LOGIN = """<div class="card"><h1>Shaxsiy kabinet</h1><p>Hisobingizga kirish uchun login va parolni kiriting.</p>
<form method="post" action="login">
<label for="u">Login</label><input id="u" name="username" autocomplete="off" required>
<label for="p">Parol</label><input id="p" name="password" type="password" required>
<button type="submit">Kirish</button></form>{error}</div>"""


@app.get('/')
def index():
    if session.get('user'):
        return redirect('dashboard')
    return render_template_string(PAGE, body=LOGIN.format(error=''))


@app.post('/login')
def login():
    username = request.form.get('username', '')
    password = request.form.get('password', '')
    # ZAIFLIK: foydalanuvchi kiritgan matn SQL so'roviga to'g'ridan-to'g'ri qo'shiladi
    query = f"SELECT username, full_name, role, balance FROM users WHERE username = '{username}' AND password = '{password}'"
    try:
        row = db.execute(query).fetchone()
    except sqlite3.Error as exc:
        error = f'<div class="err">Ma\'lumotlar bazasi xatosi: {exc}<br>{escape(query)}</div>'
        return render_template_string(PAGE, body=LOGIN.format(error=error)), 500
    if not row:
        return render_template_string(PAGE, body=LOGIN.format(error='<div class="err">Login yoki parol noto\'g\'ri.</div>')), 401
    session['user'] = {'username': row[0], 'full_name': row[1], 'role': row[2], 'balance': row[3]}
    return redirect('dashboard')


@app.get('/dashboard')
def dashboard():
    user = session.get('user')
    if not user:
        return redirect('./')
    if user['role'] == 'admin':
        clients = db.execute("SELECT full_name, balance FROM users WHERE role = 'client'").fetchall()
        rows = ''.join(f'<tr><td>{escape(n)}</td><td>{b:,} so\'m</td></tr>' for n, b in clients)
        body = (f'<div class="card"><h1>Boshqaruv paneli</h1><p>Xush kelibsiz, {escape(user["full_name"])}.</p>'
                f'<div class="ok">Tizim kaliti: {escape(FLAG)}</div><table><tr><th>Mijoz</th><th>Balans</th></tr>{rows}</table>'
                '<p><a href="logout">Chiqish</a></p></div>')
    else:
        body = (f'<div class="card"><h1>Salom, {escape(user["full_name"])}</h1><p>Balansingiz: <b>{user["balance"]:,} so\'m</b></p>'
                '<p>Boshqaruv paneli faqat administratorlar uchun.</p><p><a href="logout">Chiqish</a></p></div>')
    return render_template_string(PAGE, body=body)


@app.get('/logout')
def logout():
    session.clear()
    return redirect('./')


def escape(value):
    return str(value).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

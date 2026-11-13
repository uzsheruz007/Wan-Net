"""Talaba kabineti — IDOR. API yozuvni so'rovchi kimligini tekshirmay qaytaradi. O'quv laboratoriyasi."""
import os
import secrets

from flask import Flask, jsonify, redirect, render_template_string, request, session

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
FLAG = open(os.environ.get('FLAG_FILE', '/flag.txt')).read().strip()

GUEST_ID = 1042
RECORDS = {
    1: {'name': 'Dekanat kotibi', 'group': '—', 'grades': {},
        'note': f"Imtihon kalitlari arxivi paroli: {FLAG}. Hech kimga bermang!"},
    7: {'name': 'Aziza Rahimova', 'group': 'KX-21', 'grades': {'Kriptografiya': 92, 'Tarmoqlar': 88}, 'note': ''},
    15: {'name': 'Bekzod Aliyev', 'group': 'KX-21', 'grades': {'Kriptografiya': 61, 'Tarmoqlar': 74},
         'note': "Qayta topshirish: 14-dekabr"},
    1003: {'name': 'Madina Yusupova', 'group': 'DI-22', 'grades': {'Algoritmlar': 95}, 'note': ''},
    GUEST_ID: {'name': 'Mehmon talaba', 'group': 'KX-23', 'grades': {'Kriptografiya': 76, 'Tarmoqlar': 81, 'Linux': 90},
               'note': "Stipendiya: tasdiqlangan"},
}
USERS = {'mehmon': ('mehmon123', GUEST_ID)}

PAGE = """<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Talaba kabineti</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#eef2f7;color:#1d2433}
header{background:#1e3a8a;color:#fff;padding:16px 24px}header b{font-size:18px}
main{max-width:640px;margin:40px auto;padding:0 16px}
.card{background:#fff;border-radius:12px;padding:24px;box-shadow:0 6px 20px rgba(30,58,138,.08);margin-bottom:16px}
label{display:block;font-size:13px;margin:14px 0 6px}input{width:100%;padding:10px;border:1px solid #c7d0e0;border-radius:8px}
button{margin-top:18px;padding:11px 18px;background:#1e3a8a;color:#fff;border:0;border-radius:8px;cursor:pointer}
table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #edf0f5;text-align:left}
.muted{color:#64748b;font-size:13px}.err{color:#b91c1c;font-size:14px}code{background:#f1f5f9;padding:2px 6px;border-radius:4px}
</style></head><body><header><b>🎓 Talaba kabineti</b></header><main>{{ body|safe }}</main>
<script>
const box = document.getElementById('grades');
if (box) {
  // Baholar API orqali olinadi
  fetch('api/students/' + box.dataset.id).then(r => r.json()).then(s => {
    const rows = Object.entries(s.grades).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    box.innerHTML = `<p><b>${s.name}</b> · ${s.group}</p><table><tr><th>Fan</th><th>Ball</th></tr>${rows}</table>` +
      (s.note ? `<p class="muted">Izoh: ${s.note}</p>` : '');
  });
}
</script></body></html>"""


@app.get('/')
def index():
    if 'student_id' in session:
        body = (f'<div class="card"><h2>Mening baholarim</h2><div id="grades" data-id="{session["student_id"]}">Yuklanmoqda…</div></div>'
                '<p class="muted"><a href="logout">Chiqish</a></p>')
    else:
        error = '<p class="err">Login yoki parol noto\'g\'ri.</p>' if request.args.get('e') else ''
        body = ('<div class="card"><h2>Kirish</h2><p class="muted">Sinov hisobi: <code>mehmon</code> / <code>mehmon123</code></p>'
                f'{error}<form method="post" action="login"><label for="u">Login</label><input id="u" name="username" required>'
                '<label for="p">Parol</label><input id="p" name="password" type="password" required>'
                '<button>Kirish</button></form></div>')
    return render_template_string(PAGE, body=body)


@app.post('/login')
def login():
    user = USERS.get(request.form.get('username', ''))
    if not user or user[0] != request.form.get('password'):
        return redirect('./?e=1')
    session['student_id'] = user[1]
    return redirect('./')


@app.get('/logout')
def logout():
    session.clear()
    return redirect('./')


@app.get('/api/students/<int:student_id>')
def student(student_id):
    if 'student_id' not in session:
        return jsonify(error='Avval tizimga kiring'), 401
    # ZAIFLIK: so'ralgan yozuv joriy foydalanuvchiga tegishli ekani tekshirilmaydi
    record = RECORDS.get(student_id)
    if not record:
        return jsonify(error='Talaba topilmadi'), 404
    return jsonify(id=student_id, **record)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

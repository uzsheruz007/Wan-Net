"""Tabriknoma generatori — Jinja2 SSTI. Foydalanuvchi matni shablonga qo'shiladi. O'quv laboratoriyasi."""
from flask import Flask, render_template_string, request

app = Flask(__name__)

PAGE = """<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tabriknoma generatori</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Georgia,serif;background:linear-gradient(135deg,#3b0a45,#7a1f5c);color:#fff}
main{max-width:560px;margin:0 auto;padding:48px 16px}h1{text-align:center;font-weight:normal;letter-spacing:1px}
form{display:flex;gap:8px;flex-wrap:wrap}input,select{flex:1;min-width:160px;padding:12px;border-radius:8px;border:0;font-size:15px}
button{padding:12px 20px;border:0;border-radius:8px;background:#ffd166;color:#3b0a45;font-weight:bold;cursor:pointer}
.card{margin-top:28px;background:#fffaf0;color:#3b0a45;border-radius:16px;padding:36px 28px;text-align:center;
box-shadow:0 20px 50px rgba(0,0,0,.35);border:6px double #d4a017;white-space:pre-wrap;word-break:break-word}
.card h2{margin:0 0 12px;font-size:28px}.err{margin-top:16px;background:#ffe3e3;color:#7f1d1d;padding:10px;border-radius:8px}
small{display:block;text-align:center;opacity:.7;margin-top:24px}
</style></head><body><main><h1>✨ Tabriknoma generatori</h1>
<form method="get"><input name="name" placeholder="Ismingiz" value="{{ name }}" required>
<select name="occasion">{% for k, v in occasions.items() %}<option value="{{ k }}" {% if k == occasion %}selected{% endif %}>{{ v[0] }}</option>{% endfor %}</select>
<button>Yaratish</button></form>
{% if error %}<div class="err">{{ error }}</div>{% endif %}
{% if card %}<div class="card">{{ card|safe }}</div>{% endif %}
<small>Tabriknoma shablonlari: Wan-Net Design Studio</small></main></body></html>"""

OCCASIONS = {
    'yangi_yil': ('Yangi yil', "Yangi yilingiz bilan, {name}! Orzularingiz ushalsin!"),
    'tugilgan_kun': ("Tug'ilgan kun", "Tug'ilgan kuningiz muborak, {name}! Baxt va omad yor bo'lsin!"),
    'navruz': ("Navro'z", "Navro'z bayrami qutlug' bo'lsin, {name}! Bahor kayfiyati tilaymiz!"),
}
BLOCKED = ('config', 'import', 'subclasses', 'mro')


@app.get('/')
def index():
    name = request.args.get('name', '')
    occasion = request.args.get('occasion', 'yangi_yil')
    if occasion not in OCCASIONS:
        occasion = 'yangi_yil'
    card, error = None, None
    if name:
        if len(name) > 300:
            error = 'Ism juda uzun.'
        elif any(word in name.lower() for word in BLOCKED):
            error = "Ruxsat etilmagan so'z aniqlandi!"
        else:
            title, text = OCCASIONS[occasion]
            # ZAIFLIK: ism shablon manbasiga qo'shiladi va Jinja2 tomonidan bajariladi
            template = f"<h2>{title}</h2>" + text.replace('{name}', name)
            try:
                card = render_template_string(template)
            except Exception as exc:
                error = f'Shablon xatosi: {type(exc).__name__}'
    return render_template_string(PAGE, name=name, occasion=occasion, occasions=OCCASIONS, card=card, error=error)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

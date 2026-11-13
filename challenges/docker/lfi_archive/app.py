"""Buyruqlar arxivi — Path Traversal, bir martalik filtrni chetlab o'tish. O'quv laboratoriyasi."""
import os

from flask import Flask, render_template_string, request

app = Flask(__name__)
DOCS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'docs')

DOCUMENTS = {
    'buyruq-012.txt': "BUYRUQ №12\n\nXodimlarning ish vaqti 09:00 dan 18:00 gacha belgilansin.\n\nDirektor: A. Qodirov",
    'buyruq-027.txt': "BUYRUQ №27\n\nServer xonasiga kirish faqat elektron kartochka orqali amalga oshirilsin.\n"
                      "Zaxira nusxalar tizimning ildiz katalogida saqlanadi.\n\nDirektor: A. Qodirov",
    'buyruq-031.txt': "BUYRUQ №31\n\nYillik inventarizatsiya 20-dekabrgacha yakunlansin.\n\nDirektor: A. Qodirov",
}
os.makedirs(DOCS, exist_ok=True)
for name, text in DOCUMENTS.items():
    with open(os.path.join(DOCS, name), 'w', encoding='utf-8') as fh:
        fh.write(text)

PAGE = """<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Buyruqlar arxivi</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:'Courier New',monospace;background:#f5f1e8;color:#2d2a24}
header{border-bottom:3px double #8b7d6b;padding:20px 24px;background:#ebe4d4}h1{margin:0;font-size:20px}
main{max-width:760px;margin:30px auto;padding:0 16px;display:grid;gap:20px;grid-template-columns:220px 1fr}
@media(max-width:640px){main{grid-template-columns:1fr}}
nav a{display:block;padding:8px 10px;margin-bottom:6px;background:#fff;border:1px solid #d6cbb5;color:#2d2a24;text-decoration:none}
nav a:hover{background:#fffaf0}pre{background:#fff;border:1px solid #d6cbb5;padding:20px;white-space:pre-wrap;min-height:200px;margin:0}
.err{color:#9b1c1c}
</style></head><body><header><h1>📁 Ichki hujjatlar arxivi</h1></header>
<main><nav>{% for d in docs %}<a href="view?doc={{ d }}">{{ d }}</a>{% endfor %}</nav>
<section>{% if error %}<pre class="err">{{ error }}</pre>{% elif content is not none %}<pre>{{ content }}</pre>
{% else %}<pre>Chap tomondan hujjatni tanlang.</pre>{% endif %}</section></main></body></html>"""


def render(content=None, error=None, status=200):
    return render_template_string(PAGE, docs=sorted(DOCUMENTS), content=content, error=error), status


@app.get('/')
def index():
    return render()


@app.get('/view')
def view():
    doc = request.args.get('doc', '')
    if doc.startswith('/') or '\\' in doc:
        return render(error="Xavfsizlik: mutlaq yo'l taqiqlangan.", status=403)
    # ZAIFLIK: "../" faqat bir marta olib tashlanadi — "....//" kabi ketma-ketlik filtrdan keyin "../" ga aylanadi
    cleaned = doc.replace('../', '')
    path = os.path.join(DOCS, cleaned)
    try:
        with open(path, encoding='utf-8', errors='replace') as fh:
            return render(content=fh.read(20000))
    except (FileNotFoundError, IsADirectoryError, NotADirectoryError):
        return render(error=f"Hujjat topilmadi: {cleaned}", status=404)
    except PermissionError:
        return render(error="Ruxsat yo'q.", status=403)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

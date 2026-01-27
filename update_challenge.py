import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wan.settings')
django.setup()

from ctf.models import Challenge

c = Challenge.objects.filter(category='Web').first()
if c:
    c.html_content = """<html>
<head>
    <title>Yashirin Sahifa</title>
    <style>
        body { background: #111; color: #0f0; font-family: monospace; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .container { text-align: center; border: 1px solid #0f0; padding: 50px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ACCESS DENIED</h1>
        <p>Siz bu yerda hech narsa ko'ra olmaysiz...</p>
        <p>Yoki shundaymi?</p>
    </div>
    <!-- 
    ========================================
    FLAG{view_source_master}
    ========================================
    -->
</body>
</html>"""
    c.description = "Ushbu masalada sizga alohida veb-sahifa beriladi. 'Saytga O'tish' tugmasini bosing va ochilgan sahifaning manba kodini (Source Code) tekshiring."
    c.save()
    print("Web challenge HTML content bilan yangilandi.")
else:
    print("Web challenge topilmadi.")

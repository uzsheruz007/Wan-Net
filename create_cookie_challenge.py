import os
import django
import hashlib

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wan.settings')
django.setup()

from ctf.models import Challenge

# Flag: FLAG{cookie_is_delicious} -> SHA256
flag = "FLAG{cookie_is_delicious}"
flag_hash = hashlib.sha256(flag.encode()).hexdigest()

html_code = """
<!DOCTYPE html>
<html>
<head>
    <title>Cookie Monster</title>
    <style>
        body { 
            background: #2c3e50; 
            color: #ecf0f1; 
            font-family: 'Courier New', monospace; 
            display: flex; 
            flex-direction: column;
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0; 
        }
        .container { 
            text-align: center; 
            border: 2px dashed #e67e22; 
            padding: 50px; 
            border-radius: 15px;
            background: rgba(0,0,0,0.2);
        }
        h1 { color: #e67e22; }
        .hint { margin-top: 20px; font-size: 0.8rem; color: #95a5a6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🍪 Cookie Monster 🍪</h1>
        <p>Men pechenyelarni yaxshi ko'raman!</p>
        <p>Lekin men ularni yeb qo'ydim... yoki yashirib qo'ydimmi?</p>
        <p>Web dasturchilar ma'lumotlarni qayerda saqlashini bilasizmi?</p>
        
        <div class="hint">
            (Maslahat: Brauzeringizning "Inspect" oynasini oching va "Application" yoki "Storage" bo'limiga qarang)
        </div>
    </div>

    <script>
        // Xakerlar uchun maxsus cookie!
        document.cookie = "ctf_flag=" + atob("RkxBR3tjb29raWVfaXNfZGVsaWNpb3VzfQ==") + "; path=/";
        console.log("Cookie mazali ekan!");
    </script>
</body>
</html>
"""

challenge, created = Challenge.objects.get_or_create(
    title="Cookie Monster",
    defaults={
        'description': "Ushbu saytda flag yashiringan. Lekin u HTML kodda ko'rinmayapti. Web-saytlar foydalanuvchi haqidagi ma'lumotlarni (masalan, sessiya IDlarini) qayerda saqlaydi?\n\n'Saytga O'tish' tugmasini bosing va brauzer vositalaridan foydalanib qidiring.",
        'category': 'Web',
        'points': 15,
        'flag_hash': flag_hash,
        'html_content': html_code,
        'is_active': True
    }
)

if created:
    print("[+] 'Cookie Monster' masalasi muvaffaqiyatli yaratildi!")
else:
    # Agar mavjud bo'lsa, HTML kodni yangilaymiz
    challenge.html_content = html_code
    challenge.description = "Ushbu saytda flag yashiringan. Lekin u HTML kodda ko'rinmayapti. Web-saytlar foydalanuvchi haqidagi ma'lumotlarni (masalan, sessiya IDlarini) qayerda saqlaydi?\n\n'Saytga O'tish' tugmasini bosing va brauzer vositalaridan foydalanib qidiring."
    challenge.save()
    print("[!] 'Cookie Monster' masalasi yangilandi!")

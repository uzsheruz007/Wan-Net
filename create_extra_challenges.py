import os
import django
import hashlib
from django.core.files.base import ContentFile

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wan.settings')
django.setup()

from ctf.models import Challenge

def create_challenge(title, description, category, points, flag, html_content=None, file_content=None, file_name=None):
    flag_hash = hashlib.sha256(flag.encode()).hexdigest()
    
    defaults = {
        'description': description,
        'category': category,
        'points': points,
        'flag_hash': flag_hash,
        'html_content': html_content,
        'is_active': True
    }
    
    challenge, created = Challenge.objects.get_or_create(title=title, defaults=defaults)
    
    if file_content and file_name:
        challenge.file.save(file_name, ContentFile(file_content))
        challenge.save()

    if created:
        print(f"[+] Yaratildi: {title} ({category})")
    else:
        print(f"[-] Mavjud: {title} ({category})")

# 1. Forensics Challenge
# Fayl ichida yashirin matn
forensics_content = b"Bu oddiy matn emas.\n0101001001\nFLAG{hidden_in_bytes}\n010101010\n"
create_challenge(
    title="Yashirin Baytlar",
    description="Ushbu faylni yuklab oling va uni 'Notepad' yoki matn muharririda ochib ko'ring. Ba'zan flaglar faylning ichida ochiq holda yotgan bo'ladi.",
    category="Forensics",
    points=20,
    flag="FLAG{hidden_in_bytes}",
    file_content=forensics_content,
    file_name="secret_data.bin"
)

# 2. Reverse Engineering Challenge
# Python kodi tahlili
reverse_desc = """
Quyidagi Python funksiyasi parolni tekshiradi. To'g'ri parolni toping va uni `FLAG{parol}` ko'rinishida yuboring.

```python
def check_password(password):
    part1 = "rever"
    part2 = "sing"
    part3 = "_is_"
    part4 = "cool"
    
    full = part1 + part2 + part3 + part4
    # full = "reversing_is_cool"
    
    return password == full
```
"""
create_challenge(
    title="Python Reversing",
    description=reverse_desc,
    category="Reverse",
    points=30,
    flag="FLAG{reversing_is_cool}"
)

# 3. Misc Challenge
# Mantiqiy savol
misc_desc = """
Quyidagi ketma-ketlikni davom ettiring:
1, 1, 2, 3, 5, 8, 13, ?

Flag formati: FLAG{javob}
"""
create_challenge(
    title="Fibonacci",
    description=misc_desc,
    category="Misc",
    points=10,
    flag="FLAG{21}"
)

print("\nQo'shimcha masalalar yuklandi!")

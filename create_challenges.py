import os
import django
import hashlib

# Django muhitini sozlash
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wan.settings')
django.setup()

from ctf.models import Challenge

def create_challenge(title, description, category, points, flag):
    flag_hash = hashlib.sha256(flag.encode()).hexdigest()
    challenge, created = Challenge.objects.get_or_create(
        title=title,
        defaults={
            'description': description,
            'category': category,
            'points': points,
            'flag_hash': flag_hash,
            'is_active': True
        }
    )
    if created:
        print(f"[+] Yaratildi: {title}")
    else:
        print(f"[-] Mavjud: {title}")

# 1. Web Challenge
create_challenge(
    title="Manbani Ko'ring",
    description="Veb-saytlar HTML kodlardan tashkil topgan. Ba'zan dasturchilar kod ichida sirli narsalarni qoldirib ketishadi. Bosh sahifaning manba kodini (Source Code) ko'zdan kechiring.",
    category="Web",
    points=10,
    flag="FLAG{view_source_master}"
)

# 2. Crypto Challenge (Base64)
# Flag: FLAG{crypto_is_fun} -> RkxBR3tjcnlwdG9faXNfZnVufQ==
create_challenge(
    title="Sirli Xabar",
    description="Quyidagi shifrlangan matnni o'qing: `RkxBR3tjcnlwdG9faXNfZnVufQ==`. Bu qanday shifrlash turi ekanligini toping va flagni oling.",
    category="Crypto",
    points=20,
    flag="FLAG{crypto_is_fun}"
)

# 3. OSINT Challenge
create_challenge(
    title="Adminning Izlari",
    description="Ushbu saytning 'Jamoa' sahifasini yoki footer qismini diqqat bilan o'qing. Bizning shiorimiz nima? Flag formati: FLAG{shior_so'zlari} (Masalan: FLAG{biz_kelajakmiz})",
    category="OSINT",
    points=15,
    flag="FLAG{kelajak_kasbini_egallang}"  # Bu taxminiy, sayt footeriga qarab o'zgartirish kerak
)

print("\nBarcha masalalar yuklandi!")

"""Docker laboratoriyalar katalogi: yagona manba.

Har lab `challenges/docker/<slug>/` papkasida (Dockerfile + app.py). Flag repoda saqlanmaydi:
`manage.py init_docker_challenges --build` har lab uchun tasodifiy flag yaratadi, image'ni `FLAG` build-arg bilan yig'adi
va bazaga faqat flag xeshini yozadi.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Lab:
    slug: str
    title: str
    category: str
    difficulty: str
    points: int
    description: str
    port: int = 5000

    @property
    def image(self):
        return f'wan-net/{self.slug.replace("_", "-")}:latest'


LABS = [
    Lab(
        slug='ping_rce',
        title='Network Diagnostic Tool',
        category='Web',
        difficulty='medium',
        points=500,
        description=(
            "Ma'murlar serverlarni tekshirish uchun shu vositadan foydalanadi. Kiritilgan manzil to'g'ridan-to'g'ri "
            "ping buyrug'iga qo'shiladi, ammo «WAF» ba'zi belgilarni to'sadi.\n\n"
            "Maqsad: tizimda buyruq bajarib, /flag.txt faylini o'qing.\n\n"
            "Mavzu: OS Command Injection, filtrni chetlab o'tish."
        ),
    ),
    Lab(
        slug='sqli_login',
        title="Qishloq Banki: mijozlar portali",
        category='Web',
        difficulty='easy',
        points=150,
        description=(
            "Kichik bankning onlayn kabineti. Dasturchi kirish formasini shoshilib yozgan: login va parol SQL so'roviga "
            "to'g'ridan-to'g'ri qo'shiladi.\n\n"
            "Maqsad: parolni bilmasdan administrator sifatida kiring — flag boshqaruv panelida.\n\n"
            "Mavzu: SQL Injection (autentifikatsiyani chetlab o'tish)."
        ),
    ),
    Lab(
        slug='idor_api',
        title="Talaba kabineti: baholar API",
        category='Web',
        difficulty='easy',
        points=200,
        description=(
            "Universitet talaba kabineti. Mehmon hisobi bilan kirib, o'z baholaringizni ko'rasiz — sahifa ularni "
            "API orqali talaba raqami bo'yicha oladi.\n\n"
            "Maqsad: boshqa foydalanuvchilarning yozuvlarini ko'rib, dekanat kotibining maxfiy izohini toping.\n\n"
            "Mavzu: IDOR (Insecure Direct Object Reference), Broken Access Control."
        ),
    ),
    Lab(
        slug='lfi_archive',
        title="Buyruqlar arxivi",
        category='Web',
        difficulty='medium',
        points=300,
        description=(
            "Tashkilotning ichki hujjatlar arxivi: buyruqlar fayl nomi bo'yicha ochiladi. Dasturchi «../» ni "
            "filtrlab, xavfsizlikni ta'minladim deb o'ylaydi.\n\n"
            "Maqsad: arxiv papkasidan tashqariga chiqib, /flag.txt ni o'qing.\n\n"
            "Mavzu: Path Traversal / LFI, noto'g'ri filtrni chetlab o'tish."
        ),
    ),
    Lab(
        slug='ssti_card',
        title="Tabriknoma generatori",
        category='Web',
        difficulty='medium',
        points=350,
        description=(
            "Ism kiritsangiz, chiroyli bayram tabriknomasi tayyorlab beradigan xizmat. Ism shablonga matn sifatida "
            "emas, shablonning bir qismi sifatida qo'shiladi.\n\n"
            "Maqsad: shablon dvigateli orqali serverda buyruq bajarib, /flag.txt ni o'qing.\n\n"
            "Mavzu: Server-Side Template Injection (Jinja2)."
        ),
    ),
    Lab(
        slug='jwt_none',
        title="Xodimlar portali",
        category='Crypto',
        difficulty='medium',
        points=400,
        description=(
            "Kompaniyaning ichki portali sessiyani JWT token bilan saqlaydi. Mehmon hisobi bilan kirish mumkin, "
            "lekin «Maxfiy hisobotlar» bo'limi faqat admin roli uchun.\n\n"
            "Maqsad: tokenni tahlil qilib, admin huquqini qo'lga kiriting.\n\n"
            "Mavzu: JWT, imzo algoritmini noto'g'ri tekshirish (alg: none)."
        ),
    ),
    Lab(
        slug='ssrf_preview',
        title="Havola ko'rib chiqish xizmati",
        category='Web',
        difficulty='hard',
        points=500,
        description=(
            "Xizmat siz bergan havolani server nomidan ochib, sahifa ko'rinishini qaytaradi. Xuddi shu serverda faqat "
            "ichkaridan ochiladigan boshqaruv xizmati ham ishlaydi; ichki manzillar «qora ro'yxat» bilan to'silgan.\n\n"
            "Maqsad: ichki xizmatga yetib borib, flagni oling.\n\n"
            "Mavzu: Server-Side Request Forgery, blacklist'ni chetlab o'tish."
        ),
    ),
]

LABS_BY_SLUG = {lab.slug: lab for lab in LABS}

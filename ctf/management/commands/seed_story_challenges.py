"""
5 ta murakkab, grafikli va hikoyaviy masalani bazaga joylaydi.
Har bir masalaning interaktiv sahifasi `ctf/story_challenges/*.html` da yotadi va
`/challenge/<id>/render/` orqali "Nishon sahifa" bo'lib ochiladi.

Qayta ishga tushirsa — html_content va metama'lumotlar yangilanadi (update_or_create).
"""
import hashlib
from pathlib import Path

from django.core.management.base import BaseCommand

from ctf.models import Challenge

STORY_DIR = Path(__file__).resolve().parents[2] / "story_challenges"

CHALLENGES = [
    {
        "file": "01_qorasuv.html",
        "title": "QORASUV-1: O'chayotgan Signal",
        "category": "Forensics",
        "difficulty": "hard",
        "points": 60,
        "flag": "flag{signal_lost}",
        "description": (
            "Mavzu: Signal forensikasi va Morze kodi.\n\n"
            "02:41 — «Qorasuv-1» meteorologik sun'iy yo'ldoshi orbitadan chiqib ketmoqda, quvvati 4%. "
            "U hamon bitta signalni takrorlab yubormoqda. Yer stansiyasi ossillografida telemetriya "
            "to'lqini ko'rinib turibdi, lekin u Morze teleriqida kodlangan.\n\n"
            "«Nishon sahifa» ni oching, animatsion ossillografdagi impulslarni kuzating va yashiringan "
            "ikki so'zli xabarni dekodlang. To'g'ri dekodlasangiz, sahifa sizga flagni beradi."
        ),
    },
    {
        "file": "02_sardoba.html",
        "title": "SARDOBA: Maqbara Qulfi",
        "category": "Crypto",
        "difficulty": "hard",
        "points": 70,
        "flag": "flag{nur_haqiqatni_ochdi}",
        "description": (
            "Mavzu: Klassik kriptografiya — Caesar (siljish) shifri.\n\n"
            "Ikki ming yillik yer osti suv omborining markazida tosh eshik. Ustida aylanadigan tosh "
            "disk — qadimgi shifrlagich, yon devorda esa mash'al yorug'ida o'yilgan yozuv.\n\n"
            "«Nishon sahifa» da tosh diskni burab, alifbo siljishini to'g'ri qiymatga keltiring. "
            "Devordagi yozuv ma'noli uch so'zga aylanganda eshik ochiladi va flag paydo bo'ladi. "
            "Ipucha: yozuv «NUR» so'zi bilan boshlanadi."
        ),
    },
    {
        "file": "03_synapse.html",
        "title": "SYNAPSE: Uyg'ongan Ong",
        "category": "Reverse",
        "difficulty": "hard",
        "points": 80,
        "flag": "flag{ong_uygondi}",
        "description": (
            "Mavzu: Graf tahlili — eng qisqa (eng kam vaznli) yo'l.\n\n"
            "Siz o'chirilgan sun'iy ong SYNAPSE ning yadrosiga ulandingiz. U uyg'onish uchun impulsni "
            "KIRISH neyronidan CHIQISH neyroniga eng kam kechikish bilan yetkazishingizni so'ramoqda.\n\n"
            "«Nishon sahifa» dagi neyron tarmog'ida qirralardagi raqamlar — kechikish (ms). Neyronlarni "
            "bosib, KIRISH dan CHIQISH gacha umumiy kechikishi eng kichik yo'lni quring. To'g'ri yo'lda "
            "flag o'zi yig'iladi."
        ),
    },
    {
        "file": "04_xotira.html",
        "title": "XOTIRA-9: Buzilgan Kadr",
        "category": "Forensics",
        "difficulty": "hard",
        "points": 70,
        "flag": "flag{kokda_yashiringan}",
        "description": (
            "Mavzu: Steganografiya — rang kanallari va bit qatlamlari.\n\n"
            "Qulagan razvedka droni qora qutisidan shikastlangan kadr buferi topildi. Ekran faqat "
            "shovqin ko'rsatadi, ammo oxirgi kadr xotirada qolgan. Signal piksellar rangining yagona "
            "bit qatlamiga ko'milgan.\n\n"
            "«Nishon sahifa» da rang kanali (R/G/B) va bit qatlamini (0–7) sozlab, 24 ta kombinatsiyadan "
            "matn chiqadiganini toping. Ipucha: drone tunda uchgan — «osmon» rangiga qarang."
        ),
    },
    {
        "file": "05_mantiq.html",
        "title": "MANTIQ ESHIGI: Kvant Qulfi",
        "category": "Misc",
        "difficulty": "hard",
        "points": 75,
        "flag": "flag{mantiq_ochildi}",
        "description": (
            "Mavzu: Mantiqiy darvozalar va kombinatsion sxema.\n\n"
            "Kvant xazina eshigi mantiqiy qulf bilan himoyalangan. Besh tumbler (A–E) AND, OR, XOR va NOT "
            "darvozalari orqali to'rtta chiroqqa ulangan.\n\n"
            "«Nishon sahifa» da tumblerlarni yoqib-o'chirib, to'rtala chiroqni bir vaqtda yondiradigan "
            "yagona kombinatsiyani toping. Sxemani diqqat bilan o'qing — tasodifiy bosish emas, mantiq "
            "kerak. Eshik ochilganda flag chiqadi."
        ),
    },
]


class Command(BaseCommand):
    help = "5 ta murakkab grafikli hikoyaviy masalani (QORASUV-1, SARDOBA, SYNAPSE, XOTIRA-9, MANTIQ ESHIGI) joylaydi"

    def handle(self, *args, **kwargs):
        self.stdout.write("Hikoyaviy masalalar joylanmoqda...")
        for data in CHALLENGES:
            path = STORY_DIR / data["file"]
            if not path.exists():
                self.stderr.write(self.style.ERROR(f"  [!] HTML topilmadi: {path}"))
                continue
            html = path.read_text(encoding="utf-8")
            flag_hash = hashlib.sha256(data["flag"].encode()).hexdigest()
            obj, created = Challenge.objects.update_or_create(
                title=data["title"],
                defaults={
                    "description": data["description"],
                    "category": data["category"],
                    "difficulty": data["difficulty"],
                    "points": data["points"],
                    "flag_hash": flag_hash,
                    "html_content": html,
                    "is_active": True,
                },
            )
            verb = "Yaratildi" if created else "Yangilandi"
            self.stdout.write(self.style.SUCCESS(f"  [+] {verb}: {data['title']} ({data['category']}, {data['points']} pts)"))
        self.stdout.write(self.style.SUCCESS("Tayyor."))

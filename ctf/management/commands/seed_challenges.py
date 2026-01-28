from django.core.management.base import BaseCommand
from ctf.models import Challenge
import hashlib

class Command(BaseCommand):
    help = 'Populates the database with 30 diverse CTF challenges'

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding challenges...")

        challenges_data = [
            # === WEB EXPLOITATION ===
            {
                "title": "Hidden in Plain Sight",
                "category": "Web",
                "points": 10,
                "description": "Saytning manba kodini (Source Code) tekshirishni bilasizmi? Ba'zida dasturchilar muhim narsalarni izoh (comment) ichida qoldirib ketishadi.",
                "flag": "flag{html_comments_are_public}",
                "html_content": "<!-- flag{html_comments_are_public} --> <h1>Nothing here...</h1>"
            },
            {
                "title": "Cookie Monster",
                "category": "Web",
                "points": 20,
                "description": "Saytga kirganingizda, brauzer 'cookie' saqlaydi. Cookie qiymatini tekshirib ko'ring. 'admin=false' ni 'admin=true' qilsa nima bo'ladi?",
                "flag": "flag{cookies_are_tasty}",
                "html_content": "<script>document.cookie = 'user=guest; path=/'; // Hint: Change to admin</script> <h1>Welcome Guest</h1>"
            },
            {
                "title": "User Agent spoofing",
                "category": "Web",
                "points": 30,
                "description": "Bu sayt faqat 'Googlebot' ga ruxsat beradi. O'zingizni Google qidiruv roboti kabi tanishtira olasizmi?",
                "flag": "flag{i_am_a_robot_now}",
                "html_content": "<h1>Access Denied: Only Googlebot allowed</h1>"
            },
            {
                "title": "Disabled Button",
                "category": "Web",
                "points": 15,
                "description": "Tugma ishlamayapti (disabled). HTML kodini o'zgartirib, uni ishga tushiring.",
                "flag": "flag{dont_trust_client_side}",
                "html_content": "<button disabled onclick='alert(\"flag{dont_trust_client_side}\")'>Get Flag</button>"
            },
             {
                "title": "Local Storage Secrets",
                "category": "Web",
                "points": 25,
                "description": "Faqat Cookielar emas, LocalStorage ham ma'lumot saqlaydi. Inspect Element -> Application tabiga qarang.",
                "flag": "flag{local_storage_hero}",
                "html_content": "<script>localStorage.setItem('secret_flag', 'flag{local_storage_hero}');</script> Check your storage."
            },
            
            # === CRYPTOGRAPHY ===
            {
                "title": "Caesar Salad",
                "category": "Crypto",
                "points": 10,
                "description": "Sezar shifri - eng qadimgi shifrlardan biri. Harflarni 3 taga surib ko'ring: 'iodj{fdhvdu_flskhu}'",
                "flag": "flag{caesar_cipher}",
                "html_content": None
            },
            {
                "title": "Base64 Basic",
                "category": "Crypto",
                "points": 15,
                "description": "Bu matn shubhali ko'rinyapti: 'ZmxhZ3tiYXNlNjRfaXNfZWFzeX0='. Uni dekodlang.",
                "flag": "flag{base64_is_easy}",
                "html_content": None
            },
            {
                "title": "Hexed",
                "category": "Crypto",
                "points": 20,
                "description": "Kompyuterlar 16-lik sanoq tizimini (Hex) yaxshi ko'radi. Buni o'qing: 66 6c 61 67 7b 68 65 78 5f 74 6f 5f 74 65 78 74 7d",
                "flag": "flag{hex_to_text}",
                "html_content": None
            },
             {
                "title": "Reverse Text",
                "category": "Crypto",
                "points": 10,
                "description": "}desrever_si_galf_siht{galf",
                "flag": "flag{this_flag_is_reversed}",
                "html_content": None
            },
            {
                "title": "Binary Solo",
                "category": "Crypto",
                "points": 25,
                "description": "01100110 01101100 01100001 01100111 01111011 01100010 01101001 01101110 01100001 01110010 01111001 01111101",
                "flag": "flag{binary}",
                "html_content": None
            },

            # === OSINT ===
            {
                "title": "Ghost Profile",
                "category": "OSINT",
                "points": 20,
                "description": "Biz 'JohnDoe1999_CTF' degan foydalanuvchini qidiryapmiz. Uning Twitter yoki Instagram profilida flag yashiringan bo'lishi mumkin (Bu o'yin uchun o'ylab topilgan). Flag formati: flag{social_media_username}",
                "flag": "flag{JohnDoe1999_CTF}",
                "html_content": "Find the user."
            },
            {
                "title": "Geo Hunter",
                "category": "OSINT",
                "points": 30,
                "description": "Rasmda Eyfel minorasi bor. Bu qaysi shahar? Flag: flag{CityName_in_English}",
                "flag": "flag{Paris}",
                "html_content": "Where is this?"
            },
             {
                "title": "GitHub Leak",
                "category": "OSINT",
                "points": 25,
                "description": "Dasturchilar ba'zan parollarni GitHub commitlarida unutib qoldiradilar. Agar repo nomi 'ctf-leaks-2024' bo'lsa, uni toping.",
                "flag": "flag{git_history_reveals_all}",
                "html_content": None
            },
             {
                "title": "Wayback Machine",
                "category": "OSINT",
                "points": 30,
                "description": "Sayt o'zgartirildi, lekin internet hech narsani unutmaydi. Archive.org saytidan ushbu sahifaning eski versiyasini toping.",
                "flag": "flag{time_travel_is_real}",
                "html_content": None
            },
             {
                "title": "DNS Records",
                "category": "OSINT",
                "points": 20,
                "description": "Saytning TXT rekordlarini tekshiring. U yerda flag bo'lishi mumkin.",
                "flag": "flag{dns_txt_record}",
                "html_content": None
            },

            # === FORENSICS ===
            {
                "title": "Magic Bytes",
                "category": "Forensics",
                "points": 30,
                "description": "Bu fayl .txt deb nomlangan, lekin u aslida rasm. Fayl sarlavhasini (header) tekshiring.",
                "flag": "flag{file_extensions_lie}",
                "html_content": None
            },
            {
                "title": "Metadata Hidden",
                "category": "Forensics",
                "points": 20,
                "description": "Rasmning EXIF ma'lumotlarini tekshiring. Kim suratga olgan?",
                "flag": "flag{exif_data_revealed}",
                "html_content": None
            },
             {
                "title": "Steganography 101",
                "category": "Forensics",
                "points": 40,
                "description": "Rasm ichiga matn yashiringan. Steghide yoki shunga o'xshash vositalar yordam berishi mumkin.",
                "flag": "flag{hidden_in_pixels}",
                "html_content": None
            },
             {
                "title": "Corrupted Header",
                "category": "Forensics",
                "points": 50,
                "description": "Fayl ochilmayapti. Hex editor yordamida uning boshidagi baytlarni tuzating (PNG uchun 89 50 4E 47...)",
                "flag": "flag{fix_the_header}",
                "html_content": None
            },
             {
                "title": "Zip Lock",
                "category": "Forensics",
                "points": 30,
                "description": "Arxiv parollangan. Parol juda oddiy (4 ta raqam). Brute-force qilib ko'ring.",
                "flag": "flag{brute_force_success}",
                "html_content": None
            },

            # === REVERSE & MISC ===
            {
                "title": "Logic Gate",
                "category": "Reverse",
                "points": 20,
                "description": "Agar A=True va B=False bo'lsa, (A OR B) AND (NOT B) nimaga teng?",
                "flag": "flag{true}",
                "html_content": None
            },
            {
                "title": "Python Snake",
                "category": "Reverse",
                "points": 30,
                "description": "Python kodini o'qing: print(''.join(['f', 'l', 'a', 'g']))",
                "flag": "flag{python_is_fun}",
                "html_content": None
            },
            {
                "title": "Sanity Check",
                "category": "Misc",
                "points": 5,
                "description": "O'yin qoidalarini o'qidingizmi? Flag shunchaki flag{welcome}.",
                "flag": "flag{welcome}",
                "html_content": None
            },
             {
                "title": "Regex Master",
                "category": "Misc",
                "points": 25,
                "description": "Emailni tekshiradigan regex ifodasini yozing.",
                "flag": "flag{regex_wizard}",
                "html_content": None
            },
             {
                "title": "QR Code",
                "category": "Misc",
                "points": 15,
                "description": "Bu QR kodni skanerlang.",
                "flag": "flag{scan_me}",
                "html_content": None
            },

            # === EXTRA ===
            {
                "title": "SQL Injection Basic",
                "category": "Web",
                "points": 50,
                "description": "Login formasiga ' OR '1'='1 deb yozsangiz nima bo'ladi?",
                "flag": "flag{sql_injection_master}",
                "html_content": "Simulation of SQL."
            },
            {
                "title": "Admin Panel",
                "category": "Web",
                "points": 40,
                "description": "/admin sahifasiga o'ting.",
                "flag": "flag{found_admin_page}",
                "html_content": "Go to /admin"
            },
            {
                "title": "Robots.txt",
                "category": "Web",
                "points": 10,
                "description": "/robots.txt faylini tekshiring. U yerda yashirin yo'llar bo'lishi mumkin.",
                "flag": "flag{robots_allowed}",
                "html_content": "User-agent: * Disallow: /secret_flag"
            },
            {
                "title": "JWT Token",
                "category": "Crypto",
                "points": 60,
                "description": "Bu JWT tokenni decode qiling va 'role' ni 'admin' qiling.",
                "flag": "flag{jwt_token_cracked}",
                "html_content": None
            },
             {
                "title": "Keyboard Cat",
                "category": "Misc",
                "points": 10,
                "description": "Qwerty klaviaturasida 'qazwsx' harflari qanday shaklni chizadi? (Shunchaki flag{cat})",
                "flag": "flag{cat}",
                "html_content": None
            },
        ]

        count = 0
        for data in challenges_data:
            # Check for duplicates by title
            if Challenge.objects.filter(title=data['title']).exists():
                continue

            # Hash the flag
            flag_hash = hashlib.sha256(data['flag'].encode()).hexdigest()
            
            Challenge.objects.create(
                title=data['title'],
                category=data['category'],
                points=data['points'],
                description=data['description'],
                flag_hash=flag_hash,
                html_content=data.get('html_content', ''),
                is_active=True
            )
            count += 1
            self.stdout.write(f"Created: {data['title']}")

        self.stdout.write(self.style.SUCCESS(f'Successfully seeded {count} new challenges!'))

# Wan-Net — CTF platformasi

Frontend: **Next.js 16** (`frontend/`). Django faqat API, `/django-admin/` (oddiy Django admin, zaxira), fayllar va CTF nishonlari.
Boshqaruv paneli — Next.js `/admin/` (`frontend/app/admin/`, `components/panel/`), faqat xodimlar (`is_staff`), login+parol bilan.
Admin'da masala qo'shilganda flag ochiq matnda yoziladi — bazaga faqat SHA256 xeshi tushadi (`ctf/panel/forms.py`).
`ctf/panel/` — panel API (`/api/panel/...`): bo'limlar sxemasi `resources.py` da (ustun, filtr, amal, forma bo'limlari);
  frontend umumiy jadval/forma bilan ko'rsatadi, shuning uchun yangi bo'lim faqat backend'da qo'shiladi.
Eski Django HTML qismlari (`kurs` ilovasi, ildizdagi `templates/`, `static/`, allauth/Google login, CKEditor, DRF) olib tashlangan.

## Tuzilma
- `ctf/views.py` — biznes oqim o'zgarmagan: ruxsat, flag tekshiruvi, brute-force himoyasi, ballar, turnir/jamoa, Docker lab.
  View'lar `render` ni `ctf/api/render.py` dan oladi: `{template, data, user, year, messages}`; redirect → `{redirect}`.
- `ctf/api/bridge.py` — `GET/POST /api/page/<yo'l>` mavjud view'ni o'sha yo'l bilan chaqiradi.
  `FrontendPagesMiddleware`: Django'dagi sahifa manziliga kelgan GET → `SITE_URL` ga redirect, boshqa so'rov → 404.
  To'g'ridan-to'g'ri Django: `/challenge/<id>/render/`, `/secret/` (nishonlar), `/logout/`, `/django-admin/`, `/media/`, `/static/`.
- `ctf/api/pages.py` — har sahifa uchun JSON (faqat ko'rsatiladigan maydonlar; `flag_hash`, `html_content` chiqmaydi).
- `frontend/app/[[...path]]/page.tsx` — barcha sahifalar; `components/SitePageHost.tsx` shablon nomi → komponent.
  Formalar `components/ApiForm.tsx` orqali (CSRF bilan). Amallar (lab start/stop, jamoa, ro'yxatdan o'tish) faqat POST.
- **Yangi sahifa/maydon:** view konteksti → `ctf/api/pages.py` → `frontend/components/pages/*` → `SitePageHost.tsx` dagi ro'yxat.
- CSS: `frontend/public/ctf/cyber.css` va `tw.css`. Yangi Tailwind klass kerak bo'lsa (`frontend` papkasida):
  `npx tailwindcss@3 -c tailwind.config.js -i tw.src.css -o public/ctf/tw.css --minify`

## Laboratoriyalar (`/labs/`)
- Katalog: `ctf/labs.py` (yagona manba: sarlavha, tavsif, qiyinlik, ball). Har lab `challenges/docker/<slug>/` da (Dockerfile + app.py).
  Lablar nginx orqali `/lab/<port>/` ostida ochiladi, shuning uchun ilovalardagi havolalar nisbiy yoziladi.
- Lablar: `ping_rce` (Command Injection), `sqli_login` (SQL Injection), `idor_api` (IDOR), `lfi_archive` (Path Traversal),
  `ssti_card` (Jinja2 SSTI), `jwt_none` (JWT alg=none), `ssrf_preview` (SSRF; host va boshqa ichki tarmoqlar har doim yopiq).
- **Flaglar repoda yo'q.** Serverda (Docker bilan):
  ```bash
  python manage.py migrate
  python manage.py init_docker_challenges --build            # hammasi: tasodifiy flag → image → bazaga faqat xesh
  python manage.py init_docker_challenges --build ssti_card  # bittasi
  ```
  `--build`'siz faqat tavsif/ball/qiyinlik yangilanadi; image yig'ilmagan yangi lab yopiq (`is_active=False`) turadi.
  `--build` qayta ishlatilsa flag almashadi (oldingi yechimlar saqlanadi). Eski Ping lab flagi ochiq yozilgan edi —
  serverda `--build ping_rce` bilan almashtiring.

## Lokal ishga tushirish
```bash
python -m venv .venv-win && .venv-win/Scripts/python -m pip install -r requirements.txt
.venv-win/Scripts/python manage.py migrate
.venv-win/Scripts/python manage.py runserver 127.0.0.1:8000
cd frontend && npm install && npm run dev          # http://127.0.0.1:3000
```
`.env`: `SITE_URL=http://127.0.0.1:3000`, `DJANGO_CSRF_TRUSTED_ORIGINS=http://127.0.0.1:3000`.

Fayl masalalari (Docker kerak emas): `manage.py init_file_challenges` — tasodifiy flag bilan fayllarni yaratadi (`--regen` — yangi flag).

Tekshiruv: `manage.py test ctf`, `cd frontend && npm run typecheck && npm run lint && npm run build`.

## Prod (nginx)
- Next: `DJANGO_URL=http://127.0.0.1:8000 npm run build && npx next start -p 3100` (`DJANGO_URL` build paytida ham kerak — rewrite'lar build'ga yoziladi).
- SEO (build paytida): `NEXT_PUBLIC_SITE_URL=https://<domen>` — canonical, Open Graph, `robots.txt`, `sitemap.xml` shu manzil bilan
  (standart `https://wan-net.uz`). Ixtiyoriy: `GOOGLE_SITE_VERIFICATION`, `YANDEX_VERIFICATION` — Search Console / Yandex Webmaster kodi.
  Sarlavha va tavsiflar `frontend/lib/seo.ts` da; logotip va ikonkalar `frontend/public/brand/`.
- `.env`: `SITE_URL=https://<domen>` (frontend manzili), `DJANGO_ALLOWED_HOSTS` ga `127.0.0.1` qo'shilsin (Next serveri Django'ga shu manzil bilan murojaat qiladi).
- nginx: `/api/`, `/django-admin/`, `/logout/`, `/secret/`, `~ ^/challenge/\d+/render/$`, `/static/`, `/media/` → Django;
  `/lab/<port>/` → mavjud lab proksi (o'zgarmagan); qolgan hammasi → Next (`127.0.0.1:3100`).
  `frontend/next.config.ts` dagi `passthrough` ro'yxati o'zgarsa, nginx ham o'zgartirilsin.

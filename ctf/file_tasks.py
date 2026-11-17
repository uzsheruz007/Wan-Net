"""Fayl asosidagi masalalar katalogi (Docker kerak emas).

Har masala `build(flag)` orqali o'quvchiga beriladigan faylni yaratadi. Flag repoda saqlanmaydi:
`manage.py init_file_challenges` tasodifiy flag yaratadi, faylni `media/ctf_files/tasks/` ga yozadi
va bazaga faqat flag xeshini saqlaydi.
"""
import base64
import bz2
import gzip
import io
import json
import lzma
import random
import secrets
import struct
import tarfile
import zipfile
from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class FileTask:
    slug: str
    title: str
    category: str
    difficulty: str
    points: int
    description: str
    filename: str
    build: Callable[[str], bytes]


FLAG_NOTE = "\n\nFlag formati: WanNet{...}"


# ---------- yordamchi: tub sonlar ----------

def _is_probable_prime(n, rounds=40):
    if n < 2:
        return False
    for p in (2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37):
        if n % p == 0:
            return n == p
    d, s = n - 1, 0
    while d % 2 == 0:
        d //= 2
        s += 1
    rng = secrets.SystemRandom()
    for _ in range(rounds):
        x = pow(rng.randrange(2, n - 1), d, n)
        if x in (1, n - 1):
            continue
        for _ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def _next_prime(n):
    n |= 1
    while not _is_probable_prime(n):
        n += 2
    return n


def _random_prime(bits):
    return _next_prime(secrets.randbits(bits) | (1 << (bits - 1)))


def _rsa_modulus(bits, e):
    while True:
        p, q = _random_prime(bits // 2), _random_prime(bits // 2)
        if p != q and (p - 1) % e and (q - 1) % e:
            return p * q


def _to_int(data):
    return int.from_bytes(data, 'big')


# ---------- O'RTA ----------

def build_xor_byte(flag):
    key = secrets.randbelow(255) + 1
    return base64.b64encode(bytes(b ^ key for b in flag.encode())) + b'\n'


VIGENERE_TEXT = (
    "Long before computers existed, people already needed to keep their letters secret. Merchants, generals and "
    "diplomats all relied on simple tricks to hide the meaning of their words from curious eyes. One of the most "
    "famous of these tricks was described in the sixteenth century and was long called the indecipherable cipher. "
    "Instead of shifting every letter by the same amount, the writer chose a secret keyword and shifted each "
    "letter of the message by a different amount, taken from the letters of that keyword in turn. Because the "
    "same plain letter could become many different cipher letters, the usual method of counting letters seemed "
    "useless, and for almost three hundred years many believed that nobody could break it. The weakness was "
    "finally explained in the nineteenth century. If the keyword is short and the message is long, the key "
    "repeats again and again, and repeated words in the text are sometimes encrypted in exactly the same way. "
    "By measuring the distances between such repetitions, an analyst can guess the length of the keyword. Once "
    "the length is known, the message splits into several columns, and every column is nothing more than a "
    "simple shift cipher that can be solved by counting the most common letters. This lesson is still important "
    "today: a secret method is not the same as a secure method, and a short key used many times will always "
    "leak information. Congratulations, analyst, you have read the whole message. The flag is "
)


def vigenere(text, key, decrypt=False):
    out, i = [], 0
    for ch in text:
        if ch.isascii() and ch.isalpha():
            base = ord('A') if ch.isupper() else ord('a')
            shift = ord(key[i % len(key)]) - ord('a')
            out.append(chr((ord(ch) - base + (-shift if decrypt else shift)) % 26 + base))
            i += 1
        else:
            out.append(ch)
    return ''.join(out)


def build_vigenere(flag):
    rng = secrets.SystemRandom()
    key = ''.join(rng.choice('abcdefghijklmnopqrstuvwxyz') for _ in range(rng.randint(6, 9)))
    return vigenere(VIGENERE_TEXT + flag + '\n', key).encode()


def _checksum(data):
    if len(data) % 2:
        data += b'\0'
    s = sum(struct.unpack(f'!{len(data) // 2}H', data))
    while s >> 16:
        s = (s & 0xffff) + (s >> 16)
    return ~s & 0xffff


def _packet(src, dst, sport, dport, seq, ack, flags, payload=b''):
    ip_src, ip_dst = bytes(map(int, src.split('.'))), bytes(map(int, dst.split('.')))
    tcp = struct.pack('!HHIIBBHHH', sport, dport, seq, ack, 5 << 4, flags, 64240, 0, 0) + payload
    pseudo = ip_src + ip_dst + struct.pack('!BBH', 0, 6, len(tcp))
    tcp = tcp[:16] + struct.pack('!H', _checksum(pseudo + tcp)) + tcp[18:]
    ip = struct.pack('!BBHHHBBH4s4s', 0x45, 0, 20 + len(tcp), secrets.randbelow(65535), 0x4000, 64, 6, 0, ip_src, ip_dst)
    ip = ip[:10] + struct.pack('!H', _checksum(ip)) + ip[12:]
    eth = bytes.fromhex('0050568a1b2c' '000c29d4e5f6') + b'\x08\x00'
    return eth + ip + tcp


def _http_session(client, server, sport, request, response):
    rng = secrets.SystemRandom()
    cs, ss = rng.getrandbits(32), rng.getrandbits(32)
    syn, ack_, psh = 0x02, 0x10, 0x18
    return [
        _packet(client, server, sport, 80, cs, 0, syn),
        _packet(server, client, 80, sport, ss, cs + 1, syn | ack_),
        _packet(client, server, sport, 80, cs + 1, ss + 1, ack_),
        _packet(client, server, sport, 80, cs + 1, ss + 1, psh, request),
        _packet(server, client, 80, sport, ss + 1, cs + 1 + len(request), psh, response),
        _packet(client, server, sport, 80, cs + 1 + len(request), ss + 1 + len(response), ack_),
    ]


def _http_response(body):
    body = body.encode()
    return b'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: %d\r\n\r\n' % len(body) + body


def build_pcap(flag):
    rng = secrets.SystemRandom()
    server, client = '10.10.5.20', '10.10.5.77'
    pages = ['/', '/about', '/news/2024', '/static/style.css', '/contacts', '/news/2025']
    sessions = []
    for path in pages:
        req = f'GET {path} HTTP/1.1\r\nHost: intranet.local\r\nUser-Agent: Mozilla/5.0\r\n\r\n'.encode()
        sessions.append((req, _http_response(f'<html><body>Sahifa: {path}</body></html>')))
    creds = base64.b64encode(f'kotib:{flag}'.encode()).decode()
    secret = (
        f'GET /hisobotlar/maxfiy HTTP/1.1\r\nHost: intranet.local\r\nAuthorization: Basic {creds}\r\n'
        'User-Agent: Mozilla/5.0\r\n\r\n'
    ).encode()
    sessions.insert(rng.randint(2, len(sessions)), (secret, _http_response('<html><body>Hisobotlar</body></html>')))

    packets = []
    for i, (req, resp) in enumerate(sessions):
        packets += _http_session(client, server, 49200 + i * 7, req, resp)
    out = io.BytesIO()
    out.write(struct.pack('<IHHiIII', 0xa1b2c3d4, 2, 4, 0, 0, 65535, 1))
    ts = 1731300000
    for i, pkt in enumerate(packets):
        out.write(struct.pack('<IIII', ts + i // 6, (i * 13791) % 1000000, len(pkt), len(pkt)))
        out.write(pkt)
    return out.getvalue()


def _wrap(kind, name, data):
    if kind == 'gz':
        return gzip.compress(data, mtime=0)
    if kind == 'bz2':
        return bz2.compress(data)
    if kind == 'xz':
        return lzma.compress(data)
    buf = io.BytesIO()
    if kind == 'zip':
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr(name, data)
    else:
        with tarfile.open(fileobj=buf, mode='w') as t:
            info = tarfile.TarInfo(name)
            info.size = len(data)
            t.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def build_matryoshka(flag):
    rng = secrets.SystemRandom()
    data = f'Tabriklaymiz! Oxirgi qavatga yetdingiz.\n{flag}\n'.encode()
    for layer in range(40):
        # eng ichki qavat: gzip yoki bzip2. tar siqmaydi, xz esa kichik matnni xom saqlaydi — flag ochiq ko'rinib qolardi
        kinds = ['gz', 'bz2'] if layer == 0 else ['gz', 'bz2', 'xz', 'zip', 'tar']
        data = _wrap(rng.choice(kinds), secrets.token_hex(4), data)
    return data


def build_pycheck(flag):
    rng = secrets.SystemRandom()
    key = [rng.randrange(1, 256) for _ in range(5)]
    mul = rng.choice([3, 5, 7, 11, 13])
    target = []
    for i, c in enumerate(flag.encode()):
        v = ((c ^ key[i % len(key)]) + i * mul) & 0xff
        target.append(((v << 3) | (v >> 5)) & 0xff)
    return f'''#!/usr/bin/env python3
# Wan-Net: litsenziya kalitini tekshiruvchi (ichki versiya)
import sys

_k = {key}
_t = {target}


def _q(v):
    return ((v << 3) | (v >> 5)) & 0xff


def tekshir(s):
    b = s.encode()
    if len(b) != len(_t):
        return False
    return all(_q(((c ^ _k[i % len(_k)]) + i * {mul}) & 0xff) == _t[i] for i, c in enumerate(b))


if __name__ == "__main__":
    kalit = input("Kalitni kiriting: ").strip()
    print("To'g'ri! Bu sizning flagingiz." if tekshir(kalit) else "Noto'g'ri kalit.")
    sys.exit(0)
'''.encode()


# ---------- QIYIN ----------

def build_rsa_close(flag):
    p = _random_prime(1024)
    q = _next_prime(p + secrets.randbits(400) + 2)
    n, e = p * q, 65537
    c = pow(_to_int(flag.encode()), e, n)
    return f'n = {n}\ne = {e}\nc = {c}\n'.encode()


HASTAD_PREFIX = b'Maxfiy buyruq barcha bo\'limlarga: ertaga soat 09:00 da yig\'ilish. Parol: '


def build_hastad(flag):
    m = _to_int(HASTAD_PREFIX + flag.encode())
    lines = ["# Bitta xabar uchta bo'limga yuborildi. Har biri o'z ochiq kaliti bilan (e = 3).", '']
    for i in range(1, 4):
        n = _rsa_modulus(1024, 3)
        assert m < n
        lines += [f'n{i} = {n}', f'c{i} = {pow(m, 3, n)}', '']
    return '\n'.join(lines).encode()


def build_mt(flag):
    rng = random.Random(secrets.randbits(64))
    leaks = [rng.getrandbits(32) for _ in range(624)]
    data = flag.encode()
    key = rng.getrandbits(8 * len(data)).to_bytes(len(data), 'little')
    ct = bytes(a ^ b for a, b in zip(data, key))
    body = {
        'izoh': "O'yin serveri har o'yinda «tasodifiy» son chiqaradi. Oxirgi 624 ta o'yin natijalari saqlangan, "
                'keyin sovrin kodi shu generatordan olingan kalit bilan XOR qilingan.',
        'kod': [
            'import random',
            'natijalar = [random.getrandbits(32) for _ in range(624)]',
            "kalit = random.getrandbits(8 * len(flag)).to_bytes(len(flag), 'little')",
            'shifr = bytes(a ^ b for a, b in zip(flag, kalit))',
        ],
        'natijalar': leaks,
        'shifr_hex': ct.hex(),
    }
    return json.dumps(body, ensure_ascii=False, indent=1).encode()


# Virtual mashina buyruqlari
VM_OPS = {'PUSH': 1, 'IN': 2, 'ADD': 3, 'XOR': 4, 'SUB': 5, 'ROL': 6, 'CHK': 7, 'LEN': 8, 'END': 9}

VM_SOURCE = '''#!/usr/bin/env python3
# Wan-Net: «Qora quti» — kichik virtual mashina. Dastur kalitni tekshiradi.
import sys

DASTUR = bytes.fromhex(
    "{program}"
)


def ishga_tushir(kirish, dastur=DASTUR):
    s, ip, xato = [], 0, 0
    k = kirish.encode()
    while True:
        op = dastur[ip]
        ip += 1
        if op == 1:
            s.append(dastur[ip]); ip += 1
        elif op == 2:
            i = dastur[ip]; ip += 1
            s.append(k[i] if i < len(k) else 0)
        elif op == 3:
            b, a = s.pop(), s.pop(); s.append((a + b) & 0xff)
        elif op == 4:
            b, a = s.pop(), s.pop(); s.append(a ^ b)
        elif op == 5:
            b, a = s.pop(), s.pop(); s.append((a - b) & 0xff)
        elif op == 6:
            n = dastur[ip]; ip += 1
            a = s.pop(); s.append(((a << n) | (a >> (8 - n))) & 0xff)
        elif op == 7:
            t = dastur[ip]; ip += 1
            xato |= s.pop() ^ t
        elif op == 8:
            xato |= len(k) ^ dastur[ip]; ip += 1
        elif op == 9:
            return xato == 0
        else:
            raise RuntimeError("noma'lum buyruq")


if __name__ == "__main__":
    print("Ochildi!" if ishga_tushir(input("Kalit: ").strip()) else "Yopiq.")
    sys.exit(0)
'''


def _vm_program(flag):
    rng = secrets.SystemRandom()
    data = flag.encode()
    order = list(range(len(data)))
    rng.shuffle(order)
    prog = [VM_OPS['LEN'], len(data)]
    for i in order:
        # har belgi oldingi (tasodifiy tanlangan) belgi bilan aralashtiriladi: yechish uchun zanjirni tiklash kerak
        j = rng.choice(order[:order.index(i)]) if order.index(i) else None
        v = data[i]
        prog += [VM_OPS['IN'], i]
        for _ in range(3):
            op, k = rng.choice(['ADD', 'XOR', 'SUB', 'ROL']), rng.randrange(1, 256)
            if op == 'ROL':
                k = rng.randrange(1, 8)
                prog += [VM_OPS['ROL'], k]
                v = ((v << k) | (v >> (8 - k))) & 0xff
            else:
                prog += [VM_OPS['PUSH'], k, VM_OPS[op]]
                v = {'ADD': (v + k) & 0xff, 'XOR': v ^ k, 'SUB': (v - k) & 0xff}[op]
        if j is not None:
            prog += [VM_OPS['IN'], j, VM_OPS['XOR']]
            v ^= data[j]
        prog += [VM_OPS['CHK'], v]
    prog.append(VM_OPS['END'])
    return bytes(prog)


def build_vm(flag):
    hexed = _vm_program(flag).hex()
    lines = '"\n    "'.join(hexed[i:i + 64] for i in range(0, len(hexed), 64))
    return VM_SOURCE.replace('{program}', lines).encode()


def build_lsb_png(flag):
    from PIL import Image, PngImagePlugin

    rng = secrets.SystemRandom()
    w, h = 480, 320
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = ((x * 255) // w, (y * 255) // h, (x * y) % 256 // 2 + rng.randrange(0, 64))
    key = secrets.token_bytes(8)
    payload = bytes(b ^ key[i % len(key)] for i, b in enumerate(flag.encode()))
    data = struct.pack('>H', len(payload)) + payload
    bits = [(byte >> (7 - k)) & 1 for byte in data for k in range(8)]
    # bitlar faqat ko'k kanalning eng kichik bitida, ustun bo'yicha (yuqoridan pastga, chapdan o'ngga)
    for n, bit in enumerate(bits):
        x, y = divmod(n, h)
        r, g, b = px[x, y]
        px[x, y] = (r, g, (b & ~1) | bit)
    info = PngImagePlugin.PngInfo()
    info.add_text('Author', 'Wan-Net')
    info.add_text('Comment', f'k={key.hex()}')
    out = io.BytesIO()
    img.save(out, 'PNG', pnginfo=info)
    return out.getvalue()


TASKS = [
    FileTask(
        slug='xor_byte', title='Bir baytli sir', category='Crypto', difficulty='medium', points=250,
        filename='xabar.txt', build=build_xor_byte,
        description=(
            "Josuslar xabarni shifrlab, base64 ko'rinishida jo'natishdi. Ma'lumki, ular har bir baytni bir xil "
            "kalit bilan XOR qilishgan — kalit esa atigi bitta bayt.\n\n"
            "Maqsad: kalitni topib, xabarni oching.\n\n"
            "Mavzu: XOR shifri, base64, brute-force." + FLAG_NOTE
        ),
    ),
    FileTask(
        slug='vigenere', title='Uch asrlik shifr', category='Crypto', difficulty='medium', points=300,
        filename='xat.txt', build=build_vigenere,
        description=(
            "Qadimiy arxivdan inglizcha xat topildi. Harflar siljitilgan, ammo Sezar shifri ishlamayapti: bitta "
            "harf turli joylarda turlicha shifrlangan. Kalit so'zi qisqa va qayta-qayta ishlatilgan.\n\n"
            "Maqsad: kalit uzunligini, keyin kalitning o'zini toping va xatni o'qing.\n\n"
            "Mavzu: Vigenère shifri, Kasiski usuli, chastota tahlili." + FLAG_NOTE
        ),
    ),
    FileTask(
        slug='pcap_basic', title='Tarmoq izi', category='Forensics', difficulty='medium', points=300,
        filename='trafik.pcap', build=build_pcap,
        description=(
            "Ichki tarmoqdan yozib olingan trafik. Kotib maxfiy hisobotlar sahifasiga kirgan — sayt HTTPS emas, "
            "oddiy HTTP orqali ishlaydi.\n\n"
            "Maqsad: trafikdan kotibning parolini toping.\n\n"
            "Mavzu: Wireshark, HTTP Basic Auth." + FLAG_NOTE
        ),
    ),
    FileTask(
        slug='matryoshka', title='Matryoshka', category='Misc', difficulty='medium', points=250,
        filename='matryoshka.bin', build=build_matryoshka,
        description=(
            "Fayl 40 qavat qilib qadoqlangan: har qavatda zip, tar, gzip, bzip2 yoki xz bo'lishi mumkin. Qo'lda "
            "ochish juda uzoq.\n\n"
            "Maqsad: hamma qavatni ochib, ichidagi flagni oling.\n\n"
            "Mavzu: fayl formatlari (magic bytes), avtomatlashtirish (skript)." + FLAG_NOTE
        ),
    ),
    FileTask(
        slug='pycheck', title='Litsenziya kaliti', category='Reverse', difficulty='medium', points=300,
        filename='tekshir.py', build=build_pycheck,
        description=(
            "Dastur litsenziya kalitini tekshiradi. To'g'ri kalit — bu flagning o'zi. Kod ochiq, lekin kalitni "
            "taxmin qilib topib bo'lmaydi.\n\n"
            "Maqsad: tekshiruvni teskari yo'nalishda bajarib, kalitni tiklang.\n\n"
            "Mavzu: Reverse engineering, bit amallari (XOR, aylantirish)." + FLAG_NOTE
        ),
    ),
    FileTask(
        slug='rsa_close', title='Juda yaqin qo\'shnilar', category='Crypto', difficulty='hard', points=450,
        filename='rsa.txt', build=build_rsa_close,
        description=(
            "2048-bitli RSA kaliti — buzib bo'lmaydigandek. Lekin dasturchi ikkinchi tub sonni birinchisidan "
            "keyingi tub sonlar orasidan qidirgan.\n\n"
            "Maqsad: n ni ko'paytuvchilarga ajratib, shifrlangan xabarni oching.\n\n"
            "Mavzu: RSA, Ferma faktorizatsiyasi." + FLAG_NOTE
        ),
    ),
    FileTask(
        slug='hastad', title='Uch bo\'limga bitta xat', category='Crypto', difficulty='hard', points=500,
        filename='xabarlar.txt', build=build_hastad,
        description=(
            "Markaz bir xil buyruqni uchta bo'limga yubordi. Har bo'limning o'z RSA kaliti bor, ammo hammasida "
            "e = 3 va padding ishlatilmagan.\n\n"
            "Maqsad: hech bir kalitni buzmasdan xabarni tiklang.\n\n"
            "Mavzu: RSA, Xitoy qoldiqlar teoremasi, Håstad hujumi." + FLAG_NOTE
        ),
    ),
    FileTask(
        slug='mt_predict', title='Kazino bashoratchisi', category='Crypto', difficulty='hard', points=550,
        filename='kazino.json', build=build_mt,
        description=(
            "Onlayn o'yin «tasodifiy» sonlarni Pythonning random modulidan oladi. Sizda ketma-ket 624 ta natija "
            "va shu generator kaliti bilan shifrlangan sovrin kodi bor.\n\n"
            "Maqsad: generatorning ichki holatini tiklab, keyingi sonlarni bashorat qiling.\n\n"
            "Mavzu: Mersenne Twister (MT19937), untempering." + FLAG_NOTE
        ),
    ),
    FileTask(
        slug='tiny_vm', title='Qora quti', category='Reverse', difficulty='hard', points=600,
        filename='qora_quti.py', build=build_vm,
        description=(
            "Kalit tekshiruvi o'ylab topilgan virtual mashina ichida bajariladi: dastur — tushunarsiz baytlar "
            "qatori. Har belgi bir necha amaldan o'tadi va boshqa belgilar bilan aralashtiriladi.\n\n"
            "Maqsad: VM buyruqlarini tushunib, disassembler yozing va kalitni tiklang.\n\n"
            "Mavzu: Reverse engineering, virtual mashina, cheklovlarni yechish." + FLAG_NOTE
        ),
    ),
    FileTask(
        slug='lsb_png', title='Piksel ostida', category='Forensics', difficulty='hard', points=450,
        filename='rasm.png', build=build_lsb_png,
        description=(
            "Oddiy gradient rasm. Lekin fayl hajmi kutilganidan kattaroq, metama'lumotlarda esa g'alati izoh bor.\n\n"
            "Maqsad: rasmga yashirilgan ma'lumotni chiqarib, uni oching.\n\n"
            "Mavzu: steganografiya (LSB), PNG metama'lumotlari, XOR." + FLAG_NOTE
        ),
    ),
]

TASKS_BY_SLUG = {t.slug: t for t in TASKS}

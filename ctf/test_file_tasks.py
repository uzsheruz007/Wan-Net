"""Fayl masalalari: har birini o'quvchi kabi yechamiz — flag faqat berilgan fayldan tiklanishi kerak."""
import base64
import bz2
import gzip
import io
import json
import lzma
import random
import re
import struct
import tarfile
import tempfile
import zipfile
from collections import Counter
from math import isqrt

from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings
from PIL import Image

from .file_tasks import HASTAD_PREFIX, TASKS, TASKS_BY_SLUG, VM_OPS, _checksum, vigenere
from .models import Challenge

FLAG = 'WanNet{test_0123456789abcdef}'


def build(slug):
    return TASKS_BY_SLUG[slug].build(FLAG)


def run_source(slug, source=None):
    ns = {'__name__': 'task'}
    exec(compile((source or build(slug)).decode(), slug, 'exec'), ns)
    return ns


def parse_ints(text):
    return {k: int(v) for k, v in re.findall(r'^(\w+) = (\d+)$', text, re.M)}


def int_to_bytes(m):
    return m.to_bytes((m.bit_length() + 7) // 8, 'big')


class FileTaskSolverTests(SimpleTestCase):
    def test_catalog(self):
        self.assertEqual(Counter(t.difficulty for t in TASKS), {'medium': 5, 'hard': 5})
        self.assertEqual(len({t.title for t in TASKS}), len(TASKS))

    def test_flag_not_in_plain_sight(self):
        for task in TASKS:
            self.assertNotIn(FLAG.encode(), task.build(FLAG), task.slug)

    def test_xor_byte(self):
        data = base64.b64decode(build('xor_byte'))
        self.assertIn(FLAG.encode(), [bytes(b ^ k for b in data) for k in range(256)])

    def test_vigenere_kasiski_and_frequency(self):
        text = build('vigenere').decode()
        letters = ''.join(c.lower() for c in text if c.isascii() and c.isalpha())
        seen, dists = {}, []
        for i in range(len(letters) - 3):
            tri = letters[i:i + 3]
            if tri in seen:
                dists.append(i - seen[tri])
            seen[tri] = i
        votes = Counter(L for d in dists for L in range(4, 13) if d % L == 0)
        for length in sorted(votes, key=lambda L: votes[L] * L, reverse=True)[:6]:
            key = ''
            for col in range(length):
                counts = Counter(letters[col::length])
                key += chr(max(range(26), key=lambda s: sum(
                    counts[chr((ord(e) - 97 + s) % 26 + 97)] for e in 'etaoinsh')) + 97)
            if FLAG in vigenere(text, key, decrypt=True):
                return
        self.fail('kalit topilmadi')

    def test_pcap_basic_auth(self):
        data = build('pcap_basic')
        self.assertEqual(data[:4], bytes.fromhex('d4c3b2a1'))
        token = re.search(rb'Authorization: Basic ([A-Za-z0-9+/=]+)', data).group(1)
        self.assertEqual(base64.b64decode(token).decode(), f'kotib:{FLAG}')

    def test_pcap_checksums_valid(self):
        data, pos, count = build('pcap_basic'), 24, 0
        while pos < len(data):
            n = struct.unpack('<I', data[pos + 8:pos + 12])[0]
            pkt = data[pos + 16:pos + 16 + n]
            pos += 16 + n
            ip, tcp = pkt[14:34], pkt[34:]
            self.assertEqual(_checksum(ip), 0)
            self.assertEqual(_checksum(ip[12:20] + struct.pack('!BBH', 0, 6, len(tcp)) + tcp), 0)
            count += 1
        self.assertEqual(count, 42)

    def test_matryoshka(self):
        data, layers = build('matryoshka'), 0
        while FLAG.encode() not in data:
            if data[:2] == b'\x1f\x8b':
                data = gzip.decompress(data)
            elif data[:3] == b'BZh':
                data = bz2.decompress(data)
            elif data[:6] == b'\xfd7zXZ\x00':
                data = lzma.decompress(data)
            elif data[:4] == b'PK\x03\x04':
                z = zipfile.ZipFile(io.BytesIO(data))
                data = z.read(z.namelist()[0])
            elif data[257:262] == b'ustar':
                t = tarfile.open(fileobj=io.BytesIO(data))
                data = t.extractfile(t.getmembers()[0]).read()
            else:
                self.fail("noma'lum format")
            layers += 1
        self.assertEqual(layers, 40)
        self.assertIn(FLAG.encode(), data)

    def test_pycheck_inverted(self):
        source = build('pycheck')
        ns = run_source('pycheck', source)
        self.assertTrue(ns['tekshir'](FLAG))
        self.assertFalse(ns['tekshir'](FLAG[:-2] + 'x}'))
        k, t = ns['_k'], ns['_t']
        mul = int(re.search(r'i \* (\d+)\) & 0xff\) ==', source.decode()).group(1))
        key = ''.join(
            chr(((((v >> 3) | (v << 5)) & 0xff) - i * mul & 0xff) ^ k[i % len(k)]) for i, v in enumerate(t))
        self.assertEqual(key, FLAG)

    def test_rsa_fermat(self):
        v = parse_ints(build('rsa_close').decode())
        n = v['n']
        self.assertGreaterEqual(n.bit_length(), 2047)
        a = isqrt(n) + 1
        while isqrt(a * a - n) ** 2 != a * a - n:
            a += 1
        b = isqrt(a * a - n)
        p, q = a - b, a + b
        self.assertEqual(p * q, n)
        m = pow(v['c'], pow(v['e'], -1, (p - 1) * (q - 1)), n)
        self.assertEqual(int_to_bytes(m).decode(), FLAG)

    def test_hastad_crt(self):
        v = parse_ints(build('hastad').decode())
        ns, cs = [v['n1'], v['n2'], v['n3']], [v['c1'], v['c2'], v['c3']]
        N = ns[0] * ns[1] * ns[2]
        x = sum(c * (N // n) * pow(N // n, -1, n) for c, n in zip(cs, ns)) % N
        lo, hi = 0, 1 << (N.bit_length() // 3 + 2)
        while lo < hi:
            mid = (lo + hi) // 2
            lo, hi = (mid + 1, hi) if mid ** 3 < x else (lo, mid)
        self.assertEqual(lo ** 3, x)
        self.assertGreater(x, ns[0])  # bitta modulda oddiy kub ildiz bilan yechilmaydi
        self.assertEqual(int_to_bytes(lo), HASTAD_PREFIX + FLAG.encode())

    def test_mt_untemper(self):
        body = json.loads(build('mt_predict'))

        def untemper(y):
            y ^= y >> 18
            y ^= (y << 15) & 0xefc60000
            x = y
            for _ in range(4):
                x = y ^ ((x << 7) & 0x9d2c5680)
            y = x & 0xffffffff
            x = y
            for _ in range(2):
                x = y ^ (x >> 11)
            return x

        rng = random.Random()
        rng.setstate((3, tuple(untemper(v) for v in body['natijalar']) + (624,), None))
        ct = bytes.fromhex(body['shifr_hex'])
        key = rng.getrandbits(8 * len(ct)).to_bytes(len(ct), 'little')
        self.assertEqual(bytes(a ^ b for a, b in zip(ct, key)).decode(), FLAG)

    def test_tiny_vm_disassemble_and_solve(self):
        ns = run_source('tiny_vm')
        self.assertTrue(ns['ishga_tushir'](FLAG))
        self.assertFalse(ns['ishga_tushir'](FLAG[:-2] + 'x}'))
        self.assertFalse(ns['ishga_tushir'](FLAG + 'x'))

        names = {v: k for k, v in VM_OPS.items()}
        prog, ip, blocks, cur = ns['DASTUR'], 2, [], []
        while names[prog[ip]] != 'END':
            name = names[prog[ip]]
            if name in ('PUSH', 'IN', 'ROL'):
                cur.append((name, prog[ip + 1]))
                ip += 2
            elif name == 'CHK':
                blocks.append((cur, prog[ip + 1]))
                cur, ip = [], ip + 2
            else:
                cur.append((name, None))
                ip += 1

        known = {}
        for ops, target in blocks:
            i, v = ops[0][1], target
            if ops[-1][0] == 'XOR' and ops[-2][0] == 'IN':
                v ^= known[ops[-2][1]]  # oldin tiklangan belgi bilan aralashgan
                ops = ops[:-2]
            steps, k = [], 1
            while k < len(ops):
                if ops[k][0] == 'ROL':
                    steps.append(ops[k])
                    k += 1
                else:
                    steps.append((ops[k + 1][0], ops[k][1]))
                    k += 2
            for name, a in reversed(steps):
                if name == 'ROL':
                    v = ((v >> a) | (v << (8 - a))) & 0xff
                else:
                    v = {'ADD': (v - a) & 0xff, 'SUB': (v + a) & 0xff, 'XOR': v ^ a}[name]
            known[i] = v
        self.assertEqual(bytes(known[i] for i in range(prog[1])).decode(), FLAG)

    def test_lsb_png(self):
        img = Image.open(io.BytesIO(build('lsb_png')))
        key = bytes.fromhex(img.info['Comment'].split('=')[1])
        w, h = img.size
        px = img.load()
        bits = [px[x, y][2] & 1 for x in range(w) for y in range(h)]

        def read(start, count):
            return bytes(int(''.join(map(str, bits[start + i * 8:start + i * 8 + 8])), 2) for i in range(count))

        payload = read(16, struct.unpack('>H', read(0, 2))[0])
        self.assertEqual(bytes(b ^ key[i % len(key)] for i, b in enumerate(payload)).decode(), FLAG)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class InitFileChallengesTests(TestCase):
    def test_creates_file_and_keeps_flag_without_regen(self):
        call_command('init_file_challenges', 'xor_byte', stdout=io.StringIO())
        c = Challenge.objects.get(title='Bir baytli sir')
        self.assertEqual((c.difficulty, c.is_active, c.file.name), ('medium', True, 'ctf_files/tasks/xabar.txt'))
        old_hash = c.flag_hash

        call_command('init_file_challenges', 'xor_byte', stdout=io.StringIO())
        self.assertEqual(Challenge.objects.get(pk=c.pk).flag_hash, old_hash)

        call_command('init_file_challenges', '--regen', 'xor_byte', stdout=io.StringIO())
        c.refresh_from_db()
        self.assertNotEqual(c.flag_hash, old_hash)
        self.assertEqual(c.file.name, 'ctf_files/tasks/xabar.txt')

    def test_unknown_slug(self):
        from django.core.management.base import CommandError
        with self.assertRaises(CommandError):
            call_command('init_file_challenges', 'yoq', stdout=io.StringIO())

"""Docker laboratoriyalarni ro'yxatdan o'tkazadi va (--build bilan) image'larini yangi flag bilan yig'adi.

    python manage.py init_docker_challenges --build            # hammasi
    python manage.py init_docker_challenges --build sqli_login # bittasi

--build'siz faqat masala yozuvlari (sarlavha, tavsif, ball, qiyinlik, image) yangilanadi, flag o'zgarmaydi.
Flag repoda saqlanmaydi: tasodifiy yaratiladi, image'ga build-arg sifatida beriladi, bazaga faqat xeshi yoziladi.
"""
import hashlib
import secrets
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from ctf.labs import LABS, LABS_BY_SLUG
from ctf.models import Challenge

LABS_DIR = Path(settings.BASE_DIR) / 'challenges' / 'docker'

# Eski nomlar: mavjud yozuv yangisiga bog'lanadi (yechimlar saqlanadi)
LEGACY_IMAGES = {'ping_rce': 'wan-net/ping-rce:latest'}


def new_flag(slug):
    return f"WanNet{{{slug}_{secrets.token_hex(8)}}}"


def build_image(lab, flag):
    from ctf import docker_utils

    if not docker_utils.client:
        raise CommandError("Docker ishlamayapti: image yig'ib bo'lmaydi.")
    docker_utils.client.images.build(
        path=str(LABS_DIR / lab.slug), tag=lab.image, buildargs={'FLAG': flag}, rm=True, pull=True,
    )


class Command(BaseCommand):
    help = "Docker laboratoriyalarni yaratadi/yangilaydi; --build image'larni yangi flag bilan yig'adi"

    def add_arguments(self, parser):
        parser.add_argument('slugs', nargs='*', help="Faqat shu lablar (masalan: sqli_login ssti_card)")
        parser.add_argument('--build', action='store_true', help="Image'ni yig'ib, yangi flag o'rnatish")

    def handle(self, *args, slugs, build, **options):
        unknown = [s for s in slugs if s not in LABS_BY_SLUG]
        if unknown:
            raise CommandError(f"Noma'lum lab: {', '.join(unknown)}. Mavjud: {', '.join(LABS_BY_SLUG)}")

        for lab in [LABS_BY_SLUG[s] for s in slugs] if slugs else LABS:
            challenge = (
                Challenge.objects.filter(docker_image_name__in=[lab.image, LEGACY_IMAGES.get(lab.slug, lab.image)]).first()
                or Challenge.objects.filter(title=lab.title).first()
                or Challenge(flag_hash='')
            )
            challenge.title = lab.title
            challenge.description = lab.description
            challenge.category = lab.category
            challenge.points = lab.points
            challenge.difficulty = lab.difficulty
            challenge.docker_image_name = lab.image
            challenge.docker_port = lab.port

            if build:
                flag = new_flag(lab.slug)
                self.stdout.write(f"[{lab.slug}] image yig'ilmoqda: {lab.image}")
                build_image(lab, flag)
                challenge.flag_hash = hashlib.sha256(flag.encode()).hexdigest()
            elif not challenge.flag_hash:
                # Image hali yig'ilmagan: masala yopiq turadi
                challenge.is_active = False

            if build:
                challenge.is_active = True
            challenge.save()
            state = 'faol' if challenge.is_active else "yopiq (--build kerak)"
            self.stdout.write(self.style.SUCCESS(f"[{lab.slug}] #{challenge.pk} {lab.title} — {state}"))

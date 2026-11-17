"""Fayl asosidagi masalalarni (ctf/file_tasks.py) yaratadi yoki yangilaydi.

    python manage.py init_file_challenges              # yangilarini yaratadi, mavjudlarining faqat matnini yangilaydi
    python manage.py init_file_challenges --regen      # hammasiga yangi flag va yangi fayl
    python manage.py init_file_challenges --regen tiny_vm

Flag repoda saqlanmaydi: tasodifiy yaratiladi, faylga joylanadi, bazaga faqat xeshi yoziladi.
"""
import hashlib
import secrets

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError

from ctf.file_tasks import TASKS, TASKS_BY_SLUG
from ctf.models import Challenge


def new_flag(slug):
    return f"WanNet{{{slug}_{secrets.token_hex(8)}}}"


class Command(BaseCommand):
    help = "Fayl asosidagi masalalarni yaratadi; --regen yangi flag va fayl beradi"

    def add_arguments(self, parser):
        parser.add_argument('slugs', nargs='*', help="Faqat shu masalalar (masalan: hastad tiny_vm)")
        parser.add_argument('--regen', action='store_true', help="Yangi flag va fayl yaratish")

    def handle(self, *args, slugs, regen, **options):
        unknown = [s for s in slugs if s not in TASKS_BY_SLUG]
        if unknown:
            raise CommandError(f"Noma'lum masala: {', '.join(unknown)}. Mavjud: {', '.join(TASKS_BY_SLUG)}")

        for task in [TASKS_BY_SLUG[s] for s in slugs] if slugs else TASKS:
            challenge = Challenge.objects.filter(title=task.title).first() or Challenge(flag_hash='')
            challenge.title = task.title
            challenge.description = task.description
            challenge.category = task.category
            challenge.points = task.points
            challenge.difficulty = task.difficulty

            if regen or not challenge.flag_hash or not challenge.file:
                flag = new_flag(task.slug)
                if challenge.file:
                    challenge.file.delete(save=False)
                challenge.file.save(f'tasks/{task.filename}', ContentFile(task.build(flag)), save=False)
                challenge.flag_hash = hashlib.sha256(flag.encode()).hexdigest()
                challenge.is_active = True
                state = 'yangi flag'
            else:
                state = "matn yangilandi, flag o'zgarmadi"
            challenge.save()
            self.stdout.write(self.style.SUCCESS(f"[{task.slug}] #{challenge.pk} {task.title} — {state}"))

from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from ctf import docker_utils
from ctf.models import ActiveContainer


class Command(BaseCommand):
    help = "Muddati o'tgan yoki o'chib qolgan laboratoriya konteynerlarini tozalaydi"

    def handle(self, *args, **options):
        deadline = timezone.now() - timedelta(minutes=settings.LAB_LIFETIME_MINUTES)
        removed = 0
        for lab in ActiveContainer.objects.all():
            expired = lab.created_at < deadline
            if expired or docker_utils.get_container_status(lab.container_id) != "running":
                if expired:
                    docker_utils.stop_container(lab.container_id)
                lab.delete()
                removed += 1
        self.stdout.write(f"Tozalandi: {removed}")

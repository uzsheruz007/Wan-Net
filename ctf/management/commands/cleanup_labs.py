from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from ctf import docker_utils
from ctf.models import ActiveContainer

# Sahifa ochilishi, so'rovlar — bir necha KB; bo'sh konteyner shovqini ≤5 bayt/s
ACTIVE_BYTES_PER_SECOND = 8


def is_idle(lab, now):
    """Trafikni yangilaydi; lab LAB_IDLE_MINUTES davomida ishlatilmagan bo'lsa — True."""
    total = docker_utils.get_traffic_bytes(lab.container_id)
    if total is None:
        return False
    elapsed = (now - lab.checked_at).total_seconds()
    if elapsed > 0 and (total - lab.traffic_bytes) / elapsed >= ACTIVE_BYTES_PER_SECOND:
        lab.active_at = now
    lab.traffic_bytes, lab.checked_at = total, now
    lab.save(update_fields=['traffic_bytes', 'checked_at', 'active_at'])
    return now - lab.active_at > timedelta(minutes=settings.LAB_IDLE_MINUTES)


class Command(BaseCommand):
    help = "Muddati o'tgan, ishlatilmayotgan yoki o'chib qolgan laboratoriya konteynerlarini tozalaydi"

    def handle(self, *args, **options):
        now = timezone.now()
        deadline = now - timedelta(minutes=settings.LAB_LIFETIME_MINUTES)
        removed = 0
        for lab in ActiveContainer.objects.all():
            if docker_utils.get_container_status(lab.container_id) != "running":
                lab.delete()
                removed += 1
            elif lab.created_at < deadline or is_idle(lab, now):
                docker_utils.stop_container(lab.container_id)
                lab.delete()
                removed += 1
        self.stdout.write(f"Tozalandi: {removed}")

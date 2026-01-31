from django.core.management.base import BaseCommand
from ctf.models import Challenge

class Command(BaseCommand):
    help = 'Initializes Docker-based Challenges'

    def handle(self, *args, **options):
        self.stdout.write("Checking for Docker challenges...")

        # Challenge 1: Ping RCE
        challenge, created = Challenge.objects.get_or_create(
            title="Network Diagnostic Tool",
            defaults={
                'description': (
                    "Bizning ma'murlarimiz serverlarni tekshirish uchun ushbu vositadan foydalanishadi. "
                    "Biroq, u juda xavfsiz ko'rinmayapti. Tizimga kirish yo'lini toping va /flag.txt ni o'qing.\n\n"
                    "**Turi:** Remote Code Execution (RCE)\n"
                    "**Qiyinchilik:** O'rta"
                ),
                'category': 'Web',
                'points': 500,
                'flag_hash': 'WanNet{RCE_byp4ss_m4st3r_3301}', # In real app, hash this!
                'docker_image_name': 'wan-net/ping-rce:latest',
                'docker_port': 5000,
                'is_active': True
            }
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f"Created challenge: {challenge.title}"))
        else:
            challenge.docker_image_name = 'wan-net/ping-rce:latest'
            challenge.save()
            self.stdout.write(self.style.WARNING(f"Updated challenge: {challenge.title}"))
        
        self.stdout.write(self.style.SUCCESS("All Docker challenges initialized."))

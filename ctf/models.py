from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

class Challenge(models.Model):
    CATEGORY_CHOICES = (
        ('Web', 'Web Exploitation'),
        ('Crypto', 'Cryptography'),
        ('OSINT', 'OSINT'),
        ('Forensics', 'Forensics'),
        ('Reverse', 'Reverse Engineering'),
        ('Misc', 'Miscellaneous'),
    )

    title = models.CharField(max_length=200, verbose_name="Sarlavha")
    description = models.TextField(verbose_name="Tavsif")
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, verbose_name="Kategoriya")
    points = models.IntegerField(default=10, verbose_name="Ball")
    flag_hash = models.CharField(max_length=256, help_text="Flagning SHA256 хeshi", verbose_name="Flag Xeshi")
    is_active = models.BooleanField(default=True, verbose_name="Faolmi?")
    file = models.FileField(upload_to='ctf_files/', blank=True, null=True, help_text="Masala uchun fayl (ixtiyoriy)", verbose_name="Fayl")
    html_content = models.TextField(blank=True, null=True, verbose_name="HTML Kod (Web Challenge uchun)", help_text="Agar bu Web challenge bo'lsa, bu yerga HTML kodni yozing. U alohida sahifa bo'lib ochiladi.")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan vaqt")

    def __str__(self):
        return f"{self.title} ({self.category}) - {self.points} pts"
    
    class Meta:
        verbose_name = "Masala"
        verbose_name_plural = "Masalalar"

class SolvedChallenge(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='solved_challenges', verbose_name="Foydalanuvchi")
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, verbose_name="Masala")
    solved_at = models.DateTimeField(auto_now_add=True, verbose_name="Yechilgan vaqt")

    class Meta:
        unique_together = ('user', 'challenge')
        verbose_name = "Yechilgan Masala"
        verbose_name_plural = "Yechilgan Masalalar"

    def __str__(self):
        return f"{self.user.username} solved {self.challenge.title}"

class CTFProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='ctf_profile', verbose_name="Foydalanuvchi")
    total_points = models.IntegerField(default=0, verbose_name="Jami Ball")
    last_solved = models.DateTimeField(auto_now=True, verbose_name="Oxirgi yechim vaqti")

    class Meta:
        verbose_name = "CTF Profil"
        verbose_name_plural = "CTF Profillari"

    def __str__(self):
        return f"{self.user.username} - {self.total_points} pts"

# Signal to create CTFProfile when User is created
@receiver(post_save, sender=User)
def create_ctf_profile(sender, instance, created, **kwargs):
    if created:
        CTFProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_ctf_profile(sender, instance, **kwargs):
    # Ensure profile exists
    CTFProfile.objects.get_or_create(user=instance)
    instance.ctf_profile.save()

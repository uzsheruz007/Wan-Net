from django.db import models
import secrets # Token generatsiya uchun
from django.contrib.auth.models import User
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

class Challenge(models.Model):
    CATEGORY_CHOICES = (
        ('Web', 'Web'),
        ('Crypto', 'Kriptografiya'),
        ('OSINT', 'OSINT'),
        ('Forensics', 'Forensika'),
        ('Reverse', 'Reverse Engineering'),
        ('Misc', 'Boshqa'),
    )

    title = models.CharField(max_length=200, verbose_name="Sarlavha")
    description = models.TextField(verbose_name="Tavsif")
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, verbose_name="Kategoriya")
    points = models.IntegerField(default=10, verbose_name="Ball")
    flag_hash = models.CharField(max_length=256, help_text="Flagning SHA256 хeshi", verbose_name="Flag Xeshi")
    is_active = models.BooleanField(default=True, verbose_name="Faolmi?")
    file = models.FileField(upload_to='ctf_files/', blank=True, null=True, help_text="Masala uchun fayl (ixtiyoriy)", verbose_name="Fayl")
    html_content = models.TextField(blank=True, null=True, verbose_name="HTML Kod (Web Challenge uchun)", help_text="Agar bu Web challenge bo'lsa, bu yerga HTML kodni yozing. U alohida sahifa bo'lib ochiladi.")
    
    # Docker Integration
    docker_image_name = models.CharField(max_length=255, blank=True, null=True, help_text="Docker image name (e.g., wan-net/ping-rce:latest)", verbose_name="Docker Image")
    docker_port = models.IntegerField(default=5000, help_text="Internal port exposed by the container", verbose_name="Docker Port")

    # Agar masala turnirga tegishli bo'lsa, uni shu yerda tanlaymiz. Agar bo'sh bo'lsa - bu oddiy mashq masalasi.
    tournament = models.ForeignKey('Tournament', on_delete=models.SET_NULL, null=True, blank=True, related_name='challenges', verbose_name="Turnir")
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

class ChallengeAttempt(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='challenge_attempts', verbose_name="Foydalanuvchi")
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE, related_name='attempts', verbose_name="Masala")
    input_flag = models.CharField(max_length=255, verbose_name="Kiritilgan flag")
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name="Vaqt")
    is_correct = models.BooleanField(default=False, verbose_name="To'g'rimi?")

    class Meta:
        ordering = ['-timestamp']
        verbose_name = "Urinish"
        verbose_name_plural = "Urinishlar"

class CTFProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='ctf_profile', verbose_name="Foydalanuvchi")
    total_points = models.IntegerField(default=0, verbose_name="Jami Ball")
    last_solved = models.DateTimeField(auto_now_add=True, verbose_name="Oxirgi yechim vaqti")
    avatar = models.ImageField(upload_to='profile_avatars/', blank=True, null=True, verbose_name="Avatar")
    telegram_id = models.BigIntegerField(null=True, blank=True, unique=True, verbose_name="Telegram ID")

    class Meta:
        verbose_name = "CTF Profil"
        verbose_name_plural = "CTF Profillari"

    def __str__(self):
        return f"{self.user.username} - {self.total_points} pts"

# --- TOURNAMENT SYSTEM MODELS ---

class Tournament(models.Model):
    MODE_CHOICES = (
        ('SOLO', 'Yakkalik'),
        ('TEAM', 'Jamoaviy'),
    )

    title = models.CharField(max_length=255, verbose_name="Turnir Nomi")
    description = models.TextField(verbose_name="Tavsif")
    start_date = models.DateTimeField(verbose_name="Boshlanish Vaqti")
    end_date = models.DateTimeField(verbose_name="Tugash Vaqti")
    is_active = models.BooleanField(default=False, verbose_name="Faolmi?")
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='SOLO', verbose_name="Format")
    
    # Kelajakda avtomatik ochish/yopish uchun
    
    def __str__(self):
        return self.title
    
    class Meta:
        verbose_name = "Turnir"
        verbose_name_plural = "Turnirlar"

class ActiveContainer(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='active_containers')
    challenge = models.ForeignKey(Challenge, on_delete=models.CASCADE)
    container_id = models.CharField(max_length=255)
    host_port = models.IntegerField(help_text="Port on the host machine")
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('user', 'challenge')

class Team(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="Jamoa Nomi")
    captain = models.ForeignKey(User, on_delete=models.CASCADE, related_name='captained_teams', verbose_name="Kapitan")
    motto = models.CharField(max_length=255, blank=True, verbose_name="Shior")
    avatar = models.ImageField(upload_to='team_avatars/', blank=True, null=True, verbose_name="Jamoa Logosi")
    token = models.CharField(max_length=10, unique=True, blank=True, verbose_name="Taklif Kodi (Invite Token)")
    members = models.ManyToManyField(User, related_name='teams', blank=True, verbose_name="A'zolar")
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.token:
            # 8 belgili unikal kod (masalan: A1B2C3D4)
            self.token = secrets.token_hex(4).upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Jamoa"
        verbose_name_plural = "Jamoalar"

class TournamentRegistration(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='registrations', verbose_name="Turnir")
    # Agar SOLO bo'lsa user to'ldiriladi, TEAM bo'lsa team to'ldiriladi
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='tournament_regs', verbose_name="Ishtirokchi (Yakka)")
    team = models.ForeignKey(Team, on_delete=models.CASCADE, null=True, blank=True, related_name='tournament_regs', verbose_name="Ishtirokchi (Jamoa)")
    
    score = models.IntegerField(default=0, verbose_name="Turnir Bali")
    last_solved = models.DateTimeField(auto_now=True, verbose_name="Oxirgi yechim vaqti")

    class Meta:
        unique_together = [['tournament', 'user'], ['tournament', 'team']]
        verbose_name = "Turnir Ishtirokchisi"
        verbose_name_plural = "Turnir Ishtirokchilari"

class TelegramAuth(models.Model):
    telegram_id = models.BigIntegerField(unique=True, verbose_name="Telegram ID")
    username = models.CharField(max_length=255, null=True, blank=True, verbose_name="Telegram Username")
    access_code = models.CharField(max_length=6, verbose_name="Tasdiqlash kodi")
    created_at = models.DateTimeField(auto_now=True, verbose_name="Yaratilgan vaqt")
    
    def __str__(self):
        return f"{self.telegram_id} - {self.access_code}"

# Signal to create CTFProfile when User is created
@receiver(post_save, sender=User)
def create_ctf_profile(sender, instance, created, **kwargs):
    if created:
        CTFProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_ctf_profile(sender, instance, **kwargs):
    # Ensure profile exists
    if hasattr(instance, 'ctf_profile'):
        instance.ctf_profile.save()
    else:    
        CTFProfile.objects.get_or_create(user=instance)

@receiver(post_delete, sender=SolvedChallenge)
def subtract_points_on_delete(sender, instance, **kwargs):
    """
    Agar yechilgan masala (SolvedChallenge) o'chirilsa, foydalanuvchi balidan ayirib tashlash.
    """
    try:
        profile = instance.user.ctf_profile
        profile.total_points -= instance.challenge.points
        # Ball manfiy bo'lib qolmasligi uchun tekshirish ixtiyoriy, 
        # lekin agarda hisob-kitob to'g'ri bo'lsa, manfiy bo'lmasligi kerak.
        # Agar oldin xato bilan ko'p yozilgan bo'lsa, 0 ga tushirish mantiqan to'g'ri.
        if profile.total_points < 0:
            profile.total_points = 0
            
        profile.save()
    except Exception:
        # User o'chib ketgan bo'lsa yoki profil yo'q bo'lsa
        pass

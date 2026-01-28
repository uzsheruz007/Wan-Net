from django.db import models
from django.contrib.auth.models import User  # User modelini import qilishni unutmang!
from django_ckeditor_5.fields import CKEditor5Field

# 1. Kurs modeli
class Course(models.Model):
    title = models.CharField(max_length=200, verbose_name="Kurs nomi")
    subtitle = models.CharField(max_length=200, verbose_name="Qisqacha mazmuni")
    description = models.TextField(verbose_name="Batafsil ma'lumot")
    level = models.CharField(max_length=50, verbose_name="Daraja")
    duration = models.CharField(max_length=50, verbose_name="Davomiyligi")
    icon = models.CharField(max_length=50, default="fas fa-book", verbose_name="Belgi (Icon)")
    image = models.ImageField(upload_to='course_images/', blank=True, null=True, verbose_name="Kurs Rasmi")


    def __str__(self):
        return self.title

    class Meta:
        verbose_name = "Kurs"
        verbose_name_plural = "Kurslar"


# 2. Modul modeli
class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules", verbose_name="Kurs")
    title = models.CharField(max_length=200, verbose_name="Modul nomi")
    order = models.PositiveIntegerField(verbose_name="Tartib raqami")

    def __str__(self):
        return f"{self.order}. {self.title}"

    class Meta:
        verbose_name = "Modul"
        verbose_name_plural = "Modullar"


# 3. Dars modeli
class Lesson(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons", verbose_name="Modul")
    title = models.CharField(max_length=200, verbose_name="Dars mavzusi")
    video_file = models.FileField(upload_to='videos/', blank=True, null=True, verbose_name="Video fayl")
    content = CKEditor5Field(verbose_name="Mazmuni", config_name='default')
    order = models.PositiveIntegerField(verbose_name="Tartib raqami")
    is_free = models.BooleanField(default=False, verbose_name="Bepulmi?")

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = "Dars"
        verbose_name_plural = "Darslar"


# 4. Test savollari
class Quiz(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="quizzes", verbose_name="Dars")
    question = models.CharField(max_length=255, verbose_name="Savol")

    def __str__(self):
        return self.question

    class Meta:
        verbose_name = "Test"
        verbose_name_plural = "Testlar"


# 5. Test javoblari
class QuizOption(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="options", verbose_name="Savol")
    text = models.CharField(max_length=200, verbose_name="Javob varianti")
    is_correct = models.BooleanField(default=False, verbose_name="To'g'ri javobmi?")

    def __str__(self):
        return self.text

    class Meta:
        verbose_name = "Javob varianti"
        verbose_name_plural = "Javob variantlari"


class LessonProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, verbose_name="Foydalanuvchi")
    lesson = models.ForeignKey('Lesson', on_delete=models.CASCADE, verbose_name="Dars") # 'Lesson' deb yozdik, mabodo Lesson classi pastroqda bo'lsa
    is_completed = models.BooleanField(default=False, verbose_name="Tugatilganmi?")
    completed_at = models.DateTimeField(auto_now_add=True, verbose_name="Tugatilgan vaqt")

    class Meta:
        # Bir foydalanuvchi bir darsni faqat bir marta "progress" qila olishi uchun
        unique_together = ('user', 'lesson')
        verbose_name = "Dars jarayoni"
        verbose_name_plural = "Dars jarayonlari"

    def __str__(self):
        return f"{self.user.username} - {self.lesson.title}"
    



# 6. User Profile
class UserProfile(models.Model):
    STATUS_CHOICES = [
        ('Beginner', 'Beginner'),
        ('Intermediate', 'Intermediate'),
        ('Advanced', 'Advanced'),
    ]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile', verbose_name="Foydalanuvchi")
    avatar = models.ImageField(upload_to='avatars/', default='avatars/default.png', blank=True, verbose_name="Rasm")
    phone = models.CharField(max_length=20, blank=True, verbose_name="Telefon raqam")
    region = models.CharField(max_length=100, blank=True, verbose_name="Hudud")
    bio = models.TextField(blank=True, verbose_name="O'zi haqida")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Beginner', verbose_name="Holat")

    def __str__(self):
        return f"{self.user.username}'s Profile"

    class Meta:
        verbose_name = "Foydalanuvchi profili"
        verbose_name_plural = "Foydalanuvchi profillari"

# Signal to create/update UserProfile
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    # This prevents "RelatedObjectDoesNotExist" error for old users without profile
    UserProfile.objects.get_or_create(user=instance)
    instance.profile.save()

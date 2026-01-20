from django.db import models
from django.contrib.auth.models import User  # User modelini import qilishni unutmang!

# 1. Kurs modeli
class Course(models.Model):
    title = models.CharField(max_length=200)
    subtitle = models.CharField(max_length=200)
    description = models.TextField()
    level = models.CharField(max_length=50)
    duration = models.CharField(max_length=50)
    icon = models.CharField(max_length=50, default="fas fa-book")


    def __str__(self):
        return self.title


# 2. Modul modeli
class Module(models.Model):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.order}. {self.title}"


# 3. Dars modeli
class Lesson(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200)
    video_url = models.URLField(blank=True)
    content = models.TextField()
    order = models.PositiveIntegerField()
    is_free = models.BooleanField(default=False)

    def __str__(self):
        return self.title


# 4. Test savollari
class Quiz(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="quizzes")
    question = models.CharField(max_length=255)

    def __str__(self):
        return self.question


# 5. Test javoblari
class QuizOption(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="options")
    text = models.CharField(max_length=200)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.text


class LessonProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    lesson = models.ForeignKey('Lesson', on_delete=models.CASCADE) # 'Lesson' deb yozdik, mabodo Lesson classi pastroqda bo'lsa
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Bir foydalanuvchi bir darsni faqat bir marta "progress" qila olishi uchun
        unique_together = ('user', 'lesson')

    def __str__(self):
        return f"{self.user.username} - {self.lesson.title}"
    



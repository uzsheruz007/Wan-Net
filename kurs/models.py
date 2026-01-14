from django.db import models
from django.urls import reverse
from ckeditor.fields import RichTextField


class Course(models.Model):
    LEVEL_CHOICES = (
        ('beginner', "Boshlang'ich"),
        ('intermediate', "O'rta"),
        ('advanced', "Yuqori"),
    )

    CATEGORY_CHOICES = (
        ('network', 'Tarmoq'),
        ('linux', 'Linux'),
        ('security', 'Xavfsizlik'),
        ('cloud', 'Cloud'),
        ('devops', 'DevOps'),
    )

    title = models.CharField(max_length=200)
    short_description = models.CharField(max_length=255)

    description = RichTextField(
        blank=True,
        default="Tavsif kiritilmagan"
    )

    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES)

    image = models.ImageField(
        upload_to='courses/images/',
        blank=True,
        null=True
    )

    duration_hours = models.PositiveIntegerField(
        default=0
    )
    lessons_count = models.PositiveIntegerField(
        default=0
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse('course_detail', args=[self.id])


class Lesson(models.Model):
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='lessons'
    )

    title = models.CharField(max_length=200)

    description = RichTextField(
        blank=True,
        default=""
    )

    order = models.PositiveIntegerField()

    video = models.FileField(
        upload_to='courses/videos/',
        blank=True,
        null=True
    )

    slide = models.FileField(
        upload_to='courses/slides/',
        blank=True,
        null=True
    )

    def __str__(self):
        return f"{self.course.title} - {self.title}"

    class Meta:
        ordering = ['order']

from django.contrib import admin
from .models import Course, Module, Lesson, Quiz, QuizOption

class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 1

class ModuleAdmin(admin.ModelAdmin):
    inlines = [LessonInline]
    list_display = ('title', 'course', 'order')

class QuizOptionInline(admin.TabularInline):
    model = QuizOption
    extra = 2

class QuizAdmin(admin.ModelAdmin):
    inlines = [QuizOptionInline]

admin.site.register(Course)
admin.site.register(Module, ModuleAdmin)
admin.site.register(Lesson)
admin.site.register(Quiz, QuizAdmin)

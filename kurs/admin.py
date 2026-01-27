from django.contrib import admin
from .models import Course, Module, Lesson, Quiz, QuizOption, LessonProgress, UserProfile
from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from allauth.account.models import EmailAddress
from django.contrib.auth.models import Group

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

# Asosiy modellar
admin.site.register(Course)
admin.site.register(Module, ModuleAdmin)
admin.site.register(Lesson)
admin.site.register(Quiz, QuizAdmin)

# Keraksiz modellarni yashirish
def unregister_models():
    models_to_hide = [
        Site,
        SocialAccount,
        SocialApp,
        SocialToken,
        EmailAddress,
        Group # Group ham ko'pincha kerak bo'lmaydi kichik loyihalarda, agar kerak bo'lsa olib tashlayman
    ]
    
    for model in models_to_hide:
        try:
            admin.site.unregister(model)
        except admin.sites.NotRegistered:
            pass

unregister_models()

from django.contrib import admin
from .models import Challenge, SolvedChallenge, CTFProfile

from django import forms
from django.db import models

@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'points', 'is_active', 'created_at')
    list_filter = ('category', 'is_active')
    search_fields = ('title', 'description')
    
    # Textarea ni kattalashtirish va Monospace font berish
    formfield_overrides = {
        models.TextField: {'widget': forms.Textarea(attrs={'rows': 20, 'cols': 100, 'style': 'font-family: monospace;'})},
    }

@admin.register(SolvedChallenge)
class SolvedChallengeAdmin(admin.ModelAdmin):
    list_display = ('user', 'challenge', 'solved_at')
    list_filter = ('challenge',)
    search_fields = ('user__username', 'challenge__title')

@admin.register(CTFProfile)
class CTFProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'total_points', 'last_solved')
    search_fields = ('user__username',)

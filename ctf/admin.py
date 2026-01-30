from django.contrib import admin
from django import forms
from django.db import models
from .models import Challenge, SolvedChallenge, CTFProfile, ChallengeAttempt, Tournament, Team, TournamentRegistration

@admin.register(Challenge)
class ChallengeAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'points', 'tournament', 'is_active', 'created_at')
    list_filter = ('category', 'is_active', 'tournament')
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
    list_display = ('user', 'total_points', 'last_solved', 'telegram_id')
    search_fields = ('user__username', 'telegram_id')

@admin.register(ChallengeAttempt)
class ChallengeAttemptAdmin(admin.ModelAdmin):
    list_display = ('user', 'challenge', 'is_correct', 'timestamp')
    list_filter = ('is_correct', 'challenge')
    search_fields = ('user__username', 'challenge__title', 'input_flag')

@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    list_display = ('title', 'start_date', 'end_date', 'is_active', 'mode')
    list_filter = ('is_active', 'mode')
    search_fields = ('title',)
    actions = ['publish_challenges']

    @admin.action(description="Masalalarni umumiy ro'yxatga chiqarish (Public)")
    def publish_challenges(self, request, queryset):
        total_moved = 0
        for tournament in queryset:
            # Turnirga bog'langan masalalarni topamiz va turnirni NULL qilamiz
            # Bu ularni "Umumiy Masalalar" sahifasida ko'rinadigan qiladi
            updated_count = tournament.challenges.update(tournament=None)
            total_moved += updated_count
            
        self.message_user(request, f"Jami {total_moved} ta masala muvaffaqiyatli umumiy bo'limga o'tkazildi.")

@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('name', 'captain', 'token', 'members_count', 'created_at')
    search_fields = ('name', 'captain__username')
    
    def members_count(self, obj):
        return obj.members.count()
    members_count.short_description = "A'zolar soni"

@admin.register(TournamentRegistration)
class TournamentRegistrationAdmin(admin.ModelAdmin):
    list_display = ('tournament', 'participant', 'score', 'last_solved')
    list_filter = ('tournament',)
    
    def participant(self, obj):
        return obj.team.name if obj.team else obj.user.username
    participant.short_description = "Ishtirokchi"

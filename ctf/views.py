from django import forms
from django.shortcuts import get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST
from django.contrib import messages
from django.utils import timezone
from .models import Challenge, SolvedChallenge, CTFProfile, ChallengeAttempt, Tournament, Team, TournamentRegistration, ActiveContainer
import hashlib
from django.conf import settings
from . import docker_utils
from .api.render import render
import random
import socket

from django.http import HttpResponse

AVATAR_MAX_BYTES = 2 * 1024 * 1024
AVATAR_TYPES = {'JPEG', 'PNG', 'GIF', 'WEBP'}


def clean_image(upload):
    """Avatar/logo: haqiqiy rasm (Pillow tekshiradi), 2 MB gacha. (fayl, xato matni) qaytaradi."""
    if upload.size > AVATAR_MAX_BYTES:
        return None, "Rasm hajmi 2 MB dan oshmasligi kerak."
    try:
        image = forms.ImageField().clean(upload)
    except forms.ValidationError:
        return None, "Faqat rasm fayli (JPG, PNG, GIF, WEBP) yuklash mumkin."
    if getattr(image.image, 'format', None) not in AVATAR_TYPES:
        return None, "Faqat rasm fayli (JPG, PNG, GIF, WEBP) yuklash mumkin."
    return image, None


def ctf_home(request):
    return render(request, 'ctf/ctf_home.html')

from django.db.models import Q, Sum, Count
from django.db import transaction
from django.core.paginator import Paginator


def challenges(request):
    # 1. User Progress (Pre-calculation)
    if request.user.is_authenticated:
        user_solved_ids = set(SolvedChallenge.objects.filter(user=request.user).values_list('challenge_id', flat=True))
        user_attempted_ids = set(ChallengeAttempt.objects.filter(user=request.user).values_list('challenge_id', flat=True))
    else:
        user_solved_ids = set()
        user_attempted_ids = set()

    # Base QuerySet:
    # 1. Turnirga bog'lanmagan (Public)
    # 2. YOKI Turniri tugagan (Archived)
    queryset = Challenge.objects.filter(is_active=True).filter(
        Q(tournament__isnull=True) | 
        Q(tournament__end_date__lt=timezone.now())
    ).order_by('-created_at')
    
    # 2. Search Logic
    query = request.GET.get('q', '').strip()
    if query:
        queryset = queryset.filter(
            Q(title__icontains=query) | 
            Q(description__icontains=query) |
            Q(category__icontains=query)
        )

    # 3. Filter by Category (New logic)
    category_filter = request.GET.get('category', '').strip()
    if category_filter and category_filter != 'Kategoriyalar':
        if category_filter == 'solved':
            if request.user.is_authenticated:
                queryset = queryset.filter(id__in=user_solved_ids)
            else:
                queryset = queryset.none()
        elif category_filter == 'failed':
            if request.user.is_authenticated:
                failed_ids = user_attempted_ids - user_solved_ids
                queryset = queryset.filter(id__in=failed_ids)
            else:
                queryset = queryset.none()
        else:
            queryset = queryset.filter(category=category_filter)

    # 4. Filter by Difficulty
    level_filter = request.GET.get('level', '').strip()
    if level_filter in dict(Challenge.DIFFICULTY_CHOICES):
        queryset = queryset.filter(difficulty=level_filter)
    else:
        level_filter = ''

    # 5. Pagination
    paginator = Paginator(queryset, 12) # Show 12 items per page
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    # We can attach 'is_solved' attribute to objects on the fly for template convenience
    # Calculate starting index for sequential numbering
    start_index = page_obj.start_index() if page_obj.paginator.count > 0 else 0
    
    for i, challenge in enumerate(page_obj):
        challenge.is_solved = challenge.id in user_solved_ids
        challenge.serial_number = start_index + i
        
        # If not solved but attempted -> Failed status
        if not challenge.is_solved and challenge.id in user_attempted_ids:
            challenge.has_failed_attempt = True
        else:
            challenge.has_failed_attempt = False

    # Get all categories defined in the Model
    all_categories = []
    for code, name in Challenge.CATEGORY_CHOICES:
        all_categories.append({
            'code': code,
            'name': name,
            'selected': code == category_filter
        })

    context = {
        'challenges': page_obj, 
        'query': query,
        'selected_category': category_filter,
        'selected_level': level_filter,
        'all_categories': all_categories,
        'total_challenges': Challenge.objects.filter(is_active=True).count(),
        'displayed_count': queryset.count()
    }

    return render(request, 'ctf/challenges.html', context)

@login_required
def challenge_detail(request, challenge_id):
    challenge = get_object_or_404(Challenge, id=challenge_id)
    now = timezone.now()

    # --- TOURNAMENT SECURITY & TEAM LOGIC ---
    tournament = challenge.tournament
    user_team = request.user.teams.first()
    
    # 1. Security Check if Tournament Challenge
    if tournament:
        # 1. Boshlanmagan yoki Nofaol
        if not tournament.is_active or now < tournament.start_date:
             messages.error(request, "Bu masala hozir yopiq.")
             return redirect('tournaments')
        
        # 2. Agar turnir tugagan bo'lsa:
        if now > tournament.end_date:
             # Agar Turnir sahifasidan kelgan bo'lsa -> TAQIQLASH
             if request.GET.get('from_tournament') == 'true':
                 messages.error(request, "Turnir vaqti tugadi! Endi masalalarni yecha olmaysiz.")
                 return redirect('tournament_detail', tournament_id=tournament.id)
             # Agar Arena (Mashqlar) sahifasidan kelgan bo'lsa -> RUXSAT (PASS)
             pass 
        else:
             # 3. Agar turnir davom etayotgan bo'lsa -> Ro'yxatdan o'tish shart
            is_registered = False
            if tournament.mode == 'SOLO':
                is_registered = TournamentRegistration.objects.filter(tournament=tournament, user=request.user).exists()
            else:
                if user_team:
                    is_registered = TournamentRegistration.objects.filter(tournament=tournament, team=user_team).exists()
            
            if not is_registered:
                messages.error(request, "Siz ushbu turnirga ro'yxatdan o'tmagansiz.")
                return redirect('tournament_detail', tournament_id=tournament.id)
    
    # 2. Check Solved Status (Team Aware)
    is_solved = False
    if tournament and tournament.mode == 'TEAM' and user_team:
        # Check if ANY team member solved it
        team_members = user_team.members.all()
        is_solved = SolvedChallenge.objects.filter(challenge=challenge, user__in=team_members).exists()
    else:
        is_solved = SolvedChallenge.objects.filter(user=request.user, challenge=challenge).exists()

    # 3. Docker Status (If Docker Challenge)
    active_container = running_container(request.user, challenge) if challenge.docker_image_name else None

    if request.method == 'POST':
        # --- ANTI-BRUTE-FORCE ---
        # 5 attempts in last 1 minute
        fail_count = ChallengeAttempt.objects.filter(
            user=request.user, 
            challenge=challenge,
            is_correct=False,
            timestamp__gte=now - timedelta(minutes=1)
        ).count()
        
        if fail_count >= 5:
            messages.error(request, "Juda ko'p xato urinishlar! Iltimos, 1 daqiqa kuting.")
            return redirect('challenge_detail', challenge_id=challenge.id)
        # ------------------------

        if is_solved:
            messages.info(request, "Bu masalani allaqachon yechgansiz!")
            return redirect('challenge_detail', challenge_id=challenge.id)

        flag_input = request.POST.get('flag', '').strip()
        hashed_input = hashlib.sha256(flag_input.encode()).hexdigest()
        is_correct = (hashed_input == challenge.flag_hash)

        # 3D Kiber-poligon (masala #51) dinamik server-side flagini tekshirish
        if not is_correct and challenge.id == 51:
            try:
                from . import lab3d
                for sc in ('web', 'ad', 'ransomware'):
                    for md in ('red', 'blue'):
                        flg = lab3d.get_dynamic_lab_flag(request, md, sc, challenge.id)
                        if flag_input == flg:
                            is_correct = True
                            break
                    if is_correct:
                        break
            except Exception:
                pass

        # SCADA / ICS Kiber-Fizik poligon (masala #52) dinamik server-side flagini tekshirish
        if not is_correct and challenge.id == 52:
            try:
                from . import scada
                for sc in ('water', 'grid', 'reactor'):
                    for md in ('red', 'blue'):
                        flg = scada.get_dynamic_scada_flag(request, md, sc, challenge.id)
                        if flag_input == flg:
                            is_correct = True
                            break
                    if is_correct:
                        break
            except Exception:
                pass
        
        # Log attempt
        try:
            ChallengeAttempt.objects.create(
                user=request.user, 
                challenge=challenge, 
                input_flag=flag_input,
                is_correct=is_correct
            )
        except:
            pass

        if is_correct:
            try:
                with transaction.atomic():
                    # Check First Blood (Before creating this solve record)
                    # We check if ANY solve exists for this challenge
                    is_first_blood = not SolvedChallenge.objects.filter(challenge=challenge).exists()
                    bonus_points = 50 if is_first_blood else 0
                    
                    # A. Record personal solve
                    SolvedChallenge.objects.create(user=request.user, challenge=challenge)
                    
                    # B. Scoring
                    points_to_add = challenge.points + bonus_points
                    
                    msg = ""
                    if tournament:
                        # Tournament Scoring
                        if tournament.mode == 'TEAM' and user_team:
                            reg = TournamentRegistration.objects.get(tournament=tournament, team=user_team)
                            reg.score += points_to_add
                            reg.save()
                            if is_first_blood:
                                msg = f"🩸 FIRST BLOOD! Jamoangizga {points_to_add} ball ({bonus_points} bonus) qo'shildi!"
                            else:
                                msg = f"TABRIKLAYMIZ! Jamoangizga {points_to_add} ball qo'shildi!"
                        else:
                            reg = TournamentRegistration.objects.get(tournament=tournament, user=request.user)
                            reg.score += points_to_add
                            reg.save()
                            if is_first_blood:
                                msg = f"🩸 FIRST BLOOD! Turnir hisobingizga {points_to_add} ball ({bonus_points} bonus) qo'shildi!"
                            else:
                                msg = f"Turnir hisobingizga {points_to_add} ball qo'shildi!"
                            
                        # Update Global Profile
                        profile, _ = CTFProfile.objects.select_for_update().get_or_create(user=request.user)
                        profile.total_points += points_to_add
                        profile.last_solved = now
                        profile.save()
                        
                        messages.success(request, msg)
                        return redirect('tournament_detail', tournament_id=tournament.id)
                        
                    else:
                        # Regular Challenge
                        profile, _ = CTFProfile.objects.select_for_update().get_or_create(user=request.user)
                        profile.total_points += points_to_add
                        profile.last_solved = now
                        profile.save()
                        if is_first_blood:
                             messages.success(request, f"🩸 FIRST BLOOD! Sizga {points_to_add} ball ({bonus_points} bonus) berildi.")
                        else:
                             messages.success(request, f"Tabriklaymiz! {points_to_add} ball berildi.")
                        return redirect('challenges')
                    
            except Exception as e:
                print(f"Error saving progress: {e}")
                messages.error(request, "Tizimda xatolik. Qayta urinib ko'ring.")
        else:
            messages.error(request, "Flag noto'g'ri!")

    return render(request, 'ctf/challenge_detail.html', {
        'challenge': challenge, 
        'is_solved': is_solved,
        'active_container': active_container,
        'lifetime': settings.LAB_LIFETIME_MINUTES,
    })

def leaderboard(request):
    queryset = CTFProfile.objects.order_by('-total_points', 'last_solved')

    paginator = Paginator(queryset, 20)
    page_obj = paginator.get_page(request.GET.get('page'))
    page_number = page_obj.number

    start_rank = page_obj.start_index()
    for i, profile in enumerate(page_obj):
        profile.rank = start_rank + i

    podium = []
    if page_number == 1:
        items = list(page_obj)
        podium = items[:3]

    return render(request, 'ctf/leaderboard_v2.html', {
        'page_obj': page_obj,
        'podium': podium,
        'is_first_page': page_number == 1,
        'is_paginated': page_obj.has_other_pages(),
    })

@login_required
def profile(request):
    user_profile, created = CTFProfile.objects.get_or_create(user=request.user)

    if request.method == 'POST':
        if 'avatar' in request.FILES:
            avatar, error = clean_image(request.FILES['avatar'])
            if error:
                messages.error(request, error)
            else:
                user_profile.avatar = avatar
                user_profile.save()
                messages.success(request, "Profil rasmi muvaffaqiyatli yangilandi!")
        return redirect('ctf_profile')

    solved_challenges = SolvedChallenge.objects.filter(user=request.user).select_related('challenge').order_by('-solved_at')
    
    # Calculate rank
    rank = CTFProfile.objects.filter(total_points__gt=user_profile.total_points).count() + 1
    
    return render(request, 'ctf/profile.html', {
        'profile': user_profile, 
        'solved_challenges': solved_challenges,
        'rank': rank
    })

def challenge_render_view(request, challenge_id):
    challenge = get_object_or_404(Challenge, id=challenge_id)
    if not challenge.html_content:
        return HttpResponse("Bu masalada ko'rsatish uchun HTML kod yo'q.", status=404)
    return HttpResponse(challenge.html_content)


# Telegram Authentication
from django.contrib.auth import login
from django.contrib.auth.models import User
from datetime import timedelta
from .models import TelegramAuth

def telegram_login(request):
    if request.user.is_authenticated:
        return redirect('ctf_home')

    error = None
    if request.method == "POST":
        code = request.POST.get("access_code")
        
        try:
            auth_entry = TelegramAuth.objects.get(access_code=code)
            
            # Check expiry (5 minutes)
            if timezone.now() - auth_entry.created_at > timedelta(minutes=5):
                auth_entry.delete()
                error = "Kodning amal qilish muddati tugagan."
            else:
                telegram_id = auth_entry.telegram_id
                tg_username = auth_entry.username
                
                try:
                    with transaction.atomic():
                        try:
                            # 1. Try to find existing profile explicitly by Telegram ID
                            profile = CTFProfile.objects.select_for_update().get(telegram_id=telegram_id)
                            user = profile.user
                            
                            # Sync Username if needed (optional)
                            if tg_username and tg_username != "Unknown" and user.username != tg_username:
                                if not User.objects.filter(username=tg_username).exists():
                                    user.username = tg_username
                                    user.save()

                        except CTFProfile.DoesNotExist:
                            # 2. Not found by ID. Try to find by USERNAME
                            user = None
                            if tg_username and tg_username != "Unknown":
                                # Case-insensitive search for username
                                user = User.objects.filter(username__iexact=tg_username).first()
                            
                            if user:
                                # Found existing user by username! Link Telegram ID to this user.
                                profile = CTFProfile.objects.select_for_update().get(user=user)
                                profile.telegram_id = telegram_id
                                profile.save()
                            else:
                                # 3. Create new user (if not found by ID and not found by Username)
                                
                                # Determine username
                                base_username = tg_username if (tg_username and tg_username != "Unknown") else f"agent_{str(telegram_id)[-4:]}"
                                final_username = base_username
                                
                                counter = 1
                                while User.objects.filter(username=final_username).exists():
                                    final_username = f"{base_username}_{counter}"
                                    counter += 1

                                user = User.objects.create_user(username=final_username)
                                
                                # Signal creates profile, we just need to update it
                                profile = CTFProfile.objects.select_for_update().get(user=user)
                                profile.telegram_id = telegram_id
                                profile.save()
                        
                        # Verify save
                        if not CTFProfile.objects.filter(telegram_id=telegram_id).exists():
                            raise Exception("Failed to link Telegram ID")

                        # Log in
                        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                        
                        # Cleanup only if successful
                        auth_entry.delete()
                        messages.success(request, f"Xush kelibsiz, {user.username}!")
                        target = request.POST.get('next') or request.GET.get('next') or ''
                        if url_has_allowed_host_and_scheme(target, allowed_hosts=None) and target.startswith('/'):
                            return redirect(target)
                        return redirect('ctf_home')
                        
                except Exception as e:
                    print(f"Login Error: {e}")
                    error = "Tizimda xatolik yuz berdi. Qayta urinib ko'ring."

        except TelegramAuth.DoesNotExist:
            error = "Kod noto'g'ri."

    return render(request, 'ctf/telegram_login.html', {'error': error})

from django.contrib.auth import logout

def logout_user(request):
    logout(request)
    return redirect('ctf_home')

def secret_view(request):
    return HttpResponse("This is a secret!")

# --- TOURNAMENT SYSTEM VIEWS ---

def tournament_list(request):
    # Only show active/upcoming/recent
    tournaments = Tournament.objects.filter(is_active=True).order_by('start_date')
    return render(request, 'ctf/tournaments.html', {'tournaments': tournaments})

def tournament_detail(request, tournament_id):
    tournament = get_object_or_404(Tournament, id=tournament_id)
    now = timezone.now()
    
    # 1. Registration Status
    is_registered = False
    if request.user.is_authenticated:
        if tournament.mode == 'SOLO':
            is_registered = TournamentRegistration.objects.filter(tournament=tournament, user=request.user).exists()
        else:
            # Check if user's team is registered
            user_team = request.user.teams.first()
            if user_team:
                is_registered = TournamentRegistration.objects.filter(tournament=tournament, team=user_team).exists()
    
    # 2. Determine if we should show challenges
    # Condition: Registered + Active + Time has passed (Started)
    show_challenges = False
    challenges = []
    
    if is_registered and tournament.is_active and now >= tournament.start_date:
        show_challenges = True
        
        # Load challenges
        challenges_qs = tournament.challenges.filter(is_active=True).order_by('points')
        
        # Calculate solved status
        user_solved_ids = set()
        user_attempted_ids = set()
        
        if request.user.is_authenticated:
            # Solved (Team aware check happens logic in loop? No, pre-calc for efficiency)
            if tournament.mode == 'TEAM' and is_registered: # and user has team
                # Get user team again to be safe
                user_team = request.user.teams.first()
                if user_team:
                    # Get IDs solved by ANY team member
                    team_members = user_team.members.all()
                    user_solved_ids = set(SolvedChallenge.objects.filter(
                        user__in=team_members, 
                        challenge__tournament=tournament
                    ).values_list('challenge_id', flat=True))
            else:
                 user_solved_ids = set(SolvedChallenge.objects.filter(
                    user=request.user,
                    challenge__tournament=tournament
                 ).values_list('challenge_id', flat=True))
                 
            # Attempts (Personal)
            user_attempted_ids = set(ChallengeAttempt.objects.filter(
                user=request.user,
                challenge__tournament=tournament
            ).values_list('challenge_id', flat=True))
            
        for ch in challenges_qs:
            ch.is_solved = ch.id in user_solved_ids
            # Agar yechilmagan bo'lsa VA urinish bo'lsa -> Failed
            if not ch.is_solved and ch.id in user_attempted_ids:
                ch.has_failed_attempt = True
            else:
                ch.has_failed_attempt = False
                
            challenges.append(ch)

    # 3. Scoreboard (Top 20)
    scoreboard = TournamentRegistration.objects.filter(tournament=tournament).order_by('-score', 'last_solved')[:20]

    context = {
        'tournament': tournament,
        'is_registered': is_registered,
        'show_challenges': show_challenges,
        'challenges': challenges,
        'scoreboard': scoreboard,
        'now': now,
        'TIME_ZONE': timezone.get_current_timezone_name()
    }
    return render(request, 'ctf/tournament_detail.html', context)

@require_POST
@login_required
def register_tournament(request, tournament_id):
    tournament = get_object_or_404(Tournament, id=tournament_id)
    
    # Check registration times
    if timezone.now() > tournament.end_date:
        messages.error(request, "Turnir tugagan.")
        return redirect('tournament_detail', tournament_id=tournament.id)

    if tournament.mode == 'SOLO':
        TournamentRegistration.objects.get_or_create(tournament=tournament, user=request.user)
        messages.success(request, f"{tournament.title} ga muvaffaqiyatli ro'yxatdan o'tdingiz!")
    else:
        # Team registration
        user_team = request.user.teams.first()
        if not user_team:
            messages.error(request, "Jamoaviy turnirda qatnashish uchun avval Jamoa tuzishingiz kerak!")
            return redirect('team_dashboard')
            
        if user_team.captain != request.user:
            messages.error(request, "Faqat jamoa sardori jamoani ro'yxatdan o'tkaza oladi!")
            return redirect('tournament_detail', tournament_id=tournament.id)
            
        TournamentRegistration.objects.get_or_create(tournament=tournament, team=user_team)
        messages.success(request, f"{user_team.name} jamoasi {tournament.title} ga ro'yxatdan o'tdi!")
        
    return redirect('tournament_detail', tournament_id=tournament.id)

@login_required
def team_dashboard(request):
    user_team = request.user.teams.first()
    
    # Default stats
    stats_labels = ['Web', 'Crypto', 'Forensics', 'Reverse', 'Misc']
    stats_data = [0, 0, 0, 0, 0]
    total_solved = 0
    
    if user_team:
        # Calculate stats based on solved challenges by team members
        solved_qs = SolvedChallenge.objects.filter(user__in=user_team.members.all())
        category_stats = solved_qs.values('challenge__category').annotate(count=Count('id'))
        
        if category_stats:
            stats_labels = []
            stats_data = []
            for item in category_stats:
                cat = item['challenge__category']
                count = item['count']
                stats_labels.append(str(cat)) # Ensure string
                stats_data.append(count)
        
        total_solved = solved_qs.count()

    return render(request, 'ctf/team_dashboard.html', {
        'team': user_team,
        'stats_labels': stats_labels,
        'stats_data': stats_data,
        'total_solved': total_solved
    })

# -----------------------------------------------------------------------------
# TOURNAMENT LEADERBOARD
# -----------------------------------------------------------------------------
def tournament_leaderboard(request, tournament_id):
    """
    Separate page for tournament live ranking.
    """
    tournament = get_object_or_404(Tournament, id=tournament_id)
    
    # Calculate Leaderboard
    registrations = TournamentRegistration.objects.filter(tournament=tournament)
    
    leaderboard = []
    
    if tournament.mode == 'TEAM':
        # Team Leaderboard
        teams_processed = set()
        for reg in registrations:
            team = reg.team
            if team and team.id not in teams_processed:
                # Sum points of all members or track differently?
                # Usually for team tournaments, points are per team (need TeamScore model or aggregate)
                # For simplicity here: summing member profiles
                
                # BETTER APPROACH: Sum solved challenges for this tournament by this team
                # But simple aggregate from Profile for now (GLOBAL SCORE)? 
                # NO, MUST BE TOURNAMENT SCORE.
                
                # Let's count points from SolvedChallenge filtered by tournament
                score = SolvedChallenge.objects.filter(
                    user__teams=team,
                    challenge__tournament=tournament
                ).aggregate(total=Sum('challenge__points'))['total'] or 0
                
                leaderboard.append({
                    'name': team.name, # Team Name
                    'score': score,
                    'is_team': True,
                    'avatar_url': team.avatar.url if team.avatar else None
                })
                teams_processed.add(team.id)
    else:
        # Solo Leaderboard (User)
        for reg in registrations:
            user = reg.user
            # Calculate score for this tournament ONLY
            score = SolvedChallenge.objects.filter(
                user=user,
                challenge__tournament=tournament
            ).aggregate(total=Sum('challenge__points'))['total'] or 0
            
            leaderboard.append({
                'name': user.username,
                'score': score,
                'is_team': False
            })

    # Sort by score descending
    leaderboard.sort(key=lambda x: x['score'], reverse=True)
    
    # Add Rank
    for i, entry in enumerate(leaderboard):
        entry['rank'] = i + 1

    return render(request, 'ctf/tournament_leaderboard.html', {
        'tournament': tournament,
        'leaderboard': leaderboard
    })

@require_POST
@login_required
def create_team(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        motto = request.POST.get('motto')
        avatar = request.FILES.get('avatar')
        if avatar:
            avatar, error = clean_image(avatar)
            if error:
                messages.error(request, error)
                return redirect('team_dashboard')
        
        if not name:
            messages.error(request, "Jamoa nomi bo'lishi shart.")
            return redirect('team_dashboard')

        if Team.objects.filter(name=name).exists():
            messages.error(request, "Bu nomli jamoa mavjud. Boshqa nom tanlang.")
            return redirect('team_dashboard')
            
        # Check if user is already in a team
        if request.user.teams.exists():
            messages.error(request, "Siz allaqachon jamoaga a'zosiz. Avval undan chiqing (hozircha chiqish yo'q).")
            return redirect('team_dashboard')

        team = Team.objects.create(name=name, motto=motto, captain=request.user, avatar=avatar)
        # Add creator as member
        team.members.add(request.user)
        team.save()
        messages.success(request, f"{team.name} jamoasi tuzildi!")
        return redirect('team_dashboard')
    return redirect('team_dashboard')

@require_POST
@login_required
def join_team(request):
    if request.method == 'POST':
        token = request.POST.get('token')
        if not token:
            messages.error(request, "Kod kiritilmadi.")
            return redirect('team_dashboard')

        try:
            team = Team.objects.get(token=token.upper())
            if request.user.teams.exists():
                messages.error(request, "Siz allaqachon boshqa jamoaga a'zosiz.")
            else:
                team.members.add(request.user)
                messages.success(request, f"{team.name} safiga qo'shildingiz!")
        except Team.DoesNotExist:
            messages.error(request, "Bunday kodli jamoa topilmadi.")
            
    return redirect('team_dashboard')

def lab_redirect(request, challenge):
    """Lab amalidan keyin: laboratoriyalar sahifasidan kelgan bo'lsa o'sha yerga, aks holda masala sahifasiga."""
    if request.POST.get('next') == 'labs':
        return redirect('labs')
    return redirect('challenge_detail', challenge_id=challenge.id)


def lab_url(container):
    # Laboratoriya nginx orqali asosiy domen ichida beriladi (/lab/<port>/).
    # So'rov Next.js serveridan keladi, shuning uchun tashqi manzil SITE_URL dan olinadi.
    return f"{settings.SITE_URL}/lab/{container.host_port}/"


def lab_expires_at(container):
    return container.created_at + timedelta(minutes=settings.LAB_LIFETIME_MINUTES)


def running_container(user, challenge=None):
    """Foydalanuvchining ishlab turgan labi (o'chib qolgan yozuvlar tozalanadi)."""
    qs = ActiveContainer.objects.filter(user=user).select_related('challenge')
    if challenge is not None:
        qs = qs.filter(challenge=challenge)
    container = qs.first()
    if container and docker_utils.get_container_status(container.container_id) != "running":
        container.delete()
        return None
    if container:
        container.url = lab_url(container)
        container.expires_at = lab_expires_at(container)
    return container


def labs(request):
    """Barcha Docker laboratoriyalar: qiyinlik, holat va joriy ishlab turgan lab."""
    now = timezone.now()
    queryset = Challenge.objects.filter(is_active=True, docker_image_name__isnull=False).exclude(docker_image_name='').filter(
        Q(tournament__isnull=True) | Q(tournament__end_date__lt=now)
    )
    order = {'easy': 0, 'medium': 1, 'hard': 2}
    items = sorted(queryset, key=lambda c: (order.get(c.difficulty, 3), c.points, c.id))
    user = request.user if request.user.is_authenticated else None
    solved_ids = set(SolvedChallenge.objects.filter(user=user).values_list('challenge_id', flat=True)) if user else set()
    attempted_ids = set(ChallengeAttempt.objects.filter(user=user).values_list('challenge_id', flat=True)) if user else set()
    for c in items:
        c.is_solved = c.id in solved_ids
        c.has_failed_attempt = not c.is_solved and c.id in attempted_ids
    return render(request, 'ctf/labs.html', {
        'labs': items,
        'active': running_container(user) if user else None,
        'lifetime': settings.LAB_LIFETIME_MINUTES,
        'idle': settings.LAB_IDLE_MINUTES,
    })


@require_POST
@login_required
def start_container_view(request, challenge_id):
    challenge = get_object_or_404(Challenge, id=challenge_id)
    if not challenge.docker_image_name:
        messages.error(request, "Bu masala uchun Docker muhiti mavjud emas.")
        return lab_redirect(request, challenge)

    # Check limit (1 container per user)
    if ActiveContainer.objects.filter(user=request.user).exists():
        # Check if it's the SAME challenge
        existing = ActiveContainer.objects.filter(user=request.user, challenge=challenge).first()
        if existing:
             messages.info(request, "Sizda allaqachon aktiv laboratoriya mavjud.")
             return lab_redirect(request, challenge)
        else:
             messages.error(request, "Sizda boshqa aktiv laboratoriya mavjud. Avval uni o'chiring!")
             return redirect('labs')

    # Pick random port
    def is_port_in_use(port):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            return s.connect_ex(('localhost', port)) == 0

    host_port = 0
    for _ in range(10):
        p = random.randint(20000, 30000)
        if not is_port_in_use(p):
            host_port = p
            break
    
    if host_port == 0:
        messages.error(request, "Bo'sh port topilmadi. Keyinroq urinib ko'ring.")
        return lab_redirect(request, challenge)

    # Start Container
    container = docker_utils.start_container(
        challenge.docker_image_name, 
        {f"{challenge.docker_port}/tcp": host_port}
    )

    if container:
        ActiveContainer.objects.create(
            user=request.user,
            challenge=challenge,
            container_id=container.id,
            host_port=host_port
        )
        messages.success(request, f"Laboratoriya ishga tushdi! Port: {host_port}")
    else:
        messages.error(request, "Konteynerni ishga tushirishda xatolik!")

    return lab_redirect(request, challenge)

@require_POST
@login_required
def stop_container_view(request, challenge_id):
    challenge = get_object_or_404(Challenge, id=challenge_id)
    active_container = get_object_or_404(ActiveContainer, user=request.user, challenge=challenge)
    
    success = docker_utils.stop_container(active_container.container_id)
    if success:
        active_container.delete()
        messages.success(request, "Laboratoriya o'chirildi.")
    else:
        # Force delete if docker fails (maybe already stopped manually)
        active_container.delete() 
        messages.warning(request, "Laboratoriya o'chirildi (lekin Docker javob bermadi).")

    return lab_redirect(request, challenge)

@require_POST
@login_required
def kick_team_member(request, member_id):
    user_team = request.user.teams.first()
    if not user_team:
        return redirect('team_dashboard')
    
    if user_team.captain != request.user:
        messages.error(request, "Faqat kapitan a'zolarni chetlashtira oladi.")
        return redirect('team_dashboard')
    
    member_to_kick = get_object_or_404(User, id=member_id)
    
    if member_to_kick == request.user:
        messages.error(request, "O'zingizni chetlashtira olmaysiz.")
        return redirect('team_dashboard')
        
    if user_team.members.filter(id=member_id).exists():
        user_team.members.remove(member_to_kick)
        messages.success(request, f"{member_to_kick.username} jamoadan chetlashtirildi.")
    else:
        messages.error(request, "Bu foydalanuvchi jamoada yo'q.")
        
    return redirect('team_dashboard')

@require_POST
@login_required
def leave_team(request):
    user_team = request.user.teams.first()
    if not user_team:
        return redirect('team_dashboard')
        
    if user_team.captain == request.user:
        messages.error(request, "Kapitan jamoadan chiqa olmaydi. Jamoani o'chiring yoki kapitanni o'zgartiring.")
        return redirect('team_dashboard')
        
    user_team.members.remove(request.user)
    messages.success(request, "Siz jamoadan chiqdingiz.")
    return redirect('team_dashboard')






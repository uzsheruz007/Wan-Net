from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from .models import Challenge, SolvedChallenge, CTFProfile, ChallengeAttempt, Tournament, Team, TournamentRegistration, ActiveContainer
import hashlib
from . import docker_utils
import random
import socket

from django.http import HttpResponse

def ctf_home(request):
    return render(request, 'ctf/ctf_home.html')

from django.db.models import Q, Sum, Count
from django.db import transaction
from django.core.paginator import Paginator
from kurs.models import Course, Lesson, LessonProgress # Import from 'kurs' app


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
        if code in ['Other', 'Boshqa', 'Misc']:
            continue
            
        all_categories.append({
            'code': code,
            'name': name,
            'selected': code == category_filter
        })

    context = {
        'challenges': page_obj, 
        'query': query,
        'selected_category': category_filter,
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
    active_container = None
    if challenge.docker_image_name:
        active_container = ActiveContainer.objects.filter(user=request.user, challenge=challenge).first()
        # Verify it's actually running
        if active_container:
            status = docker_utils.get_container_status(active_container.container_id)
            if status != "running":
                # Auto-clean ghost records
                active_container.delete()
                active_container = None
            else:
                active_container.url = f"http://127.0.0.1:{active_container.host_port}"

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
        'active_container': active_container
    })

def leaderboard(request):
    queryset = CTFProfile.objects.order_by('-total_points', 'last_solved')

    paginator = Paginator(queryset, 20)
    page_number = int(request.GET.get('page', 1))
    page_obj = paginator.get_page(page_number)

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
        # Handle Avatar Upload
        if 'avatar' in request.FILES:
            user_profile.avatar = request.FILES['avatar']
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

def secret_view(request):
    return render(request, 'ctf/secret_page.html')

def challenge_render_view(request, challenge_id):
    challenge = get_object_or_404(Challenge, id=challenge_id)
    if not challenge.html_content:
        return HttpResponse("Bu masalada ko'rsatish uchun HTML kod yo'q.", status=404)
    return HttpResponse(challenge.html_content)

@login_required
def courses_list(request):
    courses = Course.objects.all()
    return render(request, 'ctf/courses_list.html', {'courses': courses})

@login_required
def course_detail_ctf(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    modules = (
        course.modules
        .prefetch_related("lessons")
        .order_by("order")
    )

    # Auto-start course logic
    has_progress = LessonProgress.objects.filter(
        user=request.user,
        lesson__module__course=course
    ).exists()

    if not has_progress:
        first_lesson = Lesson.objects.filter(
            module__course=course
        ).order_by("module__order", "order").first()
        if first_lesson:
            LessonProgress.objects.create(user=request.user, lesson=first_lesson)

    completed_lessons_ids = set(
        LessonProgress.objects.filter(
            user=request.user,
            lesson__module__course=course,
            is_completed=True
        ).values_list("lesson_id", flat=True)
    )

    total_lessons = Lesson.objects.filter(module__course=course).count()
    progress = int((len(completed_lessons_ids) / total_lessons) * 100) if total_lessons else 0

    # UI uchun qaysi darslar ochiqligini hisoblash
    all_lessons = list(Lesson.objects.filter(module__course=course).order_by("module__order", "order"))
    unlocked_lessons_ids = set()
    
    for i, lesson in enumerate(all_lessons):
        if lesson.is_open:
            unlocked_lessons_ids.add(lesson.id)
        # Progressiv ochilish O'CHIRILDI. Faqat admin ruxsat bergan darslar ochiq.

    # UI uchun qulaylik: Hammasi bitta setda
    accessible_lessons_ids = completed_lessons_ids | unlocked_lessons_ids

    context = {
        "course": course,
        "modules": modules,
        "completed_lessons_ids": completed_lessons_ids,
        "unlocked_lessons_ids": unlocked_lessons_ids,
        "accessible_lessons_ids": accessible_lessons_ids,
        "progress": progress,
    }
    return render(request, "ctf/course_detail_v2.html", context)


@login_required
def lesson_detail_ctf(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    course = lesson.module.course

    all_lessons = list(
        Lesson.objects.filter(module__course=course)
        .order_by("module__order", "order")
    )

    all_ids = [l.id for l in all_lessons]
    if lesson.id not in all_ids:
        messages.error(request, "Dars topilmadi.")
        return redirect("course_detail_ctf", course_id=course.id)

    current_index = all_ids.index(lesson.id)

    # 🔐 ACCESS CONTROL (STRICT: ONLY IF OPEN)
    # Endi oldingi dars tugatilgani ahamiyatsiz. Faqat is_open bo'lishi shart.
    if not lesson.is_open:
        messages.error(request, "� Bu dars yopiq (Admin tomonidan ochilmagan).")
        return redirect("course_detail_ctf", course_id=course.id)

    # ❗ FAQAT KO‘RISH UCHUN progress (completed emas!)
    LessonProgress.objects.get_or_create(
        user=request.user,
        lesson=lesson,
        defaults={"is_completed": False}
    )

    next_lesson = all_lessons[current_index + 1] if current_index + 1 < len(all_lessons) else None
    prev_lesson = all_lessons[current_index - 1] if current_index > 0 else None

    is_completed = LessonProgress.objects.filter(
        user=request.user,
        lesson=lesson,
        is_completed=True
    ).exists()

    return render(request, "ctf/lesson_detail.html", {
        "lesson": lesson,
        "course": course,
        "next_lesson": next_lesson,
        "prev_lesson": prev_lesson,
        "is_completed": is_completed,
    })

@login_required
def mark_lesson_complete_ctf(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    progress, created = LessonProgress.objects.get_or_create(user=request.user, lesson=lesson)
    
    progress.is_completed = True 
    progress.save()
    
    messages.success(request, "Dars tugatildi! +XP")
    
    # Calculate next lesson to redirect to
    all_lessons = list(
        Lesson.objects.filter(module__course=lesson.module.course)
        .order_by("module__order", "order")
    )
    try:
        current_index = all_lessons.index(lesson)
        if current_index + 1 < len(all_lessons):
            return redirect('lesson_detail_ctf', lesson_id=all_lessons[current_index + 1].id)
    except ValueError:
        pass

    return redirect('course_detail_ctf', course_id=lesson.module.course.id)

# Telegram Authentication
from django.contrib.auth import login
from django.contrib.auth.models import User
from datetime import timedelta
from .models import TelegramAuth
import uuid

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

@login_required
def create_team(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        motto = request.POST.get('motto')
        avatar = request.FILES.get('avatar')
        
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

@login_required
def start_container_view(request, challenge_id):
    challenge = get_object_or_404(Challenge, id=challenge_id)
    if not challenge.docker_image_name:
        messages.error(request, "Bu masala uchun Docker muhiti mavjud emas.")
        return redirect('challenge_detail', challenge_id=challenge.id)

    # Check limit (1 container per user)
    if ActiveContainer.objects.filter(user=request.user).exists():
        # Check if it's the SAME challenge
        existing = ActiveContainer.objects.filter(user=request.user, challenge=challenge).first()
        if existing:
             messages.info(request, "Sizda allaqachon aktiv laboratoriya mavjud.")
             return redirect('challenge_detail', challenge_id=challenge.id)
        else:
             messages.error(request, "Sizda boshqa aktiv laboratoriya mavjud. Avval uni o'chiring!")
             return redirect('challenges') # or back

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
        return redirect('challenge_detail', challenge_id=challenge.id)

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

    return redirect('challenge_detail', challenge_id=challenge.id)

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

    return redirect('challenge_detail', challenge_id=challenge.id)

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






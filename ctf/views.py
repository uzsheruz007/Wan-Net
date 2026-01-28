from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from .models import Challenge, SolvedChallenge, CTFProfile
import hashlib

from django.http import HttpResponse

def ctf_home(request):
    return render(request, 'ctf/ctf_home.html')

from django.db.models import Q
from django.core.paginator import Paginator
from kurs.models import Course, Lesson, LessonProgress # Import from 'kurs' app


def challenges(request):
    # Base QuerySet - Sorted by ID by default to ensure sequential order
    queryset = Challenge.objects.filter(is_active=True).order_by('id')
    
    # 1. Search Logic
    query = request.GET.get('q', '').strip()
    if query:
        queryset = queryset.filter(
            Q(title__icontains=query) | 
            Q(description__icontains=query) |
            Q(category__icontains=query)
        )

    # 2. Filter by Category
    category_filter = request.GET.get('category', '').strip()
    if category_filter and category_filter != 'Kategoriyalar':
        queryset = queryset.filter(category=category_filter)

    # 3. User Progress
    if request.user.is_authenticated:
        user_solved_ids = SolvedChallenge.objects.filter(user=request.user).values_list('challenge_id', flat=True)
    else:
        user_solved_ids = []

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
        'all_categories': all_categories,
        'total_challenges': Challenge.objects.filter(is_active=True).count(),
        'displayed_count': queryset.count()
    }

    return render(request, 'ctf/challenges.html', context)

@login_required
def challenge_detail(request, challenge_id):
    challenge = get_object_or_404(Challenge, id=challenge_id)
    is_solved = SolvedChallenge.objects.filter(user=request.user, challenge=challenge).exists()

    if request.method == 'POST':
        if is_solved:
            messages.info(request, "Siz bu masalani allaqachon yechgansiz!")
            return redirect('challenge_detail', challenge_id=challenge.id)

        flag_input = request.POST.get('flag', '').strip()
        # Hash input flag
        hashed_input = hashlib.sha256(flag_input.encode()).hexdigest()

        if hashed_input == challenge.flag_hash:
            # Correct flag
            SolvedChallenge.objects.create(user=request.user, challenge=challenge)
            
            # Update points and time
            profile, created = CTFProfile.objects.get_or_create(user=request.user)
            profile.total_points += challenge.points
            profile.last_solved = timezone.now()
            profile.save()

            messages.success(request, f"Tabriklaymiz! Flag to'g'ri. Sizga {challenge.points} ball berildi.")
            return redirect('challenges')
        else:
            messages.error(request, "Flag noto'g'ri! Qayta urinib ko'ring.")

    return render(request, 'ctf/challenge_detail.html', {'challenge': challenge, 'is_solved': is_solved})

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

    context = {
        "course": course,
        "modules": modules,
        "completed_lessons_ids": completed_lessons_ids,
        "progress": progress,
    }
    return render(request, "ctf/course_detail_v2.html", context)

@login_required
def lesson_detail_ctf(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    course = lesson.module.course

    # Get all lessons ordered by module order then lesson order
    all_lessons = list(
        Lesson.objects.filter(module__course=course)
        .order_by("module__order", "order")
    )

    try:
        current_index = all_lessons.index(lesson)
    except ValueError:
        current_index = 0

    next_lesson = all_lessons[current_index + 1] if current_index + 1 < len(all_lessons) else None
    prev_lesson = all_lessons[current_index - 1] if current_index > 0 else None

    # Track visitation
    LessonProgress.objects.get_or_create(user=request.user, lesson=lesson)

    # Check completion
    is_completed = LessonProgress.objects.filter(user=request.user, lesson=lesson, is_completed=True).exists()

    context = {
        "lesson": lesson,
        "course": course,
        "next_lesson": next_lesson,
        "prev_lesson": prev_lesson,
        "is_completed": is_completed,
    }
    return render(request, "ctf/lesson_detail.html", context)

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
                # Valid Code
                telegram_id = auth_entry.telegram_id
                tg_username = auth_entry.username
                
                # Try to find existing profile
                try:
                    profile = CTFProfile.objects.get(telegram_id=telegram_id)
                    user = profile.user
                    
                    # Sync Username if changed (and available)
                    if tg_username and tg_username != "Unknown" and user.username != tg_username:
                        if not User.objects.filter(username=tg_username).exists():
                            user.username = tg_username
                            user.save()

                except CTFProfile.DoesNotExist:
                    # Create new user
                    final_username = tg_username if (tg_username and tg_username != "Unknown") else f"agent_{str(uuid.uuid4())[:8]}"
                    
                    # Ensure uniqueness
                    if User.objects.filter(username=final_username).exists():
                        final_username = f"{final_username}_{str(uuid.uuid4())[:4]}"

                    user = User.objects.create_user(username=final_username)
                    # Profile is created by signal, just update telegram_id
                    profile = CTFProfile.objects.get(user=user)
                    profile.telegram_id = telegram_id
                    profile.save()
                
                # Log in
                login(request, user, backend='django.contrib.auth.backends.ModelBackend')
                
                # Cleanup
                auth_entry.delete()
                messages.success(request, f"Xush kelibsiz, {user.username}!")
                return redirect('ctf_home')

        except TelegramAuth.DoesNotExist:
            error = "Kod noto'g'ri."

    return render(request, 'ctf/telegram_login.html', {'error': error})

from django.contrib.auth import logout

def logout_user(request):
    logout(request)
    return redirect('ctf_home')






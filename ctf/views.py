from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib import messages
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
            
            # Update points
            profile, created = CTFProfile.objects.get_or_create(user=request.user)
            profile.total_points += challenge.points
            profile.save()

            messages.success(request, f"Tabriklaymiz! Flag to'g'ri. Sizga {challenge.points} ball berildi.")
            return redirect('challenges')
        else:
            messages.error(request, "Flag noto'g'ri! Qayta urinib ko'ring.")

    return render(request, 'ctf/challenge_detail.html', {'challenge': challenge, 'is_solved': is_solved})

def leaderboard(request):
    # Sort by total_points descending
    queryset = CTFProfile.objects.order_by('-total_points', 'last_solved')
    
    # Pagination
    paginator = Paginator(queryset, 20)  # Show 20 players per page
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    return render(request, 'ctf/leaderboard.html', {'page_obj': page_obj})

@login_required
def profile(request):
    profile, created = CTFProfile.objects.get_or_create(user=request.user)

    if request.method == 'POST':
        # Handle Avatar Upload
        if 'avatar' in request.FILES:
            profile.avatar = request.FILES['avatar']
            profile.save()
            messages.success(request, "Profil rasmi muvaffaqiyatli yangilandi!")
            return redirect('ctf_profile')

    solved_challenges = SolvedChallenge.objects.filter(user=request.user).select_related('challenge').order_by('-solved_at')
    
    # Calculate rank
    rank = CTFProfile.objects.filter(total_points__gt=profile.total_points).count() + 1
    
    return render(request, 'ctf/profile.html', {
        'profile': profile, 
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

    # Auto-start course logic
    has_progress = LessonProgress.objects.filter(user=request.user, lesson__module__course=course).exists()
    if not has_progress:
        first_lesson = Lesson.objects.filter(module__course=course).order_by('module__order', 'order').first()
        if first_lesson:
            LessonProgress.objects.create(user=request.user, lesson=first_lesson)

    # Get completed lessons IDs for UI indicators
    completed_lessons_ids = LessonProgress.objects.filter(
        user=request.user,
        lesson__module__course=course,
        is_completed=True
    ).values_list("lesson_id", flat=True)

    # Calculate overall progress
    total_lessons = Lesson.objects.filter(module__course=course).count()
    progress = int((len(completed_lessons_ids) / total_lessons) * 100) if total_lessons else 0

    context = {
        "course": course,
        "completed_lessons_ids": set(completed_lessons_ids), # Use set for faster lookups in template
        "progress": progress
    }
    return render(request, "ctf/course_detail.html", context)


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
        # Should not happen if data is consistent
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




from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages

from .models import Course, Lesson, LessonProgress, UserProfile


# ==========================
# INDEX (HOME)
# ==========================

def home(request):
    courses = Course.objects.all()[:3]
    return render(request, "index.html", {"courses": courses})





from .forms import UserUpdateForm, ProfileUpdateForm

@login_required
def profile_view(request):
    if request.method == 'POST':
        u_form = UserUpdateForm(request.POST, instance=request.user)
        # Handle case where profile might not exist yet if created manually before signal
        if not hasattr(request.user, 'profile'):
             UserProfile.objects.create(user=request.user)
        p_form = ProfileUpdateForm(request.POST, request.FILES, instance=request.user.profile)
        
        if u_form.is_valid() and p_form.is_valid():
            u_form.save()
            p_form.save()
            messages.success(request, 'Hisobingiz yangilandi!')
            return redirect('profile')
    else:
        u_form = UserUpdateForm(instance=request.user)
        if not hasattr(request.user, 'profile'):
            UserProfile.objects.create(user=request.user)
        p_form = ProfileUpdateForm(instance=request.user.profile)

    # --- Real Stats Calculation ---
    all_courses = Course.objects.all()
    user_courses = []
    
    completed_courses_count = 0
    active_courses_count = 0
    total_lessons_completed_all = 0

    for course in all_courses:
        # Get total lessons in this course
        # Note: Lesson is related to Module, Module to Course.
        # We need to traverse: Course -> Modules -> Lessons
        total_lessons = Lesson.objects.filter(module__course=course).count()
        
        if total_lessons == 0:
            continue

        # Get completed lessons for this user in this course
        # Count a course as "started/active" if user has ANY progress record (visited or completed)
        user_progress_qs = LessonProgress.objects.filter(
            user=request.user,
            lesson__module__course=course
        )
        
        if user_progress_qs.exists():
            completed_count = user_progress_qs.filter(is_completed=True).count()
            progress = int((completed_count / total_lessons) * 100)
            
            status = "Davom etish"
            if progress == 100:
                status = "Tugatilgan"
                completed_courses_count += 1
            else:
                active_courses_count += 1
            
            user_courses.append({
                'course': course,
                'progress': progress,
                'status': status,
                'completed_count': completed_count,
                'total_lessons': total_lessons
            })
            
            total_lessons_completed_all += completed_count

    # Estimated learning hours (e.g. 15 mins per lesson)
    learning_hours = round(total_lessons_completed_all * 0.25, 1)

    context = {
        'u_form': u_form,
        'p_form': p_form,
        'active_tab': 'dashboard',
        'user_courses': user_courses,
        'completed_courses_count': completed_courses_count,
        'active_courses_count': active_courses_count,
        'learning_hours': learning_hours,
    }
    return render(request, "profile.html", context)


# ==========================
# COURSES
# ==========================
@login_required
def course_list(request):
    courses = Course.objects.all()
    return render(request, "courses.html", {"courses": courses})


@login_required
def course_detail(request, course_id):
    course = get_object_or_404(Course, id=course_id)

    # Auto-start course logic:
    # If user has no progress in this course, create a record for the first lesson
    # so it shows up in "My Courses" / Active list.
    has_progress = LessonProgress.objects.filter(user=request.user, lesson__module__course=course).exists()
    if not has_progress:
        first_lesson = Lesson.objects.filter(module__course=course).order_by('module__order', 'order').first()
        if first_lesson:
            LessonProgress.objects.create(user=request.user, lesson=first_lesson)

    # Auto-start course logic:
    # If user has no progress in this course, create a record for the first lesson
    # so it shows up in "My Courses" / Active list.
    has_progress = LessonProgress.objects.filter(user=request.user, lesson__module__course=course).exists()
    if not has_progress:
        first_lesson = Lesson.objects.filter(module__course=course).order_by('module__order', 'order').first()
        if first_lesson:
            LessonProgress.objects.create(user=request.user, lesson=first_lesson)

    completed_lessons = LessonProgress.objects.filter(
        user=request.user,
        lesson__module__course=course,
        is_completed=True
    ).values_list("lesson_id", flat=True)

    total_lessons = Lesson.objects.filter(module__course=course).count()
    progress = int((len(completed_lessons) / total_lessons) * 100) if total_lessons else 0

    context = {
        "course": course,
        "completed_lessons": completed_lessons,
        "progress": progress
    }
    return render(request, "curriculum.html", context)


@login_required
def lesson_detail(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    course = lesson.module.course

    all_lessons = list(
        Lesson.objects.filter(module__course=course)
        .order_by("module__order", "order")
    )

    current_index = all_lessons.index(lesson)
    next_lesson = all_lessons[current_index + 1] if current_index + 1 < len(all_lessons) else None
    prev_lesson = all_lessons[current_index - 1] if current_index > 0 else None

    LessonProgress.objects.get_or_create(user=request.user, lesson=lesson)

    completed_ids = LessonProgress.objects.filter(
        user=request.user,
        lesson__module__course=course,
        is_completed=True
    ).values_list("lesson_id", flat=True)

    progress = int((len(completed_ids) / len(all_lessons)) * 100) if all_lessons else 0

    context = {
        "lesson": lesson,
        "next_lesson": next_lesson,
        "prev_lesson": prev_lesson,
        "progress": progress,
        "completed_lessons": Lesson.objects.filter(id__in=completed_ids),
        # Pass full LessonProgress object to check status in template cleanly
        "is_completed": LessonProgress.objects.filter(user=request.user, lesson=lesson, is_completed=True).exists()
    }
    return render(request, "lesson.html", context)


@login_required
def mark_lesson_complete(request, lesson_id):
    lesson = get_object_or_404(Lesson, id=lesson_id)
    progress, created = LessonProgress.objects.get_or_create(user=request.user, lesson=lesson)
    
    # Toggle completion status or set to True? 
    # Usually "Mark as Complete" sets it to True. 
    # Let's make it toggle for flexibility or just set True. 
    # User asked for "Tugatish" (Complete) button.
    progress.is_completed = True 
    progress.save()
    
    messages.success(request, "Dars tugatildi!")
    
    # Redirect back to the lesson page or next lesson?
    # Usually stay on page or go to next. For now, back to lesson.
    return redirect('lesson_detail', lesson_id=lesson.id)


@login_required
def certificate_view(request, course_id):
    course = get_object_or_404(Course, id=course_id)
    
    # Verify completion
    total_lessons = Lesson.objects.filter(module__course=course).count()
    completed_lessons = LessonProgress.objects.filter(
        user=request.user, 
        lesson__module__course=course, 
        is_completed=True
    ).count()

    if total_lessons > 0 and completed_lessons == total_lessons:
        return render(request, "certificate.html", {"course": course})
    else:
        messages.error(request, "Sertifikat olish uchun kursni 100% tugatishingiz kerak!")
        return redirect('course_detail', course_id=course.id)



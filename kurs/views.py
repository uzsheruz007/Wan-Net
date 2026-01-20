from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login, logout
from django.contrib import messages

from .models import Course, Lesson, LessonProgress


# ==========================
# INDEX (HOME)
# ==========================

def home(request):
    return render(request, "index.html")


# ==========================
# AUTH
# ==========================
def signup_view(request):
    if request.method == "POST":
        full_name = request.POST.get("full_name")
        email = request.POST.get("email")
        password1 = request.POST.get("password1")
        password2 = request.POST.get("password2")

        if password1 != password2:
            messages.error(request, "Parollar mos emas")
            return redirect("signup_view")

        if User.objects.filter(username=email).exists():
            messages.error(request, "Bu email allaqachon mavjud")
            return redirect("signup_view")

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password1,
            first_name=full_name
        )
        user.save()

        messages.success(request, "Ro'yxatdan muvaffaqiyatli o'tdingiz")
        return redirect("login")

    return render(request, "registration/signup.html")


def login_view(request):
    if request.method == "POST":
        email = request.POST.get("email")
        password = request.POST.get("password")

        user = authenticate(request, username=email, password=password)

        if user is not None:
            login(request, user)
            return redirect("profile")
        else:
            messages.error(request, "Email yoki parol noto‘g‘ri")
            return redirect("login")

    return render(request, "registration/login.html")


def logout_view(request):
    logout(request)
    return redirect("login")


@login_required
def profile_view(request):
    return render(request, "profile.html")


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
    }
    return render(request, "lesson.html", context)

from django.shortcuts import render, get_object_or_404
from .models import Course, Lesson


def course_list(request):
    courses = Course.objects.all()
    return render(request, 'courses.html', {'courses': courses})


def course_detail(request, pk):
    course = get_object_or_404(Course, pk=pk)
    lessons = course.lessons.all()
    return render(request, 'course_detail.html', {
        'course': course,
        'lessons': lessons
    })


def lesson_detail(request, pk):
    lesson = get_object_or_404(Lesson, pk=pk)
    return render(request, 'lesson_detail.html', {'lesson': lesson})


def index(request):
    return render(request, 'index.html', {'index': index})
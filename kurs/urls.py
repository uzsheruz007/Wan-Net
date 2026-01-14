from django.urls import path
from .views import course_list, course_detail, lesson_detail, index

urlpatterns = [
    path('', index, name='index'),
    path('kurs/', course_list, name='course_list'),
    path('course/<int:pk>/', course_detail, name='course_detail'),
    path('lesson/<int:pk>/', lesson_detail, name='lesson_detail'),
]

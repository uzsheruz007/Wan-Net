from django.urls import path
from . import views  

urlpatterns = [
    path('', views.home, name='index'),  # ← views. prefiksi bilan
    path("profile/", views.profile_view, name="profile"),
    path('courses/', views.course_list, name='course_list'),
    path('course/<int:course_id>/', views.course_detail, name='course_detail'),
    path('lesson/<int:lesson_id>/', views.lesson_detail, name='lesson_detail'),
    path('lesson/<int:lesson_id>/complete/', views.mark_lesson_complete, name='mark_lesson_complete'),
    path('course/<int:course_id>/certificate/', views.certificate_view, name='certificate_view'),
]
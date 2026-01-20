from django.urls import path
from . import views  

urlpatterns = [
    path('', views.home, name='index'),  # ← views. prefiksi bilan
    path("profile/", views.profile_view, name="profile"),
    path('courses/', views.course_list, name='course_list'),
    path("signup/", views.signup_view, name="signup_view"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path('course/<int:course_id>/', views.course_detail, name='course_detail'),
    path('lesson/<int:lesson_id>/', views.lesson_detail, name='lesson_detail'),
]
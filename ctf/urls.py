from django.urls import path
from . import views

urlpatterns = [
    path('', views.ctf_home, name='ctf_home'),
    path('challenges/', views.challenges, name='challenges'),
    path('challenge/<int:challenge_id>/', views.challenge_detail, name='challenge_detail'),
    path('challenge/<int:challenge_id>/render/', views.challenge_render_view, name='challenge_render'),
    path('leaderboard/', views.leaderboard, name='leaderboard'),
    path('profile/', views.profile, name='ctf_profile'),
    
    # Academy Routes
    path('academy/', views.courses_list, name='courses_list'),
    path('academy/course/<int:course_id>/', views.course_detail_ctf, name='course_detail_ctf'),
    path('academy/lesson/<int:lesson_id>/', views.lesson_detail_ctf, name='lesson_detail_ctf'),
    path('academy/lesson/<int:lesson_id>/complete/', views.mark_lesson_complete_ctf, name='mark_lesson_complete_ctf'),
    
    path('secret/', views.secret_view, name='secret_view'),
]

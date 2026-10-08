from django.urls import path
from . import views

urlpatterns = [
    path('', views.ctf_home, name='ctf_home'),
    path('challenges/', views.challenges, name='challenges'),
    path('challenge/<int:challenge_id>/', views.challenge_detail, name='challenge_detail'),
    path('challenge/<int:challenge_id>/render/', views.challenge_render_view, name='challenge_render'),
    path('challenge/<int:challenge_id>/start/', views.start_container_view, name='start_container'),
    path('challenge/<int:challenge_id>/stop/', views.stop_container_view, name='stop_container'),
    path('leaderboard/', views.leaderboard, name='leaderboard'),
    path('profile/', views.profile, name='ctf_profile'),
    
    # Tournament System
    path('tournaments/', views.tournament_list, name='tournaments'),
    path('tournament/<int:tournament_id>/', views.tournament_detail, name='tournament_detail'),
    path('tournament/<int:tournament_id>/register/', views.register_tournament, name='register_tournament'),
    path('tournament/<int:tournament_id>/leaderboard/', views.tournament_leaderboard, name='tournament_leaderboard'),
    
    # Team System
    path('team/', views.team_dashboard, name='team_dashboard'),
    path('team/create/', views.create_team, name='create_team'),
    path('team/join/', views.join_team, name='join_team'),
    path('team/kick/<int:member_id>/', views.kick_team_member, name='kick_team_member'),
    path('team/leave/', views.leave_team, name='leave_team'),

    # Auth
    path('login/', views.telegram_login, name='login'),
    path('logout/', views.logout_user, name='logout'),

    path('secret/', views.secret_view, name='secret_view'),
]

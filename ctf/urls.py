from django.urls import path
from . import views

urlpatterns = [
    path('', views.ctf_home, name='ctf_home'),
    path('challenges/', views.challenges, name='challenges'),
    path('challenge/<int:challenge_id>/', views.challenge_detail, name='challenge_detail'),
    path('challenge/<int:challenge_id>/render/', views.challenge_render_view, name='challenge_render'),
    path('leaderboard/', views.leaderboard, name='leaderboard'),
    path('profile/', views.profile, name='ctf_profile'),
    path('secret/', views.secret_view, name='secret_view'),
]

from django.urls import path

from . import views

urlpatterns = [
    path('', views.dashboard, name='panel_dashboard'),
    path('me/', views.me, name='panel_me'),
    path('login/', views.login_view, name='panel_login'),
    path('logout/', views.logout_view, name='panel_logout'),
    path('<slug:slug>/', views.resource_list, name='panel_list'),
    path('<slug:slug>/action/', views.resource_action, name='panel_action'),
    path('<slug:slug>/new/', views.resource_detail, name='panel_new'),
    path('<slug:slug>/<int:pk>/', views.resource_detail, name='panel_detail'),
    path('<slug:slug>/<int:pk>/delete/', views.resource_delete, name='panel_delete'),
]

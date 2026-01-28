from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path('accounts/', include('allauth.urls')),
    path("ckeditor5/", include('django_ckeditor_5.urls')),
    path('', include('ctf.urls')), # CTF uchun alohida yo'l

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
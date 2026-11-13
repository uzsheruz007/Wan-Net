from django.contrib import admin
from django.urls import path, include

from ctf.api import bridge
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Oddiy Django admin (zaxira); /admin/ — Next.js boshqaruv paneli
    path('django-admin/', admin.site.urls),
    # Next.js frontend uchun: sahifa ma'lumoti va formalar (ctf/api/bridge.py)
    path('api/csrf/', bridge.csrf, name='api_csrf'),
    path('api/page/', bridge.page, {'path': ''}, name='api_page_root'),
    path('api/page/<path:path>', bridge.page, name='api_page'),
    # Boshqaruv paneli (Next.js /admin/), faqat xodimlar uchun
    path('api/panel/', include('ctf.panel.urls')),

    path('', include('ctf.urls')), # CTF uchun alohida yo'l

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
"""Next.js ko'prigi: /api/page/<yo'l> mavjud CTF view'ini o'sha yo'l bilan chaqiradi va javobni JSON qiladi.

Ruxsat, CSRF, flag tekshiruvi va xabarlar mavjud view'larda qoladi. Faqat CTF sahifalari va amallari ochiq —
/django-admin/, /accounts/ va nishon sahifalari (masala HTML'i, /secret/) bu yerdan chaqirilmaydi.
Sahifa manziliga to'g'ridan-to'g'ri kelgan so'rov frontend'ga yo'naltiriladi (FrontendPagesMiddleware).
"""
from django.conf import settings
from django.http import Http404, HttpResponseRedirect, JsonResponse
from django.urls import Resolver404, resolve
from django.views.decorators.csrf import ensure_csrf_cookie

# Sahifa emas: xom HTML (CTF nishoni) yoki redirect javobi, brauzer to'g'ridan-to'g'ri so'raydi
DIRECT_VIEWS = {'challenge_render', 'secret_view', 'logout'}
CTF_MODULE = 'ctf.views'


def _not_found():
    return JsonResponse({'error': 'not_found'}, status=404)


def is_frontend_page(match):
    """Bu manzilni foydalanuvchiga Next.js ko'rsatadimi (yoki uning formasi shu yerga yuboriladimi)."""
    if match is None or match.namespace or match.url_name in DIRECT_VIEWS:
        return False
    return getattr(match.func, '__module__', '') == CTF_MODULE


class FrontendPagesMiddleware:
    """Django HTML sahifa bermaydi: sahifa manziliga kelgan GET frontend'ga o'tadi, boshqa so'rovlar yopiq."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        if not is_frontend_page(request.resolver_match):
            return None
        if request.method in ('GET', 'HEAD'):
            return HttpResponseRedirect(f'{settings.SITE_URL}{request.get_full_path()}')
        return _not_found()


@ensure_csrf_cookie
def page(request, path):
    target = f'/{path}'
    try:
        match = resolve(target)
    except Resolver404:
        return _not_found()
    if not is_frontend_page(match):
        return _not_found()

    # View'lar (login redirect'idagi ?next=, build_absolute_uri) asl manzilni ko'rishi kerak
    request.path = request.path_info = target
    request.resolver_match = match

    try:
        response = match.func(request, *match.args, **match.kwargs)
    except Http404:
        return _not_found()

    if response.status_code in (301, 302):
        return JsonResponse({'redirect': response['Location']})
    return response


@ensure_csrf_cookie
def csrf(request):
    """Brauzerda CSRF cookie bo'lmasa, birinchi POST'dan oldin chaqiriladi."""
    return JsonResponse({'ok': True})

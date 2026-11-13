"""View'lar uchun `render`: shablon nomi + JSON ma'lumot. Sahifani Next.js chizadi (frontend/).

`template` — sahifa nomi: frontend shu nom bo'yicha komponent tanlaydi. Biznes oqimi (ruxsat, redirect, xabarlar) view'larda qoladi.
"""
from django.contrib.messages import get_messages
from django.http import JsonResponse
from django.utils import timezone


def avatar_url(profile):
    return profile.avatar.url if profile and profile.avatar else ''


def user_json(request):
    user = request.user
    if not user.is_authenticated:
        return {'authenticated': False, 'username': '', 'avatar': '', 'is_staff': False}
    profile = getattr(user, 'ctf_profile', None)
    return {
        'authenticated': True,
        'username': user.username,
        'avatar': avatar_url(profile),
        'is_staff': user.is_staff,
    }


def render(request, template, context=None, status=None):
    from .pages import serialize  # view'lar bilan import sikli bo'lmasligi uchun

    response = JsonResponse({
        'template': template,
        'data': serialize(template, context or {}, request),
        'user': user_json(request),
        'year': timezone.localdate().year,
        # Ko'rsatilgach o'chadi: keyingi sahifada qayta chiqmaydi
        'messages': [{'tags': m.tags, 'text': str(m)} for m in get_messages(request)],
    }, status=status or 200, json_dumps_params={'ensure_ascii': False})
    response['Cache-Control'] = 'no-store'
    return response

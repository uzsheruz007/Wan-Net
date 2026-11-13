"""Boshqaruv paneli API (/api/panel/...): faqat xodimlar (is_staff). Javob har doim JSON.

Xato formati bir xil: {"error": "<kod>", "message": "<matn>"} va forma xatolari uchun {"errors": {maydon: [matn]}}.
"""
from datetime import timedelta
from functools import wraps

from django import forms
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.paginator import Paginator
from django.db.models import Q
from django.db.models.fields.files import FieldFile
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from ..api.render import avatar_url
from ..models import ActiveContainer, Challenge, ChallengeAttempt, CTFProfile, SolvedChallenge, Tournament
from .resources import RESOURCES

PAGE_SIZE = 25
LOGIN_LIMIT = 10           # shuncha noto'g'ri urinishdan keyin...
LOGIN_WINDOW = 15 * 60     # ...shuncha soniya kirish yopiladi


def json(data, status=200):
    response = JsonResponse(data, status=status)
    response['Cache-Control'] = 'no-store'
    return response


def error(code, message, status, **extra):
    return json({'error': code, 'message': message, **extra}, status)


def staff_required(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        user = request.user
        if not user.is_authenticated:
            return error('auth', 'Tizimga kiring.', 401)
        if not (user.is_active and user.is_staff):
            return error('forbidden', "Panelga kirish huquqingiz yo'q.", 403)
        return view(request, *args, **kwargs)
    return wrapper


def get_resource(slug):
    return RESOURCES.get(slug)


def me_json(user):
    return {
        'username': user.username,
        'avatar': avatar_url(getattr(user, 'ctf_profile', None)),
        'is_superuser': user.is_superuser,
    }


# ------------------------------ Kirish ------------------------------

def client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    return forwarded.split(',')[0].strip() or request.META.get('REMOTE_ADDR', '')


@require_POST
def login_view(request):
    username = request.POST.get('username', '').strip()
    password = request.POST.get('password', '')
    if not username or not password:
        return error('invalid', 'Login va parolni kiriting.', 400)

    # Ham login, ham IP bo'yicha: birini almashtirib cheklovdan qochib bo'lmaydi
    keys = [f'panel-login:u:{username.lower()}', f'panel-login:ip:{client_ip(request)}']
    if any(cache.get(key, 0) >= LOGIN_LIMIT for key in keys):
        return error('locked', "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring.", 429)

    user = authenticate(request, username=username, password=password)
    if user is None or not user.is_staff:
        for key in keys:
            cache.add(key, 0, LOGIN_WINDOW)
            cache.incr(key)
        return error('invalid', "Login yoki parol noto'g'ri.", 400)

    cache.delete(keys[0])
    login(request, user)
    return json({'ok': True, 'user': me_json(user)})


@require_POST
def logout_view(request):
    logout(request)
    return json({'ok': True})


@require_GET
@ensure_csrf_cookie
@staff_required
def me(request):
    return json({
        'user': me_json(request.user),
        'resources': [{'slug': r.slug, 'label': r.label, 'icon': r.icon} for r in RESOURCES.values()],
    })


# ------------------------------ Bosh sahifa ------------------------------

@require_GET
@staff_required
def dashboard(request):
    now = timezone.now()
    day, week = now - timedelta(days=1), now - timedelta(days=7)

    attempts_day = ChallengeAttempt.objects.filter(timestamp__gte=day)
    recent = SolvedChallenge.objects.select_related('user', 'challenge').order_by('-solved_at')[:8]
    top = CTFProfile.objects.select_related('user').filter(total_points__gt=0).order_by('-total_points')[:5]
    live = Tournament.objects.filter(is_active=True).filter(Q(end_date__isnull=True) | Q(end_date__gte=now))
    return json({
        'stats': [
            {'key': 'users', 'label': 'Foydalanuvchilar', 'value': User.objects.count(),
             'note': f"+{User.objects.filter(date_joined__gte=week).count()} shu hafta"},
            {'key': 'challenges', 'label': 'Faol masalalar', 'value': Challenge.objects.filter(is_active=True).count(),
             'note': f"jami {Challenge.objects.count()}"},
            {'key': 'solves', 'label': 'Yechimlar (24 soat)', 'value': SolvedChallenge.objects.filter(solved_at__gte=day).count(),
             'note': f"jami {SolvedChallenge.objects.count()}"},
            {'key': 'attempts', 'label': 'Urinishlar (24 soat)', 'value': attempts_day.count(),
             'note': f"{attempts_day.filter(is_correct=True).count()} to'g'ri"},
            {'key': 'labs', 'label': 'Ishlayotgan lablar', 'value': ActiveContainer.objects.count(), 'note': 'hozir'},
            {'key': 'tournaments', 'label': 'Jonli turnirlar', 'value': live.count(),
             'note': f"jami {Tournament.objects.count()}"},
        ],
        'recent': [
            {'user': s.user.username, 'challenge': s.challenge.title, 'challenge_id': s.challenge_id,
             'points': s.challenge.points, 'time': s.solved_at.isoformat()}
            for s in recent
        ],
        'top': [{'id': p.user_id, 'username': p.user.username, 'points': p.total_points} for p in top],
    })


# ------------------------------ Ro'yxat ------------------------------

def meta_json(resource, user):
    return {
        'slug': resource.slug,
        'label': resource.label,
        'singular': resource.singular,
        'icon': resource.icon,
        'hint': resource.hint,
        'columns': [{'key': c.key, 'label': c.label, 'kind': c.kind} for c in resource.columns],
        'filters': [{'key': f.key, 'label': f.label, 'options': [[str(v), str(l)] for v, l in f.options()]}
                    for f in resource.filters],
        'actions': [{'key': key, 'label': a.label, 'danger': a.danger, 'confirm': a.confirm}
                    for key, a in resource.all_actions(user).items()],
        'can_create': bool(resource.form) and resource.allowed(user, 'create'),
        'can_edit': bool(resource.form) and resource.allowed(user, 'edit'),
        'searchable': bool(resource.search),
    }


def filtered(resource, request):
    qs = resource.queryset()
    q = request.GET.get('q', '').strip()
    if q and resource.search:
        condition = Q()
        for lookup in resource.search:
            condition |= Q(**{lookup: q})
        qs = qs.filter(condition)
    for f in resource.filters:
        value = request.GET.get(f.key, '')
        if value:
            qs = f.apply(qs, value)
    return qs.order_by(*resource.ordering)


@require_GET
@staff_required
def resource_list(request, slug):
    resource = get_resource(slug)
    if not resource:
        return error('not_found', "Bo'lim topilmadi.", 404)
    page = Paginator(filtered(resource, request), PAGE_SIZE).get_page(request.GET.get('page'))
    return json({
        'meta': meta_json(resource, request.user),
        'rows': [resource.row(obj) for obj in page],
        'page': {'number': page.number, 'num_pages': page.paginator.num_pages, 'count': page.paginator.count},
    })


@require_POST
@staff_required
def resource_action(request, slug):
    resource = get_resource(slug)
    if not resource:
        return error('not_found', "Bo'lim topilmadi.", 404)
    action = resource.all_actions(request.user).get(request.POST.get('action', ''))
    if not action:
        return error('invalid', "Bu amal mavjud emas.", 400)
    ids = [i for i in request.POST.getlist('ids') if i.isdigit()]
    if not ids:
        return error('invalid', 'Hech narsa tanlanmagan.', 400)
    qs = resource.queryset().filter(pk__in=ids)
    if slug == 'users':
        qs = qs.exclude(pk=request.user.pk)  # o'zini bloklash/o'chirish mumkin emas
    return json({'ok': True, 'message': action.run(request, qs)})


# ------------------------------ Forma ------------------------------

def widget_type(field):
    widget = field.widget
    if isinstance(widget, forms.PasswordInput):
        return 'password'
    if isinstance(widget, forms.Textarea):
        return 'textarea'
    if isinstance(widget, forms.CheckboxInput):
        return 'checkbox'
    if isinstance(widget, forms.SelectMultiple):
        return 'multiselect'
    if isinstance(widget, forms.Select):
        return 'select'
    if isinstance(widget, forms.ClearableFileInput):
        return 'image' if isinstance(field, forms.ImageField) else 'file'
    if isinstance(field, forms.DateTimeField):
        return 'datetime'
    if isinstance(field, forms.IntegerField):
        return 'number'
    if isinstance(field, forms.EmailField):
        return 'email'
    return 'text'


def field_value(kind, value):
    if kind == 'password':
        return ''
    if kind in ('file', 'image'):
        if isinstance(value, FieldFile) and value:
            return {'url': value.url, 'name': value.name.rsplit('/', 1)[-1]}
        return None
    if kind == 'datetime' and hasattr(value, 'strftime'):
        if timezone.is_aware(value):
            value = timezone.localtime(value)
        return value.strftime('%Y-%m-%dT%H:%M')
    if kind == 'multiselect':
        return [str(v) for v in (value or [])]
    if kind == 'checkbox':
        return bool(value)
    return '' if value is None else str(value)


def form_json(resource, form):
    fields = []
    for bound in form:
        kind = widget_type(bound.field)
        item = {
            'name': bound.name,
            'label': str(bound.label),
            'type': kind,
            'required': bound.field.required,
            'help': str(bound.help_text or ''),
            'value': field_value(kind, bound.value()),
            'errors': [str(e) for e in bound.errors],
        }
        if kind in ('select', 'multiselect'):
            item['choices'] = [[str(v), str(l)] for v, l in bound.field.choices if not (kind == 'multiselect' and v == '')]
        if kind == 'textarea':
            item['rows'] = int(bound.field.widget.attrs.get('rows', 5))
            item['mono'] = bool(bound.field.widget.attrs.get('data-mono'))
        fields.append(item)

    names = [f['name'] for f in fields]
    sections = [
        {'title': title, 'fields': [n for n in members if n in names]}
        for title, members in (resource.sections or [('', names)])
    ]
    placed = {n for s in sections for n in s['fields']}
    rest = [n for n in names if n not in placed]
    if rest:
        sections.append({'title': 'Boshqa', 'fields': rest})
    return {
        'fields': fields,
        'sections': [s for s in sections if s['fields']],
        'non_field_errors': [str(e) for e in form.non_field_errors()],
    }


def detail_json(resource, form, obj, user):
    return {
        'meta': meta_json(resource, user),
        'id': obj.pk if obj else None,
        'title': resource.title(obj) if obj else f'Yangi {resource.singular.lower()}',
        'links': [{'label': label, 'href': href} for label, href in (resource.links(obj) if obj else [])],
        'facts': [{'label': label, 'value': str(value)} for label, value in (resource.facts(obj) if obj else [])],
        'can_delete': bool(obj) and resource.allowed(user, 'delete') and not (resource.slug == 'users' and obj.pk == user.pk),
        'form': form_json(resource, form),
    }


@staff_required
def resource_detail(request, slug, pk=None):
    """GET — forma sxemasi; POST — saqlash (pk yo'q bo'lsa yangi yozuv)."""
    resource = get_resource(slug)
    if not resource or not resource.form:
        return error('not_found', "Bo'lim topilmadi.", 404)
    op = 'edit' if pk else 'create'
    if not resource.allowed(request.user, op):
        return error('forbidden', "Bu amal uchun huquqingiz yo'q.", 403)

    obj = None
    if pk:
        obj = resource.queryset().filter(pk=pk).first()
        if obj is None:
            return error('not_found', 'Yozuv topilmadi.', 404)

    kwargs = resource.form_kwargs(request)
    if request.method == 'GET':
        return json(detail_json(resource, resource.form(instance=obj, **kwargs), obj, request.user))
    if request.method != 'POST':
        return error('method', "Ruxsat etilmagan so'rov.", 405)

    form = resource.form(request.POST, request.FILES, instance=obj, **kwargs)
    if not form.is_valid():
        return json({
            'error': 'validation',
            'message': "Formada xatolar bor — belgilangan maydonlarni tekshiring.",
            **detail_json(resource, form, obj, request.user),
        }, 400)
    saved = form.save()
    return json({'ok': True, 'id': saved.pk, 'message': f"{resource.singular} saqlandi."})


@require_POST
@staff_required
def resource_delete(request, slug, pk):
    resource = get_resource(slug)
    if not resource or not resource.allowed(request.user, 'delete'):
        return error('forbidden', "Bu amal uchun huquqingiz yo'q.", 403)
    if slug == 'users' and pk == request.user.pk:
        return error('invalid', "O'z hisobingizni o'chirib bo'lmaydi.", 400)
    obj = resource.queryset().filter(pk=pk).first()
    if obj is None:
        return error('not_found', 'Yozuv topilmadi.', 404)
    obj.delete()
    return json({'ok': True, 'message': f"{resource.singular} o'chirildi."})

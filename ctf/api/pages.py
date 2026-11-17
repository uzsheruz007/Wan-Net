"""Shablon konteksti → frontend uchun JSON. Har sahifaga bitta funksiya.

Faqat sahifa ko'rsatadigan maydonlar beriladi: `flag_hash`, `html_content`, konteyner ID'si to'liq va boshqa
ichki maydonlar tashqariga chiqmaydi. Sana, son va matn formatlari shu yerda (shablondagi filtrlar o'rnida).
"""
from django.db.models import Sum
from django.template.defaultfilters import date as date_filter
from django.template.defaultfilters import timesince_filter, truncatechars
from django.utils import timezone
from django.utils.html import linebreaks

from ..models import SolvedChallenge
from .render import avatar_url


def fmt(value, pattern='d.m.Y H:i'):
    if not value:
        return ''
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    return date_filter(value, pattern)


def epoch_ms(value):
    return int(value.timestamp() * 1000) if value else None


def initial(name):
    return (name or '?')[:1]


def card_json(challenge):
    """ctf/_chal_card.html: masala kartasi (ro'yxat va turnir sahifasi)."""
    return {
        'id': challenge.id,
        'title': truncatechars(challenge.title, 48),
        'category': challenge.category,
        'points': challenge.points,
        'is_lab': bool(challenge.docker_image_name),
        'difficulty': challenge.difficulty,
        'is_solved': getattr(challenge, 'is_solved', False),
        'has_failed_attempt': getattr(challenge, 'has_failed_attempt', False),
    }


def page_json(page_obj):
    return {
        'number': page_obj.number,
        'num_pages': page_obj.paginator.num_pages,
        'has_previous': page_obj.has_previous(),
        'has_next': page_obj.has_next(),
    }


# ------------------------------ Sahifalar ------------------------------

def home(ctx, request):
    return {}


def challenges(ctx, request):
    return {
        'challenges': [card_json(c) for c in ctx['challenges']],
        'page': page_json(ctx['challenges']),
        'query': ctx['query'],
        'selected_category': ctx['selected_category'],
        'selected_level': ctx['selected_level'],
        'categories': [{'code': c['code'], 'name': c['name']} for c in ctx['all_categories']],
        'total_challenges': ctx['total_challenges'],
        'displayed_count': ctx['displayed_count'],
    }


def challenge_detail(ctx, request):
    challenge = ctx['challenge']
    container = ctx['active_container']
    return {
        'challenge': {
            'id': challenge.id,
            'title': challenge.title,
            'category': challenge.category,
            'category_display': challenge.get_category_display(),
            'points': challenge.points,
            'description_html': linebreaks(challenge.description, autoescape=True),
            'file_url': challenge.file.url if challenge.file else '',
            'file_name': challenge.file.name.rsplit('/', 1)[-1] if challenge.file else '',
            'has_target': bool(challenge.html_content),
            'is_lab': bool(challenge.docker_image_name),
            'difficulty': challenge.difficulty,
        },
        'is_solved': ctx['is_solved'],
        'container': container_json(container),
        'lifetime': ctx['lifetime'],
    }


def container_json(container):
    if not container:
        return None
    return {
        'url': container.url,
        'short_id': container.container_id[:8],
        'challenge_id': container.challenge_id,
        'title': container.challenge.title,
        'started': fmt(container.created_at, 'H:i'),
        'expires_ms': epoch_ms(container.expires_at),
    }


def labs(ctx, request):
    def lab(c):
        paragraphs = [p.strip() for p in c.description.replace('\r\n', '\n').split('\n\n') if p.strip()]
        topic = next((p[len('Mavzu:'):].strip().rstrip('.') for p in paragraphs if p.startswith('Mavzu:')), '')
        first_paragraph = paragraphs[0] if paragraphs else ''
        return {
            **card_json(c),
            'title': c.title,
            'summary': truncatechars(first_paragraph, 220),
            'topic': topic,
        }

    labs_list = [lab(c) for c in ctx['labs']]
    return {
        'labs': labs_list,
        'active': container_json(ctx['active']),
        'lifetime': ctx['lifetime'],
        'idle': ctx['idle'],
        'solved': sum(1 for item in labs_list if item['is_solved']),
    }


def leaderboard(ctx, request):
    page_obj = ctx['page_obj']
    me = request.user.pk if request.user.is_authenticated else None

    def row(profile):
        return {
            'rank': profile.rank,
            'username': profile.user.username,
            'avatar': avatar_url(profile),
            'points': profile.total_points,
            'last_solved': f'{timesince_filter(profile.last_solved)} oldin' if profile.last_solved else '',
            'is_me': profile.user_id == me,
        }

    rows = [row(p) for p in page_obj]
    podium = rows[:3] if ctx['is_first_page'] else []
    return {
        'podium': podium,
        'rows': rows[len(podium):],
        'total': page_obj.paginator.count,
        'page': page_json(page_obj),
    }


def profile(ctx, request):
    user = request.user
    solved = list(ctx['solved_challenges'])
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'date_joined': fmt(user.date_joined, 'd.m.Y'),
        'avatar': avatar_url(ctx['profile']),
        'total_points': ctx['profile'].total_points,
        'rank': ctx['rank'],
        'solved': [
            {
                'challenge_id': s.challenge_id,
                'title': s.challenge.title,
                'points': s.challenge.points,
                'solved_at': fmt(s.solved_at),
            }
            for s in solved
        ],
    }


def team_dashboard(ctx, request):
    team = ctx['team']
    if not team:
        return {'team': None}
    members = list(team.members.select_related('ctf_profile').order_by('date_joined'))
    points = SolvedChallenge.objects.filter(user__in=members).aggregate(total=Sum('challenge__points'))['total'] or 0
    return {
        'team': {
            'name': team.name,
            'motto': team.motto,
            'avatar': team.avatar.url if team.avatar else '',
            'captain': team.captain.username,
            'token': team.token,
            'points': points,
            'is_captain': team.captain_id == request.user.pk,
            'members': [
                {
                    'id': m.id,
                    'username': m.username,
                    'points': m.ctf_profile.total_points if hasattr(m, 'ctf_profile') else 0,
                    'is_captain': m.id == team.captain_id,
                    'is_me': m.id == request.user.pk,
                }
                for m in members
            ],
        },
        'stats': [{'label': label, 'value': value} for label, value in zip(ctx['stats_labels'], ctx['stats_data'])],
        'total_solved': ctx['total_solved'],
    }


def tournament_status(tournament, now):
    if tournament.end_date and tournament.end_date < now:
        return 'ended'
    return 'live' if tournament.is_active else 'upcoming'


def tournaments(ctx, request):
    now = timezone.now()
    return {
        'tournaments': [
            {
                'id': t.id,
                'title': t.title,
                'mode': t.mode,
                'status': tournament_status(t, now),
                'start': fmt(t.start_date),
                'description': t.description,
            }
            for t in ctx['tournaments']
        ],
    }


def tournament_detail(ctx, request):
    t = ctx['tournament']
    return {
        'tournament': {
            'id': t.id,
            'title': t.title,
            'description': t.description,
            'mode': t.mode,
            'is_active': t.is_active,
            'registrations': t.registrations.count(),
            'start_ms': epoch_ms(t.start_date),
            'end_ms': epoch_ms(t.end_date),
        },
        'is_registered': ctx['is_registered'],
        'show_challenges': ctx['show_challenges'],
        'challenges': [card_json(c) for c in ctx['challenges']],
    }


def tournament_leaderboard(ctx, request):
    t = ctx['tournament']
    return {
        'tournament': {'id': t.id, 'title': t.title},
        'rows': [
            {
                'rank': e['rank'],
                'name': e['name'],
                'score': e['score'],
                'is_team': e['is_team'],
                'avatar': e.get('avatar_url') or '',
            }
            for e in ctx['leaderboard']
        ],
    }


def login(ctx, request):
    return {'error': ctx.get('error') or ''}


SERIALIZERS = {
    'ctf/ctf_home.html': home,
    'ctf/challenges.html': challenges,
    'ctf/challenge_detail.html': challenge_detail,
    'ctf/labs.html': labs,
    'ctf/leaderboard_v2.html': leaderboard,
    'ctf/profile.html': profile,
    'ctf/team_dashboard.html': team_dashboard,
    'ctf/tournaments.html': tournaments,
    'ctf/tournament_detail.html': tournament_detail,
    'ctf/tournament_leaderboard.html': tournament_leaderboard,
    'ctf/telegram_login.html': login,
}


def serialize(template, ctx, request):
    return SERIALIZERS[template](ctx, request)

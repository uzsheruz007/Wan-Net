"""Panel bo'limlari: har model uchun ro'yxat ustunlari, qidiruv, filtrlar, forma va ommaviy amallar.

Frontend bu ta'riflarni sxema sifatida oladi (`meta`) va bitta umumiy jadval/forma bilan ko'rsatadi.
"""
from dataclasses import dataclass
from typing import Callable

from django.contrib.auth.models import User
from django.db.models import Count, Q
from django.utils import timezone

from .. import docker_utils
from ..api.pages import fmt
from ..models import ActiveContainer, Challenge, ChallengeAttempt, SolvedChallenge, Team, Tournament, TournamentRegistration
from . import forms


@dataclass(frozen=True)
class Column:
    key: str
    label: str
    kind: str = 'text'  # text | mono | number | bool | chip | date


@dataclass(frozen=True)
class Filter:
    key: str
    label: str
    options: Callable[[], list]
    apply: Callable


@dataclass(frozen=True)
class Action:
    label: str
    run: Callable  # (request, queryset) -> xabar matni
    danger: bool = False
    confirm: str = ''


def bool_filter(key, label, lookup, yes='Ha', no="Yo'q"):
    return Filter(key, label, lambda: [('1', yes), ('0', no)], lambda qs, v: qs.filter(**{lookup: v == '1'}))


def set_active(value):
    def run(request, qs):
        count = qs.update(is_active=value)
        state = 'faollashtirildi' if value else "o'chirib qo'yildi"
        return f'{count} ta yozuv {state}.'
    return run


def delete_selected(request, qs):
    count = 0
    for obj in qs:  # signal'lar (ball ayirish va h.k.) ishlashi uchun bittalab
        obj.delete()
        count += 1
    return f"{count} ta yozuv o'chirildi."


DELETE = Action("O'chirish", delete_selected, danger=True, confirm="Tanlangan yozuvlar butunlay o'chirilsinmi?")


class Resource:
    slug = ''
    label = ''
    singular = ''
    icon = 'fa-table'
    model = None
    form = None
    columns: list = []
    search: tuple = ()
    filters: list = []
    sections: list = []  # [(sarlavha, [maydonlar])]; bo'sh — hammasi bitta bo'limda
    actions: dict = {}
    ordering = ('-id',)
    can_create = True
    can_edit = True
    can_delete = True
    hint = ''

    def queryset(self):
        return self.model.objects.all()

    def row(self, obj):
        raise NotImplementedError

    def title(self, obj):
        return str(obj)

    def links(self, obj):
        """Tahrirlash sahifasidagi saytga havolalar: [(matn, manzil)]."""
        return []

    def facts(self, obj):
        """Tahrirlash sahifasidagi qisqa ma'lumotlar: [(nomi, qiymati)]."""
        return []

    def allowed(self, user, op):
        return {'create': self.can_create, 'edit': self.can_edit, 'delete': self.can_delete}.get(op, True)

    def form_kwargs(self, request):
        return {}

    def all_actions(self, user):
        actions = dict(self.actions)
        if self.allowed(user, 'delete'):
            actions['delete'] = DELETE
        return actions


# ------------------------------ Masalalar ------------------------------

def challenge_kind(c):
    if c.docker_image_name:
        return 'Lab'
    if c.html_content:
        return 'Veb nishon'
    return 'Fayl' if c.file else 'Matn'


KIND_FILTERS = {
    'lab': Q(docker_image_name__gt=''),
    'web': Q(html_content__gt='') & (Q(docker_image_name__isnull=True) | Q(docker_image_name='')),
    'file': Q(file__gt=''),
}


class ChallengeResource(Resource):
    slug, label, singular, icon = 'challenges', 'Masalalar', 'Masala', 'fa-flag'
    model = Challenge
    form = forms.ChallengeForm
    columns = [
        Column('id', '#', 'mono'),
        Column('title', 'Sarlavha'),
        Column('category', 'Kategoriya', 'chip'),
        Column('difficulty', 'Qiyinlik'),
        Column('points', 'Ball', 'number'),
        Column('kind', 'Turi'),
        Column('tournament', 'Turnir'),
        Column('solves', 'Yechgan', 'number'),
        Column('is_active', 'Faol', 'bool'),
    ]
    search = ('title__icontains', 'description__icontains')
    filters = [
        Filter('category', 'Kategoriya', lambda: list(Challenge.CATEGORY_CHOICES), lambda qs, v: qs.filter(category=v)),
        Filter('difficulty', 'Qiyinlik', lambda: list(Challenge.DIFFICULTY_CHOICES), lambda qs, v: qs.filter(difficulty=v)),
        Filter('kind', 'Turi', lambda: [('lab', 'Docker lab'), ('web', 'Veb nishon'), ('file', 'Fayl bilan')],
               lambda qs, v: qs.filter(KIND_FILTERS[v]) if v in KIND_FILTERS else qs),
        Filter('tournament', 'Turnir',
               lambda: [('none', 'Mashq (turnirsiz)')] + [(str(t.id), t.title) for t in Tournament.objects.order_by('-start_date')],
               lambda qs, v: qs.filter(tournament__isnull=True) if v == 'none' else qs.filter(tournament_id=v) if v.isdigit() else qs),
        bool_filter('active', 'Holati', 'is_active', yes='Faol', no='Yopiq'),
    ]
    sections = [
        ('Asosiy', ['title', 'description', 'category', 'points', 'difficulty', 'flag', 'is_active', 'tournament']),
        ("Qo'shimcha: fayl, veb nishon, Docker lab", ['file', 'html_content', 'docker_image_name', 'docker_port']),
    ]
    actions = {
        'activate': Action('Faollashtirish', set_active(True)),
        'deactivate': Action("Yopish", set_active(False)),
    }
    hint = "Docker lablarni bu yerda emas, `init_docker_challenges --build` buyrug'i bilan qo'shing — flag o'zi yaratiladi."

    def queryset(self):
        return Challenge.objects.select_related('tournament').annotate(solve_count=Count('solvedchallenge', distinct=True))

    def row(self, c):
        return {
            'id': c.id,
            'title': c.title,
            'category': c.get_category_display(),
            'difficulty': c.get_difficulty_display() or '—',
            'points': c.points,
            'kind': challenge_kind(c),
            'tournament': c.tournament.title if c.tournament else '—',
            'solves': c.solve_count,
            'is_active': c.is_active,
        }

    def title(self, c):
        return c.title

    def links(self, c):
        links = [('Saytda ochish', f'/challenge/{c.id}/')]
        if c.html_content:
            links.append(('Veb nishon', f'/challenge/{c.id}/render/'))
        return links

    def facts(self, c):
        return [
            ('Yechganlar', SolvedChallenge.objects.filter(challenge=c).count()),
            ('Urinishlar', ChallengeAttempt.objects.filter(challenge=c).count()),
            ('Yaratilgan', fmt(c.created_at)),
        ]


# ------------------------------ Turnirlar ------------------------------

def tournament_status(t, now):
    if t.end_date and t.end_date < now:
        return 'Tugagan'
    return 'Jonli' if t.is_active else 'Kutilmoqda'


def publish_challenges(request, qs):
    moved = Challenge.objects.filter(tournament__in=qs).update(tournament=None)
    return f"{moved} ta masala umumiy mashqlarga o'tkazildi."


class TournamentResource(Resource):
    slug, label, singular, icon = 'tournaments', 'Turnirlar', 'Turnir', 'fa-trophy'
    model = Tournament
    form = forms.TournamentForm
    columns = [
        Column('id', '#', 'mono'),
        Column('title', 'Nomi'),
        Column('mode', 'Format', 'chip'),
        Column('status', 'Holati'),
        Column('start', 'Boshlanish', 'date'),
        Column('end', 'Tugash', 'date'),
        Column('registrations', 'Ishtirokchi', 'number'),
        Column('challenges', 'Masala', 'number'),
        Column('is_active', 'Faol', 'bool'),
    ]
    search = ('title__icontains',)
    filters = [
        Filter('mode', 'Format', lambda: list(Tournament.MODE_CHOICES), lambda qs, v: qs.filter(mode=v)),
        bool_filter('active', 'Faolligi', 'is_active', yes='Faol', no='Faol emas'),
    ]
    ordering = ('-start_date',)
    actions = {
        'activate': Action('Faollashtirish', set_active(True)),
        'deactivate': Action("To'xtatish", set_active(False)),
        'publish': Action(
            "Masalalarni mashqlarga chiqarish", publish_challenges,
            confirm="Tanlangan turnirlarning masalalari umumiy mashqlar ro'yxatiga o'tkazilsinmi?",
        ),
    }
    hint = "Turnir masalalari turnir faol bo'lgandagina ko'rinadi. Turnir tugagach, ularni «Masalalarni mashqlarga chiqarish» amali bilan ochiq qiling."

    def queryset(self):
        return Tournament.objects.annotate(
            reg_count=Count('registrations', distinct=True), chal_count=Count('challenges', distinct=True),
        )

    def row(self, t):
        return {
            'id': t.id,
            'title': t.title,
            'mode': t.get_mode_display(),
            'status': tournament_status(t, timezone.now()),
            'start': fmt(t.start_date),
            'end': fmt(t.end_date),
            'registrations': t.reg_count,
            'challenges': t.chal_count,
            'is_active': t.is_active,
        }

    def title(self, t):
        return t.title

    def links(self, t):
        return [
            ('Saytda ochish', f'/tournament/{t.id}/'),
            ('Reyting', f'/tournament/{t.id}/leaderboard/'),
            ('Masalalari', f'/admin/challenges/?tournament={t.id}'),
            ('Ishtirokchilari', f'/admin/registrations/?tournament={t.id}'),
        ]

    def facts(self, t):
        return [
            ('Holati', tournament_status(t, timezone.now())),
            ('Ishtirokchilar', t.registrations.count()),
            ('Masalalar', t.challenges.count()),
        ]


# ------------------------------ Jamoalar ------------------------------

class TeamResource(Resource):
    slug, label, singular, icon = 'teams', 'Jamoalar', 'Jamoa', 'fa-users'
    model = Team
    form = forms.TeamForm
    columns = [
        Column('id', '#', 'mono'),
        Column('name', 'Nomi'),
        Column('captain', 'Kapitan'),
        Column('members', "A'zolar", 'number'),
        Column('token', 'Taklif kodi', 'mono'),
        Column('created', 'Yaratilgan', 'date'),
    ]
    search = ('name__icontains', 'captain__username__icontains', 'token__iexact')

    def queryset(self):
        return Team.objects.select_related('captain').annotate(member_count=Count('members', distinct=True))

    def row(self, t):
        return {
            'id': t.id,
            'name': t.name,
            'captain': t.captain.username,
            'members': t.member_count,
            'token': t.token,
            'created': fmt(t.created_at),
        }

    def title(self, t):
        return t.name

    def facts(self, t):
        return [('Taklif kodi', t.token), ('Turnirlar', t.tournament_regs.count())]


# ------------------------------ Foydalanuvchilar ------------------------------

class UserResource(Resource):
    slug, label, singular, icon = 'users', 'Foydalanuvchilar', 'Foydalanuvchi', 'fa-user'
    model = User
    form = forms.UserForm
    columns = [
        Column('id', '#', 'mono'),
        Column('username', 'Login'),
        Column('points', 'Ball', 'number'),
        Column('solved', 'Yechgan', 'number'),
        Column('telegram_id', 'Telegram ID', 'mono'),
        Column('role', 'Roli', 'chip'),
        Column('is_active', 'Faol', 'bool'),
        Column('joined', "Ro'yxatdan o'tgan", 'date'),
    ]
    search = ('username__icontains', 'email__icontains', 'ctf_profile__telegram_id__iexact')
    filters = [
        Filter('role', 'Roli', lambda: [('staff', 'Xodim'), ('user', 'Ishtirokchi')],
               lambda qs, v: qs.filter(is_staff=(v == 'staff')) if v in ('staff', 'user') else qs),
        bool_filter('active', 'Holati', 'is_active', yes='Faol', no='Bloklangan'),
    ]
    sections = [
        ('Hisob', ['username', 'email', 'is_active']),
        ('CTF profili', ['total_points', 'telegram_id']),
        ('Huquqlar', ['is_staff', 'is_superuser', 'new_password']),
    ]
    actions = {
        'activate': Action('Blokdan chiqarish', set_active(True)),
        'deactivate': Action('Bloklash', set_active(False), danger=True, confirm='Tanlangan foydalanuvchilar bloklansinmi?'),
    }
    hint = "Ishtirokchilar saytga Telegram orqali kiradi. Parol faqat panelga kiradigan xodimlar uchun kerak."

    def queryset(self):
        return User.objects.select_related('ctf_profile').annotate(solved_count=Count('solved_challenges', distinct=True))

    def row(self, u):
        profile = getattr(u, 'ctf_profile', None)
        return {
            'id': u.id,
            'username': u.username,
            'points': profile.total_points if profile else 0,
            'solved': u.solved_count,
            'telegram_id': (profile.telegram_id if profile else None) or '—',
            'role': 'Admin' if u.is_superuser else 'Xodim' if u.is_staff else 'Ishtirokchi',
            'is_active': u.is_active,
            'joined': fmt(u.date_joined, 'd.m.Y'),
        }

    def title(self, u):
        return u.username

    def allowed(self, user, op):
        if op in ('create', 'delete'):
            return user.is_superuser
        return True

    def all_actions(self, user):
        # Huquq va blok faqat bosh administrator qo'lida
        return super().all_actions(user) if user.is_superuser else {}

    def form_kwargs(self, request):
        return {'editor': request.user}

    def facts(self, u):
        return [
            ('Yechgan masalalar', SolvedChallenge.objects.filter(user=u).count()),
            ('Urinishlar', ChallengeAttempt.objects.filter(user=u).count()),
            ('Oxirgi kirish', fmt(u.last_login) or '—'),
        ]

    def links(self, u):
        return [
            ('Yechimlari', f'/admin/solves/?q={u.username}'),
            ('Urinishlari', f'/admin/attempts/?q={u.username}'),
        ]


# ------------------------------ Turnir ishtirokchilari ------------------------------

class RegistrationResource(Resource):
    slug, label, singular, icon = 'registrations', 'Ishtirokchilar', 'Ishtirokchi', 'fa-id-badge'
    model = TournamentRegistration
    form = forms.RegistrationForm
    can_create = False
    columns = [
        Column('id', '#', 'mono'),
        Column('tournament', 'Turnir'),
        Column('participant', 'Ishtirokchi'),
        Column('kind', 'Turi', 'chip'),
        Column('score', 'Ball', 'number'),
        Column('last_solved', "So'nggi faollik", 'date'),
    ]
    search = ('user__username__icontains', 'team__name__icontains', 'tournament__title__icontains')
    filters = [
        Filter('tournament', 'Turnir', lambda: [(str(t.id), t.title) for t in Tournament.objects.order_by('-start_date')],
               lambda qs, v: qs.filter(tournament_id=v) if v.isdigit() else qs),
    ]
    ordering = ('-score', 'last_solved')
    hint = "Ballni qo'lda o'zgartirish faqat xatoni tuzatish uchun: u turnir reytingiga darhol ta'sir qiladi."

    def queryset(self):
        return TournamentRegistration.objects.select_related('tournament', 'user', 'team')

    def participant(self, r):
        return r.team.name if r.team else r.user.username if r.user else '—'

    def row(self, r):
        return {
            'id': r.id,
            'tournament': r.tournament.title,
            'participant': self.participant(r),
            'kind': 'Jamoa' if r.team_id else 'Yakka',
            'score': r.score,
            'last_solved': fmt(r.last_solved),
        }

    def title(self, r):
        return f'{self.participant(r)} — {r.tournament.title}'


# ------------------------------ Yechimlar va urinishlar ------------------------------

class SolveResource(Resource):
    slug, label, singular, icon = 'solves', 'Yechimlar', 'Yechim', 'fa-check-double'
    model = SolvedChallenge
    can_create = can_edit = False
    columns = [
        Column('id', '#', 'mono'),
        Column('user', 'Foydalanuvchi'),
        Column('challenge', 'Masala'),
        Column('points', 'Ball', 'number'),
        Column('solved_at', 'Vaqti', 'date'),
    ]
    search = ('user__username__iexact', 'challenge__title__icontains')
    ordering = ('-solved_at',)
    hint = "Yechim o'chirilsa, masala bali foydalanuvchining umumiy balidan ayiriladi (turnir bali o'zgarmaydi)."

    def queryset(self):
        return SolvedChallenge.objects.select_related('user', 'challenge')

    def row(self, s):
        return {
            'id': s.id,
            'user': s.user.username,
            'challenge': s.challenge.title,
            'points': s.challenge.points,
            'solved_at': fmt(s.solved_at),
        }


class AttemptResource(Resource):
    slug, label, singular, icon = 'attempts', 'Urinishlar', 'Urinish', 'fa-terminal'
    model = ChallengeAttempt
    can_create = can_edit = False
    columns = [
        Column('id', '#', 'mono'),
        Column('user', 'Foydalanuvchi'),
        Column('challenge', 'Masala'),
        Column('flag', 'Kiritilgan flag', 'mono'),
        Column('is_correct', "To'g'ri", 'bool'),
        Column('time', 'Vaqti', 'date'),
    ]
    search = ('user__username__iexact', 'challenge__title__icontains', 'input_flag__icontains')
    filters = [bool_filter('correct', 'Natija', 'is_correct', yes="To'g'ri", no="Noto'g'ri")]
    ordering = ('-timestamp',)

    def queryset(self):
        return ChallengeAttempt.objects.select_related('user', 'challenge')

    def row(self, a):
        return {
            'id': a.id,
            'user': a.user.username,
            'challenge': a.challenge.title,
            'flag': a.input_flag,
            'is_correct': a.is_correct,
            'time': fmt(a.timestamp, 'd.m.Y H:i:s'),
        }


# ------------------------------ Faol lablar ------------------------------

def stop_labs(request, qs):
    count = 0
    for lab in qs:
        docker_utils.stop_container(lab.container_id)
        lab.delete()
        count += 1
    return f"{count} ta laboratoriya to'xtatildi."


class LabResource(Resource):
    slug, label, singular, icon = 'labs', 'Faol lablar', 'Lab', 'fa-server'
    model = ActiveContainer
    can_create = can_edit = can_delete = False
    columns = [
        Column('id', '#', 'mono'),
        Column('user', 'Foydalanuvchi'),
        Column('challenge', 'Laboratoriya'),
        Column('container', 'Konteyner', 'mono'),
        Column('port', 'Port', 'mono'),
        Column('started', 'Ishga tushgan', 'date'),
        Column('active_at', "So'nggi faollik", 'date'),
    ]
    search = ('user__username__iexact', 'challenge__title__icontains')
    ordering = ('-created_at',)
    actions = {'stop': Action("To'xtatish", stop_labs, danger=True, confirm="Tanlangan laboratoriyalar to'xtatilsinmi?")}

    def queryset(self):
        return ActiveContainer.objects.select_related('user', 'challenge')

    def row(self, lab):
        return {
            'id': lab.id,
            'user': lab.user.username,
            'challenge': lab.challenge.title,
            'container': lab.container_id[:12],
            'port': lab.host_port,
            'started': fmt(lab.created_at, 'd.m H:i'),
            'active_at': fmt(lab.active_at, 'd.m H:i'),
        }


RESOURCES = {
    r.slug: r
    for r in (
        ChallengeResource(), TournamentResource(), TeamResource(), UserResource(),
        RegistrationResource(), SolveResource(), AttemptResource(), LabResource(),
    )
}

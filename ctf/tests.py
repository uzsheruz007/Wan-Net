import hashlib
import io
from datetime import timedelta
from unittest import mock

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from PIL import Image

from .models import ActiveContainer, Challenge, CTFProfile, SolvedChallenge, Team, TelegramAuth


@override_settings(LAB_IDLE_MINUTES=15, LAB_LIFETIME_MINUTES=60)
class LabCleanupTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('talaba', password='x')
        challenge = Challenge.objects.create(
            title='Ping', description='d', category='Web', flag_hash='x', docker_image_name='wan-net/ping-rce',
        )
        self.lab = ActiveContainer.objects.create(user=self.user, challenge=challenge, container_id='c1', host_port=25000)
        self.traffic = 0
        patches = [
            mock.patch('ctf.docker_utils.get_container_status', return_value='running'),
            mock.patch('ctf.docker_utils.get_traffic_bytes', side_effect=lambda cid: self.traffic),
            mock.patch('ctf.docker_utils.stop_container', return_value=True),
        ]
        self.stop = [p.start() for p in patches][2]
        for p in patches:
            self.addCleanup(p.stop)

    def run_cleanup(self, minutes, bytes_per_second):
        self.traffic += bytes_per_second * 120
        with mock.patch('django.utils.timezone.now', return_value=self.lab.created_at + timedelta(minutes=minutes)):
            call_command('cleanup_labs', stdout=mock.Mock())

    def test_used_lab_is_kept_idle_lab_is_stopped(self):
        for minute in (2, 4, 6):
            self.run_cleanup(minute, 50)  # sahifa ochilib, so'rovlar yuborilmoqda
        self.assertTrue(ActiveContainer.objects.exists())
        for minute in range(8, 22, 2):
            self.run_cleanup(minute, 2)  # foydalanuvchi ketdi: faqat shovqin
        self.assertTrue(ActiveContainer.objects.exists())
        self.run_cleanup(22, 2)
        self.assertFalse(ActiveContainer.objects.exists())
        self.stop.assert_called_once_with('c1')

    def test_lifetime_limit_still_applies(self):
        self.run_cleanup(61, 50)
        self.assertFalse(ActiveContainer.objects.exists())

    def test_logout_stops_labs(self):
        self.client.force_login(self.user)
        self.client.get(reverse('logout'))
        self.assertFalse(ActiveContainer.objects.exists())
        self.stop.assert_called_once_with('c1')


def page(path):
    """Frontend so'raydigan manzil: /challenges/ → /api/page/challenges/"""
    return f'/api/page{path}'


def png(name='a.png'):
    buffer = io.BytesIO()
    Image.new('RGB', (4, 4), 'green').save(buffer, 'PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


@override_settings(SITE_URL='http://front.test')
class BridgeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('agent', password='x')
        self.challenge = Challenge.objects.create(
            title='Hidden', description='a\n\n<b>b</b>', category='Web', points=20,
            flag_hash=hashlib.sha256(b'FLAG{ok}').hexdigest(), html_content='<!-- flag -->',
        )

    def test_django_page_url_redirects_to_frontend(self):
        response = self.client.get('/challenges/?category=Web')
        self.assertRedirects(response, 'http://front.test/challenges/?category=Web', fetch_redirect_response=False)
        self.assertEqual(self.client.post('/team/join/').status_code, 404)

    def test_home_and_list_pages(self):
        body = self.client.get(page('/')).json()
        self.assertEqual(body['template'], 'ctf/ctf_home.html')
        self.assertFalse(body['user']['authenticated'])

        body = self.client.get(page('/challenges/')).json()
        self.assertEqual(body['template'], 'ctf/challenges.html')
        card = body['data']['challenges'][0]
        self.assertEqual(card['title'], 'Hidden')
        self.assertNotIn('flag_hash', card)
        self.assertNotIn('Misc', [c['code'] for c in body['data']['categories']])

    def test_detail_needs_login_and_hides_secrets(self):
        body = self.client.get(page(f'/challenge/{self.challenge.id}/')).json()
        self.assertEqual(body['redirect'], f'/login/?next=/challenge/{self.challenge.id}/')

        self.client.force_login(self.user)
        data = self.client.get(page(f'/challenge/{self.challenge.id}/')).json()['data']
        self.assertTrue(data['challenge']['has_target'])
        self.assertIn('&lt;b&gt;b&lt;/b&gt;', data['challenge']['description_html'])
        text = str(data)
        self.assertNotIn('flag_hash', text)
        self.assertNotIn('<!-- flag -->', text)

    def test_flag_submission(self):
        self.client.force_login(self.user)
        url = page(f'/challenge/{self.challenge.id}/')
        body = self.client.post(url, {'flag': 'FLAG{wrong}'}).json()
        self.assertEqual(body['messages'][0]['tags'], 'error')

        body = self.client.post(url, {'flag': 'FLAG{ok}'}).json()
        self.assertEqual(body['redirect'], '/challenges/')
        # Birinchi yechim: 20 + 50 (first blood)
        self.assertEqual(CTFProfile.objects.get(user=self.user).total_points, 70)
        messages = self.client.get(page('/challenges/')).json()['messages']
        self.assertIn('FIRST BLOOD', messages[0]['text'])

    def test_actions_are_post_only(self):
        self.client.force_login(self.user)
        for path in (f'/challenge/{self.challenge.id}/start/', f'/challenge/{self.challenge.id}/stop/', '/team/leave/', '/team/kick/1/'):
            self.assertEqual(self.client.get(page(path)).status_code, 405, path)

    def test_direct_views_are_not_bridged(self):
        for path in ('/secret/', f'/challenge/{self.challenge.id}/render/', '/logout/', '/django-admin/', '/nope/'):
            self.assertEqual(self.client.get(page(path)).status_code, 404, path)
        self.assertEqual(self.client.get(f'/challenge/{self.challenge.id}/render/').content, b'<!-- flag -->')

    def test_only_captain_can_kick(self):
        captain = User.objects.create_user('captain')
        team = Team.objects.create(name='t', captain=captain)
        team.members.add(captain, self.user)

        self.client.force_login(self.user)
        body = self.client.post(page(f'/team/kick/{captain.id}/')).json()
        self.assertEqual(body['redirect'], '/team/')
        self.assertEqual(team.members.count(), 2)

        self.client.force_login(captain)
        data = self.client.get(page('/team/')).json()['data']
        self.assertTrue(data['team']['is_captain'])
        self.client.post(page(f'/team/kick/{self.user.id}/'))
        self.assertEqual(list(team.members.all()), [captain])

    def test_team_points_are_summed(self):
        team = Team.objects.create(name='t', captain=self.user)
        team.members.add(self.user)
        SolvedChallenge.objects.create(user=self.user, challenge=self.challenge)
        self.client.force_login(self.user)
        data = self.client.get(page('/team/')).json()['data']
        self.assertEqual(data['team']['points'], 20)
        self.assertEqual(data['total_solved'], 1)

    def test_avatar_must_be_an_image(self):
        self.client.force_login(self.user)
        fake = SimpleUploadedFile('x.png', b'<script>alert(1)</script>', content_type='image/png')
        self.client.post(page('/profile/'), {'avatar': fake})
        self.assertFalse(CTFProfile.objects.get(user=self.user).avatar)

        self.client.post(page('/profile/'), {'avatar': png()})
        self.assertTrue(CTFProfile.objects.get(user=self.user).avatar.name.endswith('.png'))
        self.addCleanup(lambda: CTFProfile.objects.get(user=self.user).avatar.delete(save=False))

    def test_login_with_code_respects_safe_next(self):
        TelegramAuth.objects.create(telegram_id=42, username='tg_agent', access_code='123456')
        body = self.client.post(page('/login/?next=//evil.example/'), {'access_code': '123456'}).json()
        self.assertEqual(body['redirect'], '/')

        self.client.logout()
        TelegramAuth.objects.create(telegram_id=43, username='tg_two', access_code='654321')
        body = self.client.post(page('/login/?next=/team/'), {'access_code': '654321'}).json()
        self.assertEqual(body['redirect'], '/team/')

        self.client.logout()
        body = self.client.post(page('/login/'), {'access_code': '000000'}).json()
        self.assertEqual(body['data']['error'], "Kod noto'g'ri.")

    def test_leaderboard_bad_page_number(self):
        body = self.client.get(page('/leaderboard/?page=abc')).json()
        self.assertEqual(body['data']['page']['number'], 1)


@override_settings(SITE_URL='http://front.test', LAB_LIFETIME_MINUTES=60)
class LabsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('agent')
        self.lab = Challenge.objects.create(
            title='SQLi', description="Bank portali.\n\nMavzu: SQL Injection.", category='Web', points=150,
            difficulty='easy', flag_hash='x', docker_image_name='wan-net/sqli-login:latest',
        )
        self.hard = Challenge.objects.create(
            title='SSRF', description='d', category='Web', points=500, difficulty='hard', flag_hash='x',
            docker_image_name='wan-net/ssrf-preview:latest',
        )
        Challenge.objects.create(title='Oddiy', description='d', category='Web', flag_hash='x')
        patches = [
            mock.patch('ctf.docker_utils.get_container_status', return_value='running'),
            mock.patch('ctf.docker_utils.start_container', return_value=mock.Mock(id='abc123def456')),
            mock.patch('ctf.docker_utils.stop_container', return_value=True),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def test_lists_only_docker_labs_sorted_by_difficulty(self):
        data = self.client.get(page('/labs/')).json()['data']
        self.assertEqual([lab['title'] for lab in data['labs']], ['SQLi', 'SSRF'])
        self.assertEqual(data['labs'][0]['topic'], 'SQL Injection')
        self.assertEqual(data['labs'][0]['summary'], 'Bank portali.')
        self.assertIsNone(data['active'])
        self.assertNotIn('flag_hash', str(data))

    def test_start_from_labs_returns_to_labs_and_shows_active(self):
        self.client.force_login(self.user)
        body = self.client.post(page(f'/challenge/{self.lab.id}/start/'), {'next': 'labs'}).json()
        self.assertEqual(body['redirect'], '/labs/')
        active = self.client.get(page('/labs/')).json()['data']['active']
        self.assertEqual(active['challenge_id'], self.lab.id)
        self.assertTrue(active['url'].startswith('http://front.test/lab/'))
        self.assertTrue(active['expires_ms'])

        # Ikkinchi lab: avval birinchisini to'xtatish kerak
        body = self.client.post(page(f'/challenge/{self.hard.id}/start/'), {'next': 'labs'}).json()
        self.assertEqual(body['redirect'], '/labs/')
        self.assertEqual(ActiveContainer.objects.filter(user=self.user).count(), 1)

        body = self.client.post(page(f'/challenge/{self.lab.id}/stop/'), {'next': 'labs'}).json()
        self.assertEqual(body['redirect'], '/labs/')
        self.assertFalse(ActiveContainer.objects.exists())

    def test_start_without_next_goes_to_challenge(self):
        self.client.force_login(self.user)
        body = self.client.post(page(f'/challenge/{self.lab.id}/start/')).json()
        self.assertEqual(body['redirect'], f'/challenge/{self.lab.id}/')
        data = self.client.get(page(f'/challenge/{self.lab.id}/')).json()['data']
        self.assertEqual(data['container']['challenge_id'], self.lab.id)
        self.assertEqual(data['lifetime'], 60)


class InitDockerChallengesTests(TestCase):
    def test_registers_labs_inactive_without_build(self):
        from .labs import LABS

        call_command('init_docker_challenges', stdout=io.StringIO())
        labs = Challenge.objects.exclude(docker_image_name__isnull=True)
        self.assertEqual(labs.count(), len(LABS))
        self.assertFalse(labs.filter(is_active=True).exists())

    def test_build_sets_random_flag_hash_and_keeps_legacy_record(self):
        legacy = Challenge.objects.create(
            title='Network Diagnostic Tool', description='d', category='Web', flag_hash='old',
            docker_image_name='wan-net/ping-rce:latest',
        )
        client = mock.Mock()
        with mock.patch('ctf.docker_utils.client', client):
            call_command('init_docker_challenges', 'ping_rce', '--build', stdout=io.StringIO())
        legacy.refresh_from_db()
        flag = client.images.build.call_args.kwargs['buildargs']['FLAG']
        self.assertRegex(flag, r'^WanNet\{ping_rce_[0-9a-f]{16}\}$')
        self.assertEqual(legacy.flag_hash, hashlib.sha256(flag.encode()).hexdigest())
        self.assertTrue(legacy.is_active)
        self.assertEqual(legacy.difficulty, 'medium')
        self.assertEqual(Challenge.objects.count(), 1)


class PanelTests(TestCase):
    """Next.js /admin/ uchun API: faqat xodimlar, flag xeshlanadi, huquqlar bosh administratorda."""

    def setUp(self):
        self.boss = User.objects.create_superuser('boss', password='Kuchli-parol-91')
        self.staff = User.objects.create_user('xodim', password='Kuchli-parol-92', is_staff=True)
        self.player = User.objects.create_user('oyinchi', password='Kuchli-parol-93')

    def challenge_form(self, **extra):
        data = {'title': 'Yangi', 'description': 'Tavsif', 'category': 'Web', 'points': 100,
                'difficulty': 'easy', 'is_active': 'on', 'docker_port': 5000}
        data.update(extra)
        return data

    def test_requires_staff(self):
        self.assertEqual(self.client.get('/api/panel/').status_code, 401)
        self.client.force_login(self.player)
        self.assertEqual(self.client.get('/api/panel/').status_code, 403)
        self.assertEqual(self.client.get('/api/panel/challenges/').status_code, 403)
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get('/api/panel/').status_code, 200)

    def test_login_only_staff_and_rate_limited(self):
        bad = self.client.post('/api/panel/login/', {'username': 'oyinchi', 'password': 'Kuchli-parol-93'})
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post('/api/panel/login/', {'username': 'xodim', 'password': 'Kuchli-parol-92'})
        self.assertEqual(ok.status_code, 200)
        self.client.post('/api/panel/logout/')
        for _ in range(10):
            self.client.post('/api/panel/login/', {'username': 'boss', 'password': 'xato'})
        locked = self.client.post('/api/panel/login/', {'username': 'boss', 'password': 'Kuchli-parol-91'})
        self.assertEqual(locked.status_code, 429)

    def test_plain_flag_is_stored_as_hash(self):
        self.client.force_login(self.staff)
        response = self.client.post('/api/panel/challenges/new/', self.challenge_form(flag='  WanNet{admin_test}  '))
        self.assertEqual(response.status_code, 200)
        challenge = Challenge.objects.get(pk=response.json()['id'])
        self.assertEqual(challenge.flag_hash, hashlib.sha256(b'WanNet{admin_test}').hexdigest())
        detail = self.client.get(f'/api/panel/challenges/{challenge.id}/').json()
        self.assertNotIn(challenge.flag_hash, str(detail))

    def test_new_challenge_requires_flag_and_errors_per_field(self):
        self.client.force_login(self.staff)
        response = self.client.post('/api/panel/challenges/new/', self.challenge_form(points=-5))
        self.assertEqual(response.status_code, 400)
        fields = {f['name']: f['errors'] for f in response.json()['form']['fields']}
        self.assertTrue(fields['flag'] and fields['points'])
        self.assertFalse(Challenge.objects.exists())

    def test_empty_flag_keeps_old_hash_on_edit(self):
        self.client.force_login(self.staff)
        challenge = Challenge.objects.create(title='Eski', description='d', category='Web', flag_hash='old')
        response = self.client.post(f'/api/panel/challenges/{challenge.id}/', self.challenge_form(title='Eski 2'))
        self.assertEqual(response.status_code, 200)
        challenge.refresh_from_db()
        self.assertEqual((challenge.title, challenge.flag_hash), ('Eski 2', 'old'))

    def test_list_search_filter_and_action(self):
        self.client.force_login(self.staff)
        Challenge.objects.create(title='SQL bosqich', description='d', category='Web', flag_hash='x')
        Challenge.objects.create(title='RSA', description='d', category='Crypto', flag_hash='x')
        data = self.client.get('/api/panel/challenges/', {'category': 'Crypto'}).json()
        self.assertEqual([r['title'] for r in data['rows']], ['RSA'])
        data = self.client.get('/api/panel/challenges/', {'q': 'sql'}).json()
        self.assertEqual([r['title'] for r in data['rows']], ['SQL bosqich'])
        ids = list(Challenge.objects.values_list('id', flat=True))
        response = self.client.post('/api/panel/challenges/action/', {'action': 'deactivate', 'ids': ids})
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Challenge.objects.filter(is_active=True).exists())

    def test_staff_cannot_grant_rights(self):
        self.client.force_login(self.staff)
        form = self.client.get(f'/api/panel/users/{self.player.id}/').json()['form']
        self.assertNotIn('is_staff', [f['name'] for f in form['fields']])
        self.client.post(f'/api/panel/users/{self.player.id}/', {
            'username': 'oyinchi', 'is_active': 'on', 'total_points': 40, 'is_staff': 'on', 'is_superuser': 'on',
        })
        self.player.refresh_from_db()
        self.assertFalse(self.player.is_staff or self.player.is_superuser)
        self.assertEqual(self.player.ctf_profile.total_points, 40)
        self.assertEqual(self.client.post(f'/api/panel/users/{self.player.id}/delete/').status_code, 403)

    def test_boss_cannot_lock_himself_out(self):
        self.client.force_login(self.boss)
        response = self.client.post(f'/api/panel/users/{self.boss.id}/', {
            'username': 'boss', 'total_points': 0, 'is_superuser': 'on',
        })
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.post(f'/api/panel/users/{self.boss.id}/delete/').status_code, 400)
        self.client.post('/api/panel/users/action/', {'action': 'deactivate', 'ids': [self.boss.id]})
        self.boss.refresh_from_db()
        self.assertTrue(self.boss.is_active and self.boss.is_staff)

    def test_deleting_solve_subtracts_points(self):
        self.client.force_login(self.staff)
        challenge = Challenge.objects.create(title='C', description='d', category='Web', flag_hash='x', points=50)
        solve = SolvedChallenge.objects.create(user=self.player, challenge=challenge)
        CTFProfile.objects.filter(user=self.player).update(total_points=50)
        self.client.post('/api/panel/solves/action/', {'action': 'delete', 'ids': [solve.id]})
        self.assertEqual(CTFProfile.objects.get(user=self.player).total_points, 0)



class DjangoAdminTests(TestCase):
    """/django-admin/ (oddiy Django admin): flag ochiq kiritiladi, bazaga xeshi yoziladi."""

    def setUp(self):
        self.client.force_login(User.objects.create_superuser('boss', password='x'))

    def test_plain_flag_is_stored_as_hash(self):
        response = self.client.post(reverse('admin:ctf_challenge_add'), {
            'title': 'Admin', 'description': 'd', 'category': 'Web', 'points': 10, 'difficulty': 'easy',
            'flag': 'WanNet{admin}', 'is_active': 'on', 'docker_port': 5000,
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Challenge.objects.get(title='Admin').flag_hash, hashlib.sha256(b'WanNet{admin}').hexdigest())

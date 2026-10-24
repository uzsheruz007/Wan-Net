from datetime import timedelta
from unittest import mock

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from .models import ActiveContainer, Challenge


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

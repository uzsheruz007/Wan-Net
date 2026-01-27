
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wan.settings')
django.setup()

from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialApp

def init_social_app():
    # Ensure site exists and is correct
    site, created = Site.objects.get_or_create(id=1, defaults={'domain': '127.0.0.1:8000', 'name': 'Wan-Net'})
    if not created:
        site.domain = '127.0.0.1:8000'
        site.name = 'Wan-Net'
        site.save()

    # Create or update Google SocialApp
    app, created = SocialApp.objects.get_or_create(
        provider='google',
        name='Google Auth',
        defaults={
            'client_id': 'DUMMY_CLIENT_ID',
            'secret': 'DUMMY_SECRET',
        }
    )
    if created:
        print("Created dummy Google SocialApp.")
    else:
        print("Google SocialApp already exists.")
    
    app.sites.add(site)
    print("Linked SocialApp to Site.")

if __name__ == '__main__':
    init_social_app()

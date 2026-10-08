from django.contrib import admin
from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialAccount, SocialApp, SocialToken
from allauth.account.models import EmailAddress
from django.contrib.auth.models import Group

# Akademiya (kurs, modul, dars, test) admin paneldan olib tashlangan

# Keraksiz modellarni yashirish
def unregister_models():
    models_to_hide = [
        Site,
        SocialAccount,
        SocialApp,
        SocialToken,
        EmailAddress,
        Group # Group ham ko'pincha kerak bo'lmaydi kichik loyihalarda, agar kerak bo'lsa olib tashlayman
    ]
    
    for model in models_to_hide:
        try:
            admin.site.unregister(model)
        except admin.sites.NotRegistered:
            pass

unregister_models()

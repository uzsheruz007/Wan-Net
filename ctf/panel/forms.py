"""Boshqaruv paneli formalari: validatsiya shu yerda, frontend faqat maydonlar sxemasini ko'rsatadi."""
import hashlib

from django import forms
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.files.uploadedfile import UploadedFile
from django.db import transaction

from ..models import Challenge, CTFProfile, Team, Tournament, TournamentRegistration
from ..views import clean_image


class ChallengeForm(forms.ModelForm):
    """Flag ochiq matnda kiritiladi, bazaga faqat SHA256 xeshi yoziladi."""

    flag = forms.CharField(
        label='Flag',
        required=False,
        strip=True,
        help_text="To'g'ri javob, masalan WanNet{...}. Saqlangach faqat xeshi qoladi; tahrirlashda bo'sh qolsa eski flag o'zgarmaydi.",
    )

    class Meta:
        model = Challenge
        fields = (
            'title', 'description', 'category', 'points', 'difficulty', 'flag', 'is_active', 'tournament',
            'file', 'html_content', 'docker_image_name', 'docker_port',
        )
        widgets = {
            'description': forms.Textarea(attrs={'rows': 8}),
            'html_content': forms.Textarea(attrs={'rows': 10, 'data-mono': '1'}),
        }

    def clean_points(self):
        points = self.cleaned_data['points']
        if points < 0:
            raise forms.ValidationError("Ball manfiy bo'lishi mumkin emas.")
        return points

    def clean(self):
        cleaned = super().clean()
        if not cleaned.get('flag') and not (self.instance.pk and self.instance.flag_hash):
            self.add_error('flag', 'Yangi masala uchun flag kiritilishi shart.')
        return cleaned

    def save(self, commit=True):
        flag = self.cleaned_data.get('flag')
        if flag:
            self.instance.flag_hash = hashlib.sha256(flag.encode()).hexdigest()
        return super().save(commit)


class TournamentForm(forms.ModelForm):
    class Meta:
        model = Tournament
        fields = ('title', 'description', 'mode', 'start_date', 'end_date', 'is_active')
        widgets = {'description': forms.Textarea(attrs={'rows': 6})}

    def clean(self):
        cleaned = super().clean()
        start, end = cleaned.get('start_date'), cleaned.get('end_date')
        if start and end and end <= start:
            self.add_error('end_date', "Tugash vaqti boshlanishdan keyin bo'lishi kerak.")
        return cleaned


class TeamForm(forms.ModelForm):
    regenerate_token = forms.BooleanField(
        label='Yangi taklif kodi', required=False, help_text="Belgilansa, eski taklif kodi bekor bo'ladi.",
    )

    class Meta:
        model = Team
        fields = ('name', 'motto', 'captain', 'members', 'avatar')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        users = User.objects.order_by('username')
        self.fields['captain'].queryset = users
        self.fields['members'].queryset = users
        self.fields['members'].help_text = "Kapitan avtomatik a'zo bo'ladi."

    def clean_avatar(self):
        avatar = self.cleaned_data.get('avatar')
        if not isinstance(avatar, UploadedFile):
            return avatar  # o'zgarmagan yoki o'chirilgan (False)
        image, error = clean_image(avatar)
        if error:
            raise forms.ValidationError(error)
        return image

    def save(self, commit=True):
        if self.cleaned_data.get('regenerate_token'):
            self.instance.token = ''  # Team.save() yangisini yaratadi
        team = super().save(commit)
        if commit:
            team.members.add(team.captain)
        return team


class UserForm(forms.ModelForm):
    """Foydalanuvchi va uning CTF profili bitta formada."""

    total_points = forms.IntegerField(label='Jami ball', min_value=0)
    telegram_id = forms.IntegerField(label='Telegram ID', required=False)
    new_password = forms.CharField(
        label='Yangi parol',
        required=False,
        strip=False,
        widget=forms.PasswordInput(render_value=False),
        help_text="Faqat panelga parol bilan kirishi kerak bo'lgan xodimlar uchun. Bo'sh qolsa parol o'zgarmaydi.",
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'is_active', 'is_staff', 'is_superuser')
        labels = {'is_staff': 'Panelga kirish (xodim)', 'is_superuser': 'Bosh administrator'}

    def __init__(self, *args, editor=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.editor = editor
        profile = self.profile()
        self.fields['total_points'].initial = profile.total_points if profile else 0
        self.fields['telegram_id'].initial = profile.telegram_id if profile else None
        for name in ('is_active', 'is_staff', 'is_superuser'):
            self.fields[name].help_text = ''
        if not (editor and editor.is_superuser):
            # Huquqlarni faqat bosh administrator o'zgartiradi
            for name in ('is_staff', 'is_superuser', 'new_password'):
                self.fields.pop(name)

    def profile(self):
        if not self.instance.pk:
            return None
        return CTFProfile.objects.filter(user=self.instance).first()

    def clean_telegram_id(self):
        telegram_id = self.cleaned_data.get('telegram_id')
        if telegram_id and CTFProfile.objects.filter(telegram_id=telegram_id).exclude(user=self.instance.pk).exists():
            raise forms.ValidationError('Bu Telegram ID boshqa foydalanuvchiga biriktirilgan.')
        return telegram_id

    def clean_new_password(self):
        password = self.cleaned_data.get('new_password')
        if password:
            validate_password(password, self.instance)
        return password

    def clean(self):
        cleaned = super().clean()
        if self.editor and self.instance.pk == self.editor.pk:
            # O'zini o'zi panel'dan chiqarib yubormasin
            for name in ('is_active', 'is_staff', 'is_superuser'):
                if name in self.fields and not cleaned.get(name):
                    self.add_error(name, "O'z hisobingizdan bu huquqni olib bo'lmaydi.")
        return cleaned

    @transaction.atomic
    def save(self, commit=True):
        user = super().save(commit=False)
        if self.cleaned_data.get('new_password'):
            user.set_password(self.cleaned_data['new_password'])
        user.save()
        profile, _ = CTFProfile.objects.get_or_create(user=user)
        profile.total_points = self.cleaned_data['total_points']
        profile.telegram_id = self.cleaned_data.get('telegram_id')
        profile.save()
        return user


class RegistrationForm(forms.ModelForm):
    class Meta:
        model = TournamentRegistration
        fields = ('score',)

    def clean_score(self):
        score = self.cleaned_data['score']
        if score < 0:
            raise forms.ValidationError("Ball manfiy bo'lishi mumkin emas.")
        return score

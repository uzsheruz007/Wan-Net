import telebot
from django.core.management.base import BaseCommand
from django.conf import settings
from ctf.models import TelegramAuth
import random
import string

class Command(BaseCommand):
    help = 'Runs the Telegram Bot for Authentication'

    def handle(self, *args, **options):
        bot = telebot.TeleBot(settings.TELEGRAM_BOT_TOKEN)
        self.stdout.write(self.style.SUCCESS('Bot started...'))

        @bot.message_handler(commands=['start'])
        def send_welcome(message):
            user_id = message.from_user.id
            username = message.from_user.username or "Unknown"
            
            # Generate 6-digit code
            code = ''.join(random.choices(string.digits, k=6))
            
            # Save or Update
            TelegramAuth.objects.update_or_create(
                telegram_id=user_id,
                defaults={
                    'access_code': code,
                    'username': username
                }
            )
            
            response = (
                f"🔒 <b>Wan-Net Shaxsni Tasdiqlash</b>\n\n"
                f"Foydalanuvchi: @{username}\n"
                f"ID: {user_id}\n\n"
                f"🔑 <b>KIRISH KODI:</b> <code>{code}</code>\n\n"
                f"🔗 <b>KIRISH LINKI:</b> http://127.0.0.1:8000/login/\n\n"
                f"<i>Bu kod vaqtincha kirish uchun amal qiladi. Uni hech kimga bermang.</i>"
            )
            
            bot.reply_to(message, response, parse_mode='HTML')

        bot.infinity_polling()

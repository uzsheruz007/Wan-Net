import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wan.settings')
django.setup()

from ctf.models import Challenge, Tournament

def check_structure():
    print("--- MASALALAR HOLATI ---")
    
    # 1. Umumiy (Public) masalalar
    public_challenges = Challenge.objects.filter(tournament__isnull=True)
    print(f"\n[UMUMIY BO'LIMDA] ({public_challenges.count()} ta):")
    for ch in public_challenges:
        print(f" - {ch.title} (ID: {ch.id})")

    # 2. Turnir ichidagi masalalar
    print("\n[TURNIR ICHIDA]:")
    tournaments = Tournament.objects.all()
    for t in tournaments:
        t_challenges = t.challenges.all()
        if t_challenges.exists():
            print(f" -> {t.title} (ID: {t.id}): {t_challenges.count()} ta masala")
            for ch in t_challenges:
                 print(f"   - {ch.title}")
        else:
            print(f" -> {t.title} (ID: {t.id}): Masalalar yo'q (BO'SH)")

if __name__ == "__main__":
    check_structure()

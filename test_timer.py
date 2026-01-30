import os
import django
import time
from django.utils import timezone
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'wan.settings')
django.setup()

def test_timer():
    print("--- TIMER LOGIC TEST ---")
    
    # 1. Server Time
    now = timezone.now()
    print(f"Current Server Time (Aware): {now}")
    
    # 2. Simulate Tournament Start (30 mins later)
    start_date = now + timedelta(minutes=30)
    print(f"Tournament Start: {start_date}")
    
    # 3. Simulate Template Rendering (date:'U')
    # Django 'U' returns Unix timestamp (seconds)
    server_timestamp = int(start_date.timestamp())
    print(f"Server Timestamp (Seconds): {server_timestamp}")
    
    # 4. Simulate Browser (JS)
    # JS Date.now() returns UTC milliseconds
    js_now = int(time.time() * 1000)
    js_target = server_timestamp * 1000
    
    diff = js_target - js_now
    
    print(f"JS Target (ms): {js_target}")
    print(f"JS Now (ms): {js_now}")
    print(f"Difference (ms): {diff}")
    
    seconds_left = diff / 1000
    minutes_left = seconds_left / 60
    
    print(f"Vaqt qoldi: {minutes_left:.2f} daqiqa")
    
    if 29 < minutes_left < 31:
        print("✅ TEST PASSED: Logic is correct!")
    else:
        print("❌ TEST FAILED: Calculation mismatch.")

if __name__ == "__main__":
    test_timer()

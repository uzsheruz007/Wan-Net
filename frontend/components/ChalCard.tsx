import { Difficulty } from '@/components/Difficulty';
import { A, pad4 } from '@/components/ui';
import type { ChallengeCard } from '@/lib/types';

const CHIP: Record<string, string> = {
  Web: '',
  Crypto: 'chip-violet',
  OSINT: 'chip-cyan',
  Forensics: 'chip-warn',
  Reverse: 'chip-danger',
};

const ICON: Record<string, string> = {
  Web: 'fa-globe',
  Crypto: 'fa-key',
  OSINT: 'fa-satellite-dish',
  Forensics: 'fa-magnifying-glass',
  Reverse: 'fa-microchip',
};

/** Masala kartasi: kategoriya, nom, qiyinlik va ball — holat yozuv bilan, kartani yopmaydi */
export function ChalCard({ challenge: c, href }: { challenge: ChallengeCard; href: string }) {
  const icon = c.is_lab ? 'fa-server' : (ICON[c.category] ?? 'fa-flag');
  return (
    <A href={href} className={`panel hud panel-interactive block ${c.is_solved ? 'is-solved' : ''}`}>
      <div className="chal-card">
        <div className="chal-head">
          <span className={`chip ${CHIP[c.category] ?? 'chip-muted'}`}>
            {c.category}
            {c.is_lab && ' · LAB'}
          </span>
          <span className="chal-icon" aria-hidden="true">
            <i className={`fas ${icon}`}></i>
          </span>
        </div>
        <h3 className="chal-title">{c.title}</h3>
        <div className="chal-meta">
          {c.difficulty ? <Difficulty level={c.difficulty} /> : <span className="text-muted font-mono text-xs">—</span>}
          <span className="chal-pts">{c.points} ball</span>
        </div>
        <div className="chal-foot">
          {c.is_solved ? (
            <span className="text-acc">
              <i className="fas fa-check mr-1"></i> Yechilgan
            </span>
          ) : c.has_failed_attempt ? (
            <span className="text-warn">
              <i className="fas fa-rotate-right mr-1"></i> Urinib ko'rilgan
            </span>
          ) : (
            <span>#{pad4(c.id)}</span>
          )}
          <span className="text-acc">
            Ochish <i className="fas fa-arrow-right ml-1"></i>
          </span>
        </div>
      </div>
    </A>
  );
}

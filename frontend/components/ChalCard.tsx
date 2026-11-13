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

/** ctf/_chal_card.html: yagona masala kartasi */
export function ChalCard({ challenge: c, href }: { challenge: ChallengeCard; href: string }) {
  const icon = c.is_lab ? 'fa-server' : (ICON[c.category] ?? 'fa-flag');
  return (
    <A href={href} className="panel hud panel-interactive block">
      <div className="chal-card">
        <div className="chal-visual">
          <span className={`chal-cat chip ${CHIP[c.category] ?? 'chip-muted'}`}>{c.category}</span>
          <span className="chal-pts chip chip-muted">{c.points} PTS</span>
          <div className="chal-icon">
            <i className={`fas ${icon}`}></i>
          </div>
        </div>
        <div className="chal-body">
          <h3 className="chal-title">{c.title}</h3>
          <div className="chal-foot">
            <span>
              #{pad4(c.id)}
              {c.is_lab && (
                <>
                  {' · '}
                  <span className="text-acc2">LAB</span>
                </>
              )}
            </span>
            <span className="text-acc">
              OCHISH <i className="fas fa-arrow-right ml-1"></i>
            </span>
          </div>
        </div>
      </div>
      {c.is_solved ? (
        <div className="overlay">
          <div className="stamp stamp-ok">YECHILGAN</div>
        </div>
      ) : (
        c.has_failed_attempt && (
          <div className="overlay">
            <div className="stamp stamp-fail">YECHILMAGAN</div>
          </div>
        )
      )}
    </A>
  );
}

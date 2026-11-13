'use client';

export default function SiteError({ reset }: { reset: () => void }) {
  return (
    <main className="page min-h-screen flex items-center justify-center">
      <title>Xato // Wan-Net</title>
      <div className="bg-stack" aria-hidden="true">
        <div className="bg-glow"></div>
        <div className="bg-grid"></div>
        <div className="bg-vignette"></div>
      </div>
      <section className="panel hud pad text-center max-w-lg rise" role="alert">
        <div className="chal-icon mx-auto mb-6" style={{ color: 'var(--danger)' }}>
          <i className="fas fa-triangle-exclamation"></i>
        </div>
        <div className="eyebrow mb-3 justify-center" style={{ color: 'var(--danger)' }}>
          xato
        </div>
        <h1 className="section-title mb-4">Sahifani yuklab bo'lmadi</h1>
        <p className="text-dim mb-8">Server javob bermadi. Birozdan keyin qayta urinib ko'ring.</p>
        <button type="button" onClick={reset} className="btn btn-solid">
          <i className="fas fa-rotate-right"></i> QAYTA URINISH
        </button>
      </section>
    </main>
  );
}

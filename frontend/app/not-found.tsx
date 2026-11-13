import { A } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="page min-h-screen flex items-center justify-center">
      <title>404 // Wan-Net</title>
      <div className="bg-stack" aria-hidden="true">
        <div className="bg-glow"></div>
        <div className="bg-grid"></div>
        <div className="bg-vignette"></div>
      </div>
      <section className="panel hud pad text-center max-w-lg rise">
        <div className="chal-icon mx-auto mb-6">
          <i className="fas fa-ghost"></i>
        </div>
        <div className="eyebrow mb-3 justify-center">404</div>
        <h1 className="section-title mb-4">Sahifa topilmadi</h1>
        <p className="text-dim mb-8">Havola eskirgan yoki bu sahifani ko'rishga ruxsatingiz yo'q.</p>
        <A href="/" className="btn btn-solid">
          <i className="fas fa-chevron-left"></i> BOSH SAHIFA
        </A>
      </section>
    </main>
  );
}

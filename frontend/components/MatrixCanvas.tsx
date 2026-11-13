'use client';

import { useEffect, useRef } from 'react';

/** Matritsa oqimi: har ustun o'z tezligida, yorqin bosh va so'nib boruvchi iz (ctf/base.html dagi skript). */
export function MatrixCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const glyphs = ['0', '1'];
    const pick = () => glyphs[(Math.random() * glyphs.length) | 0];
    type Column = { y: number; speed: number; color: string; prev: number | null };
    let size = 17;
    let cols: Column[] = [];
    let W = 0;
    let H = 0;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas!.width = W;
      canvas!.height = H;
      size = W < 640 ? 14 : 17;
      cols = Array.from({ length: Math.ceil(W / size) }, () => ({
        y: (Math.random() * -H) / size,
        speed: 0.35 + Math.random() * 0.75,
        color: Math.random() < 0.12 ? '#00d1ff' : '#00ff9c',
        prev: null,
      }));
      ctx!.fillStyle = '#04070a';
      ctx!.fillRect(0, 0, W, H);
    }
    resize();

    let resizeTimer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    };
    window.addEventListener('resize', onResize);

    function draw() {
      ctx!.fillStyle = 'rgba(4, 7, 10, 0.085)';
      ctx!.fillRect(0, 0, W, H);
      ctx!.font = `600 ${size - 2}px "JetBrains Mono", monospace`;
      ctx!.textBaseline = 'top';
      cols.forEach((col, i) => {
        const x = i * size;
        const row = Math.floor(col.y);
        if (col.prev !== null && col.prev !== row) {
          ctx!.fillStyle = col.color;
          ctx!.fillText(pick(), x, col.prev * size);
        }
        if (col.prev !== row) {
          ctx!.fillStyle = '#e6fff4';
          ctx!.fillText(pick(), x, row * size);
          col.prev = row;
        }
        col.y += col.speed;
        if (row * size > H && Math.random() > 0.97) {
          col.y = Math.random() * -20;
          col.prev = null;
          col.speed = 0.35 + Math.random() * 0.75;
        }
      });
    }

    let last = 0;
    let raf: number | null = null;
    function loop(ts: number) {
      raf = requestAnimationFrame(loop);
      if (ts - last < (calm ? 110 : 50)) return; // ~20 kadr/s (animatsiya o'chiq tizimda ~9)
      last = ts;
      draw();
    }
    function sync() {
      if (!document.hidden && raf === null) {
        raf = requestAnimationFrame(loop);
      } else if (document.hidden && raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    }
    document.addEventListener('visibilitychange', sync);
    sync();

    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return <canvas id="matrix-canvas" ref={ref} />;
}

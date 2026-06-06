import React from 'react';

const variants = [
  {
    id: 'PastelClouds',
    label: 'A — Wolkensanft',
    subtitle: 'Lavendel · Mint · Pfirsich',
    accent: '#c9a8ed',
    bg: '#f9f4ff',
    dot: '#7dd8c2',
  },
  {
    id: 'PastelSunny',
    label: 'B — Sonniger Tag',
    subtitle: 'Gelb · Koralle · Himmelblau',
    accent: '#f87171',
    bg: '#fffbf0',
    dot: '#f59e0b',
  },
  {
    id: 'PastelCandy',
    label: 'C — Candy Shop',
    subtitle: 'Lila · Rosa · Mint',
    accent: '#a855f7',
    bg: '#fdf4ff',
    dot: '#ec4899',
  },
];

export function PastelCanvas() {
  const base = typeof window !== 'undefined'
    ? window.location.origin + (import.meta.env.BASE_URL ?? '/__mockup/').replace(/\/$/, '')
    : '/__mockup';

  return (
    <div style={{ fontFamily: "'Nunito', 'Segoe UI', sans-serif", background: '#f5f0ff', minHeight: '100vh', padding: '2rem' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', borderRadius: 999, background: '#e9d5ff', marginBottom: 16, color: '#7c3aed', fontSize: '0.85rem', fontWeight: 800 }}>
          🎨 Pastel Design Exploration
        </div>
        <h1 style={{ fontWeight: 900, fontSize: 'clamp(1.6rem, 3.5vw, 2.5rem)', color: '#3b1854', margin: '0 0 8px' }}>
          HeroKids Landing — 3 Pastel-Varianten
        </h1>
        <p style={{ color: '#8b5aaa', fontSize: '0.95rem', maxWidth: 560, margin: '0 auto' }}>
          Drei verschiedene Pastellpaletten mit je eigenem Charakter und leichten Strukturunterschieden.
          Jede Variante zeigt die vollständige Landing-Page-Struktur.
        </p>
      </div>

      {/* 3-column iframe grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', maxWidth: 1700, margin: '0 auto' }}>
        {variants.map((v) => (
          <div key={v.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* Label card */}
            <div style={{ background: '#fff', borderRadius: '18px 18px 0 0', padding: '1rem 1.25rem 0.85rem', border: `1.5px solid ${v.accent}40`, borderBottom: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1rem', color: '#3b1854', marginBottom: 2 }}>{v.label}</div>
                <div style={{ fontWeight: 600, fontSize: '0.78rem', color: '#8b5aaa' }}>{v.subtitle}</div>
              </div>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: v.accent }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: v.dot }} />
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: v.bg, border: `1.5px solid ${v.accent}80` }} />
              </div>
            </div>

            {/* iframe */}
            <div style={{ borderRadius: '0 0 18px 18px', overflow: 'hidden', border: `1.5px solid ${v.accent}40`, borderTop: `2px solid ${v.accent}`, boxShadow: `0 8px 32px ${v.accent}22`, flexGrow: 1 }}>
              <iframe
                src={`${base}/preview/herokids-landing/${v.id}`}
                title={v.label}
                style={{
                  width: '200%',
                  height: 900,
                  border: 'none',
                  transform: 'scale(0.5)',
                  transformOrigin: 'top left',
                  display: 'block',
                  background: v.bg,
                }}
              />
            </div>

            {/* Quick-open link */}
            <a
              href={`${base}/preview/herokids-landing/${v.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'block', marginTop: 8, textAlign: 'center', color: v.accent, fontWeight: 800, fontSize: '0.82rem', textDecoration: 'none', padding: '6px 0' }}
            >
              In neuem Tab öffnen ↗
            </a>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p style={{ textAlign: 'center', marginTop: '2.5rem', color: '#b09ac4', fontSize: '0.8rem' }}>
        Alle 3 Varianten sind statische Mockups ohne echte API-Calls. Auth-Panel ist visueller Platzhalter.
      </p>
    </div>
  );
}

export default PastelCanvas;

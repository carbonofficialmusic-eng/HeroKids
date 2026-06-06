import React from 'react';

const C = {
  bg: '#ffffff',
  bgCard: '#f9f4ff',
  bgSection: '#f0faf6',
  lavender: '#e8d5f5',
  lavenderD: '#c9a8ed',
  mint: '#c8f0e8',
  mintD: '#7dd8c2',
  peach: '#fde8d8',
  peachD: '#f9c4a8',
  fg: '#3d2d56',
  fgMuted: '#8b7aaa',
  border: '#e8d5f5',
  ctaBg: '#7dd8c2',
  ctaFg: '#ffffff',
} as const;

const features = [
  {
    emoji: '🎮',
    bg: C.lavender,
    title: 'Quests & Challenges',
    desc: 'Chores become magical quests. Kids earn stars and level up their hero character.',
  },
  {
    emoji: '✅',
    bg: C.mint,
    title: 'Photo Proof',
    desc: 'Children snap a photo when done — parents approve from their own dashboard.',
  },
  {
    emoji: '🎁',
    bg: C.peach,
    title: 'Real Rewards',
    desc: 'Redeem earned points for screen time, treats, or family outings you define.',
  },
];

export function PastelClouds() {
  return (
    <div style={{ fontFamily: "'Nunito', 'Segoe UI', sans-serif", background: C.bg, color: C.fg, minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        .pc-nav-link { color: ${C.fgMuted}; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
        .pc-nav-link:hover { color: ${C.fg}; }
        .pc-cta { display: inline-flex; align-items: center; gap: 8px; padding: 0 2rem; height: 52px; border-radius: 999px; background: ${C.ctaBg}; color: ${C.ctaFg}; font-weight: 800; font-size: 1rem; border: none; cursor: pointer; box-shadow: 0 8px 24px -8px ${C.mintD}88; text-decoration: none; }
        .pc-cta:hover { background: ${C.mintD}; }
        .pc-ghost { display: inline-flex; align-items: center; gap: 8px; padding: 0 1.5rem; height: 52px; border-radius: 999px; background: transparent; color: ${C.fg}; font-weight: 700; font-size: 1rem; border: 2px solid ${C.lavender}; cursor: pointer; }
        .pc-feat-card { background: #fff; border-radius: 20px; padding: 2rem; box-shadow: 0 4px 24px rgba(200,160,240,0.12); border: 1.5px solid ${C.lavender}; flex: 1; min-width: 0; }
        .pc-auth-field { width: 100%; padding: 0.65rem 1rem; border-radius: 12px; border: 1.5px solid ${C.lavender}; background: #fff; font-family: inherit; font-size: 0.95rem; color: ${C.fg}; outline: none; box-sizing: border-box; margin-top: 4px; }
        .pc-auth-field:focus { border-color: ${C.mintD}; }
        .pc-tab { flex: 1; padding: 0.5rem; border-radius: 10px; border: none; background: transparent; font-family: inherit; font-weight: 700; font-size: 0.85rem; cursor: pointer; color: ${C.fgMuted}; transition: background 0.15s; }
        .pc-tab.active { background: #fff; color: ${C.fg}; box-shadow: 0 2px 8px rgba(180,140,220,0.15); }
        .pc-submit { width: 100%; padding: 0.75rem; border-radius: 12px; border: none; background: ${C.ctaBg}; color: #fff; font-family: inherit; font-weight: 800; font-size: 1rem; cursor: pointer; margin-top: 0.5rem; }
        .pc-submit:hover { background: ${C.mintD}; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', borderBottom: `1.5px solid ${C.lavender}`, padding: '0 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${C.lavender}, ${C.mint})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⭐</div>
            <span style={{ fontWeight: 900, fontSize: '1.3rem', color: C.fg }}>HeroKids</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#features" className="pc-nav-link">Features</a>
            <a href="#rewards" className="pc-nav-link">Rewards</a>
            <a href="#pricing" className="pc-nav-link">Pricing</a>
          </div>
          <button className="pc-cta" style={{ height: 40, fontSize: '0.9rem', padding: '0 1.25rem' }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero — stacked layout */}
      <section style={{ padding: '5rem 1.5rem 4rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        {/* Ambient blobs */}
        <div style={{ position: 'absolute', top: '-8%', left: '5%', width: 320, height: 320, borderRadius: '50%', background: C.lavender, opacity: 0.45, filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-5%', right: '5%', width: 260, height: 260, borderRadius: '50%', background: C.mint, opacity: 0.45, filter: 'blur(50px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', right: '15%', width: 180, height: 180, borderRadius: '50%', background: C.peach, opacity: 0.4, filter: 'blur(40px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
          {/* Badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', borderRadius: 999, background: C.lavender, marginBottom: 28, color: C.fg, fontSize: '0.85rem', fontWeight: 800 }}>
            ✨ Gamified Chores for Happy Families
          </div>

          <h1 style={{ fontSize: 'clamp(2.6rem, 6vw, 4.2rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '1.25rem', color: C.fg }}>
            Turn Chores into
            <br />
            <span style={{ color: C.mintD }}>Heroic Adventures</span>
          </h1>

          <p style={{ fontSize: '1.1rem', color: C.fgMuted, marginBottom: '2.25rem', lineHeight: 1.7 }}>
            HeroKids makes household tasks fun — kids earn points, unlock rewards,
            and grow into responsible little heroes. Parents stay in control.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
            <a className="pc-cta" href="#auth">
              Start for Free →
            </a>
            <button className="pc-ghost">
              ▶ See How It Works
            </button>
          </div>

          {/* Social proof */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: '0.875rem', color: C.fgMuted, fontWeight: 600 }}>
            <div style={{ display: 'flex' }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #fff', background: C.lavender, marginLeft: i > 1 ? -8 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, overflow: 'hidden' }}>
                  <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${i}&backgroundColor=e8d5f5`} alt="" style={{ width: '100%', height: '100%' }} />
                </div>
              ))}
            </div>
            Loved by 2,400+ families worldwide
          </div>
        </div>
      </section>

      {/* Auth Panel — centred below hero */}
      <section id="auth" style={{ padding: '1rem 1.5rem 4rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: C.bgCard, borderRadius: 24, border: `1.5px solid ${C.lavender}`, padding: '2rem', width: '100%', maxWidth: 440, boxShadow: '0 8px 40px rgba(180,140,220,0.12)' }}>
          <h2 style={{ fontWeight: 900, fontSize: '1.35rem', marginBottom: 4, color: C.fg }}>Join HeroKids</h2>
          <p style={{ color: C.fgMuted, fontSize: '0.9rem', marginBottom: '1.25rem' }}>Create your family account — it's free to start.</p>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: C.lavender, borderRadius: 12, padding: 4, marginBottom: '1.25rem' }}>
            <button className="pc-tab active">Log In</button>
            <button className="pc-tab">Register</button>
            <button className="pc-tab">Reset</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.875rem', color: C.fg }}>Email</label>
              <input className="pc-auth-field" type="email" placeholder="you@example.com" />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.875rem', color: C.fg }}>Password</label>
              <input className="pc-auth-field" type="password" placeholder="••••••••" />
            </div>
            <button className="pc-submit">Log In</button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ background: C.bgSection, padding: '4rem 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.75rem)', color: C.fg, marginBottom: 12 }}>
              Everything your family needs
            </h2>
            <p style={{ color: C.fgMuted, fontSize: '1.05rem', maxWidth: 520, margin: '0 auto' }}>
              A gentle, encouraging system that grows with your children.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {features.map((feat, i) => (
              <div key={i} className="pc-feat-card">
                <div style={{ width: 52, height: 52, borderRadius: 16, background: feat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 16 }}>
                  {feat.emoji}
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8, color: C.fg }}>{feat.title}</h3>
                <p style={{ color: C.fgMuted, lineHeight: 1.65, fontSize: '0.95rem' }}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ padding: '5rem 1.5rem', textAlign: 'center', background: C.bg }}>
        <div style={{ maxWidth: 580, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌟</div>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', color: C.fg, marginBottom: 16 }}>
            Ready to raise little heroes?
          </h2>
          <p style={{ color: C.fgMuted, fontSize: '1.05rem', marginBottom: '2rem', lineHeight: 1.7 }}>
            Join thousands of families making chore time the best time of the day.
          </p>
          <button className="pc-cta" style={{ fontSize: '1.05rem' }}>
            Start Free Today →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1.5px solid ${C.lavender}`, padding: '2rem 1.5rem', background: '#faf7ff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.lavender}, ${C.mint})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>⭐</div>
            <span style={{ fontWeight: 900, color: C.fg }}>HeroKids</span>
          </div>
          <div style={{ display: 'flex', gap: 20, color: C.fgMuted, fontSize: '0.875rem' }}>
            <a href="#" style={{ color: C.fgMuted, textDecoration: 'none' }}>Privacy</a>
            <a href="#" style={{ color: C.fgMuted, textDecoration: 'none' }}>Terms</a>
            <a href="#" style={{ color: C.fgMuted, textDecoration: 'none' }}>Contact</a>
          </div>
          <p style={{ color: C.fgMuted, fontSize: '0.85rem' }}>© 2025 HeroKids. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default PastelClouds;

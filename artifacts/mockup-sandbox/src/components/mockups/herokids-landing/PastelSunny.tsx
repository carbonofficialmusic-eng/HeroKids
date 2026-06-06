import React from 'react';

const C = {
  bg: '#fffbf0',
  bgCard: '#fff8e6',
  bgSection: '#fff4dc',
  yellow: '#fef3c7',
  yellowD: '#f59e0b',
  coral: '#fecaca',
  coralD: '#f87171',
  sky: '#bae6fd',
  skyD: '#38bdf8',
  fg: '#44300a',
  fgMuted: '#92774a',
  border: '#fde68a',
  ctaBg: '#f87171',
  ctaFg: '#ffffff',
} as const;

const steps = [
  { num: '01', color: C.yellow, accent: C.yellowD, title: 'Set Up Tasks', desc: 'Parents create chore quests with point values, due dates, and optional photo-proof requirements.' },
  { num: '02', color: C.coral, accent: C.coralD, title: 'Kids Complete', desc: 'Children check off tasks, snap photos, and watch their points stack up on the leaderboard.' },
  { num: '03', color: C.sky, accent: C.skyD, title: 'Earn Rewards', desc: 'Redeem points for family-defined rewards — screen time, trips, toys, or custom surprises.' },
];

export function PastelSunny() {
  return (
    <div style={{ fontFamily: "'Nunito', 'Segoe UI', sans-serif", background: C.bg, color: C.fg, minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        .ps-nav-link { color: ${C.fgMuted}; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
        .ps-nav-link:hover { color: ${C.fg}; }
        .ps-cta { display: inline-flex; align-items: center; gap: 8px; padding: 0 2rem; height: 52px; border-radius: 999px; background: ${C.ctaBg}; color: ${C.ctaFg}; font-weight: 800; font-size: 1rem; border: none; cursor: pointer; box-shadow: 0 8px 24px -8px ${C.coralD}88; }
        .ps-cta:hover { filter: brightness(1.07); }
        .ps-ghost { display: inline-flex; align-items: center; gap: 8px; padding: 0 1.5rem; height: 52px; border-radius: 999px; background: transparent; color: ${C.fg}; font-weight: 700; font-size: 1rem; border: 2px solid ${C.border}; cursor: pointer; }
        .ps-auth-field { width: 100%; padding: 0.65rem 1rem; border-radius: 12px; border: 1.5px solid ${C.border}; background: #fff; font-family: inherit; font-size: 0.95rem; color: ${C.fg}; outline: none; box-sizing: border-box; margin-top: 4px; }
        .ps-auth-field:focus { border-color: ${C.coralD}; }
        .ps-tab { flex: 1; padding: 0.5rem; border-radius: 10px; border: none; background: transparent; font-family: inherit; font-weight: 700; font-size: 0.85rem; cursor: pointer; color: ${C.fgMuted}; transition: background 0.15s; }
        .ps-tab.active { background: #fff; color: ${C.fg}; box-shadow: 0 2px 8px rgba(245,158,11,0.15); }
        .ps-submit { width: 100%; padding: 0.75rem; border-radius: 12px; border: none; background: ${C.ctaBg}; color: #fff; font-family: inherit; font-weight: 800; font-size: 1rem; cursor: pointer; margin-top: 0.5rem; }
        .ps-submit:hover { filter: brightness(1.07); }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: `rgba(255,251,240,0.92)`, backdropFilter: 'blur(12px)', borderBottom: `1.5px solid ${C.border}`, padding: '0 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${C.yellow}, ${C.coral})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>☀️</div>
            <span style={{ fontWeight: 900, fontSize: '1.3rem', color: C.fg }}>HeroKids</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#how-it-works" className="ps-nav-link">How It Works</a>
            <a href="#rewards" className="ps-nav-link">Rewards</a>
            <a href="#pricing" className="ps-nav-link">Pricing</a>
          </div>
          <button className="ps-cta" style={{ height: 40, fontSize: '0.9rem', padding: '0 1.25rem' }}>
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero — side-by-side with warm gradient background */}
      <section style={{ padding: '3rem 1.5rem 4rem', position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${C.yellow} 0%, ${C.bg} 50%, ${C.coral}40 100%)` }}>
        <div style={{ position: 'absolute', top: '-20%', right: '-5%', width: 400, height: 400, borderRadius: '50%', background: C.coral, opacity: 0.25, filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '10%', width: 300, height: 300, borderRadius: '50%', background: C.sky, opacity: 0.3, filter: 'blur(60px)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          {/* Left: Copy */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 18px', borderRadius: 999, background: C.coral, marginBottom: 28, color: C.fg, fontSize: '0.85rem', fontWeight: 800 }}>
              ☀️ The Sunny Way to Raise Responsible Kids
            </div>

            <h1 style={{ fontSize: 'clamp(2.4rem, 5vw, 3.8rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '1.25rem', color: C.fg }}>
              Make Every Chore
              <br />
              <span style={{ color: C.coralD }}>Shine Bright</span>
            </h1>

            <p style={{ fontSize: '1.05rem', color: C.fgMuted, marginBottom: '2rem', lineHeight: 1.7, maxWidth: 440 }}>
              HeroKids transforms daily tasks into sunny adventures. Children earn points,
              unlock rewards, and parents keep everything running smoothly.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: '2rem' }}>
              <button className="ps-cta">
                Start Free Today →
              </button>
              <button className="ps-ghost">
                ▶ Watch Demo
              </button>
            </div>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[['2,400+', 'Families'], ['98%', 'Satisfaction'], ['Free', 'To Start']].map(([val, label]) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 900, fontSize: '1.4rem', color: C.coralD }}>{val}</div>
                  <div style={{ color: C.fgMuted, fontSize: '0.8rem', fontWeight: 600 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Auth Panel */}
          <div id="auth" style={{ background: '#fff', borderRadius: 24, border: `1.5px solid ${C.border}`, padding: '2rem', boxShadow: '0 12px 48px rgba(245,158,11,0.12)' }}>
            <h2 style={{ fontWeight: 900, fontSize: '1.35rem', marginBottom: 4, color: C.fg }}>Join HeroKids</h2>
            <p style={{ color: C.fgMuted, fontSize: '0.9rem', marginBottom: '1.25rem' }}>Create your family account — it's free to start.</p>

            <div style={{ display: 'flex', gap: 4, background: C.yellow, borderRadius: 12, padding: 4, marginBottom: '1.25rem' }}>
              <button className="ps-tab active">Log In</button>
              <button className="ps-tab">Register</button>
              <button className="ps-tab">Reset</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontWeight: 700, fontSize: '0.875rem', color: C.fg }}>Email</label>
                <input className="ps-auth-field" type="email" placeholder="you@example.com" />
              </div>
              <div>
                <label style={{ fontWeight: 700, fontSize: '0.875rem', color: C.fg }}>Password</label>
                <input className="ps-auth-field" type="password" placeholder="••••••••" />
              </div>
              <button className="ps-submit">Log In</button>
              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: C.fgMuted }}>
                No account? <a href="#" style={{ color: C.coralD, fontWeight: 700, textDecoration: 'none' }}>Register for free</a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" style={{ padding: '5rem 1.5rem', background: C.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.75rem)', color: C.fg, marginBottom: 12 }}>
              How HeroKids Works
            </h2>
            <p style={{ color: C.fgMuted, fontSize: '1.05rem' }}>Three simple steps to a more harmonious household.</p>
          </div>

          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
            {steps.map((step, i) => (
              <div key={i} style={{ flex: 1, minWidth: 260, background: step.color, borderRadius: 20, padding: '2rem', border: `1.5px solid ${step.accent}30` }}>
                <div style={{ fontWeight: 900, fontSize: '2.5rem', color: step.accent, marginBottom: 12, opacity: 0.5 }}>{step.num}</div>
                <h3 style={{ fontWeight: 800, fontSize: '1.2rem', marginBottom: 10, color: C.fg }}>{step.title}</h3>
                <p style={{ color: C.fgMuted, lineHeight: 1.65, fontSize: '0.95rem' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '5rem 1.5rem', textAlign: 'center', background: `linear-gradient(135deg, ${C.yellow} 0%, ${C.coral}50 100%)` }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌻</div>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', color: C.fg, marginBottom: 16 }}>
            Start your sunny family journey
          </h2>
          <p style={{ color: C.fgMuted, fontSize: '1.05rem', marginBottom: '2rem', lineHeight: 1.7 }}>
            Join 2,400+ families who've made chore time something kids actually look forward to.
          </p>
          <button className="ps-cta" style={{ fontSize: '1.05rem' }}>
            Create Free Account →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1.5px solid ${C.border}`, padding: '2rem 1.5rem', background: C.bgCard }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.yellow}, ${C.coral})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>☀️</div>
            <span style={{ fontWeight: 900, color: C.fg }}>HeroKids</span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            <a href="#" style={{ color: C.fgMuted, textDecoration: 'none', fontSize: '0.875rem' }}>Privacy</a>
            <a href="#" style={{ color: C.fgMuted, textDecoration: 'none', fontSize: '0.875rem' }}>Terms</a>
            <a href="#" style={{ color: C.fgMuted, textDecoration: 'none', fontSize: '0.875rem' }}>Contact</a>
          </div>
          <p style={{ color: C.fgMuted, fontSize: '0.85rem' }}>© 2025 HeroKids. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default PastelSunny;

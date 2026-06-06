import React from 'react';

const C = {
  bg: '#fdf4ff',
  bgCard: '#faf0ff',
  purple: '#e9d5ff',
  purpleD: '#a855f7',
  pink: '#fce7f3',
  pinkD: '#ec4899',
  mint: '#d1fae5',
  mintD: '#10b981',
  fg: '#3b1854',
  fgMuted: '#8b5aaa',
  border: '#e9d5ff',
  ctaBg: '#a855f7',
  ctaFg: '#ffffff',
} as const;

const features = [
  {
    emoji: '🎮',
    bg: C.purple,
    accent: C.purpleD,
    title: 'Quest System',
    desc: 'Every chore becomes an epic quest. Kids pick up tasks, submit photo proof, and watch XP roll in.',
  },
  {
    emoji: '🏆',
    bg: C.pink,
    accent: C.pinkD,
    title: 'Leaderboard',
    desc: 'Siblings compete in a friendly leaderboard. Weekly resets keep everyone motivated all month long.',
  },
  {
    emoji: '🎁',
    bg: C.mint,
    accent: C.mintD,
    title: 'Reward Shop',
    desc: 'Spend earned points in the family reward shop — screen time, candy, outings, and more.',
  },
];

const testimonials = [
  { quote: 'My 8-year-old now asks to do extra chores just to earn more candy points!', name: 'Sophie M.', role: 'Mom of 2' },
  { quote: 'The leaderboard turned sibling rivalry into healthy competition. Game changer.', name: 'James K.', role: 'Dad of 3' },
];

export function PastelCandy() {
  return (
    <div style={{ fontFamily: "'Nunito', 'Segoe UI', sans-serif", background: C.bg, color: C.fg, minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        .pca-nav-link { color: ${C.fgMuted}; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
        .pca-nav-link:hover { color: ${C.fg}; }
        .pca-cta { display: inline-flex; align-items: center; gap: 8px; padding: 0 2rem; height: 52px; border-radius: 9999px; background: ${C.ctaBg}; color: ${C.ctaFg}; font-weight: 800; font-size: 1rem; border: none; cursor: pointer; box-shadow: 0 8px 24px -8px ${C.purpleD}77; }
        .pca-cta:hover { filter: brightness(1.1); }
        .pca-ghost { display: inline-flex; align-items: center; gap: 8px; padding: 0 1.5rem; height: 52px; border-radius: 9999px; background: transparent; color: ${C.fg}; font-weight: 700; font-size: 1rem; border: 2px solid ${C.purple}; cursor: pointer; }
        .pca-auth-field { width: 100%; padding: 0.65rem 1rem; border-radius: 16px; border: 1.5px solid ${C.purple}; background: #fff; font-family: inherit; font-size: 0.95rem; color: ${C.fg}; outline: none; box-sizing: border-box; margin-top: 4px; }
        .pca-auth-field:focus { border-color: ${C.purpleD}; }
        .pca-tab { flex: 1; padding: 0.5rem; border-radius: 12px; border: none; background: transparent; font-family: inherit; font-weight: 700; font-size: 0.85rem; cursor: pointer; color: ${C.fgMuted}; transition: background 0.15s; }
        .pca-tab.active { background: #fff; color: ${C.fg}; box-shadow: 0 2px 8px rgba(168,85,247,0.15); }
        .pca-submit { width: 100%; padding: 0.75rem; border-radius: 16px; border: none; background: ${C.ctaBg}; color: #fff; font-family: inherit; font-weight: 800; font-size: 1rem; cursor: pointer; margin-top: 0.5rem; }
        .pca-submit:hover { filter: brightness(1.1); }
        .pca-feat-card { background: #fff; border-radius: 28px; padding: 2rem; box-shadow: 0 4px 24px rgba(168,85,247,0.1); border: 1.5px solid ${C.purple}; }
        .pca-testimonial { background: #fff; border-radius: 24px; padding: 1.75rem; border: 1.5px solid ${C.pink}; flex: 1; min-width: 260px; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: `rgba(253,244,255,0.92)`, backdropFilter: 'blur(12px)', borderBottom: `1.5px solid ${C.purple}`, padding: '0 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 14, background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🍬</div>
            <span style={{ fontWeight: 900, fontSize: '1.3rem', color: C.fg }}>HeroKids</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#features" className="pca-nav-link">Features</a>
            <a href="#testimonials" className="pca-nav-link">Reviews</a>
            <a href="#pricing" className="pca-nav-link">Pricing</a>
          </div>
          <button className="pca-cta" style={{ height: 40, fontSize: '0.9rem', padding: '0 1.25rem' }}>
            Join Now
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '4.5rem 1.5rem 3rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-5%', width: 350, height: 350, borderRadius: '50%', background: C.purple, opacity: 0.5, filter: 'blur(70px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '0%', right: '-5%', width: 280, height: 280, borderRadius: '50%', background: C.pink, opacity: 0.5, filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '40%', width: 200, height: 200, borderRadius: '50%', background: C.mint, opacity: 0.45, filter: 'blur(50px)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 9999, background: C.pink, marginBottom: 28, color: C.pinkD, fontSize: '0.85rem', fontWeight: 800 }}>
            🍬 The Sweetest Way to Raise Responsible Kids
          </div>

          <h1 style={{ fontSize: 'clamp(2.8rem, 7vw, 4.5rem)', fontWeight: 900, lineHeight: 1.08, marginBottom: '1.25rem', color: C.fg }}>
            Chores Never
            <br />
            <span style={{ color: C.purpleD }}>Tasted So Sweet</span>
          </h1>

          <p style={{ fontSize: '1.1rem', color: C.fgMuted, marginBottom: '2.25rem', lineHeight: 1.7, maxWidth: 540, margin: '0 auto 2.25rem' }}>
            HeroKids turns household tasks into a candy-coloured adventure.
            Kids earn points, unlock skins, and climb the leaderboard — all with parent approval.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
            <button className="pca-cta" style={{ fontSize: '1.05rem' }}>
              Start for Free →
            </button>
            <button className="pca-ghost">
              ▶ See the Magic
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: '0.875rem', color: C.fgMuted, fontWeight: 600 }}>
            <div style={{ display: 'flex' }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid #fff', background: C.purple, marginLeft: i > 1 ? -8 : 0, overflow: 'hidden' }}>
                  <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=candy${i}&backgroundColor=e9d5ff`} alt="" style={{ width: '100%', height: '100%' }} />
                </div>
              ))}
            </div>
            2,400+ families and counting
          </div>
        </div>
      </section>

      {/* Auth Panel */}
      <section id="auth" style={{ padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: '#fff', borderRadius: 32, border: `1.5px solid ${C.purple}`, padding: '2rem', width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(168,85,247,0.12)' }}>
          <h2 style={{ fontWeight: 900, fontSize: '1.35rem', marginBottom: 4, color: C.fg }}>Create Your Family</h2>
          <p style={{ color: C.fgMuted, fontSize: '0.9rem', marginBottom: '1.25rem' }}>Free forever for up to 3 family members.</p>

          <div style={{ display: 'flex', gap: 4, background: C.purple, borderRadius: 16, padding: 4, marginBottom: '1.25rem' }}>
            <button className="pca-tab active">Log In</button>
            <button className="pca-tab">Register</button>
            <button className="pca-tab">Reset</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.875rem', color: C.fg }}>Email</label>
              <input className="pca-auth-field" type="email" placeholder="you@example.com" />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.875rem', color: C.fg }}>Password</label>
              <input className="pca-auth-field" type="password" placeholder="••••••••" />
            </div>
            <button className="pca-submit">Log In 🍬</button>
          </div>
        </div>
      </section>

      {/* Feature Grid — 3 cards */}
      <section id="features" style={{ padding: '4.5rem 1.5rem', background: C.bgCard }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.75rem)', color: C.fg, marginBottom: 12 }}>
              Packed with Playful Features
            </h2>
            <p style={{ color: C.fgMuted, fontSize: '1.05rem', maxWidth: 500, margin: '0 auto' }}>
              Every feature designed to delight kids and give parents peace of mind.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {features.map((feat, i) => (
              <div key={i} className="pca-feat-card">
                <div style={{ width: 60, height: 60, borderRadius: 22, background: feat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, marginBottom: 18 }}>
                  {feat.emoji}
                </div>
                <h3 style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: 10, color: C.fg }}>{feat.title}</h3>
                <p style={{ color: C.fgMuted, lineHeight: 1.65, fontSize: '0.95rem' }}>{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" style={{ padding: '4.5rem 1.5rem', background: C.bg }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontWeight: 900, fontSize: 'clamp(1.6rem, 3.5vw, 2.4rem)', color: C.fg }}>
              Families Are Loving It 💜
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
            {testimonials.map((t, i) => (
              <div key={i} className="pca-testimonial">
                <div style={{ display: 'flex', marginBottom: 12, gap: 2 }}>
                  {[1,2,3,4,5].map(s => <span key={s} style={{ color: C.purpleD, fontSize: 16 }}>★</span>)}
                </div>
                <p style={{ color: C.fg, lineHeight: 1.65, marginBottom: 16, fontStyle: 'italic', fontSize: '0.95rem' }}>"{t.quote}"</p>
                <div>
                  <div style={{ fontWeight: 800, color: C.fg, fontSize: '0.9rem' }}>{t.name}</div>
                  <div style={{ color: C.fgMuted, fontSize: '0.8rem' }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '5rem 1.5rem', textAlign: 'center', background: `linear-gradient(135deg, ${C.purple} 0%, ${C.pink} 100%)` }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🍬</div>
          <h2 style={{ fontWeight: 900, fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', color: C.fg, marginBottom: 16 }}>
            Make chores irresistible
          </h2>
          <p style={{ color: C.fgMuted, fontSize: '1.05rem', marginBottom: '2rem', lineHeight: 1.7 }}>
            Start your free family account today and watch kids beg for more chores.
          </p>
          <button className="pca-cta" style={{ fontSize: '1.05rem' }}>
            Start Free Today 🍬
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1.5px solid ${C.purple}`, padding: '2rem 1.5rem', background: '#faf0ff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 10, background: `linear-gradient(135deg, ${C.purple}, ${C.pink})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🍬</div>
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

export default PastelCandy;

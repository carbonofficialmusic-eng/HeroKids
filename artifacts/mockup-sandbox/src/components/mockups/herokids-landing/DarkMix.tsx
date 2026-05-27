import React from 'react';
import { Button } from '@/components/ui/button';
import { Star, CheckCircle2, Shield, Heart, ArrowRight, Play, Gamepad2, Gift, Sparkles } from 'lucide-react';
import './DarkMix.css';

export function DarkMix() {
  return (
    <div className="herokids-dark min-h-screen overflow-x-hidden selection:bg-orange-500/30">

      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blob-1 -z-10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-blob-2 -z-10 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full backdrop-blur-md border-b" style={{ backgroundColor: 'hsl(228 30% 10% / 0.85)', borderColor: 'hsl(228 20% 22% / 0.8)' }}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transform rotate-3" style={{ backgroundColor: 'hsl(22 95% 56%)' }}>
              <Star className="w-6 h-6 fill-white text-white" />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight" style={{ color: 'hsl(220 30% 95%)' }}>HeroKids</span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-semibold" style={{ color: 'hsl(220 20% 60%)' }}>
            <a href="#how-it-works" className="hover:text-orange-400 transition-colors">How it Works</a>
            <a href="#features" className="hover:text-orange-400 transition-colors">Features</a>
            <a href="#parents" className="hover:text-orange-400 transition-colors">For Parents</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="hidden sm:inline-flex font-bold" style={{ color: 'hsl(220 20% 60%)' }}>Log in</Button>
            <Button className="rounded-full px-6 font-bold btn-bounce shadow-md text-white" style={{ backgroundColor: 'hsl(22 95% 56%)' }}>
              Start Free Trial
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="glow-hero" />
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold mb-6 border" style={{ backgroundColor: 'hsl(228 25% 16%)', borderColor: 'hsl(228 20% 28%)', color: 'hsl(220 20% 60%)' }}>
                <Sparkles className="w-4 h-4" style={{ color: 'hsl(45 95% 56%)' }} />
                <span>Make chores the best part of the day</span>
              </div>
              <h1 className="font-display text-5xl lg:text-7xl font-extrabold leading-[1.1] mb-6">
                Raise helpful kids.<br />
                <span className="text-gradient relative inline-block">
                  Without the nagging.
                  <svg className="absolute w-full h-4 -bottom-2 left-0" viewBox="0 0 100 20" preserveAspectRatio="none" style={{ color: 'hsl(22 95% 56% / 0.5)' }}>
                    <path d="M0,10 Q50,20 100,10" stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round" />
                  </svg>
                </span>
              </h1>
              <p className="text-xl mb-8 max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed" style={{ color: 'hsl(220 20% 60%)' }}>
                HeroKids turns daily routines into epic adventures. Kids earn points, unlock rewards, and build healthy habits—all while having a blast.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Button size="lg" className="h-14 rounded-full px-8 font-bold text-lg w-full sm:w-auto btn-bounce text-white" style={{ backgroundColor: 'hsl(22 95% 56%)', boxShadow: '0 8px 24px -8px hsl(22 95% 56% / 0.5)' }}>
                  Get Started for Free
                </Button>
                <Button size="lg" variant="outline" className="h-14 rounded-full px-8 font-bold text-lg w-full sm:w-auto border-2 group" style={{ borderColor: 'hsl(228 20% 28%)', color: 'hsl(220 30% 95%)', backgroundColor: 'transparent' }}>
                  <Play className="w-5 h-5 mr-2 fill-current" style={{ color: 'hsl(22 95% 56%)' }} />
                  See how it works
                </Button>
              </div>
              <div className="mt-8 flex items-center justify-center lg:justify-start gap-4 text-sm font-semibold" style={{ color: 'hsl(220 20% 60%)' }}>
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 flex items-center justify-center overflow-hidden" style={{ borderColor: 'hsl(228 30% 10%)', backgroundColor: 'hsl(228 25% 16%)' }}>
                      <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${i}&backgroundColor=b6e3f4`} alt="avatar" />
                    </div>
                  ))}
                </div>
                <span>Loved by 10,000+ families</span>
              </div>
            </div>

            <div className="flex-1 relative w-full max-w-lg mx-auto lg:max-w-none">
              <div className="absolute inset-0 rounded-full blur-3xl transform translate-x-10 translate-y-10" style={{ backgroundColor: 'hsl(22 95% 56% / 0.12)' }} />
              <div className="relative rounded-[2rem] overflow-hidden border-4 shadow-2xl animate-float" style={{ borderColor: 'hsl(228 20% 22%)', boxShadow: '0 32px 80px -16px hsl(22 95% 56% / 0.25)' }}>
                <img
                  src="/__mockup/images/herokids-hero.png"
                  alt="Happy family high fiving"
                  className="w-full h-auto object-cover aspect-video lg:aspect-square"
                />
                <div className="absolute top-6 left-6 rounded-2xl p-3 shadow-xl flex items-center gap-3 animate-float" style={{ animationDelay: '1s', backgroundColor: 'hsl(228 28% 13%)', border: '1px solid hsl(228 20% 22%)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(142 60% 20%)', color: 'hsl(142 60% 60%)' }}>
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'hsl(220 20% 60%)' }}>Completed</p>
                    <p className="font-bold text-sm" style={{ color: 'hsl(220 30% 95%)' }}>Cleaned room!</p>
                  </div>
                </div>
                <div className="absolute bottom-8 right-[-20px] rounded-2xl p-4 shadow-xl flex items-center gap-4 animate-float" style={{ animationDelay: '2s', backgroundColor: 'hsl(228 28% 13%)', border: '1px solid hsl(228 20% 22%)' }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'hsl(45 95% 56%)', color: 'hsl(24 10% 10%)' }}>
                    <Star className="w-7 h-7 fill-current" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-2xl leading-none" style={{ color: 'hsl(220 30% 95%)' }}>+50</p>
                    <p className="text-xs font-bold uppercase" style={{ color: 'hsl(220 20% 60%)' }}>Points Earned</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 relative" style={{ backgroundColor: 'hsl(228 28% 13%)' }}>
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-4xl lg:text-5xl font-extrabold mb-4">From chaos to calm in three simple steps</h2>
            <p className="text-xl font-medium" style={{ color: 'hsl(220 20% 60%)' }}>Set it up in minutes. See the magic happen immediately.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Gamepad2 className="w-8 h-8" style={{ color: 'hsl(199 80% 56%)' }} />,
                title: '1. Set the Missions',
                desc: 'Assign chores, daily routines, or special tasks. Customize points based on difficulty.',
                glow: 'hsl(199 80% 56% / 0.12)'
              },
              {
                icon: <CheckCircle2 className="w-8 h-8" style={{ color: 'hsl(22 95% 56%)' }} />,
                title: '2. Kids Take Charge',
                desc: 'Kids check off tasks in their own fun, gamified app interface.',
                glow: 'hsl(22 95% 56% / 0.12)'
              },
              {
                icon: <Gift className="w-8 h-8" style={{ color: 'hsl(45 95% 56%)' }} />,
                title: '3. Unlock Rewards',
                desc: 'Points turn into real-life rewards you set: screen time, allowance, or a family movie night.',
                glow: 'hsl(45 95% 56% / 0.12)'
              }
            ].map((step, i) => (
              <div key={i} className="rounded-3xl p-8 border transition-all hover:scale-[1.02]" style={{ backgroundColor: 'hsl(228 30% 10%)', borderColor: 'hsl(228 20% 22%)' }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: step.glow }}>
                  {step.icon}
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">{step.title}</h3>
                <p className="font-medium leading-relaxed" style={{ color: 'hsl(220 20% 60%)' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature 1: Kids App */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 order-2 md:order-1 relative">
              <div className="absolute inset-0 rounded-[3rem] transform -rotate-3" style={{ backgroundColor: 'hsl(45 95% 56% / 0.08)' }} />
              <img
                src="/__mockup/images/herokids-rewards.png"
                alt="Gamified app interface"
                className="relative z-10 w-full h-auto rounded-[2rem] shadow-lg animate-float"
                style={{ animationDuration: '7s', border: '2px solid hsl(228 20% 22%)' }}
              />
            </div>
            <div className="flex-1 order-1 md:order-2">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: 'hsl(45 95% 56% / 0.15)' }}>
                <Star className="w-8 h-8 fill-current" style={{ color: 'hsl(45 95% 56%)' }} />
              </div>
              <h2 className="font-display text-4xl lg:text-5xl font-extrabold mb-6">Built for little hands and big imaginations.</h2>
              <p className="text-xl font-medium mb-8 leading-relaxed" style={{ color: 'hsl(220 20% 60%)' }}>
                The kids' interface doesn't feel like a chore chart—it feels like a game. With fun sounds, engaging animations, and clear progress tracking, they'll be begging to do the dishes.
              </p>
              <ul className="space-y-4">
                {['Visual progress tracking', 'Fun achievement badges', 'Customizable avatars'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 font-bold text-lg">
                    <CheckCircle2 className="w-6 h-6" style={{ color: 'hsl(22 95% 56%)' }} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Parents App — dark card on dark bg, with orange glow */}
      <section className="py-24 relative overflow-hidden rounded-[3rem] mx-4 lg:mx-8 mb-24" style={{ background: 'linear-gradient(135deg, hsl(228 28% 16%) 0%, hsl(22 50% 14%) 100%)', border: '1px solid hsl(228 20% 26%)' }}>
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none transform translate-x-1/2 -translate-y-1/2" style={{ backgroundColor: 'hsl(22 95% 56% / 0.1)' }} />
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ backgroundColor: 'hsl(228 25% 22%)' }}>
                <Shield className="w-8 h-8" style={{ color: 'hsl(220 30% 95%)' }} />
              </div>
              <h2 className="font-display text-4xl lg:text-5xl font-extrabold mb-6">Your ultimate parenting command center.</h2>
              <p className="text-xl font-medium mb-8 leading-relaxed" style={{ color: 'hsl(220 20% 60%)' }}>
                Approve completed tasks, set custom rewards, and monitor everyone's progress from your own dedicated parent dashboard. Total control, zero stress.
              </p>
              <Button size="lg" className="rounded-full px-8 font-bold text-lg btn-bounce border" style={{ backgroundColor: 'hsl(228 30% 10%)', color: 'hsl(220 30% 95%)', borderColor: 'hsl(228 20% 30%)' }}>
                Explore Parent Features <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 relative">
              <div className="absolute inset-0 rounded-[3rem] transform rotate-3" style={{ backgroundColor: 'hsl(22 95% 56% / 0.06)' }} />
              <img
                src="/__mockup/images/herokids-mascot.png"
                alt="Kid superhero mascot"
                className="relative z-10 w-full h-auto rounded-[2rem] shadow-2xl animate-float"
                style={{ animationDuration: '8s', border: '2px solid hsl(228 20% 26%)' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <Heart className="w-12 h-12 mx-auto mb-6 fill-current" style={{ color: 'hsl(22 95% 56%)' }} />
            <h2 className="font-display text-4xl font-extrabold">Don't just take our word for it</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                text: '"For the first time ever, my 8-year-old asked me if there were any more chores he could do. This app is literal magic. It completely changed our morning routine."',
                name: 'Sarah Jenkins',
                role: 'Mom of 2',
                seed: 'sarah'
              },
              {
                text: '"We used to argue every night about picking up toys. Now they compete to see who can earn the weekend movie pick first. Absolutely brilliant."',
                name: 'Mike Rodriguez',
                role: 'Dad of 3',
                seed: 'mike'
              }
            ].map((t, i) => (
              <div key={i} className="p-8 rounded-3xl border" style={{ backgroundColor: 'hsl(228 28% 13%)', borderColor: 'hsl(228 20% 22%)' }}>
                <div className="flex mb-4" style={{ color: 'hsl(45 95% 56%)' }}>
                  {[1, 2, 3, 4, 5].map(s => <Star key={s} className="w-5 h-5 fill-current" />)}
                </div>
                <p className="text-lg font-medium mb-6 italic leading-relaxed" style={{ color: 'hsl(220 25% 75%)' }}>{t.text}</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(228 25% 16%)' }}>
                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${t.seed}&backgroundColor=b6e3f4`} alt={t.name} />
                  </div>
                  <div>
                    <p className="font-bold">{t.name}</p>
                    <p className="text-sm" style={{ color: 'hsl(220 20% 60%)' }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-32 relative overflow-hidden mx-4 lg:mx-8 mb-8 rounded-[3rem]" style={{ background: 'linear-gradient(135deg, hsl(22 90% 38%) 0%, hsl(22 95% 52%) 60%, hsl(45 95% 50%) 100%)' }}>
        <div className="absolute inset-0 opacity-10 rounded-[3rem]" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cubes.png')" }} />
        <div className="container mx-auto px-4 relative z-10 text-center text-white max-w-3xl">
          <h2 className="font-display text-5xl lg:text-6xl font-extrabold mb-6">Ready to make family life fun again?</h2>
          <p className="text-2xl mb-10" style={{ color: 'hsl(0 0% 100% / 0.8)' }}>Join thousands of families turning everyday chores into epic adventures.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-14 rounded-full px-10 font-bold text-lg w-full sm:w-auto btn-bounce shadow-xl" style={{ backgroundColor: 'hsl(228 30% 10%)', color: 'hsl(220 30% 95%)' }}>
              Start your 14-day free trial
            </Button>
            <p className="text-sm font-medium" style={{ color: 'hsl(0 0% 100% / 0.6)' }}>No credit card required</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t" style={{ backgroundColor: 'hsl(228 28% 13%)', borderColor: 'hsl(228 20% 20%)' }}>
        <div className="container mx-auto px-4 max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6 font-medium" style={{ color: 'hsl(220 20% 60%)' }}>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 fill-current" style={{ color: 'hsl(22 95% 56%)' }} />
            <span className="font-display font-bold" style={{ color: 'hsl(220 30% 95%)' }}>HeroKids</span>
          </div>
          <p>© {new Date().getFullYear()} HeroKids Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-orange-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-orange-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-orange-400 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default DarkMix;

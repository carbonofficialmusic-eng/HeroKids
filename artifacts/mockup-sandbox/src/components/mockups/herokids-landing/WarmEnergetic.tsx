import React from 'react';
import { Button } from '@/components/ui/button';
import { Star, CheckCircle2, Shield, Heart, ArrowRight, Play, Gamepad2, Gift, Sparkles } from 'lucide-react';
import './_group.css';

export function WarmEnergetic() {
  return (
    <div className="herokids-theme min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary selection:text-white">
      
      {/* Decorative Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blob-1 -z-10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-[10%] right-[-5%] w-[40%] h-[40%] bg-blob-2 -z-10 rounded-full blur-3xl pointer-events-none" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-sm transform rotate-3">
              <Star className="w-6 h-6 fill-current" />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-foreground">HeroKids</span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-semibold text-muted-foreground">
            <a href="#how-it-works" className="hover:text-primary transition-colors">How it Works</a>
            <a href="#features" className="hover:text-primary transition-colors">Features</a>
            <a href="#parents" className="hover:text-primary transition-colors">For Parents</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="hidden sm:inline-flex font-bold hover:text-primary">Log in</Button>
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 font-bold btn-bounce shadow-md">
              Start Free Trial
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 text-secondary-foreground font-bold mb-6 border border-secondary/30">
                <Sparkles className="w-4 h-4 text-secondary-foreground" />
                <span>Make chores the best part of the day</span>
              </div>
              <h1 className="font-display text-5xl lg:text-7xl font-extrabold leading-[1.1] mb-6 text-foreground">
                Raise helpful kids.<br/>
                <span className="text-primary relative inline-block">
                  Without the nagging.
                  <svg className="absolute w-full h-4 -bottom-2 left-0 text-secondary" viewBox="0 0 100 20" preserveAspectRatio="none">
                    <path d="M0,10 Q50,20 100,10" stroke="currentColor" strokeWidth="8" fill="none" strokeLinecap="round"/>
                  </svg>
                </span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed">
                HeroKids turns daily routines into epic adventures. Kids earn points, unlock rewards, and build healthy habits—all while having a blast.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Button size="lg" className="h-14 bg-primary hover:bg-primary/90 text-white rounded-full px-8 font-bold text-lg w-full sm:w-auto btn-bounce shadow-lg shadow-primary/30">
                  Get Started for Free
                </Button>
                <Button size="lg" variant="outline" className="h-14 rounded-full px-8 font-bold text-lg w-full sm:w-auto border-2 hover:bg-muted group">
                  <Play className="w-5 h-5 mr-2 fill-foreground group-hover:text-primary group-hover:fill-primary transition-colors" />
                  See how it works
                </Button>
              </div>
              <div className="mt-8 flex items-center justify-center lg:justify-start gap-4 text-sm font-semibold text-muted-foreground">
                <div className="flex -space-x-3">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${i}&backgroundColor=ffd5dc`} alt="avatar" />
                    </div>
                  ))}
                </div>
                <span>Loved by 10,000+ families</span>
              </div>
            </div>
            
            <div className="flex-1 relative w-full max-w-lg mx-auto lg:max-w-none">
              <div className="absolute inset-0 bg-accent/20 rounded-full blur-3xl transform translate-x-10 translate-y-10" />
              <div className="relative rounded-[2rem] overflow-hidden border-8 border-white shadow-2xl animate-float">
                <img 
                  src="/__mockup/images/herokids-hero.png" 
                  alt="Happy family high fiving" 
                  className="w-full h-auto object-cover aspect-video lg:aspect-square"
                />
                
                {/* Floating elements */}
                <div className="absolute top-6 left-6 bg-white rounded-2xl p-3 shadow-xl flex items-center gap-3 animate-float" style={{animationDelay: '1s'}}>
                  <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Completed</p>
                    <p className="font-bold text-sm">Cleaned room!</p>
                  </div>
                </div>
                
                <div className="absolute bottom-8 right-[-20px] bg-white rounded-2xl p-4 shadow-xl flex items-center gap-4 animate-float" style={{animationDelay: '2s'}}>
                  <div className="w-12 h-12 bg-secondary text-secondary-foreground rounded-full flex items-center justify-center">
                    <Star className="w-7 h-7 fill-current" />
                  </div>
                  <div>
                    <p className="font-display font-bold text-2xl leading-none">+50</p>
                    <p className="text-xs text-muted-foreground font-bold uppercase">Points Earned</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24 bg-white relative">
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="font-display text-4xl lg:text-5xl font-extrabold mb-4">From chaos to calm in three simple steps</h2>
            <p className="text-xl text-muted-foreground font-medium">Set it up in minutes. See the magic happen immediately.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Gamepad2 className="w-8 h-8 text-accent" />,
                title: "1. Set the Missions",
                desc: "Assign chores, daily routines, or special tasks. Customize points based on difficulty.",
                color: "bg-accent/10"
              },
              {
                icon: <CheckCircle2 className="w-8 h-8 text-primary" />,
                title: "2. Kids Take Charge",
                desc: "Kids check off tasks in their own fun, gamified app interface.",
                color: "bg-primary/10"
              },
              {
                icon: <Gift className="w-8 h-8 text-secondary" />,
                title: "3. Unlock Rewards",
                desc: "Points turn into real-life rewards you set: screen time, allowance, or a family movie night.",
                color: "bg-secondary/20"
              }
            ].map((step, i) => (
              <div key={i} className="bg-background rounded-3xl p-8 border border-border/50 shadow-sm hover:shadow-xl transition-shadow relative overflow-hidden group">
                <div className={`w-16 h-16 rounded-2xl ${step.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  {step.icon}
                </div>
                <h3 className="font-display text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-muted-foreground font-medium leading-relaxed">{step.desc}</p>
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
              <div className="absolute inset-0 bg-secondary/30 rounded-[3rem] transform -rotate-3" />
              <img 
                src="/__mockup/images/herokids-rewards.png" 
                alt="Gamified app interface" 
                className="relative z-10 w-full h-auto rounded-[2rem] shadow-lg animate-float"
                style={{ animationDuration: '7s' }}
              />
            </div>
            <div className="flex-1 order-1 md:order-2">
              <div className="w-14 h-14 bg-secondary/20 rounded-2xl flex items-center justify-center mb-6">
                <Star className="w-8 h-8 text-secondary-foreground fill-current" />
              </div>
              <h2 className="font-display text-4xl lg:text-5xl font-extrabold mb-6">Built for little hands and big imaginations.</h2>
              <p className="text-xl text-muted-foreground font-medium mb-8">
                The kids' interface doesn't feel like a chore chart—it feels like a game. With fun sounds, engaging animations, and clear progress tracking, they'll be begging to do the dishes.
              </p>
              <ul className="space-y-4">
                {['Visual progress tracking', 'Fun achievement badges', 'Customizable avatars'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 font-bold text-lg">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 2: Parents App */}
      <section className="py-24 bg-foreground text-white relative overflow-hidden rounded-[3rem] mx-4 lg:mx-8 mb-24">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[100px] pointer-events-none transform translate-x-1/2 -translate-y-1/2" />
        <div className="container mx-auto px-4 max-w-6xl relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h2 className="font-display text-4xl lg:text-5xl font-extrabold mb-6">Your ultimate parenting command center.</h2>
              <p className="text-xl text-white/70 font-medium mb-8">
                Approve completed tasks, set custom rewards, and monitor everyone's progress from your own dedicated parent dashboard. Total control, zero stress.
              </p>
              <Button size="lg" className="bg-white text-foreground hover:bg-white/90 rounded-full px-8 font-bold text-lg btn-bounce">
                Explore Parent Features
              </Button>
            </div>
            <div className="flex-1 relative">
              <div className="absolute inset-0 bg-white/5 rounded-[3rem] transform rotate-3" />
              <img 
                src="/__mockup/images/herokids-mascot.png" 
                alt="Kid superhero mascot" 
                className="relative z-10 w-full h-auto rounded-[2rem] shadow-2xl animate-float"
                style={{ animationDuration: '8s' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-16">
            <Heart className="w-12 h-12 text-primary mx-auto mb-6 fill-current" />
            <h2 className="font-display text-4xl font-extrabold">Don't just take our word for it</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-border">
              <div className="flex text-secondary mb-4">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-current" />)}
              </div>
              <p className="text-lg font-medium mb-6 italic">"For the first time ever, my 8-year-old asked me if there were any more chores he could do. This app is literal magic. It completely changed our morning routine."</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-full overflow-hidden">
                   <img src="https://api.dicebear.com/7.x/notionists/svg?seed=sarah&backgroundColor=b6e3f4" alt="Sarah" />
                </div>
                <div>
                  <p className="font-bold">Sarah Jenkins</p>
                  <p className="text-sm text-muted-foreground">Mom of 2</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-border">
              <div className="flex text-secondary mb-4">
                {[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-current" />)}
              </div>
              <p className="text-lg font-medium mb-6 italic">"We used to argue every night about picking up toys. Now they compete to see who can earn the weekend movie pick first. Absolutely brilliant."</p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-muted rounded-full overflow-hidden">
                   <img src="https://api.dicebear.com/7.x/notionists/svg?seed=mike&backgroundColor=c0aede" alt="Mike" />
                </div>
                <div>
                  <p className="font-bold">Mike Rodriguez</p>
                  <p className="text-sm text-muted-foreground">Dad of 3</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        <div className="container mx-auto px-4 relative z-10 text-center text-white max-w-3xl">
          <h2 className="font-display text-5xl lg:text-6xl font-extrabold mb-6">Ready to make family life fun again?</h2>
          <p className="text-2xl text-white/80 font-medium mb-10">Join thousands of families turning everyday chores into epic adventures.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="h-14 bg-white text-primary hover:bg-white/90 rounded-full px-10 font-bold text-lg w-full sm:w-auto btn-bounce shadow-xl">
              Start your 14-day free trial
            </Button>
            <p className="text-sm text-white/60 font-medium">No credit card required</p>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="bg-white py-12 border-t border-border">
        <div className="container mx-auto px-4 max-w-6xl flex flex-col md:flex-row items-center justify-between gap-6 text-muted-foreground font-medium">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-primary fill-current" />
            <span className="font-display font-bold text-foreground">HeroKids</span>
          </div>
          <p>© {new Date().getFullYear()} HeroKids Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default WarmEnergetic;

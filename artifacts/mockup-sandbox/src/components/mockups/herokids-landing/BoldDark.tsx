import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sparkles, Trophy, Target, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import './BoldDark.css';

export function BoldDark() {
  return (
    <div className="bold-dark-theme min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold tracking-tight">HeroKids</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#rewards" className="hover:text-foreground transition-colors">Rewards</a>
            <a href="#parents" className="hover:text-foreground transition-colors">For Parents</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="hidden md:flex font-mono text-sm uppercase tracking-wider">Log In</Button>
            <Button className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-full px-6">
              Get Early Access
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-24 md:pt-52 md:pb-32 px-6">
        <div className="glow-bg" />
        <div className="max-w-7xl mx-auto relative z-10 grid md:grid-cols-2 gap-12 items-center">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary border border-border mb-6">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">The New Standard in Family Ops</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black leading-[1.1] tracking-tight mb-8">
              Raise responsible kids, <br />
              <span className="text-gradient">effortlessly.</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 leading-relaxed max-w-lg">
              HeroKids is the premium task management platform designed for modern families. Turn daily chores into a rewarding progression system.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-bold h-14 px-8 rounded-full text-lg w-full sm:w-auto group">
                Start Free Trial <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button size="lg" variant="outline" className="border-border hover:bg-secondary h-14 px-8 rounded-full text-lg w-full sm:w-auto">
                See How It Works
              </Button>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-accent/20 rounded-[2rem] blur-3xl" />
            <img 
              src="/__mockup/images/herokids_hero.png" 
              alt="HeroKids Cinematic Device" 
              className="relative rounded-[2rem] border border-border/50 shadow-2xl shadow-primary/10 object-cover w-full aspect-square"
            />
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-12 border-y border-border/50 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6">
          <p className="text-center text-sm font-mono uppercase tracking-widest text-muted-foreground mb-8">Trusted by thousands of design-conscious parents</p>
          <div className="flex flex-wrap justify-center gap-12 md:gap-24 opacity-50 grayscale mix-blend-luminosity">
            {['Forbes', 'TechCrunch', 'Wired', 'FastCompany'].map((brand) => (
              <span key={brand} className="text-2xl font-bold tracking-tighter">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Section 1 - UI Teaser */}
      <section id="features" className="py-24 md:py-32 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">A UI that respects your intelligence.</h2>
            <p className="text-xl text-muted-foreground">Most kids apps are loud and cluttered. HeroKids offers a sleek, dark-mode focused experience that feels like a professional tool, adapted for family life.</p>
          </div>
          
          <div className="relative w-full rounded-3xl overflow-hidden border border-border shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
            <img 
              src="/__mockup/images/herokids_ui.png" 
              alt="HeroKids UI Dashboard" 
              className="w-full h-auto object-cover max-h-[700px]"
            />
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-24 px-6 bg-secondary/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Target className="w-8 h-8 text-primary" />,
                title: "Quest Mechanics",
                desc: "Chores become quests. Kids gain XP and level up, building intrinsic motivation."
              },
              {
                icon: <Trophy className="w-8 h-8 text-accent" />,
                title: "Custom Rewards",
                desc: "Set real-world rewards. Screen time, allowance, or a trip to the zoo—you decide."
              },
              {
                icon: <ShieldCheck className="w-8 h-8 text-primary" />,
                title: "Parental Approval",
                desc: "Quests require photo proof and your sign-off before XP is awarded."
              }
            ].map((feat, i) => (
              <Card key={i} className="bg-card border-border/50 hover:border-primary/50 transition-colors">
                <CardContent className="p-8">
                  <div className="mb-6 p-4 rounded-2xl bg-secondary inline-block">
                    {feat.icon}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feat.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feat.desc}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-5xl font-bold tracking-tight mb-6">Ready to upgrade your family OS?</h2>
          <p className="text-xl text-muted-foreground mb-10">Join the waitlist today and get 3 months of HeroKids Premium for free.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
            <Input 
              placeholder="Enter your email" 
              className="h-14 rounded-full bg-background border-border text-lg px-6"
            />
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white font-bold h-14 px-8 rounded-full text-lg w-full sm:w-auto shrink-0">
              Join Waitlist
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border/50 bg-background text-sm text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-bold text-foreground">HeroKids</span>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
          <p>© 2025 HeroKids Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default BoldDark;
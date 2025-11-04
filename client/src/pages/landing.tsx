import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Star, Trophy, Users, CheckCircle, Zap } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import logoUrl from "@assets/A708B97F-2199-4C99-A66F-C3BA6238381B_1762070025130.png";

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b sticky top-0 backdrop-blur-md z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={logoUrl} 
              alt="HomeHero Logo" 
              className="h-12 w-12 rounded-lg"
              data-testid="img-logo"
            />
            <span className="text-2xl font-black font-accent" data-testid="text-app-name">
              HomeHero
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              onClick={() => (window.location.href = "/api/login")}
              data-testid="button-login"
            >
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <h1 className="text-5xl md:text-7xl font-black font-accent mb-6 gradient-text-celebration" data-testid="text-hero-title">
            Turn Chores into Adventures!
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto" data-testid="text-hero-subtitle">
            HomeHero makes household tasks fun for the whole family. Kids earn
            points, climb leaderboards, and win awesome rewards!
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button
              size="lg"
              className="text-lg h-14 px-8"
              onClick={() => (window.location.href = "/api/login")}
              data-testid="button-hero-cta"
            >
              <Star className="h-5 w-5 mr-2" />
              Start Your Adventure
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold font-accent text-center mb-12" data-testid="text-features-title">
            How HomeHero Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 text-center hover-elevate transition-all" data-testid="card-feature-tasks">
              <div className="h-16 w-16 rounded-full gradient-achievement mx-auto mb-4 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold font-accent mb-3">Create Tasks</h3>
              <p className="text-muted-foreground">
                Parents assign household chores with point values and optional
                photo proof for completion.
              </p>
            </Card>

            <Card className="p-8 text-center hover-elevate transition-all" data-testid="card-feature-points">
              <div className="h-16 w-16 rounded-full gradient-celebration mx-auto mb-4 flex items-center justify-center">
                <Star className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold font-accent mb-3">Earn Points</h3>
              <p className="text-muted-foreground">
                Kids complete tasks and watch their points grow. Each completed
                chore brings them closer to rewards!
              </p>
            </Card>

            <Card className="p-8 text-center hover-elevate transition-all" data-testid="card-feature-compete">
              <div className="h-16 w-16 rounded-full gradient-winner mx-auto mb-4 flex items-center justify-center">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold font-accent mb-3">Win Rewards</h3>
              <p className="text-muted-foreground">
                Climb the family leaderboard and earn prizes! Weekly and
                monthly winners get special rewards.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold font-accent text-center mb-12" data-testid="text-benefits-title">
            Why Families Love HomeHero
          </h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { icon: Users, text: "Get everyone involved in household chores" },
              { icon: Zap, text: "Motivate kids with points and achievements" },
              { icon: Trophy, text: "Friendly competition brings families together" },
              { icon: CheckCircle, text: "Track progress with photo proof" },
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-4 p-4" data-testid={`item-benefit-${i}`}>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <benefit.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="text-lg font-semibold">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl md:text-5xl font-black font-accent mb-6" data-testid="text-cta-title">
            Ready to Make Chores Fun?
          </h2>
          <p className="text-xl text-muted-foreground mb-8" data-testid="text-cta-subtitle">
            Join thousands of families making household tasks an adventure!
          </p>
          <Button
            size="lg"
            className="text-lg h-14 px-8"
            onClick={() => (window.location.href = "/api/login")}
            data-testid="button-cta-signup"
          >
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto max-w-6xl text-center text-sm text-muted-foreground">
          <p>© 2025 HomeHero. Making families stronger, one chore at a time.</p>
        </div>
      </footer>
    </div>
  );
}

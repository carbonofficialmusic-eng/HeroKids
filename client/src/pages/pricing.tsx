import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Trophy, Users, Zap, Crown } from "lucide-react";
import { Link } from "wouter";
import type { FamilyMember } from "@shared/schema";

const TIERS = [
  {
    id: "free",
    name: "Free",
    icon: Users,
    memberLimit: 2,
    price: "$0",
    period: "forever",
    description: "Perfect for getting started",
    features: [
      "Up to 2 family members",
      "Unlimited tasks",
      "Points & leaderboard",
      "Custom rewards",
      "Task photo proofs",
      "Dark mode",
    ],
    popular: false,
  },
  {
    id: "family",
    name: "Family",
    icon: Trophy,
    memberLimit: 4,
    price: "$3",
    period: "per month",
    description: "Great for small families",
    features: [
      "Up to 4 family members",
      "Everything in Free",
      "Recurring tasks",
      "Weekly/monthly leaderboards",
      "Task templates",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "family_plus",
    name: "Family+",
    icon: Zap,
    memberLimit: 6,
    price: "$9",
    period: "per month",
    description: "For larger families",
    features: [
      "Up to 6 family members",
      "Everything in Family",
      "Advanced analytics",
      "Task comments",
      "Push notifications",
      "Family chat",
    ],
    popular: false,
  },
  {
    id: "hero_pro",
    name: "HeroPro",
    icon: Crown,
    memberLimit: Infinity,
    price: "$25",
    period: "per month",
    description: "Ultimate family management",
    features: [
      "Unlimited family members",
      "Everything in Family+",
      "Custom integrations",
      "API access",
      "Premium templates",
      "24/7 priority support",
    ],
    popular: false,
  },
];

export default function Pricing() {
  const { user } = useAuth();

  // Fetch current family member to get subscription tier
  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!user,
  });

  // Fetch family subscription tier
  const { data: familyData } = useQuery<{
    familyName: string;
    subscriptionTier: string;
    memberCount: number;
  }>({
    queryKey: ["/api/families/current"],
    enabled: !!member,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" data-testid="button-back-home">
              ← Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Pricing Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-black font-accent mb-4" data-testid="heading-pricing">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground">
            Select the perfect plan for your family's needs. All plans include core task management features.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const isCurrentTier = familyData?.subscriptionTier === tier.id;
            
            return (
              <Card
                key={tier.id}
                className={`relative p-6 flex flex-col ${
                  tier.popular ? "ring-2 ring-primary shadow-lg" : ""
                }`}
                data-testid={`card-tier-${tier.id}`}
              >
                {tier.popular && (
                  <Badge
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                    data-testid="badge-most-popular"
                  >
                    Most Popular
                  </Badge>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`h-12 w-12 rounded-full ${
                    tier.popular ? "gradient-winner" : "bg-primary/10"
                  } flex items-center justify-center`}>
                    <Icon className={`h-6 w-6 ${tier.popular ? "text-white" : "text-primary"}`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold font-accent">{tier.name}</h2>
                    <p className="text-xs text-muted-foreground">{tier.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">{tier.price}</span>
                    <span className="text-sm text-muted-foreground">/{tier.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tier.memberLimit === Infinity
                      ? "Unlimited members"
                      : `Up to ${tier.memberLimit} members`}
                  </p>
                </div>

                <ul className="space-y-3 mb-6 flex-1">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={tier.popular ? "default" : "outline"}
                  disabled={tier.id === "free"}
                  data-testid={`button-select-${tier.id}`}
                >
                  {tier.id === "free" ? (
                    "Current Plan"
                  ) : isCurrentTier ? (
                    "Current Plan"
                  ) : (
                    `Choose ${tier.name}`
                  )}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* FAQ or Additional Info */}
        <div className="mt-16 text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold font-accent mb-4">Questions?</h2>
          <p className="text-muted-foreground mb-6">
            All plans include unlimited tasks, points tracking, and real-time updates. 
            Upgrade or downgrade anytime. No long-term contracts.
          </p>
          <Button variant="outline" data-testid="button-contact-support">
            Contact Support
          </Button>
        </div>
      </div>
    </div>
  );
}

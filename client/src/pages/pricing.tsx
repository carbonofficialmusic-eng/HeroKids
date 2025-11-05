import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Trophy, Users, Zap, Crown, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { FamilyMember } from "@shared/schema";

const TIERS = [
  {
    id: "free",
    name: "Free",
    icon: Users,
    memberLimit: 2,
    price: "€0",
    period: "forever",
    description: "Perfect for getting started",
    features: [
      "Up to 2 family members",
      "Unlimited tasks",
      "Monthly leaderboard",
      "Custom rewards",
      "Dark mode",
      "3 unlockable character skins",
    ],
    popular: false,
  },
  {
    id: "family",
    name: "Family",
    icon: Trophy,
    memberLimit: 4,
    price: "€2",
    period: "per month",
    description: "Great for small families",
    features: [
      "Up to 4 family members",
      "Everything in Free",
      "Photo proof for tasks",
      "Recurring tasks",
      "Weekly & monthly leaderboards",
      "Advanced analytics",
      "10 unlockable character skins",
    ],
    popular: true,
  },
  {
    id: "family_plus",
    name: "Family+",
    icon: Zap,
    memberLimit: 6,
    price: "€5",
    period: "per month",
    description: "For larger families",
    features: [
      "Up to 6 family members",
      "Everything in Family",
      "Family chat",
      "Task comments",
      "Push notifications",
      "All character skins unlocked",
    ],
    popular: false,
  },
  {
    id: "family_hero",
    name: "Family Hero",
    icon: Crown,
    memberLimit: 999,
    price: "€12",
    period: "per month",
    description: "Ultimate family management",
    features: [
      "Unlimited family members",
      "Everything in Family+",
      "Priority support",
      "Early access to new features",
      "Custom integrations (coming soon)",
      "All future features included",
    ],
    popular: false,
  },
];

export default function Pricing() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [processingTier, setProcessingTier] = useState<string | null>(null);

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

  const checkoutMutation = useMutation({
    mutationFn: async (tier: string) => {
      const res = await apiRequest("POST", "/api/create-checkout-session", { tier });
      return await res.json();
    },
    onSuccess: (data: { sessionId: string; url: string }) => {
      console.log("Checkout session created:", data);
      
      if (!data.url) {
        setProcessingTier(null);
        toast({
          title: "Checkout Error",
          description: "No checkout URL received from server",
          variant: "destructive",
        });
        return;
      }
      
      // Redirect to Stripe Checkout
      console.log("Redirecting to:", data.url);
      window.location.href = data.url;
    },
    onError: (error: any) => {
      setProcessingTier(null);
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to start checkout process",
        variant: "destructive",
      });
    },
  });

  const handleUpgrade = (tierId: string) => {
    if (!member || member.role !== "parent") {
      toast({
        title: "Permission Denied",
        description: "Only parents can manage subscriptions",
        variant: "destructive",
      });
      return;
    }

    setProcessingTier(tierId);
    checkoutMutation.mutate(tierId);
  };

  const isParent = member?.role === "parent";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b sticky top-0 backdrop-blur-md z-40 bg-background/80">
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
          {!isParent && (
            <p className="text-sm text-amber-600 dark:text-amber-500 mt-4">
              Note: Only parents can change subscription plans.
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            const isCurrentTier = familyData?.subscriptionTier === tier.id;
            const isProcessing = processingTier === tier.id;
            
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
                    {tier.memberLimit === 999
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
                  disabled={tier.id === "free" || isCurrentTier || !isParent || isProcessing}
                  onClick={() => handleUpgrade(tier.id)}
                  data-testid={`button-select-${tier.id}`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : tier.id === "free" ? (
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
            Upgrade or downgrade anytime. Cancel whenever you want, no questions asked.
          </p>
          <p className="text-sm text-muted-foreground">
            Payments are securely processed by Stripe. Your subscription will renew automatically each month.
          </p>
        </div>
      </div>
    </div>
  );
}

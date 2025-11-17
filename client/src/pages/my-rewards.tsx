import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/components/profile-menu";
import {
  CheckCircle2,
  Trophy,
  ArrowLeft,
  Clock,
  Coins,
} from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import type { User, FamilyMember, RewardRedemption } from "@shared/schema";

export default function MyRewards() {
  const { t } = useTranslation();

  const { data: authUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: member } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/current"],
    enabled: !!authUser,
  });

  const { data: realMember } = useQuery<FamilyMember>({
    queryKey: ["/api/family-members/real"],
    enabled: !!authUser,
  });

  const { data: redemptions = [] } = useQuery<(RewardRedemption & { rewardTitle?: string })[]>({
    queryKey: ["/api/reward-redemptions"],
    enabled: !!member,
  });

  const { data: familyMembers = [] } = useQuery<FamilyMember[]>({
    queryKey: ["/api/family-members"],
    enabled: !!member,
  });

  const isParent = member?.role === "parent";
  const isRealParent = realMember?.role === "parent";

  // Filter and sort redemptions by newest first
  const myRedemptions = member 
    ? redemptions
        .filter(r => r.memberId === member.id)
        .sort((a, b) => {
          const dateA = a.redeemedAt ? new Date(a.redeemedAt).getTime() : 0;
          const dateB = b.redeemedAt ? new Date(b.redeemedAt).getTime() : 0;
          return dateB - dateA;
        })
    : [];

  if (!member) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Lädt...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b sticky top-0 z-40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild data-testid="button-back">
              <Link href="/kid-dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
              Meine Belohnungen
            </h1>
          </div>
          <ProfileMenu
            member={member}
            isParent={isParent}
            isRealParent={isRealParent}
            familyMemberCount={familyMembers.length}
            onEditProfile={() => {}}
            onSwitchMember={() => {}}
          />
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {myRedemptions.length === 0 ? (
          <Card className="p-12 text-center bg-card/80 backdrop-blur-md rounded-2xl">
            <Trophy className="h-20 w-20 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-xl text-muted-foreground">Noch keine Belohnungen eingelöst</p>
            <p className="text-sm text-muted-foreground mt-2">
              Sammle Punkte und löse deine erste Belohnung ein!
            </p>
            <Button asChild className="mt-6" data-testid="button-go-back">
              <Link href="/kid-dashboard">Zurück zum Dashboard</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-green-500/20">
                  <Trophy className="h-7 w-7 text-green-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ fontFamily: "Fredoka, sans-serif" }}>
                    Alle meine Belohnungen
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {myRedemptions.length} {myRedemptions.length === 1 ? "Belohnung" : "Belohnungen"} eingelöst
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {myRedemptions.map((redemption, index) => (
                <motion.div
                  key={redemption.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-4 hover-elevate">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`p-3 rounded-xl flex-shrink-0 ${
                          redemption.status === "completed" 
                            ? "bg-green-500/20" 
                            : "bg-amber-500/20"
                        }`}>
                          {redemption.status === "completed" ? (
                            <CheckCircle2 className="h-6 w-6 text-green-500" />
                          ) : (
                            <Clock className="h-6 w-6 text-amber-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg truncate" style={{ fontFamily: "Fredoka, sans-serif" }}>
                            {redemption.rewardTitle || "Belohnung"}
                          </h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                            <Coins className="h-3.5 w-3.5 flex-shrink-0" />
                            <span className="whitespace-nowrap">{redemption.pointsSpent} Punkte</span>
                            <span>•</span>
                            <span className="whitespace-nowrap">{redemption.redeemedAt ? new Date(redemption.redeemedAt).toLocaleDateString("de-DE") : "-"}</span>
                          </div>
                        </div>
                      </div>
                      <Badge 
                        variant={redemption.status === "completed" ? "default" : "secondary"}
                        className="text-xs whitespace-nowrap flex-shrink-0"
                        data-testid={`badge-status-${redemption.id}`}
                      >
                        {redemption.status === "completed" ? "✓ Erfüllt" : 
                         redemption.status === "approved" ? "Warte" : 
                         "Ausstehend"}
                      </Badge>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

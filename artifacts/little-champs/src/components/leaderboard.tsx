import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Award, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FamilyMember } from "@shared/schema";
import { getAvatarUrl } from "@/lib/skins";

interface LeaderboardProps {
  members: FamilyMember[];
  period?: "week" | "month" | "all";
  weeklyPrize?: string | null;
  monthlyPrize?: string | null;
}

export function Leaderboard({ members, period = "week", weeklyPrize, monthlyPrize }: LeaderboardProps) {
  const { t } = useTranslation();
  const eligibleMembers = members.filter((m) => !m.excludeFromLeaderboard);
  const sortedMembers = [...eligibleMembers].sort((a, b) => {
    const points = (m: FamilyMember) => period === "week" ? m.weeklyPoints : period === "month" ? m.monthlyPoints : m.totalPoints;
    return points(b) - points(a);
  });
  const getPoints = (m: FamilyMember) => period === "week" ? m.weeklyPoints : period === "month" ? m.monthlyPoints : m.totalPoints;
  const top3 = sortedMembers.slice(0, 3);
  const rest = sortedMembers.slice(3);
  const title = period === "week" ? t("leaderboard.thisWeeksLeaderboard") : period === "month" ? t("leaderboard.thisMonthsLeaderboard") : t("leaderboard.allTimeLeaderboard");

  const avatar = (m: FamilyMember, size: string) => (
    <Avatar className={`${size} lc-podium-avatar`} style={{ borderColor: m.color }}>
      <AvatarImage src={getAvatarUrl(m.activeSkinId, m.avatarUrl, m.useCustomAvatar, m.updatedAt)} />
      <AvatarFallback style={{ backgroundColor: m.color }} className="text-white font-bold">{m.displayName[0]}</AvatarFallback>
    </Avatar>
  );

  const podiumPerson = (m: FamilyMember, rank: 1 | 2 | 3) => (
    <div className={`lc-podium-place lc-podium-place-${rank}`} data-testid={`podium-rank-${rank}`}>
      <div className="lc-medal">{rank === 1 ? <Trophy /> : rank === 2 ? <Medal /> : <Award />}</div>
      {avatar(m, rank === 1 ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16 sm:h-20 sm:w-20")}
      <div className="lc-podium-name" data-testid={`text-member-name-${rank}`}>{m.displayName}</div>
      <div className="lc-podium-points" data-testid={`text-member-points-${rank}`}>{getPoints(m)}</div>
      <div className="lc-podium-block"><span>{rank}</span></div>
    </div>
  );

  return (
    <Card className="lc-leaderboard-card p-4 sm:p-6" data-testid="card-leaderboard">
      <div className="lc-leaderboard-heading">
        <div className="lc-heading-kicker"><Sparkles /> {period === "month" ? t("dashboard.monthly") : t("dashboard.weekly")}</div>
        <h2 data-testid="text-leaderboard-title">{title}</h2>
        <p data-testid="text-leaderboard-subtitle">
          {period === "month" ? t("leaderboard.pointsEarnedMonth") : period === "week" ? t("leaderboard.pointsEarnedWeek") : t("leaderboard.pointsEarnedAllTime")}
        </p>
      </div>

      {top3.length > 0 && (
        <div className="lc-podium" aria-label={title}>
          {top3[1] && podiumPerson(top3[1], 2)}
          {top3[0] && podiumPerson(top3[0], 1)}
          {top3[2] && podiumPerson(top3[2], 3)}
        </div>
      )}

      {rest.length > 0 && (
        <div className="lc-rank-list">
          {rest.map((m, index) => {
            const rank = index + 4;
            return (
              <div key={m.id} className="lc-rank-row" data-testid={`row-member-${m.id}`}>
                <div className="lc-rank-number" data-testid={`text-rank-${rank}`}>{rank}</div>
                {avatar(m, "h-11 w-11")}
                <div className="lc-rank-name" data-testid={`text-member-name-${rank}`}>{m.displayName}</div>
                <div className="lc-rank-points" data-testid={`text-member-points-${rank}`}>{getPoints(m)}</div>
              </div>
            );
          })}
        </div>
      )}

      {eligibleMembers.length === 0 && (
        <div className="lc-empty-state text-center py-12" data-testid="leaderboard-empty-state">
          <Trophy className="lc-empty-state-icon h-14 w-14 mx-auto mb-4 text-cyan-300/60" />
          <p className="lc-empty-state-description text-lg text-muted-foreground" data-testid="leaderboard-empty-message">
            {members.length === 0 ? t("leaderboard.noMembersYet") : t("leaderboard.allExcluded")}
          </p>
        </div>
      )}

      {((period === "week" && weeklyPrize) || (period === "month" && monthlyPrize)) && (
        <div className="lc-prize"><Trophy /> <span>{period === "week" ? t("leaderboard.weeklyPrize") : t("leaderboard.monthlyPrize")}: {period === "week" ? weeklyPrize : monthlyPrize}</span></div>
      )}
    </Card>
  );
}
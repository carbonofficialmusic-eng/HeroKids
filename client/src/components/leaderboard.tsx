import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, Award } from "lucide-react";
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
  // Filter out members who opted out of leaderboard competition
  const eligibleMembers = members.filter(m => !m.excludeFromLeaderboard);
  
  const sortedMembers = [...eligibleMembers].sort((a, b) => {
    const aPoints = period === "week" ? a.weeklyPoints : period === "month" ? a.monthlyPoints : a.totalPoints;
    const bPoints = period === "week" ? b.weeklyPoints : period === "month" ? b.monthlyPoints : b.totalPoints;
    return bPoints - aPoints;
  });

  const getPoints = (member: FamilyMember) => {
    return period === "week" ? member.weeklyPoints : period === "month" ? member.monthlyPoints : member.totalPoints;
  };

  const top3 = sortedMembers.slice(0, 3);
  const rest = sortedMembers.slice(3);

  const getTrophyIcon = (rank: number) => {
    if (rank === 0) return <Trophy className="h-8 w-8 text-yellow-500" />;
    if (rank === 1) return <Medal className="h-7 w-7 text-gray-400" />;
    if (rank === 2) return <Award className="h-6 w-6 text-amber-700" />;
    return null;
  };

  const getTitle = () => {
    if (period === "week") return t('leaderboard.thisWeeksLeaderboard');
    if (period === "month") return t('leaderboard.thisMonthsLeaderboard');
    return t('leaderboard.allTimeLeaderboard');
  };

  return (
    <Card className="p-6" data-testid="card-leaderboard">
      <h2 className="text-2xl font-bold font-accent mb-6" data-testid="text-leaderboard-title">
        {getTitle()}
      </h2>
      <p className="text-sm text-muted-foreground mb-6" data-testid="text-leaderboard-subtitle">
        {period === "month" && t('leaderboard.pointsEarnedMonth')}
        {period === "week" && t('leaderboard.pointsEarnedWeek')}
        {period === "all" && t('leaderboard.pointsEarnedAllTime')}
      </p>

      {/* Podium display for top 3 */}
      {top3.length > 0 && (
        <div className="flex items-end justify-center gap-4 mb-8">
          {/* 2nd place */}
          {top3[1] && (
            <div className="flex flex-col items-center" data-testid={`podium-rank-2`}>
              <div className="mb-2">{getTrophyIcon(1)}</div>
              <Avatar className="h-12 w-12 mb-2" style={{ borderWidth: "4px", borderColor: top3[1].color }}>
                <AvatarImage src={getAvatarUrl(top3[1].activeSkinId, top3[1].avatarUrl, top3[1].useCustomAvatar, top3[1].updatedAt)} />
                <AvatarFallback style={{ backgroundColor: top3[1].color }} className="text-white">
                  {top3[1].displayName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm font-semibold text-center" data-testid={`text-member-name-2`}>
                {top3[1].displayName}
              </div>
              <div className="text-2xl font-black font-accent gradient-text-achievement" data-testid={`text-member-points-2`}>
                {getPoints(top3[1])}
              </div>
            </div>
          )}

          {/* 1st place - elevated */}
          {top3[0] && (
            <div className="flex flex-col items-center transform -translate-y-4" data-testid={`podium-rank-1`}>
              <div className="mb-2">{getTrophyIcon(0)}</div>
              <Avatar className="h-16 w-16 mb-2" style={{ borderWidth: "4px", borderColor: top3[0].color }}>
                <AvatarImage src={getAvatarUrl(top3[0].activeSkinId, top3[0].avatarUrl, top3[0].useCustomAvatar, top3[0].updatedAt)} />
                <AvatarFallback style={{ backgroundColor: top3[0].color }} className="text-white">
                  {top3[0].displayName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-base font-bold text-center" data-testid={`text-member-name-1`}>
                {top3[0].displayName}
              </div>
              <div className="text-3xl font-black font-accent gradient-text-winner" data-testid={`text-member-points-1`}>
                {getPoints(top3[0])}
              </div>
            </div>
          )}

          {/* 3rd place */}
          {top3[2] && (
            <div className="flex flex-col items-center" data-testid={`podium-rank-3`}>
              <div className="mb-2">{getTrophyIcon(2)}</div>
              <Avatar className="h-12 w-12 mb-2" style={{ borderWidth: "4px", borderColor: top3[2].color }}>
                <AvatarImage src={getAvatarUrl(top3[2].activeSkinId, top3[2].avatarUrl, top3[2].useCustomAvatar, top3[2].updatedAt)} />
                <AvatarFallback style={{ backgroundColor: top3[2].color }} className="text-white">
                  {top3[2].displayName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm font-semibold text-center" data-testid={`text-member-name-3`}>
                {top3[2].displayName}
              </div>
              <div className="text-2xl font-black font-accent gradient-text-achievement" data-testid={`text-member-points-3`}>
                {getPoints(top3[2])}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rest of the members */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((member, index) => {
            const rank = index + 4;
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                data-testid={`row-member-${member.id}`}
              >
                <div className="w-6 text-center font-bold text-muted-foreground" data-testid={`text-rank-${rank}`}>
                  {rank}
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={getAvatarUrl(member.activeSkinId, member.avatarUrl, member.useCustomAvatar, member.updatedAt)} />
                  <AvatarFallback style={{ backgroundColor: member.color }} className="text-white">
                    {member.displayName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="font-semibold" data-testid={`text-member-name-${rank}`}>
                    {member.displayName}
                  </div>
                </div>
                <div className="text-xl font-black font-accent" data-testid={`text-member-points-${rank}`}>
                  {getPoints(member)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {eligibleMembers.length === 0 && (
        <div className="text-center py-12" data-testid="leaderboard-empty-state">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg text-muted-foreground" data-testid="leaderboard-empty-message">
            {members.length === 0 
              ? t('leaderboard.noMembersYet')
              : t('leaderboard.allExcluded')
            }
          </p>
        </div>
      )}

      {/* Prize Display */}
      {period === "week" && weeklyPrize && (
        <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Trophy className="h-4 w-4" />
            <span>{t('leaderboard.weeklyPrize')}: {weeklyPrize}</span>
          </div>
        </div>
      )}

      {period === "month" && monthlyPrize && (
        <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Trophy className="h-4 w-4" />
            <span>{t('leaderboard.monthlyPrize')}: {monthlyPrize}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

import { Badge } from "@/components/ui/badge";

interface Participant {
  memberId: string;
  displayName: string;
  status?: string | null;
  hasCompleted?: boolean;
}

export function CompactTaskParticipantNames({ members, id }: { members: Participant[]; id: string }) {
  return (
    <div id={id} className="flex min-w-0 flex-wrap gap-1">
      {members.map((member) => {
        const approved = member.status === "approved" || member.hasCompleted;
        return (
          <Badge
            key={member.memberId}
            variant="outline"
            className={`min-w-0 max-w-full px-1 py-0 text-[10px] leading-tight font-normal ${
              approved ? "border-transparent bg-sky-600 text-white" : "text-muted-foreground"
            }`}
            data-approved={approved ? "true" : "false"}
          >
            <span className="block min-w-0 truncate">{member.displayName}</span>
          </Badge>
        );
      })}
    </div>
  );
}

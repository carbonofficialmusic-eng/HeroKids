import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CompactTaskParticipantNames } from "@/components/compact-task-participant-names";

it("renders only names, with blue badges exclusively for approved participants", () => {
  const html = renderToStaticMarkup(
    <CompactTaskParticipantNames id="participants" members={[
      { memberId: "a", displayName: "Anna", status: "approved" },
      { memberId: "b", displayName: "Ben", status: "pending" },
      { memberId: "c", displayName: "Clara", status: null },
      { memberId: "d", displayName: "David", status: "rejected" },
      { memberId: "e", displayName: "Emma", hasCompleted: true },
    ]} />,
  );
  expect(html.replace(/<[^>]*>/g, "")).toBe("AnnaBenClaraDavidEmma");
  expect(html.match(/data-approved="true"/g)).toHaveLength(2);
  expect(html.match(/data-approved="false"/g)).toHaveLength(3);
  expect(html.match(/bg-sky-600/g)).toHaveLength(2);
  expect(html).toContain("max-w-full");
  expect(html).toContain("truncate");
});

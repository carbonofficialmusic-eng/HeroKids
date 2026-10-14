---
name: Segmented daily progress badges
description: Confirmed visual rule for tasks that require multiple executions per day.
---

Daily task progress must remain visible as a segmented badge. Completed executions are green and remaining executions are yellow; two daily executions use halves and three use thirds. Include the child's name.

For tasks assigned to multiple members, every member gets an independent segmented badge rather than one combined family counter.

A member counts as fully completed only when their approved daily progress reaches the target. An approved partial execution must neither increase the completed-member total nor block that member's next execution; a pending approval still blocks duplicate submission. A multi-member parent card may use the green completed design only when every explicitly assigned member is fully complete; a stale aggregate task status must not override the per-member progress.

**Why:** The user confirmed this approach after the temporary green completion check disappeared too quickly to communicate whether the first daily execution had been recorded.

**How to apply:** Use this pattern anywhere repeated-daily progress appears in parent and child views, with readable Light and Dark variants. Update every segment optimistically, including the final one, so no server refetch delay is visible. Keep the badge fully green after the final execution until the normal daily reset. Points and approval still happen only after the final required execution.

On TV, the final submitted execution must turn its segment green even while parent approval is pending. This applies to both two- and three-execution badges, family-wide progress and per-member progress.

**Why:** The user explicitly corrected a TV card where the third execution stayed yellow despite being submitted. The green segments represent performed executions, not approval.

**How to apply:** Do not subtract a pending final execution from the displayed progress. Keep the overall card and member status as submitted, block duplicate submissions and retain the existing parent-approval and point-award rules. Green execution segments must not be interpreted as an approved task.

Eine Ablehnung setzt den gesamten Fortschritt einer mehrfachen Aufgabe auf 0 zurück, nicht nur um eine Ausführung zurück. Diese Regel gilt für alle Apps.

**Why:** Der Nutzer hat ausdrücklich festgelegt, dass nach Ablehnung nicht 2 von 3 Ausführungen stehen bleiben dürfen.

**How to apply:** Den abgelehnten Versuch serverseitig vollständig zurücksetzen. Bei unzugewiesenen Aufgaben betrifft das den gemeinsamen Familienzähler, bei expliziter Zuweisung den betroffenen Empfänger. Andere Empfänger und andere lokale Tage nicht verändern.
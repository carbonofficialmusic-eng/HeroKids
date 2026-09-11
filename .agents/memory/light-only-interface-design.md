---
name: Light-only interface design
description: Theme boundary and visual direction for future Little Champs interface work.
---

All further interface design changes must be scoped exclusively to Light Mode. The approved Dark Mode must remain visually and functionally unchanged.

Light Mode follows a friendly premium family-app direction: lightly warm off-white backgrounds, white rounded surfaces with subtle soft shadows, dark navy text and icons, clear blue primary actions, restrained pastel secondary surfaces, and warm gold family-tier accents.

Active-reward cards use explicit Light Mode state colors on the child dashboard and related pages: green when ready to claim, orange while points are still missing. Bonus rewards use a separate friendly light-purple treatment.

On the parent dashboard, active rewards follow the same green-ready/orange-in-progress states. Acquired and shared treasure entries stay light, not gold, in Light Mode; their point chips are orange.

Exception to the light-only rule: active rewards on both parent views also use green-ready/orange-in-progress colors in Dark Mode. Other approved Dark Mode areas remain unchanged.

Mobile parent-dashboard reward states need a CSS fallback derived from the existing redeem button state; newly added card attributes or classes may not appear in an already loaded mobile preview.

**Why:** Repeated theme-scoped, page-scoped, and direct new-class overrides changed the full list but left the already loaded embedded mobile dashboard cards in their old treasure style.

**How to apply:** Keep ready/locked classes, but also style the card through `:has(.lc-redeem-button:not(:disabled))` and `:has(.lc-redeem-button:disabled)` so existing markup determines the state.

**Confirmed:** The button-state fallback visibly fixed the embedded parent dashboard on mobile. The child rewards full-list component is separate markup and must keep its own green-ready/orange-locked classes aligned with the child dashboard.

On the parent rewards page, a shared reward is blue while the current parent has not joined. After joining, it moves to the acquired list and uses the existing treasure-card look.

**Why:** Color communicates whether the parent is only being invited to share or already owns a participation in the reward.

**How to apply:** Scope blue styling only to joinable shared-reward cards; never recolor acquired participant cards blue.

For completed tasks in Light Mode, keep the child-board card green. On the parent board, use a white card with readable dark text because the green check already communicates completion.

**Why:** The parent view needs a neutral management surface, while the child view benefits from the stronger green success state.

**How to apply:** Scope the white `approved` task-card treatment to the parent dashboard only; do not include the child dashboard selector.

On the child profile in Light Mode, joinable shared rewards use an almost-white card with only a subtle blue tint, while blue remains for accents and the join button.

**Why:** A fully dark-blue card is too visually heavy against the light child dashboard.

**How to apply:** Override the joinable card, title, chips, and participant rows only under the Light Mode child-dashboard selector; preserve Dark Mode.

Completed-member badges on shared tasks use the landing-page orange in Light Mode; incomplete member badges stay neutral.

**Why:** This repeats the public brand accent without replacing semantic green states or turning every blue action orange.

**How to apply:** Scope the orange treatment to completed member badges on parent and child task boards under `html:not(.dark)`; preserve Dark Mode and other controls.

Main dashboard section headings use matching child-board styling on both boards in Light Mode: 1.5rem Fredoka, white, with the same dark text shadow.

**Why:** The user reviewed the orange-heading experiment and found it visually unsuccessful, then confirmed the parent board's white headings as the reference for the child board.

**How to apply:** Keep major section-title typography identical on both boards and reserve the landing-page orange for selected badges, icons, or controls.

Parent-dashboard section headings use that same 1.5rem white Fredoka treatment in Dark Mode as an explicit exception to the light-only rule.

**Why:** The user explicitly requested identical parent-dashboard heading styling across Light and Dark Mode.

**How to apply:** Keep the parent section-heading typography shared across themes; do not extend this exception to unrelated Dark Mode surfaces.

Section icons before dashboard headings use the large illustrated scale from the earlier child-board design on both parent and child boards.

**Why:** The user prefers the prominent icons shown in the old reference screenshot over compact heading icons.

**How to apply:** Use roughly 6rem square wrappers for standard section icons and 8rem for the family-goals artwork on both boards.

Active task-sorting filters and leaderboard period tabs use the landing-page orange in Light Mode on both dashboards. Active task filters have no contrasting border; orange runs directly to the edge.

**Why:** Selected “All” and “Weekly/Monthly” controls should repeat the orange brand accent instead of the previous blue.

**How to apply:** Recolor only active task filter buttons and active leaderboard period tabs; do not change inactive controls or Dark Mode.

Light-Mode dashboard navigation arrows to full-list pages and list/grid toggles use the normal white control style with dark icons on parent and child boards.

**Why:** The user reversed the earlier orange treatment after reviewing it and explicitly requested the normal white presentation again.

**How to apply:** Let these controls inherit the existing white Light-Mode `lc-icon-button` surface, dark icon, light border, and neutral shadow. Preserve dimensions, behavior, and Dark Mode.

On the approvals page, checked selection boxes and the bulk-approve button use the landing-page orange in Light Mode.

**Why:** The user wants selection state and its primary bulk action to match the established orange accent.

**How to apply:** Scope this to checked completion/select-all checkboxes and the bulk-approve button; preserve green per-item approval actions and Dark Mode.

The child and parent active-rewards “view all” headers show only a large centered shop illustration, with no “Rewards” title or subtitle.

**Why:** The user prefers the shop artwork as the sole page identifier and wants it prominent and centered on both views.

**How to apply:** Use a roughly 8rem icon centered independently of the back button on both active-reward list views.


On parent-dashboard family goals, the period and contribution-point badges use the landing-page orange in Light Mode.

**Why:** These compact metadata badges are suitable brand accents without making the heading hierarchy visually heavy.

**How to apply:** Scope orange styling to those two goal badges under `html:not(.dark)`; preserve progress colors and Dark Mode.

Point-cost badges on active rewards use one consistent landing-page orange in Light Mode, regardless of whether the reward is ready or locked.

**Why:** Green-ready and orange-locked cost badges looked inconsistent; the card and redeem button already communicate availability.

**How to apply:** Override only cost badges on the parent dashboard and active-rewards page after state-specific fallback rules; preserve card status colors and Dark Mode.

Enabled “redeem now” buttons must keep the same high-contrast label treatment on the parent dashboard, child dashboard, and child rewards list as on the parent rewards list.

**Why:** Shared card colors alone did not make the label equally readable in every dashboard variant, especially the compact parent card.

**How to apply:** Enforce white 0.875rem bold text, full opacity, and a subtle dark text shadow on enabled redeem buttons across all four reward views.

Reward-point badge selectors must target the badge class or badge test ID, never utility-class substrings such as `bg-primary`.

**Why:** The default redeem button also contains the primary-background utility, so a broad badge fallback recolored its white label mint green despite the intended button rule.

**How to apply:** Use semantic reward badge selectors; do not infer element roles from shared color utility classes.

For task cards, open tasks use the white Light Mode surface. Submitted or approval-pending tasks use the same warm cream/gold palette as child-board rewards in Light Mode. Approved tasks retain transparent green. Dark Mode status designs remain unchanged.

**Why:** The user explicitly approved the current Dark Mode and asked that all subsequent design work apply only when Light Mode is active.

**How to apply:** Use additive selectors scoped with `html:not(.dark)` for new theme styling. Target open task cards through an explicit open-state class or attribute; never use a broad task-card selector that also matches submitted or approved states. Do not rewrite shared or Dark Mode declarations. Preserve existing layout, spacing, dimensions, behavior, responsive rules, content, and test IDs unless separately requested.

An equipped skin background must remain visible when switching between Light and Dark Mode. It may disappear only when the member explicitly uses the background toggle on the Skin page.

**Why:** Theme selection and skin-background visibility are independent user preferences; opaque Light-Mode page roots previously hid an enabled background.

**How to apply:** Keep full-page Light-Mode surfaces transparent while the app reports an enabled skin background, and rely on the normal theme fallback only when that background is disabled or absent.
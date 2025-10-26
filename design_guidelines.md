# HomeHero Design Guidelines

## Design Approach

**Reference-Based Approach**: Drawing inspiration from gamified learning apps (Duolingo, ClassDojo) and task management tools (Habitica, Todoist), creating a playful yet functional family-focused interface that motivates children while providing parents with clear oversight.

**Core Design Principles**:
- Joyful Clarity: Playful aesthetics that never compromise usability
- Age-Appropriate Hierarchy: Clear visual distinction between parent and child interfaces
- Celebration-Driven: Reward moments are visually spectacular
- Accessible Fun: Readable, approachable design for ages 6-15

---

## Typography

**Font Families**:
- Primary: Nunito (Google Fonts) - rounded, friendly, highly readable
- Accent: Fredoka (Google Fonts) - playful headers and gamification elements
- System Fallback: -apple-system, sans-serif

**Type Scale**:
- Hero/Celebration: text-6xl font-bold (Fredoka)
- Page Headers: text-4xl font-bold (Fredoka)
- Section Titles: text-2xl font-semibold (Nunito)
- Card Titles: text-xl font-semibold (Nunito)
- Body Text: text-base font-normal (Nunito)
- Small Text/Metadata: text-sm font-medium (Nunito)
- Point Values/Stats: text-3xl font-black (Fredoka)

---

## Layout System

**Spacing Primitives**: Use Tailwind units 2, 4, 6, 8, 12, 16 for consistent rhythm
- Component padding: p-4 to p-8
- Section spacing: py-12 to py-16
- Card gaps: gap-4 to gap-6
- Icon-text spacing: gap-2

**Grid System**:
- Desktop: 3-column task grids (grid-cols-3)
- Tablet: 2-column layouts (md:grid-cols-2)
- Mobile: Single column (grid-cols-1)
- Dashboard widgets: 2x2 grid for stats (grid-cols-2)

**Container Strategy**:
- Main content: max-w-7xl mx-auto px-4
- Cards/modules: max-w-sm to max-w-md
- Modal dialogs: max-w-2xl

---

## Component Library

### Navigation

**Top Navigation Bar**:
- Fixed position with subtle shadow
- Family name/logo on left
- Quick stats (total points this week) in center
- User avatar dropdown on right
- Height: h-16
- Contains notification bell icon with badge for completed tasks

**Role-Based Dashboard Layout**:

*Parent View*:
- Left sidebar (w-64) with family overview, task management, reward settings
- Main content area with task lists, completion status, leaderboard widget
- Quick-add floating action button (bottom-right, size-16, rounded-full)

*Child View*:
- Simplified top navigation only
- Card-based task grid as main focus
- Large point counter always visible (sticky top-0)
- Leaderboard accessible via tab navigation

### Task Components

**Task Card**:
- Rounded corners (rounded-2xl)
- Generous padding (p-6)
- Task icon/emoji on left (size-12)
- Title (text-xl font-semibold)
- Point badge (top-right corner, rounded-full, px-3 py-1)
- Due date with calendar icon (text-sm)
- Status indicator (ring-4 on card border when active)
- Photo proof camera icon (if enabled)
- Complete button (w-full at bottom, rounded-xl, h-12)

**Task List View** (Parent):
- Compact rows with checkbox, title, assignee avatar, points, status
- Hover state reveals edit/delete actions
- Drag handle for reordering
- Row height: h-16

### Gamification Elements

**Point Counter**:
- Large circular badge with animated number increment
- Glow effect on point gain (animate-pulse)
- Display format: "1,250 pts"
- Size variants: Compact (h-12), Standard (h-16), Hero (h-24)

**Leaderboard Card**:
- Podium-style top 3 display with 1st place elevated
- Avatar (size-16 for winner, size-12 for others)
- Username below avatar
- Point total in accent font (Fredoka)
- Trophy icons (Heroicons) for top 3
- Remaining family members in list format below
- Update animation on rank change

**Achievement Badge**:
- Circular design (size-20)
- Icon in center
- Subtle gradient background
- Stack horizontally with -space-x-2 overlap
- Unlock animation: scale and fade-in

**Progress Bar**:
- Height: h-3
- Rounded ends (rounded-full)
- Animated fill on update (transition-all duration-500)
- Show percentage label above bar

### Forms & Inputs

**Task Creation Form**:
- Multi-step wizard for parents (3 steps: Details → Assignment → Proof)
- Single-step form for children (simplified)
- Input fields with icons (leading icon pattern)
- Clear label above input (text-sm font-medium)
- Input height: h-12
- Date picker with calendar UI
- Point slider with visual feedback (10-100 range)
- Recurring task toggle with day-of-week buttons

**Photo Proof Upload**:
- Large dropzone with dashed border (border-4 border-dashed)
- Camera icon (size-16)
- "Tap to upload photo" instruction
- Thumbnail preview (size-32, rounded-lg)
- Retake button if needed

### User Elements

**Avatar System**:
- Circular frames (rounded-full)
- Size variants: xs (h-8), sm (h-10), md (h-12), lg (h-16), xl (h-24)
- Customizable ring border for role indication (ring-4)
- Letter fallback if no image
- Color coding per family member

**User Profile Card**:
- Large avatar at top (h-24)
- Username (text-2xl font-bold)
- Role badge below name (parent/child)
- Total points lifetime (text-xl)
- Current week points (text-lg)
- Achievement showcase (horizontal scroll of badges)

### Feedback & States

**Success Celebration**:
- Full-screen confetti animation overlay
- "+50 pts" text with bounce animation
- Encouraging message ("Great job, Sophie!")
- Confetti uses CSS animation (not heavy JS)
- Auto-dismiss after 3 seconds

**Empty States**:
- Large icon (size-24)
- Friendly message (text-xl)
- Suggested action button below
- Padding: py-16

**Loading States**:
- Skeleton screens with pulse animation
- Spinner for actions (size-6, animate-spin)
- Use Heroicons' arrow-path icon

### Subscription Tier Display

**Tier Cards** (Pricing Page):
- Side-by-side comparison (grid-cols-1 md:grid-cols-2 lg:grid-cols-4)
- Current tier has highlighted border (ring-4)
- Badge for "Most Popular"
- Feature list with checkmarks
- Large CTA button per tier (h-14)
- User count indicator with avatar stack

**Tier Badge** (Current Plan):
- Small pill badge (rounded-full, px-3 py-1)
- Icon + tier name
- Display in settings/account area

---

## Animations

**Strategic Animation Usage** (Minimal but Impactful):

**Essential Animations**:
- Task completion: Scale bounce + checkmark draw
- Point gain: Number count-up + glow pulse
- Rank change: Slide animation in leaderboard
- Achievement unlock: Badge scale-in with shimmer

**Micro-interactions**:
- Button press: scale-95 on active
- Card hover: slight lift (translate-y-1 shadow-lg)
- Transitions: transition-all duration-200 ease-in-out

**Prohibited**:
- Auto-playing background animations
- Parallax scroll effects
- Excessive bounce or shake effects
- Perpetual motion elements

---

## Icons

**Icon Library**: Heroicons (via CDN)
- Consistent size-6 for inline icons
- size-8 for feature icons
- size-12 for card/section headers

**Key Icon Mapping**:
- Tasks: CheckCircleIcon
- Points: StarIcon
- Camera: CameraIcon
- Trophy: TrophyIcon
- Calendar: CalendarIcon
- Users: UserGroupIcon
- Settings: CogIcon
- Add: PlusIcon
- Rewards: GiftIcon

---

## Images

**Avatar Customization**:
- Library of 20+ preset illustrated avatars (animals, characters)
- Stored as SVG assets
- Fallback to initials with background

**Reward/Achievement Graphics**:
- Trophy illustrations for winners
- Badge icons for achievements
- Store in `/assets/rewards/` directory

**Empty State Illustrations**:
- Friendly illustrations for "No tasks yet"
- Celebration graphics for completion states
- Motivational imagery

**No Hero Images**: This app is task-focused, not marketing-focused. Skip traditional hero sections.

---

## Page-Specific Layouts

**Dashboard** (Child View):
- Sticky point counter header (h-20)
- "My Tasks" grid below (3 columns desktop)
- Each task card has completion checkbox prominently displayed
- Completed tasks fade opacity and move to bottom
- Filter tabs: All / Active / Completed

**Dashboard** (Parent View):
- Two-column layout: Task management (left 2/3) + Family stats (right 1/3)
- Stats sidebar shows leaderboard, recent completions, reward settings preview
- Task creation prominent with large "Add Task" button

**Task Detail Modal**:
- Centered overlay (max-w-2xl)
- Large task icon/emoji at top
- Task description, point value, due date stacked
- Assigned user avatar
- Photo proof gallery (if enabled)
- Action buttons at bottom (full-width, h-12)

**Leaderboard Page**:
- Full-width podium visual for top 3
- Confetti background element (static image)
- Medal/trophy illustrations
- Weekly/Monthly/All-Time tabs
- Historical data chart showing point trends

**Rewards Settings** (Parent Only):
- Create/edit reward cards
- Point threshold input
- Reward description text area
- Active/inactive toggle per reward
- Grid display of defined rewards

---

## Accessibility

- Minimum touch target: h-12 w-12 (48px)
- Form labels always visible (not floating)
- Clear focus states (ring-2 ring-offset-2)
- Icon-only buttons include aria-labels
- Readable contrast for all text (WCAG AA minimum)
- Skip navigation link for keyboard users
- Status announcements for screen readers on point gains
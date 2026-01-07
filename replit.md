# HeroKids - Gamified Family Task Management

## Overview

HeroKids is a full-stack web application designed to gamify household chores for families. It empowers children to earn points, compete on leaderboards, and unlock rewards by completing tasks, thereby fostering responsibility and making chores engaging. The application features real-time updates, photo verification for task completion, and a playful design, aiming to enhance family cooperation and introduce children to personal responsibility. It offers a structured gamified system with subscription tiers that unlock progressive features, including various gamification elements like leaderboards, character skins, and a flexible task approval system. The project's ambition is to create a fun, interactive platform that promotes positive family dynamics and teaches children valuable life skills.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Design System**: Custom CSS variables for theming (light/dark), playful typography (Nunito, Fredoka), gradient effects, elevation, and rounded corners.
- **UI Components**: Radix UI primitives wrapped with shadcn/ui ("New York" style).
- **Themed Backgrounds**: Dynamic backgrounds linked to active character skins with smooth transitions and frosted glass UI effects. Users can toggle backgrounds on/off independently from their avatar selection via a "Hide Background" button in the Skins Gallery. The preference persists across skin changes.
- **Animations**: Framer Motion for smooth transitions, canvas-confetti for celebratory effects, and spring-based animations for UI elements, ensuring 60fps performance.

### Technical Implementations
- **Frontend**: React with TypeScript (Vite), Wouter for routing, TanStack Query for server state management.
- **Backend**: Express.js with TypeScript (Node.js), RESTful API.
- **Real-time Updates**: WebSocket server using "family rooms" for live synchronization.
- **Authentication**: Replit Auth (OIDC-based) via `openid-client` and Passport.js, with Express-session and PostgreSQL store.
- **File Uploads**: Replit Object Storage (Google Cloud Storage backend) with presigned URL-based client-side uploads. Task proofs and avatars use a 3-step flow: (1) request presigned URL from backend, (2) upload file directly to storage, (3) set ACL policy and get final object path. Serves files via `/objects/` endpoint with ACL validation. Replaces multer diskStorage for production compatibility (read-only filesystem).
- **Subscription Tiers**: 4-tier model (Free, Family, Family+, Family Hero) with feature unlocks enforced by backend middleware (e.g., member limits, leaderboard types, character skins, photo proof, recurring tasks, chat).
- **Gamification Features**: Monthly leaderboards with optional member exclusion, unlockable character skins across 14 themed collections (112 standard skins + 12 Legacy skins: Starter Heroes, Elite Heroes, Dinosaur Heroes, Magical Princess World, Space Explorers, Cute Animals, Vampire Adventure, Ballerina Dreams, Superhero Squad, Mecha Robots, Manga Heroes, Gaming Legends, Pterosaur Sky, HeroKids Legacy) with balanced point progression (0-7000 points). Tiers 10-12 are designed for older children (8-14 years) with modern, stylish themes. Tier 13 "Pterosaur Sky" features 8 scientifically accurate flying dinosaur skins (Pteranodon, Quetzalcoatlus, Rhamphorhynchus, Pterodactylus, Dimorphodon, Tapejara, Anhanguera, Dsungaripterus) with unique prehistoric backgrounds. Tier 14 "HeroKids Legacy" features 12 logo-style superhero skins matching the HeroKids logo aesthetic with flat vector design, thick teal outlines, and pastel colors - unlocked through star collection (48 hidden stars, 4 stars = 1 Legacy avatar). Points system tracks `totalEarned`, `totalPoints`, `weeklyPoints`, and `monthlyPoints`. Custom recurring tasks and factory reset option available.
- **Star Collection System**: 48 hidden stars randomly placed per member on standard skin cards. Every 4 stars collected unlocks one HeroKids Legacy avatar (12 total). Stars are found when discovering/unlocking new skin cards. Constants `TOTAL_HIDDEN_STARS` (48) and `STARS_PER_LEGACY_AVATAR` (4) in `shared/skin-config.ts` control the system.
- **Achievements System**: Automatic milestone detection and reward system. Parents configure achievements (First Weekly Finisher, Weekly Leaderboard Top 3, Perfect Week, Lifetime Milestones, Task Streaks) in Settings. Flexible reward types: bonus points OR custom rewards (e.g., "Extra pocket money", "Movie night", "Ice cream"). Reward type is set per achievement definition, and when awarded, the reward details are snapshotted into the award record. Full i18n support (8 languages) for achievement configuration UI.
- **Task Approval System**: Configurable per-task approval with granular completion states (`pending`, `approved`, `rejected`, `null`). Backend guards prevent duplicate submissions via transaction locks. Tasks can be auto-approved or require parent verification. Recurring tasks automatically reopen at midnight. Client-side `useMidnightRefresh` hook ensures task list updates automatically. API exposes `memberCompletionStatus` for precise UI state rendering.
- **Multi-Completion Tasks**: Tasks can have `maxCompletions` for multiple family members. Displays progress (e.g., "2/4"). Backend uses SQL atomic increments. Recurring multi-completion tasks reset completion count at midnight. Intelligent per-member visibility shows tasks as grayed out for completed members while active for others.
- **Shared Rewards**: Children can split reward costs equally. Initiator pays upfront, others join for free, then finalize splits the cost evenly and refunds initiator's share. Features UNIQUE constraint to prevent duplicate joins, atomic transactions for point transfers, and real-time WebSocket updates for all sharing events.
- **Notification System**: Real-time notification center for family activity updates available to both parents and children. Parents receive family-wide notifications (task completions, reward redemptions, achievement events), while children receive personal notifications (task approved/rejected feedback, achievement earned, shared reward invites). Uses `targetMemberId` column to differentiate: `null` = parent notifications, specific member ID = child notifications. Features unread counter with real-time WebSocket updates, clickable navigation to relevant pages, and mark-as-read/delete functionality.
- **Family Chat**: Real-time messaging for higher tiers with unread counters and WebSocket synchronization.
- **Join System**: Family-level join codes for inviting new members.
- **Multilingual Support**: Full i18n with 8 supported languages (German, English, French, Spanish, Japanese, Chinese, Korean, Swedish) using `react-i18next`. Family-level language setting with parent-only permission and real-time sync.
- **Timezone Support**: Family-specific timezone configuration for accurate task resets. Features auto-detection from browser timezone, 21+ common timezone options with flag icons, and a scheduler that performs daily/weekly/monthly resets at each family's local midnight. Backend stores period strings (YYYY-MM-DD for daily, RRRR-Www for weekly, YYYY-MM for monthly) in family's local timezone using `date-fns-tz` formatInTimeZone. Boundary guards ensure weekly resets only run on Monday and monthly resets only on day 1. Migration path initializes null periods from existing timestamps, skipping reset checks on first run to prevent data loss. Settings UI shows timezone mismatch warnings when selected timezone differs from browser timezone.
- **Kid Dashboard**: A fully functional child-friendly interface at `/kid-dashboard` for ages 6-11 with complete API integration. Features real rewards with redemption flow (confetti effects), active tasks with granular completion states (pending/approved/rejected), and playful Fredoka typography. Task actionability logic prevents duplicate completions using backend transaction guards. Accessible via ProfileMenu navigation with full i18n support (8 languages).
- **Device Linking**: Allows children to link their existing account from a shared family device to their own personal device while preserving all progress. Parents generate a 6-character link code (valid for 15 minutes) after PIN verification. Children enter the code on their new device at `/link-device` to create a secure device session. Features bcrypt-hashed session tokens stored in HttpOnly secure cookies, device management dashboard for parents to view/revoke linked devices, and full German/English localization.
- **Admin Dashboard**: Comprehensive admin interface at `/admin` (password-protected via ADMIN_PASSWORD secret) with 4 tabs:
  - **Overview**: Key metrics (families, members, tasks, rewards, points, paid subscriptions) and subscription tier distribution
  - **Analytics**: Interactive Recharts-based visualizations including new registrations per week/month (LineChart/BarChart), most active families by completed tasks (horizontal BarChart), average points per child (BarChart), and subscription tier distribution (PieChart)
  - **Families**: Full family management with member details, subscription tier changes, admin message broadcasting via WebSocket, and member removal (with safety check preventing last parent removal)
  - **Skins**: Skin usage statistics sorted by popularity, with ability to delete custom skins (IDs starting with 'custom_')

### System Design Choices
- **Data Storage**: PostgreSQL (Neon serverless driver) with Drizzle ORM. Production and Development databases are separate. Character skins (112 standard + 12 Legacy = 124 total across 14 collections) are auto-seeded on first app startup. Tier 13 Pterosaur Sky and Tier 14 HeroKids Legacy skins are added incrementally via migration. Skin images and backgrounds are bundled as build assets via Vite's @assets import system, ensuring automatic deployment to production.
- **Authorization**: Role-based (parent vs. child) with API-level enforcement and role change security safeguards (e.g., preventing self-demotion or demotion of the last parent).
- **Session Management**: Secure, httpOnly cookies with 7-day TTL and CSRF protection.
- **Development**: Custom Vite integration for React HMR and API routing.

## External Dependencies

-   **Authentication**: Replit Auth OIDC provider.
-   **Database**: Neon PostgreSQL serverless database.
-   **Asset Storage**: Replit Object Storage (Google Cloud Storage) for uploaded photos (task proofs, avatars) with presigned URL uploads; legacy `/uploads/` endpoint for backward compatibility; pre-made avatar assets.
-   **Fonts**: Google Fonts (Nunito, Fredoka).
-   **UI Libraries**: Radix UI, shadcn/ui, Tailwind CSS, lucide-react.
-   **Build & Development**: Vite, esbuild, tsx.
-   **Validation**: Zod (with Drizzle-Zod integration).
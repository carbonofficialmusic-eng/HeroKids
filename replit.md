# HeroKids - Gamified Family Task Management

## Overview

HeroKids is a full-stack web application designed to gamify household chores for families. It empowers children to earn points, compete on leaderboards, and unlock rewards by completing tasks, thereby fostering responsibility and making chores engaging. The application features real-time updates, photo verification for task completion, and a playful design, aiming to enhance family cooperation and introduce children to personal responsibility. It offers a structured gamified system with subscription tiers that unlock progressive features, including various gamification elements like leaderboards, character skins, and a flexible task approval system. The project's ambition is to create a fun, interactive platform that promotes positive family dynamics and teaches children valuable life skills.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Design System**: Custom CSS variables for theming (light/dark), playful typography (Nunito, Fredoka), gradient effects, elevation, and rounded corners.
- **UI Components**: Radix UI primitives wrapped with shadcn/ui ("New York" style).
- **Themed Backgrounds**: Dynamic backgrounds linked to active character skins with smooth transitions and frosted glass UI effects.
- **Animations**: Framer Motion for smooth transitions, canvas-confetti for celebratory effects, and spring-based animations for UI elements, ensuring 60fps performance.

### Technical Implementations
- **Frontend**: React with TypeScript (Vite), Wouter for routing, TanStack Query for server state management.
- **Backend**: Express.js with TypeScript (Node.js), RESTful API.
- **Real-time Updates**: WebSocket server using "family rooms" for live synchronization.
- **Authentication**: Replit Auth (OIDC-based) via `openid-client` and Passport.js, with Express-session and PostgreSQL store.
- **File Uploads**: Multer middleware for photo uploads (task proofs, avatars).
- **Subscription Tiers**: 4-tier model (Free, Family, Family+, Family Hero) with feature unlocks enforced by backend middleware (e.g., member limits, leaderboard types, character skins, photo proof, recurring tasks, chat).
- **Gamification Features**: Monthly leaderboards with optional member exclusion, unlockable character skins across 3 tiers (Starter, Elite, Dinosaur) based on lifetime points, custom recurring tasks, and a factory reset option. Points system tracks `totalEarned`, `totalPoints`, `weeklyPoints`, and `monthlyPoints`.
- **Task Approval System**: Configurable per-task approval with granular completion states (`pending`, `approved`, `rejected`, `null`). Backend guards prevent duplicate submissions via transaction locks. Tasks can be auto-approved or require parent verification. Recurring tasks automatically reopen at midnight. Client-side `useMidnightRefresh` hook ensures task list updates automatically. API exposes `memberCompletionStatus` for precise UI state rendering.
- **Multi-Completion Tasks**: Tasks can have `maxCompletions` for multiple family members. Displays progress (e.g., "2/4"). Backend uses SQL atomic increments. Recurring multi-completion tasks reset completion count at midnight. Intelligent per-member visibility shows tasks as grayed out for completed members while active for others.
- **Shared Rewards**: Children can split reward costs equally. Initiator pays upfront, others join for free, then finalize splits the cost evenly and refunds initiator's share. Features UNIQUE constraint to prevent duplicate joins, atomic transactions for point transfers, and real-time WebSocket updates for all sharing events.
- **Family Chat**: Real-time messaging for higher tiers with unread counters and WebSocket synchronization.
- **Join System**: Family-level join codes for inviting new members.
- **Multilingual Support**: Full i18n with 7 supported languages (German, English, French, Spanish, Japanese, Chinese, Korean) using `react-i18next`. Family-level language setting with parent-only permission and real-time sync.
- **Timezone Support**: Family-specific timezone configuration for accurate task resets. Features auto-detection from browser timezone, 21+ common timezone options with flag icons, and a scheduler that performs daily/weekly/monthly resets at each family's local midnight. Backend tracks reset timestamps per family to prevent duplicate resets across different timezones. Settings UI shows timezone mismatch warnings when selected timezone differs from browser timezone.
- **Kid Dashboard**: A fully functional child-friendly interface at `/kid-dashboard` for ages 6-11 with complete API integration. Features real rewards with redemption flow (confetti effects), active tasks with granular completion states (pending/approved/rejected), and playful Fredoka typography. Task actionability logic prevents duplicate completions using backend transaction guards. Accessible via ProfileMenu navigation with full i18n support (7 languages).

### System Design Choices
- **Data Storage**: PostgreSQL (Neon serverless driver) with Drizzle ORM. Production and Development databases are separate. Character skins are auto-seeded on first app startup.
- **Authorization**: Role-based (parent vs. child) with API-level enforcement and role change security safeguards (e.g., preventing self-demotion or demotion of the last parent).
- **Session Management**: Secure, httpOnly cookies with 7-day TTL and CSRF protection.
- **Development**: Custom Vite integration for React HMR and API routing.

## External Dependencies

-   **Authentication**: Replit Auth OIDC provider.
-   **Database**: Neon PostgreSQL serverless database.
-   **Asset Storage**: Local filesystem for uploaded photos; pre-made avatar assets.
-   **Fonts**: Google Fonts (Nunito, Fredoka).
-   **UI Libraries**: Radix UI, shadcn/ui, Tailwind CSS, lucide-react.
-   **Build & Development**: Vite, esbuild, tsx.
-   **Validation**: Zod (with Drizzle-Zod integration).
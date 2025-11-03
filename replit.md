# HomeHero - Gamified Family Task Management

## Overview

HomeHero is a full-stack web application designed to transform household chores into an engaging and motivating game for families. Children earn points, compete on leaderboards, and unlock rewards by completing tasks, fostering responsibility and making chores fun. The application features real-time updates, photo verification for task completion, and a playful, age-appropriate design. HomeHero aims to enhance family cooperation and introduce children to personal responsibility through gamified learning.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite.
- **Routing**: Wouter for client-side routing.
- **State Management**: TanStack Query for server state management with aggressive caching.
- **UI Component System**: Radix UI primitives wrapped with custom styling via shadcn/ui, following the "New York" style variant and custom Tailwind configuration.
- **Design System**: Custom CSS variables for theming (light/dark mode), playful typography (Nunito, Fredoka), gradient effects, elevation system for interactive elements, and rounded corners.
- **Real-time Updates**: WebSocket connection for live synchronization across family members, using query invalidation for immediate updates.

### Backend Architecture
- **Framework**: Express.js with TypeScript on Node.js.
- **API Structure**: RESTful API with endpoints for authentication, family member management, tasks, rewards, task completions, and avatar uploads.
- **File Upload Handling**: Multer middleware for photo uploads (task proofs, custom avatars) with size limits, image validation, and unique filename generation.
- **WebSocket Server**: Runs alongside Express, using "family rooms" for targeted real-time broadcasts.
- **Session Management**: Express-session with PostgreSQL session store (`connect-pg-simple`) for persistent sessions (7-day TTL, secure, httpOnly cookies).
- **Development Tooling**: Custom Vite integration for serving React app with HMR and handling API routes.

### Data Storage
- **Database**: PostgreSQL accessed via Neon's serverless driver.
- **ORM**: Drizzle ORM for type-safe queries and schema management.
- **Schema Design**: Includes tables for Users, Family Members (with points tracking), Tasks (with recurrence and photo requirements), Task Assignments, Task Completions (with photo proof URLs), Rewards, Points History, and Sessions.
- **Database Migrations**: Managed via Drizzle Kit.

### Authentication & Authorization
- **Authentication Provider**: Replit Auth (OIDC-based) integrated via `openid-client` and Passport.js.
- **Authentication Flow**: Redirects to Replit for OIDC, establishes a session, and creates/updates user/family member records.
- **Session Security**: Secure, httpOnly cookies, 7-day session lifetime, CSRF protection, PostgreSQL-stored session data.
- **Authorization Model**: Role-based (parent vs. child) with API-level permission enforcement.

## External Dependencies

-   **Authentication**: Replit Auth OIDC provider (`REPL_ID`, `ISSUER_URL`, `SESSION_SECRET` environment variables required).
-   **Database**: Neon PostgreSQL serverless database (`DATABASE_URL` environment variable required).
-   **Asset Storage**:
    -   Local filesystem for uploaded task completion photos (`uploads/task-proofs/`) and custom profile pictures (`uploads/avatars/`).
    -   Pre-made avatar assets in `attached_assets/generated_images/`.
    -   All uploads served via `/uploads` static route.
-   **Fonts**: Google Fonts (Nunito, Fredoka).
-   **UI Components**: Radix UI, shadcn/ui, Tailwind CSS, lucide-react.
-   **Build & Development**: Vite, esbuild, tsx, Replit-specific plugins.
-   **Validation**: Zod for schema validation; Drizzle-Zod for integration.

## Recent Changes (November 2025)

### Completed Features
-   **Join Family Feature**: 6-character case-insensitive join codes for adding family members on separate devices
-   **Parent Dashboard Enhancements**: Parents can redeem rewards and view same statistics as children
-   **Redemption Celebration Fix**: Celebration now displays correct reward name and points spent (e.g., "Sleeping at a friend - 30 points")
-   **Custom Logo**: HomeHero logo (blue house with red cape) added to landing page
-   **Monthly Leaderboard**: Leaderboard now shows "Points Earned This Month" instead of available balance
    -   Redeeming rewards no longer affects leaderboard ranking
    -   True competition for who worked hardest this month
    -   Automatically resets on the 1st of each month
-   **Family Settings**: Parents can now control leaderboard visibility for children
    -   New Settings page accessible only to parents at `/settings`
    -   Toggle to show/hide leaderboard for children
    -   Parents always see the leaderboard regardless of setting
    -   Real-time sync via WebSocket when settings change
    -   Controlled Tabs state prevents UI issues when toggling while viewing leaderboard

### Known Issues
-   **CRITICAL**: Task completion awards points immediately without parent approval - approval system needs implementation
-   Join codes are one-time use and cryptographically secure
-   Mobile dialogs use `max-h-[90vh] overflow-y-auto` for proper scrolling
-   Tier limits bypassed in development mode for testing

### Technical Notes
-   **Points System**: 
    -   `totalEarned`: Lifetime achievement (never decreases)
    -   `totalPoints`: Available balance for spending on rewards (decreases when redeeming)
    -   `weeklyPoints`: Points earned this week (never decreases, resets Monday)
    -   `monthlyPoints`: Points earned this month (never decreases, resets 1st of month)
-   **Auth Fix**: Updated upsertUser to use email as conflict target instead of id
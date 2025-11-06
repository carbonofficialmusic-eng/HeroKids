# HomeHero - Gamified Family Task Management

## Overview

HomeHero is a full-stack web application that gamifies household chores for families. It allows children to earn points, compete on leaderboards, and unlock rewards by completing tasks, fostering responsibility and making chores fun. The application features real-time updates, photo verification for task completion, and a playful, age-appropriate design, aiming to enhance family cooperation and introduce children to personal responsibility.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Design System**: Custom CSS variables for theming (light/dark), playful typography (Nunito, Fredoka), gradient effects, elevation, and rounded corners.
- **UI Components**: Radix UI primitives wrapped with shadcn/ui ("New York" style).
- **Themed Backgrounds**: Dynamic backgrounds tied to active character skins with smooth crossfade transitions and frosted glass UI effects.

### Technical Implementations
- **Frontend**: React with TypeScript (Vite), Wouter for routing, TanStack Query for server state management and caching.
- **Backend**: Express.js with TypeScript (Node.js), RESTful API.
- **Real-time Updates**: WebSocket server using "family rooms" for live synchronization.
- **Authentication**: Replit Auth (OIDC-based) via `openid-client` and Passport.js, with Express-session and PostgreSQL store for persistent, secure sessions.
- **File Uploads**: Multer middleware for photo uploads (task proofs, avatars).
- **Subscription Tiers**: 4-tier model (Free, Family, Family+, Family Hero) with progressive feature unlocks enforced by backend middleware. Features include variable member limits, leaderboard types, character skin unlocks, photo proof, recurring tasks, and future analytics/chat.
- **Gamification Features**: Monthly leaderboards, unlockable character skins based on reward redemptions, custom recurring tasks with availability management, and a factory reset option for parents.
- **Points System**: Tracks `totalEarned` (lifetime), `totalPoints` (spendable balance), `weeklyPoints`, and `monthlyPoints`.
- **Task Approval System**: Configurable per-task approval requirement. Tasks can be set to auto-approve (no parent verification needed) or require approval (default). Auto-approved tasks award points immediately upon completion with distinct success messaging and visual indicators.
- **Family Chat**: Real-time family messaging (Family+ tier and above) with unread message counters, auto-mark-as-read functionality, and WebSocket synchronization.
- **Join System**: Family-level join codes (6-character unique codes) for inviting new members to families.

### System Design Choices
- **Data Storage**: PostgreSQL (Neon serverless driver) with Drizzle ORM for type-safe schema and queries.
- **Authorization**: Role-based (parent vs. child) with API-level enforcement and role change security safeguards.
- **Role Change Security**: Multi-layered protection to prevent family lockout:
  - Parents cannot demote themselves to child role (self-demotion prevention)
  - Cannot demote the last parent (ensures at least one parent always exists)
  - Only real authenticated parents can change roles (not "actingAs" sessions)
  - Role enum validation ensures only "parent" or "child" values accepted
- **Session Management**: Secure, httpOnly cookies with 7-day TTL and CSRF protection.
- **Development**: Custom Vite integration for React HMR and API routing.

## External Dependencies

-   **Authentication**: Replit Auth OIDC provider.
-   **Database**: Neon PostgreSQL serverless database.
-   **Asset Storage**: Local filesystem for uploaded task completion photos and custom profile pictures; pre-made avatar assets.
-   **Fonts**: Google Fonts (Nunito, Fredoka).
-   **UI Libraries**: Radix UI, shadcn/ui, Tailwind CSS, lucide-react.
-   **Build & Development**: Vite, esbuild, tsx.
-   **Validation**: Zod (with Drizzle-Zod integration).
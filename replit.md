# HeroKids - Gamified Family Task Management

## Overview

HeroKids is a full-stack web application that gamifies household chores for families. It allows children to earn points, compete on leaderboards, and unlock rewards by completing tasks, fostering responsibility and making chores fun. The application features real-time updates, photo verification for task completion, and a playful, age-appropriate design, aiming to enhance family cooperation and introduce children to personal responsibility.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Design System**: Custom CSS variables for theming (light/dark), playful typography (Nunito, Fredoka), gradient effects, elevation, and rounded corners.
- **UI Components**: Radix UI primitives wrapped with shadcn/ui ("New York" style).
- **Themed Backgrounds**: Dynamic backgrounds tied to active character skins with smooth crossfade transitions and frosted glass UI effects.
- **Animations**: Framer Motion for smooth transitions, canvas-confetti for celebratory effects on auto-approved task completions, spring-based animations for task cards, checkmarks, and points counter with 60fps performance.

### Technical Implementations
- **Frontend**: React with TypeScript (Vite), Wouter for routing, TanStack Query for server state management and caching.
- **Backend**: Express.js with TypeScript (Node.js), RESTful API.
- **Real-time Updates**: WebSocket server using "family rooms" for live synchronization.
- **Authentication**: Replit Auth (OIDC-based) via `openid-client` and Passport.js, with Express-session and PostgreSQL store for persistent, secure sessions.
- **File Uploads**: Multer middleware for photo uploads (task proofs, avatars).
- **Subscription Tiers**: 4-tier model (Free, Family, Family+, Family Hero) with progressive feature unlocks enforced by backend middleware. Features include variable member limits, leaderboard types, character skin unlocks, photo proof, recurring tasks, and future analytics/chat.
- **Gamification Features**: Monthly leaderboards with optional member exclusion (allows parents to opt out of competition with children), unlockable character skins across 3 tiers (Starter Heroes, Elite Heroes, Dinosaur Bonus Pack) based on lifetime points earned, custom recurring tasks with availability management, and a factory reset option for parents.
- **Points System**: Tracks `totalEarned` (lifetime), `totalPoints` (spendable balance), `weeklyPoints`, and `monthlyPoints`.
- **Task Approval System**: Configurable per-task approval requirement. Tasks can be set to auto-approve (no parent verification needed) or require approval (default). Auto-approved tasks award points immediately upon completion. Recurring tasks show as greyed out with a checkmark after completion and automatically reopen on schedule at midnight (not 24 hours later), preventing duplicate point earning while providing visual feedback. Daily tasks become available again at 12:00 AM, weekly at midnight 7 days later, and monthly at midnight on the same date next month.
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

## Character Skin System

### Skin Tiers
**Tier 1 - Starter Heroes (0-500 points)**
- Modern, child-friendly 3D cartoon style with vibrant colors
- Contemporary everyday environments as backgrounds
- 8 skins: Junior Champion (0), Brave Explorer (60), Star Cadet (120), Nature Scout (180), Speed Runner (240), Book Wizard (300), Kitchen Hero (360), Art Master (500)

**Tier 2 - Elite Heroes (560-1000 points)**
- Heroic, epic style with white/transparent avatar backgrounds
- Dramatic fantasy/sci-fi themed backgrounds
- Friendly but powerful, not aggressive
- 8 skins: Tech Ninja (560), Ocean Guardian (620), Sky Knight (680), Fire Phoenix (740), Crystal Mage (800), Neon Rebel (860), Cosmic Drifter (920), Thunder Champion (1000)

**Tier 3 - Dinosaur Bonus Pack (1060-1500 points)**
- Realistic, scientifically accurate dinosaur designs for teenagers
- Epic prehistoric landscapes (Jurassic/Cretaceous periods)
- Detailed, educational, and impressive
- 8 skins: T-Rex (1060), Triceratops (1120), Stegosaurus (1180), Velociraptor (1240), Brachiosaurus (1300), Spinosaurus (1360), Ankylosaurus (1420), Allosaurus (1500)

### Hidden Bonus Points
Certain special skins award bonus points when unlocked:
- **Tier 1**: Brave Explorer (+10), Book Wizard (+10)
- **Tier 2**: Tech Ninja (+10), Fire Phoenix (+10), Thunder Champion (+20)
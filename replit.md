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
- **Multilingual Support**: Full internationalization (i18n) with 6 supported languages (German, English, French, Spanish, Japanese, Chinese) - **ALL LANGUAGES NOW FULLY TRANSLATED**. ~275 critical UI strings professionally translated across all non-English languages covering navigation, dashboard, tasks, rewards, leaderboard, settings, and common UI elements. Family-level language setting stored in database, parent-only permission to change language, real-time sync via WebSocket. Translation infrastructure uses react-i18next with comprehensive translation files (client/src/locales/{lang}/translation.json).

### System Design Choices
- **Data Storage**: PostgreSQL (Neon serverless driver) with Drizzle ORM for type-safe schema and queries.
  - **Important**: Production and Development databases are SEPARATE - changes to one do not affect the other
  - **Auto-Seed**: Character skins (24 total) are automatically seeded on first app startup if the skins table is empty (see `server/index.ts`)
  - **Database UI**: SQL Console and "Add record" features available in Production Database → My Data tab for manual data management
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

### Tekken-Style Discovery Mechanics
**Card System**: Members earn 1 skin discovery card per 60 points earned (totalEarned). Cards can be spent to discover any skin from unlocked packages.

**Discovery Flow**:
1. Earn points through completed tasks (60 points = 1 card)
2. Navigate to skins gallery
3. Click "Discover" on any undiscovered skin from unlocked packages
4. Skin is instantly revealed and becomes equippable
5. If skin has bonus points, they are awarded immediately

**Database**: `discovered_skin_ids` (array) tracks which skins each member has chosen to discover. The default "Junior Champion" (0 points) is always available without discovery.

**Available Cards Calculation**: `availableCards = floor(totalEarned / 60) - discoveredSkinIds.length`

### Skin Tiers & Package Unlocks
**Tier 1 - Starter Heroes** (Unlocked from start)
- Modern, child-friendly 3D cartoon style with vibrant colors
- Contemporary everyday environments as backgrounds
- 8 skins: Junior Champion (0 - always available), Brave Explorer (60), Star Cadet (120), Nature Scout (180), Speed Runner (240), Book Wizard (300), Kitchen Hero (360), Art Master (500)

**Tier 2 - Elite Heroes** (Package unlocks at 500 total points)
- Heroic, epic style with white/transparent avatar backgrounds
- Dramatic fantasy/sci-fi themed backgrounds
- Friendly but powerful, not aggressive
- 8 skins: Tech Ninja (560), Ocean Guardian (620), Sky Knight (680), Fire Phoenix (740), Crystal Mage (800), Neon Rebel (860), Cosmic Drifter (920), Thunder Champion (1000)

**Tier 3 - Dinosaur Heroes** (Package unlocks at 1000 total points)
- Realistic, scientifically accurate dinosaur designs for teenagers
- Epic prehistoric landscapes (Jurassic/Cretaceous periods)
- Detailed, educational, and impressive
- 8 skins: T-Rex (1060), Triceratops (1120), Stegosaurus (1180), Velociraptor (1240), Brachiosaurus (1300), Spinosaurus (1360), Ankylosaurus (1420), Allosaurus (1500)

### Hidden Bonus Points
Certain special skins award bonus points when discovered:
- **Tier 1**: Brave Explorer (+10), Book Wizard (+10)
- **Tier 2**: Tech Ninja (+10), Fire Phoenix (+10), Thunder Champion (+20)
- **Tier 3**: Velociraptor (+10), Brachiosaurus (+10)

**Note**: The `pointsRequired` values in the database are for reference/ordering only. Actual discovery is controlled by available cards, not point thresholds.

## Known Issues & Browser Compatibility

### Production Database Empty After Publish (RESOLVED)
**Issue**: Character skins (and other seeded data) were missing from the published app even though they existed in development.

**Root Cause**: Production and Development databases are SEPARATE entities in Replit - they don't share data.

**Solution Implemented**: Auto-seed mechanism in `server/index.ts`:
- Checks if skins table is empty on app startup
- Automatically inserts all 24 character skins if table is empty
- Runs idempotently (safe to run multiple times, won't create duplicates)
- Works for both Development and Production environments

**Manual Alternative**: Use SQL Console in Production Database → My Data tab to run `production-skins-insert.sql`

**Status**: ✅ RESOLVED - Auto-seed now ensures skins are available in both environments

### Safari iOS Aggressive Caching
**Issue**: Safari on iOS aggressively caches API responses, which can prevent users from seeing updates after the app is republished.

**Symptoms**:
- Old data appears even after republishing with fixes
- Development environment shows changes immediately, but published app does not
- Hard refresh may be required to see latest data

**Solutions for Users**:
1. **Hard Refresh**: Desktop (Ctrl+Shift+R), Mobile (pull-to-refresh)
2. **Clear Safari Cache**: Settings → Safari → Clear History and Website Data
3. **Use Private Browsing**: Open the app in a Safari Private Tab
4. **Use Chrome/Firefox**: Switch to a different browser on iOS
5. **Wait**: Safari's cache typically expires after 5-10 minutes

**Technical Details**: The published app (herokids.replit.app) serves correct data, but Safari may cache GET requests to endpoints like `/api/skins` for extended periods, even with `Cache-Control` headers.

### Desktop Stripe Checkout Compatibility
**Issue**: Ad-blockers and tracking prevention may block Stripe checkout page rendering on desktop browsers.

**Symptoms**:
- Checkout page fails to load or shows blank screen
- Browser console shows blocked requests

**Solutions**:
- Disable ad-blockers/tracking prevention for herokids.replit.app
- Use mobile devices (iOS/Android) where checkout works reliably
- Add herokids.replit.app to browser's allowlist
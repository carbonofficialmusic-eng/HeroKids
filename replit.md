# HeroKids - Gamified Family Task Management

## Overview
HeroKids is a full-stack web application designed to gamify household chores for families. It empowers children to earn points, compete on leaderboards, and unlock rewards by completing tasks, thereby fostering responsibility and making chores engaging. The application features real-time updates, photo verification for task completion, and a playful design, aiming to enhance family cooperation and introduce children to personal responsibility. It offers a structured gamified system with subscription tiers that unlock progressive features, including various gamification elements like leaderboards, character skins, and a flexible task approval system. The project's ambition is to create a fun, interactive platform that promotes positive family dynamics and teaches children valuable life skills.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### UI/UX Decisions
- **Design System**: Custom CSS variables for theming, playful typography (Nunito, Fredoka), gradient effects, elevation, and rounded corners.
- **UI Components**: Radix UI primitives wrapped with shadcn/ui.
- **Themed Backgrounds**: Dynamic backgrounds linked to active character skins with smooth transitions and frosted glass UI effects. Users can toggle backgrounds on/off.
- **Animations**: Framer Motion for smooth transitions, canvas-confetti for celebratory effects, and spring-based animations.

### Technical Implementations
- **Frontend**: React with TypeScript (Vite), Wouter for routing, TanStack Query for server state management.
- **Backend**: Express.js with TypeScript (Node.js), RESTful API.
- **Real-time Updates**: WebSocket server using "family rooms" for live synchronization.
- **Authentication**: First-party email/password auth using bcrypt password hashes, Passport sessions, PostgreSQL session storage, email verification, password reset tokens, database-backed login rate limiting, deterministic case-insensitive email lookup, and mobile JWT/device-token compatibility. Verified account emails are protected by a normalized unique database index. Legacy `/api/login` and `/api/callback` redirect to `/`.
- **Account-to-Member Safety**: Login, registration, and password reset clear any stale acting-as-member session state. Acting-as-member sessions are accepted only when the real authenticated account is a parent in the same family as the target member. The admin family detail view includes repair controls to unlink a login account from an incorrect member and link an existing account to the correct member by email, with backend conflict checks preventing accidental double attachment. If an account is already linked elsewhere, admins get a confirmation prompt that safely detaches it from the current member and links it to the target member in one step. Admin account-link repairs require a specific non-generic repair audit name and are recorded in a sanitized recent history per family with the affected member, old account email, new account email, action, repaired-by admin label, and timestamp; admins can search this history by member, action, email, actor, or repair time.
- **Account Setup Flow**: Successful registration redirects to `/setup` with a highlighted first-step banner and prefilled display/family-name suggestions. The first profile is enforced as a parent, while existing authenticated family members continue to route to dashboards by role.
- **UI Test Coverage**: Vitest with jsdom and Testing Library covers task filters, the parent registration to family setup to dashboard journey, returning-family routing, and admin email health readiness.
- **Email Delivery**: Transactional email abstraction supports Resend through the Replit connection, or `RESEND_API_KEY`/`SENDGRID_API_KEY` secrets as fallback. Resend was connected on 2026-04-21 and `EMAIL_FROM` can be used to override the default `HeroKids <no-reply@herokids.app>` sender. Auth email links use trusted configured origins (`APP_BASE_URL`, `PUBLIC_APP_URL`, or `REPLIT_DOMAINS`) instead of request host headers. Production environment variables now set `APP_BASE_URL=https://herokids.app` and `EMAIL_FROM=HeroKids <noreply@herokids.app>`. A script-based launch check is available with `npx tsx scripts/check-email-health.ts --send-to test@example.com`; it reports provider configuration, redacted provider/domain failures, real test-send status, and whether production links use `https://herokids.app`. The protected admin dashboard also exposes the same launch readiness details, polls readiness while open, shows a prominent alert/toast when email health is not ready, can send a test transactional email to a chosen recipient without exposing provider secrets, and keeps up to 100 sanitized recent readiness/test-send outcomes with masked recipient addresses. Logged-in parents with unverified account emails can request a fresh verification email from the profile menu.
- **Email Domain Test Status**: On 2026-04-21, `herokids.app` email DNS was verified and Resend accepted real sends from `HeroKids <noreply@herokids.app>`. Automated coverage now protects the admin email health endpoints and dashboard test-send flow.
- **File Uploads**: Replit Object Storage (Google Cloud Storage backend) with presigned URL-based client-side uploads.
- **Subscription Tiers**: 3-tier model (Free, Family, Enterprise) with feature unlocks enforced by backend middleware.
- **Gamification Features**: Monthly leaderboards, unlockable character skins across various themed collections (122 total skins), a star collection system for unlocking special avatars, and an achievements system with flexible reward types.
- **Platform Detection**: Native iOS/Android builds hide Stripe payment UI for "Reader Model" compliance.
- **Task Management**: Configurable recurrence (one-time, daily, weekly, monthly, yearly) with sub-options; per-task approval system with granular completion states; multi-completion tasks for multiple family members; shared tasks with point splitting; optional due dates with visual urgency indicators, enforcement, and grace periods.
- **Shared Rewards**: Children can split reward costs equally, with atomic transactions and real-time WebSocket updates.
- **Notification System**: Real-time notification center for family activity updates, distinguishing between parent and child notifications.
- **Family Chat**: Real-time messaging for higher tiers.
- **Join System**: Family-level join codes for inviting new members.
- **Multilingual Support**: Full i18n with 8 supported languages using `react-i18next`.
- **Timezone Support**: Family-specific timezone configuration for accurate task resets, with auto-detection and UI warnings for mismatches.
- **Kid Dashboard**: A child-friendly interface with full API integration, real rewards, active tasks with completion states, and time-based task filtering with collapsible category groups.
- **Parent Dashboard Task Filtering**: Time-based filter tabs with localStorage persistence and collapsible category groups based on task iconEmoji.
- **Device Linking**: Allows children to link accounts from shared devices to personal devices using a secure link code.
- **Admin Dashboard**: Password-protected interface for key metrics, analytics, family management, skin usage statistics, and sanitized account status per family member.

### System Design Choices
- **Data Storage**: PostgreSQL (Neon serverless driver) with Drizzle ORM. Character skins are auto-seeded and incrementally added via migrations.
- **Authorization**: Role-based (parent vs. child) with API-level enforcement.
- **Session Management**: Secure, httpOnly cookies with 7-day TTL and CSRF protection.
- **Development**: Custom Vite integration for React HMR and API routing.

## External Dependencies
-   **Authentication**: Local email/password authentication with optional Resend or SendGrid for account emails.
-   **Database**: Neon PostgreSQL serverless database.
-   **Email**: Resend connection for transactional account emails.
-   **Asset Storage**: Replit Object Storage (Google Cloud Storage) for uploaded photos; pre-made avatar assets.
-   **Fonts**: Google Fonts (Nunito, Fredoka).
-   **UI Libraries**: Radix UI, shadcn/ui, Tailwind CSS, lucide-react.
-   **Build & Development**: Vite, esbuild, tsx.
-   **Validation**: Zod with Drizzle-Zod integration.

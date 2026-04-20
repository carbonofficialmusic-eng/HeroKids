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
- **Authentication**: Replit Auth (OIDC-based) via `openid-client` and Passport.js, with Express-session and PostgreSQL store.
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
- **Admin Dashboard**: Password-protected interface for key metrics, analytics, family management, and skin usage statistics.

### System Design Choices
- **Data Storage**: PostgreSQL (Neon serverless driver) with Drizzle ORM. Character skins are auto-seeded and incrementally added via migrations.
- **Authorization**: Role-based (parent vs. child) with API-level enforcement.
- **Session Management**: Secure, httpOnly cookies with 7-day TTL and CSRF protection.
- **Development**: Custom Vite integration for React HMR and API routing.

## External Dependencies
-   **Authentication**: Replit Auth OIDC provider.
-   **Database**: Neon PostgreSQL serverless database.
-   **Asset Storage**: Replit Object Storage (Google Cloud Storage) for uploaded photos; pre-made avatar assets.
-   **Fonts**: Google Fonts (Nunito, Fredoka).
-   **UI Libraries**: Radix UI, shadcn/ui, Tailwind CSS, lucide-react.
-   **Build & Development**: Vite, esbuild, tsx.
-   **Validation**: Zod (with Drizzle-Zod integration).
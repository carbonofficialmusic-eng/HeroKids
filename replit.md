# HomeHero - Gamified Family Task Management

## Overview

HomeHero is a full-stack web application that transforms household chores into an engaging game for families. Children earn points by completing tasks, compete on leaderboards, and unlock rewards - making household responsibilities fun and motivating. The application features real-time updates, photo verification for task completion, and a playful, age-appropriate design inspired by gamified learning apps like Duolingo and Habitica.

## Recent Changes

**October 31, 2025 - Point Labels Clarification**:
- Added "Lifetime Points" label below the main point counter in child view for clarity
- Changed weekly points display from "This week: X points" to "Weekly Points: X" for consistency
- Labels help eliminate confusion about which points are used for rewards (lifetime) vs leaderboard (weekly)

**October 31, 2025 - Edit, Delete Rewards & Child Rewards Board Access**:
- Added ability for parents to edit and delete rewards
- Edit button (pencil icon) and delete button (trash icon) appear in top-right corner of reward cards in parent view only
- Only visible to real parents (isRealParent check) - children cannot see or modify rewards
- PUT /api/rewards/:rewardId endpoint for editing rewards (parent-only permission)
- DELETE /api/rewards/:rewardId endpoint for deleting rewards (parent-only permission)
- RewardDialog component now supports both create and edit modes
- Real-time updates via WebSocket when reward is updated or deleted (reward_updated, reward_deleted events)
- Fixed point deduction bug in reward redemption - now correctly deducts from total, weekly, and monthly points
- Added "My Rewards" button to child view so children can access the Rewards Board to track their redeemed rewards
- Children see only their own redemptions on the Rewards Board, parents see all family redemptions
- Fixed child view to display total points (instead of weekly) to match reward redemption logic
- Child view now shows "This week: X points" below main display for weekly progress tracking

**October 30, 2025 - Rewards Board Feature**:
- Implemented complete reward redemption and approval workflow
- Created dedicated Rewards Board page (/rewards-board) for viewing all family redemptions
- Added three-state redemption status workflow: pending → approved → completed
- Parents can approve pending redemptions and mark them as fulfilled
- Children can only view their own redemptions, parents see all family redemptions
- Real-time updates via WebSocket when redemption status changes
- Fixed reward redemption endpoint to use actingAsMemberId from session for correct point attribution
- Added parent-only controls with permission checks based on authenticated user (not acting member)
- Navigation link to Rewards Board visible only in parent view
- Comprehensive test coverage of complete redemption flow

**October 30, 2025 - Permission System Fix**:
- Fixed permission checks so children cannot edit/add tasks, members, or rewards
- Implemented dual permission model:
  - `isParent` (based on acting member) controls which view to show
  - `isRealParent` (based on authenticated user) controls parent-only UI elements
- When parent switches to act as child, they now see the true child view (no edit buttons)
- Switch button and dialog remain available for real parents even when acting as child
- Real children and parents-acting-as-children both see child-only view

**October 30, 2025 - Switch Member Feature**:
- Added session-based member switching for parents to test different family member views
- Parents can click the User2 icon to switch to act as any family member
- All actions (task completion, points earned) correctly go to the member you're acting as
- Added POST `/api/family-members/switch` endpoint (parents only)
- Added GET `/api/family-members/real` endpoint to get authenticated user's real member
- Updated task completion endpoint to check session.actingAsMemberId for correct point attribution
- SwitchMemberDialog component shows all family members with avatars and roles

**October 26, 2025 - Edit Profile Feature**:
- Added EditMemberDialog component for updating member profiles
- Users can now edit their own avatar, display name, and color
- Parents can edit any family member's profile
- Added PUT `/api/family-members/:memberId` endpoint with permission checking
- Profile updates broadcast in real-time to all family members via WebSocket
- Settings icon button in dashboard header provides easy access
- Fixed race condition bug by passing memberId explicitly to mutation

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**Routing**: Wouter for lightweight client-side routing. The application has two main states:
- Landing page for unauthenticated users
- Dashboard for authenticated family members

**State Management**: TanStack Query (React Query) for server state management with aggressive caching (staleTime: Infinity) to minimize unnecessary API calls. The queryClient is configured with custom fetch functions that handle 401 errors appropriately.

**UI Component System**: Radix UI primitives wrapped with custom styling via shadcn/ui pattern. Components are stored in `client/src/components/ui/` and follow the "New York" style variant with custom Tailwind configuration.

**Design System**: 
- Custom CSS variables for theming (light/dark mode support)
- Playful typography using Nunito (body) and Fredoka (headers/gamification elements)
- Gradient effects for celebration moments and achievements
- Hover/active state elevation system for interactive elements
- Rounded corners and friendly spacing following the design guidelines in `design_guidelines.md`

**Real-time Updates**: WebSocket connection (implemented in `useWebSocket.ts`) for live synchronization across family members. When one user creates a task or completes an action, all connected family members see updates immediately via query invalidation.

### Backend Architecture

**Framework**: Express.js with TypeScript running on Node.js.

**API Structure**: RESTful API with routes defined in `server/routes.ts`. Key endpoints include:
- `/api/auth/*` - Authentication via Replit Auth (OIDC)
- `/api/family-members/*` - Family member management
- `/api/tasks/*` - Task CRUD operations
- `/api/rewards/*` - Reward management
- `/api/task-completions/*` - Task completion with photo upload support
- `/api/upload-avatar` - Profile picture upload endpoint

**File Upload Handling**: Multer middleware for photo uploads supporting both task completion proofs and custom profile pictures:

**Task Completion Photos** (`uploads/task-proofs/`):
- 5MB file size limit
- Image file type validation
- Unique filename generation using timestamps
- Photo URL tracking to prevent spoofing

**Custom Profile Pictures** (`uploads/avatars/`):
- 5MB file size limit
- Image file type validation
- Unique filename generation using timestamps
- Optional upload - users can choose between pre-made animal avatars or custom photos
- Callback-based state synchronization for clearing custom uploads

**WebSocket Server**: WebSocket server running alongside Express for real-time communication. Clients join "family rooms" based on their family name, enabling targeted broadcasts for family-specific events (task creation, completion, member joining).

**Session Management**: Express-session with PostgreSQL session store (`connect-pg-simple`) for persistent sessions across server restarts. Sessions have a 7-day TTL with secure, httpOnly cookies.

**Development Tooling**: Custom Vite integration that serves the React application in development mode with HMR support, while also handling API routes through the Express server.

### Data Storage

**Database**: PostgreSQL accessed via Neon's serverless driver with WebSocket connections.

**ORM**: Drizzle ORM for type-safe database queries and schema management. Schema is defined in `shared/schema.ts` and shared between client and server for end-to-end type safety.

**Schema Design**:
- **Users**: Authentication data from Replit OIDC (email, profile info)
- **Family Members**: Extended user profiles with avatar, color customization, role (parent/child), and points tracking (total, weekly, monthly)
- **Tasks**: Household chores with emoji icons, point values, recurrence patterns, and photo requirement flags
- **Task Assignments**: Many-to-many relationship between tasks and family members
- **Task Completions**: Completion records with optional photo proof URLs
- **Rewards**: Unlockable rewards with point thresholds
- **Points History**: Audit trail for point changes
- **Sessions**: Required for Replit Auth session persistence

**Database Migrations**: Managed via Drizzle Kit with migrations stored in `/migrations/` directory.

### Authentication & Authorization

**Authentication Provider**: Replit Auth (OIDC-based) integrated via `openid-client` and Passport.js strategy.

**Authentication Flow**:
1. Users click "Get Started" → redirected to `/api/login`
2. OIDC discovery and authentication via Replit
3. Session established with PostgreSQL-backed session store
4. User record created/updated in database
5. Family member profile created on first login

**Session Security**:
- Secure, httpOnly cookies
- 7-day session lifetime
- CSRF protection via session secrets
- Session data stored in PostgreSQL for persistence

**Authorization Model**: Role-based (parent vs. child) with permissions enforced at the API layer. Parents can create tasks and rewards; children can complete tasks and view leaderboards.

### External Dependencies

**Authentication**: 
- Replit Auth OIDC provider for user authentication
- Required environment variables: `REPL_ID`, `ISSUER_URL`, `SESSION_SECRET`

**Database**: 
- Neon PostgreSQL serverless database
- Required environment variable: `DATABASE_URL`
- WebSocket support for Drizzle ORM via `@neondatabase/serverless` and `ws` package

**Asset Storage**:
- Local filesystem storage for uploaded task completion photos (`uploads/task-proofs/`)
- Custom profile pictures stored in `uploads/avatars/`
- Pre-made avatar assets stored in `attached_assets/generated_images/` (6 animal avatars: fox, bear, rabbit, cat, penguin, lion)
- All uploads served via `/uploads` static route
- Future consideration: Migration to cloud storage (S3, Cloudinary) for production scalability

**Fonts**: 
- Google Fonts (Nunito, Fredoka) loaded via CDN link in `client/index.html`

**UI Components**:
- Radix UI headless component primitives
- shadcn/ui component patterns
- Tailwind CSS for styling
- lucide-react for icons

**Build & Development**:
- Vite for frontend bundling and development server
- esbuild for backend bundling
- tsx for TypeScript execution in development
- Replit-specific plugins for development tooling (cartographer, dev banner, runtime error overlay)

**Validation**:
- Zod for schema validation on both client and server
- Drizzle-Zod integration for automatic schema validation from database types
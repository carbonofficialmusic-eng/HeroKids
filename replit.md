# HomeHero - Gamified Family Task Management

## Overview

HomeHero is a full-stack web application that transforms household chores into an engaging game for families. Children earn points by completing tasks, compete on leaderboards, and unlock rewards - making household responsibilities fun and motivating. The application features real-time updates, photo verification for task completion, and a playful, age-appropriate design inspired by gamified learning apps like Duolingo and Habitica.

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

**File Upload Handling**: Multer middleware for photo verification of task completions. Images are stored in `uploads/task-proofs/` with:
- 5MB file size limit
- Image file type validation
- Unique filename generation using timestamps
- Photo URL tracking to prevent spoofing

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
- Local filesystem storage for uploaded task completion photos
- Avatar assets stored in `attached_assets/generated_images/`
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
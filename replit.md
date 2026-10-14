# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## GitHub / iOS release workflow

- Normal release branch: `publish`, tracking `origin/publish`. A push may automatically start Xcode Cloud; get the user's approval before pushing.
- `pnpm run git:setup` enables the tracked pre-push guard. `pnpm run git:check` checks the committed release tree; `pnpm run git:test` tests the guard.
- Keep `.migration-backup/`, root `/ios/`, generated output and unused uploads local. These files must not be deleted just to clean up Git.
- Uploaded files are ignored by default. When importing a new `@assets/...` file, explicitly add the needed file with `git add -f attached_assets/...` and update the `.gitignore` exception if appropriate. The guard blocks missing imported assets and unused uploads.
- Preserve local history on a `backup/...` branch before history reconciliation. Do not push backup branches, use `git push --all`, force-push, or merge the old unfiltered history into `publish`.
- GitHub connector access is separate from normal Git authentication. A successful API call or fetch does not prove that the Git pane can push.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

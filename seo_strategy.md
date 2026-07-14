# SEO Strategy

## In scope
- Public marketing pages
- Public pricing page
- Public legal pages (`/privacy`, `/terms`, `/impressum`)
- Crawlability files and social-sharing metadata
- AI crawler visibility for public content

## Out of scope
- Authenticated dashboard routes (`/dashboard`, `/kid-dashboard`, `/tasks`, `/rewards`, `/chat`, `/settings`, `/analytics`, `/family-goals`, `/account`)
- Admin routes (`/admin`, `/api/admin/**`)
- API endpoints except where they affect crawlability (for example robots.txt or sitemap.xml handling)
- Native mobile-only app flows

## Target audience
- Parents and families looking for a fun way to manage chores and rewards for children.

## Primary keywords
- family chore app
- chore app for kids
- gamified family task management
- kids rewards app
- family task management app

## Dismissed categories
- (None yet)

## Notes from latest scan
- Public routes currently ship through a shared SPA shell with no SSR, SSG, or prerender step for SEO-sensitive pages.
- Highest-priority technical SEO work is to add crawl files (`robots.txt`, `sitemap.xml`, `llms.txt`), ship route-specific metadata, and reduce reliance on one oversized client bundle for public content.

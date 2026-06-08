# copypilot-platform — Repo Context

See `../CLAUDE.md` for full platform context, conventions, and working rules.

## What This Repo Is

Next.js 15 App Router frontend for CopyPilot. Deployed on Vercel.
Default branch: `main`. Current HEAD: `f8c1fca`.

## Key Directories

```
app/
  layout.tsx                    — Root layout: fonts, ThemeToggle, ToastProvider
  globals.css                   — All CSS tokens, component classes, animations
  (public)/                     — Unauthenticated routes: login, signup, changelog
  (app)/                        — Authenticated routes: all tool pages + settings
    layout.tsx                  — AppLayout wrapper (sidebar + main content)
    settings/page.tsx           — Shared settings: credentials, brand profiles,
                                  backend status (all 5 services), about
    <tool>/jobs/page.tsx        — Job list (uses shared JobsListPage component)
    <tool>/jobs/new/page.tsx    — New job form
    <tool>/jobs/[id]/page.tsx   — Job detail: results, progress, rerun, cancel
components/
  layout/
    Sidebar.tsx                 — Nav with per-tool accent colors, + quick-action
    AppLayout.tsx               — Main layout wrapper
  ui/
    Badge.tsx                   — Status + source badges (inline rgba, not Tailwind opacity)
    JobsListPage.tsx            — Shared job list with hover actions, status borders
    NicheSelect.tsx             — Industry niche dropdown (hardcoded, no API call)
    BrandProfilesCard.tsx       — Brand profile select/create/delete
    Toast.tsx                   — Toast notification system
    Skeleton.tsx                — Loading skeletons
    ImportErrors.tsx            — Rejected row display for imports
lib/
  api/
    faq.ts                      — FAQ API client
    intro.ts                    — Intro API client
    meta.ts                     — Meta API client
    page-copy.ts                — Page Copy API client
    all-in-one.ts               — All in One API client (includes rerunSection)
    shared.ts                   — apiFetch base, shared settings/brand API calls
  import-rows.ts                — Shared CSV/paste row parser (use for all imports)
  supabase.ts                   — Supabase browser client
  cancellation-polling.test.mjs — Cancellation contract regression tests
  import-rows.test.mjs          — Import parsing regression tests
```

## Route Structure

```
/                           → redirects to /home
/home                       → marketing/landing page
/login, /signup             → auth pages
/changelog                  → public changelog
/settings                   → credentials, brand profiles, backend status
/<tool>/jobs                → job list
/<tool>/jobs/new            → new job form
/<tool>/jobs/[id]           → job detail
```

Tools: `faq`, `intro`, `meta`, `page-copy`, `all-in-one`

## API Client Pattern

Each tool has its own client in `lib/api/<tool>.ts`:

```typescript
const BASE = (process.env.NEXT_PUBLIC_<TOOL>_API_URL || 'https://<fallback>.railway.app').replace(/\/+$/, '')
const f = (path, token, opts?) => apiFetch(BASE, path, token, opts)
export const <tool>Api = { runJob, listJobs, getJob, ... }
```

Shared calls (settings, brand profiles, niches) route through the FAQ backend
via `lib/api/shared.ts`. Do not duplicate these in other clients.

## Design System

Tokens are CSS variables in `globals.css`, mapped to Tailwind in `tailwind.config.ts`.

**Never use Tailwind opacity modifiers on CSS-variable colors** (`bg-muted/8`,
`border-accent/20`). They silently render transparent. Use inline `rgba()` or
define a dedicated CSS class instead. Badge.tsx is the reference implementation.

Per-tool accent colors are available as Tailwind classes:
`text-tool-faq`, `bg-tool-intro`, `text-tool-meta`, etc.

Key utility classes defined in `globals.css` (do not re-implement in Tailwind):
- `.input-base` — all form inputs/selects/textareas
- `.btn-primary` — primary action button
- `.btn-ghost` — secondary/ghost button
- `.label-caps` — section header labels
- `.status-pulse` — animated dot for running/cancelling badges
- `.prose-result` — AI output text display

## Cancellation Polling Contract

All five `jobs/[id]/page.tsx` files must follow this pattern:

```typescript
// Poll while running OR cancelling
if (status === 'running' || status === 'cancelling') startPolling()

// On cancel button click:
await toolApi.cancelJob(token, id)
reloadImmediately()  // do not wait for next poll
```

Regression tests in `lib/cancellation-polling.test.mjs` enforce this.
Run `npm test` to verify before any changes to job detail pages.

## Import Parsing

All new-job forms use `lib/import-rows.ts` for CSV upload and bulk paste.
Do not write custom parsers. The shared parser handles:
- Quoted values and multiline fields
- Intentionally blank cells (retain position)
- Recognized header removal
- Required field validation
- Rejected rows with source row numbers reported via `ImportErrors` component

## Settings Page

`app/(app)/settings/page.tsx` checks all 5 backend health endpoints in
parallel on load. The `BACKENDS` array defines all 5 service URLs. Update
this array if a Railway URL changes.

## Known Gotchas

- `NEXT_PUBLIC_*` vars are baked at build time — env var changes require redeploy
- `export const dynamic = 'force-dynamic'` is required on all authenticated pages
- `ToastProvider` must stay in the root `app/layout.tsx` — not in `(app)/layout.tsx`
- Do not add `@import` for Google Fonts in CSS — fonts load via `next/font/google`
- The optional Vercel Analytics branch (`vercel/install-vercel-web-analytics-*`)
  introduces a `pnpm-lock.yaml` — do not merge it

# Import Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use one reliable CSV and paste parser across all five new-job screens while preserving valid data and clearly listing rejected rows.

**Architecture:** Add a pure PapaParse-based utility that accepts a small app-specific schema and returns accepted records plus row-numbered errors. Add one compact rejected-row list component, then replace only the existing import handlers in each screen.

**Tech Stack:** Next.js 15, React 18, TypeScript, PapaParse, Node test runner, ESLint

---

### Task 1: Establish Parser Test Harness

**Files:**
- Modify: `package.json`
- Create: `lib/import-rows.test.ts`

- [ ] Add a `test` script using Node's test runner with TypeScript stripping.
- [ ] Write failing tests for delimiter detection, blank-cell preservation, quoted values, multiline values, headers, positional rows, invalid URLs, and malformed input.
- [ ] Run `npm test` and confirm failure because `lib/import-rows.ts` does not exist.
- [ ] Commit the failing tests and test-script setup.

### Task 2: Implement Shared Parser

**Files:**
- Create: `lib/import-rows.ts`
- Test: `lib/import-rows.test.ts`

- [ ] Define the parser schema, accepted record, and rejected-row result types.
- [ ] Implement normalized header alias matching and conservative header detection.
- [ ] Parse text with PapaParse while preserving cells and source row numbers.
- [ ] Validate required HTTP(S) URLs and return accepted and rejected rows separately.
- [ ] Run `npm test` until all focused parser tests pass.
- [ ] Commit the parser implementation.

### Task 3: Add Rejected-Row Display

**Files:**
- Create: `components/ui/ImportErrors.tsx`

- [ ] Add a compact component that renders row numbers and error reasons.
- [ ] Keep the component presentation-only and compatible with existing screen styling.
- [ ] Run lint and TypeScript checks.
- [ ] Commit the component.

### Task 4: Migrate FAQ and Intro Imports

**Files:**
- Modify: `app/(app)/faq/jobs/new/page.tsx`
- Modify: `app/(app)/intro/jobs/new/page.tsx`

- [ ] Replace CSV upload parsing with `file.text()` followed by the shared parser.
- [ ] Replace pasted-row splitting with the same shared parser.
- [ ] Preserve each screen's current page-type defaults and row-table behavior.
- [ ] Display rejected rows near both import controls.
- [ ] Run focused tests, lint, and TypeScript checks.
- [ ] Commit the FAQ and Intro migration.

### Task 5: Migrate Meta, Page Copy, and All In One Imports

**Files:**
- Modify: `app/(app)/meta/jobs/new/page.tsx`
- Modify: `app/(app)/page-copy/jobs/new/page.tsx`
- Modify: `app/(app)/all-in-one/jobs/new/page.tsx`

- [ ] Replace manual tab splitting with the shared parser.
- [ ] Preserve page-type, template-key, and output-toggle defaults from current screen state.
- [ ] Display rejected rows beside the existing paste controls.
- [ ] Keep existing submission payloads unchanged.
- [ ] Run focused tests, lint, and TypeScript checks.
- [ ] Commit the three-screen migration.

### Task 6: Full Verification and Scope Audit

**Files:**
- Review only all files changed by Tasks 1-5

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Confirm no backend, API contract, database, route, or unrelated UI files changed.
- [ ] Document verification results and remaining uncertainty.

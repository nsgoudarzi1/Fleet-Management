# AGENTS.md

## 1) Project Summary & Scope
- Product: `dmslite` multi-tenant dealer management platform (DMS-lite) with compliance/documents.
- Core modules: inventory, CRM, deals, documents/compliance, fixed ops, accounting, integrations.
- Primary guarantees: strict org isolation, server-side RBAC, full auditability for critical actions.
- Agent objective: deliver small, safe, reviewable changes that preserve these guarantees.

## 2) Tech Stack & Key Directories
- Framework: Next.js App Router + TypeScript.
- UI: Tailwind CSS + shadcn/ui + lucide-react.
- Data: PostgreSQL + Prisma.
- Auth: NextAuth (credentials + memberships).
- Tests: Vitest.

Key paths:
- `app/(protected)/*`: authenticated pages.
- `app/api/*`: route handlers (thin transport layer).
- `components/modules/*`: feature UIs.
- `components/ui/*`: shared shadcn primitives.
- `lib/services/*`: business logic (authoritative layer).
- `lib/validations/*`: zod schemas for all inputs.
- `lib/documents/*`, `lib/compliance/*`, `lib/esign/*`: documents/compliance/e-sign.
- `lib/storage/*`: storage adapters.
- `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.ts`.
- `scripts/db-verify-fresh.ts`: migration hygiene + fresh DB verification.

## 3) Runbook (Local / Dev / Prod-like)
Local setup:
- `npm install`
- `npx prisma generate`
- `npx prisma migrate deploy`
- `npx prisma db seed`
- `npm run dev`

Prod-like validation before merge:
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run db:verify-fresh`

Demo login (seeded):
- `owner@summitauto.dev`
- `demo1234`

## 4) Environment Variables & Modes
Required baseline:
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

Deployment/runtime modes:
- `DEPLOY_TARGET=vercel|cloudflare`
- `PDF_MODE=none|external|playwright`
- `STORAGE_MODE=local|s3|r2|supabase`
- `IMPORT_STORAGE_MODE` (optional override; defaults to `STORAGE_MODE`)
- `WORKER_SECRET` (for webhook worker scheduled execution)

Document/external:
- External PDF mode requires provider keys (see `lib/config.ts`).
- S3/R2 mode requires `S3_*` vars.

SLA config:
- `SLA_LEAD_RESPONSE_MINUTES`
- `SLA_TASK_OVERDUE_GRACE_MINUTES`

Rule: after changing env vars, restart dev server.

## 5) Data Model Rules (Multi-tenant + RBAC)
Non-negotiables:
- Every tenant-owned record must be scoped by `orgId`.
- Never trust route params alone; always query with `id + orgId`.
- Enforce auth/roles/permissions server-side only (`lib/services/guard.ts`).
- Use `requireOrgContext`, `requireOrgRoles`, and `requirePerm` in services.
- Public/integration endpoints must resolve org via API key and still scope queries.

## 6) Audit Logging Rules
- Critical actions must write `AuditEvent`:
  - create/update/delete/post/close/send/void/regenerate/revoke/role assignment/import rollback.
- Use `recordAudit(...)` from `lib/services/audit` inside transactions where possible.
- Include minimal before/after diffs (not full blobs if unnecessary).
- Never skip audit for core entities: Vehicle, Customer, Deal, Payment, RepairOrder close, Funding changes, roles, integrations, documents.

## 7) Webhooks & Integrations Worker Model
- Outbound events create `WebhookEvent` + `WebhookDelivery` rows.
- Delivery statuses: `PENDING`, `FAILED`, `DELIVERED`, `DEAD`.
- Retry schedule: 1m, 5m, 15m, 1h, 6h; then mark `DEAD`.
- Worker endpoint: `POST /api/integrations/webhooks/worker`
  - Manual mode: admin session.
  - Scheduled mode: `X-Worker-Secret` or `Authorization: Bearer <WORKER_SECRET>`.
- Vercel cron (recommended): every 5 minutes targeting worker endpoint.
- Redelivery routes exist for individual deliveries/events; keep operations idempotent.

## 8) Coding Conventions (Services, Validation, API)
Do:
- Put business logic in `lib/services/*`.
- Keep route handlers thin: parse request, call service, return JSON.
- Validate all inputs with zod schemas in `lib/validations/*`.
- Use shared error handling (`handleRouteError`) and size-limited JSON parsing where needed.
- Prefer transactions for multi-write operations.

Do not:
- Put business rules directly in React components.
- Bypass zod parsing in mutating endpoints.
- Implement org/RBAC checks in client-only code.

## 9) UI/UX Conventions
- Use shadcn components from `components/ui/*`.
- Keep module UI in `components/modules/<domain>/*`.
- Maintain work-queue-first UX: fast triage, low-click actions.
- Tables should support filters/saved views/bulk operations where relevant.
- Prefer drawer/dialog quick actions over navigation thrash.
- Keep status badges and entity layouts consistent across modules.

## 10) Testing & Quality Gates
Minimum gate before finalizing work:
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run db:verify-fresh`

If changing Prisma schema:
- `npx prisma generate`
- create migration via `npx prisma migrate dev --name <change>`
- verify migration hygiene and fresh DB apply.

## 11) How To Add a New Module (Checklist)
1. Add Prisma models/enums/indexes with `orgId` and required relations.
2. Create migration and update seed demo data.
3. Add zod schemas in `lib/validations/<module>.ts`.
4. Add service methods in `lib/services/<module>.ts` with guard + org scoping.
5. Add API routes under `app/api/<module>` that only call services.
6. Add UI pages/components under `app/(protected)` + `components/modules`.
7. Add audit events for critical writes.
8. Add/emit integration webhook events if action is externally relevant.
9. Run lint/test/build/db verify fresh.

## 12) Common Pitfalls & Fixes
- Env changes not applied:
  - Restart `npm run dev`.
- Prisma drift/shadow DB issues:
  - Do not edit applied migrations unless absolutely required.
  - If local drift: `npx prisma migrate reset --force` (dev only), then `npx prisma db seed`.
- Fresh deploy migration failures:
  - Run `npm run db:verify-fresh` and fix migration layout/SQL assumptions.
- Seed foreign key failures:
  - Delete in correct dependency order; clear new module tables too.
- Hydration warnings:
  - Avoid non-deterministic values in SSR output; gate client-only logic in client components.

## 13) Codex Output Guidelines
- Default response style: diff-first and concise.
- Do not dump full files unless explicitly requested.
- Report:
  - files changed
  - key diffs per file
  - migration notes/commands
  - verification results
- Include exact commands executed and pass/fail status.
- If blocked, state exact blocker and next command needed.

## Quick Smoke Test
1. Sign in with seeded owner.
2. Open Dashboard (`/app`) and confirm queues render.
3. Open a deal and generate documents.
4. Send e-sign via stub and complete signing.
5. Open Fixed Ops, transition an RO, confirm accounting posting path.
6. Open Integrations, run worker now, verify deliveries update.
7. Open Settings Security/Audit/Import and confirm pages load.

## Definition of Done (PR-quality)
- Schema/migrations/seed consistent and deployable.
- Org scoping + permission checks enforced in service layer.
- Audit events written for all critical actions touched.
- Lint/test/build/db-verify-fresh pass.
- No API contract regressions unless explicitly requested.
- UI changes follow existing design conventions and keep workflows fast.
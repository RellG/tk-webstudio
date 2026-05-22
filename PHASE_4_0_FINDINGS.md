# Phase 4.0 — Webstudio Clone/Template Mechanism Findings

**Status:** COMPLETE — unblocks Phase 4.1
**Date:** 2026-05-22

## Q1: Built-in template/marketplace concept?

**Yes — Webstudio ships a first-class marketplace concept, and it's the right primitive for TK templates.**

The schema already models everything we need:

- `Project.marketplaceApprovalStatus` enum `UNLISTED | PENDING | APPROVED | REJECTED` (`packages/prisma-client/prisma/schema.prisma:156`, `:172-177`).
- `Build.marketplaceProduct String @default("{}")` holds the JSON product metadata baked into each build (`schema.prisma:199`).
- `ApprovedMarketplaceProduct` view exposes `(projectId, marketplaceProduct, authorizationToken)` for any project whose latest build is approved (`schema.prisma:350-354`).
- `AuthorizationToken` carries `canClone Boolean @default(true)` and `canCopy Boolean @default(true)` (`schema.prisma:218-231`) — this is the credential that lets an unauthenticated/unauthorized visitor pull a clone.

A composite perf index `@@index([isDeleted, marketplaceApprovalStatus])` on `Project` (`schema.prisma:163`) confirms the marketplace listing is treated as a hot read path.

In the UI, the marketplace currently surfaces inside the **builder** (a left-sidebar feature at `apps/builder/app/builder/features/marketplace/`), not the dashboard. The router that backs it is `apps/builder/app/shared/marketplace/router.server.ts:12-26` exposing `getItems` and `getBuildData`, and `db.server.ts:29` reads `ApprovedMarketplaceProduct` directly to populate the picker.

The "Open project" link in `apps/builder/app/builder/features/marketplace/about.tsx:79-89` already uses `builderUrl({ projectId, authToken })` — i.e. anyone who clicks an approved marketplace item gets a viewer-token link into the source project's builder. That same token is what powers cloning.

## Q2: How does the clone flow work?

The clone path is **a single Postgres function call**, not an application-level row copy:

1. UI calls `nativeClient.project.clone.mutate({ projectId, title, authToken })` from `apps/builder/app/shared/clone-project.tsx:46-50`.
2. The tRPC handler is `packages/project/src/trpc/project-router.ts:34-47`. If an `authToken` is passed, it constructs a token-scoped source context via `ctx.createTokenContext(authToken)` and delegates to `projectApi.clone(input, ctx, sourceContext)`.
3. `packages/project/src/db/project.ts:294-411`:
   - Loads the source project (`loadById`) using the source (possibly token-only) context.
   - Asserts the destination user is authenticated.
   - If the source belongs to a workspace, runs membership / permission checks **before** copying.
   - Calls `postgrest.client.rpc("clone_project", { project_id, user_id, title, domain })`.
   - Returns `{ id }` of the new project.
4. The DB function is defined in `packages/prisma-client/prisma/migrations/20240730131207_clone_project_preview_imagea/migration.sql:1-72`. It:
   - `INSERT`s a new `Project` row owned by `user_id`.
   - `INSERT`s `Asset` rows for every uploaded `File` from the source (R2/S3 file payloads themselves are referenced by `name`, not copied — assets are deduplicated).
   - Copies the source's `previewImageAssetId`.
   - `INSERT`s exactly one new `Build` row, copying `pages, styleSources, styleSourceSelections, styles, breakpoints, props, instances, dataSources, resources` from the **non-deployed development build** of the source (`WHERE deployment IS NULL`).
   - Returns the new `Project` row.

Notably the function does **not** copy `marketplaceProduct` JSON or `marketplaceApprovalStatus` — the clone lands as an `UNLISTED` regular project, which is exactly what we want for a client-owned copy.

For the auth model: an unauthenticated visitor cannot clone. They must (a) be logged in, and (b) hold an `AuthorizationToken` for the source project with `canClone=true`. The token is checked at `apps/builder/app/routes/_ui.dashboard.tsx:151-153` via `authDb.getTokenInfo(...)`.

## Q3: Where to intercept `?template={slug}`

**There is already a deep-link pattern we should match, not invent.** The dashboard loader at `apps/builder/app/routes/_ui.dashboard.tsx:136-166` (`getProjectToClone`) reads `?projectToCloneAuthToken=<token>` from the URL on a `navigate` request, resolves it to `{ id, authToken, title }`, and passes it down to `apps/builder/app/dashboard/dashboard.tsx:382` which auto-opens the `CloneProjectDialog`. The user picks a title, clicks Clone, the existing `project.clone` mutation runs, and they end up in their own copy.

That is the entire UX flow Phase 4.1 needs — for free.

**Recommendation:** in the same loader (`_ui.dashboard.tsx`), add a sibling lookup: if `?template={slug}` is present and `?projectToCloneAuthToken` is not, translate the slug to the TK template project's `AuthorizationToken` (built with `canClone=true`) and treat it as if `projectToCloneAuthToken` had been passed. Two implementation shapes:

- **Cleanest:** add a small helper `getTemplateProjectToClone(request, context)` next to `getProjectToClone`, query a `TKTemplate` lookup (see Q4), return the same `{ id, authToken, title }` shape.
- **Alternative:** issue an HTTP redirect from `_ui.dashboard.tsx` from `?template=runway` → `?projectToCloneAuthToken=<resolved>`. Less elegant; an extra round trip; not worth it.

Either way the only fork-divergent file we add is the slug→token resolver — the rest of the flow is upstream Webstudio code we don't touch.

## Q4: Chosen ownership model

**Option (a): TK templates are real `Project` rows owned by a system user (e.g. `tk-system@tktechnology.org`), each fronted by a per-template `AuthorizationToken` (`canClone=true`, `relation=viewers`). A thin slug→projectId/token map lives outside the schema.**

Reasoning grounded in #1 and #2:

1. The clone flow is _built around_ `AuthorizationToken`. Any other ownership model would force us to re-implement the auth gate that `getTokenInfo` already enforces. Option (a) reuses it verbatim.
2. The DB `clone_project` function already copies the latest non-deployed build, the assets, and the preview image — i.e. the whole template. We get visual fidelity for free.
3. Approving the templates to the marketplace (`marketplaceApprovalStatus = APPROVED` + a build with `marketplaceProduct` JSON) would _also_ surface them inside the builder's "Marketplace" sidebar — a free secondary discovery surface for free for power users. We can opt in or out later without changing the data model.
4. Option (b) (a new `Template` table) is pure fork divergence with no functional gain. It would duplicate `Project`/`Build` data, force us to maintain a parallel clone path, and collide with upstream changes. Rejected.
5. Option (c) (seed pipeline / fixtures) is brittle. Each template change would require a migration or seed re-run; we lose the ability to edit a template through the regular builder UI. Rejected.

Concrete shape of (a):

- Create a single user account `tk-system@tktechnology.org` (Google login, password vaulted). All TK template projects live here.
- For each template, create the project in the builder, build the design, then mint one `AuthorizationToken` with `relation=viewers` (which still gives `canClone=true` per the permission table at `packages/authorization-token/src/db/authorization-token.ts:82-86` and the per-relation logic in the tests at `:36-72`).
- Store the slug → `(projectId, authToken)` map. Two viable homes:
  - **Static JSON** committed in the fork (e.g. `apps/builder/app/tk-templates.ts`). Simplest. Acceptable fork divergence — one file, low collision risk. **Recommended for Phase 4.1.**
  - **DB table** (`TKTemplate { slug PK, projectId, authToken }`). Cleaner long-term but adds a migration to the divergence surface; defer until 4.4+ if the static file gets unwieldy.

## Q5: Publish flow shape

Publishing is per-project and gated by token+plan permissions. Each project gets `{project.domain}.{PUBLISHER_HOST}` (default `wstd.work`, set via env at `apps/builder/app/env/env.server.ts:47,106`) plus optional custom domains via the `Domain` / `ProjectDomain` tables (`schema.prisma:243-272`). When a user clicks publish, the build moves to `publishStatus = PENDING/PUBLISHED/FAILED` and the static deployment lives on the publisher host. The `LatestStaticBuildPerProject` view (`schema.prisma:274-286`) tracks the latest static build per project. The publisher itself is a separate service (we have not deployed one yet — Phase 5 deferred).

**Implication for Phase 4:** template projects do not need anything baked in to be publishable later. Each client's _cloned_ copy is a normal project with its own domain (auto-generated via `generateDomain(project.title)` in the clone path). When Phase 5 stands up our own `PUBLISHER_HOST` (e.g. `sites.tktechnology.org`), client publishes Just Work. No template-side changes needed now.

## Recommended Phase 4.1 implementation sketch

1. Create the `tk-system@tktechnology.org` Google account; sign into TK Studio with it; create one project titled `template:runway`.
2. Rebuild the `runway` template in the Webstudio builder (long pole — the actual design work).
3. In the project's Share dialog, mint an `AuthorizationToken` with `relation=viewers` (default `canClone=true`). Copy the token UUID.
4. Add `apps/builder/app/tk-templates.ts`: `export const TK_TEMPLATES: Record<string, { projectId: string; authToken: string }> = { runway: { ... } }`.
5. In `apps/builder/app/routes/_ui.dashboard.tsx`, add a sibling to `getProjectToClone` named `getTKTemplateToClone(request, context)`. When `?template={slug}` is set and the slug exists in `TK_TEMPLATES`, build the same `{ id, authToken, title }` payload using `authDb.getTokenInfo` + `projectApi.loadById` (using `createTokenContext`), and merge into the loader's `projectToClone` return value. The existing `<CloneProject>` component (`apps/builder/app/dashboard/dashboard.tsx:59-96`) then opens the clone dialog with zero further changes.
6. After clone, the dashboard reloads and `CloneProjectDialog.onCreate` already routes the user into the new project's builder (via `revalidate()`; the navigation to the builder subdomain is handled by the existing project tile click path). Verify this happens; if not, add a direct `navigate(builderUrl({ projectId: newId, origin }))` in the `onCreate` callback in `dashboard.tsx`.
7. End-to-end test from `tktechnology.org/templates.html`: click Customize → log in → land on dialog with title prefilled "Runway (copy)" → click Clone → arrive in builder editing your own copy. Edit, reload, verify persistence.
8. Document the steps in `RUNBOOK.md` so steps 1–4 (the per-template work) become a recipe for the remaining 24 templates.

## Risks / unknowns

- **GitHub-only auth gate during 4.1.** Step 5 above requires the visitor to log in. Until Phase 4.2 ships Google OAuth, every test will require a GitHub account. Fine for engineering; blocks any real client. Don't skip 4.2.
- **`canClone` semantics for `viewers`.** The unit tests in `packages/authorization-token/src/db/authorization-token.test.ts:36-49` confirm viewers keep `canClone=true` by default but `applyTokenPermissions` could be modified upstream. Verify once at 4.1 time by calling `getTokenInfo` on the minted token and asserting `canClone === true` before relying on it.
- **Build `deployment IS NULL` clause.** `clone_project` only copies the _development_ build (`migration.sql:67`). If a template project has been published (deployment set), the clone path will still work but copies the dev build — which should match the published one. Just don't accidentally edit a template _after_ a publish without re-running the development build through edit; the dev build is the source of truth for clones.
- **Static slug map fork divergence.** `tk-templates.ts` is a new file in the fork. Upstream Webstudio will never touch it, so collision risk is essentially zero — but document it in `CLAUDE.md` so future merges know to leave it alone.
- **Subdomain routing for cloned projects.** Phase 3 set up wildcard `*.studio.tktechnology.org` for per-project builders. Verify a freshly cloned project opens at `p-{newProjectId}.studio.tktechnology.org` without further DNS work — should be true given the wildcard, but worth one smoke check.

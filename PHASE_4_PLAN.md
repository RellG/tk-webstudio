# Phase 4 — Templates: rebuild the 25 customizable TK templates as native Webstudio projects

**Status:** PLANNED (gated on signoff). Predecessor (Phase 3) complete 2026-05-22.
**Goal:** A client lands on `tktechnology.org/templates.html`, clicks "Customize in Studio" on any of the 25 customizable templates, and ends up inside the TK Studio builder editing **their own copy of that template** as a real project — branded, responsive, design-system-true, ready to publish.

This is the long pole of the whole TK Studio v2 effort (~1–3 days per template × ~25 = 4–10 weeks of focused work). The plan below sequences it so we land production value early instead of waiting until all 25 are done.

---

## Definition of done (the whole phase)

1. At least **6 of the 25 customizable templates** are real Webstudio projects clients can clone and edit. (The 6 sets a credible "open for business" floor; the rest land in batches.)
2. **Deep-link flow works end-to-end:** `https://studio.tktechnology.org/?template={slug}` → client gets a new project seeded from that template, attached to their account, editable in the builder.
3. **Client auth path exists** that does not require a GitHub account (clients are SMB owners, not developers).
4. Every shipped template:
   - Visually matches its `tk-gallery` source on desktop, tablet, mobile
   - Uses the TK Technology Design System tokens (no off-brand colors/fonts/spacing)
   - Has the `data-brand-*` content surfaces meaningfully editable in Webstudio
   - Passes WCAG AA contrast
   - Loads under 2.5s on a clean cache (mobile 3G profile)
5. A **template-build runbook** documents the rebuild process so additional templates can be added by a less-specialized contributor later.

---

## Predecessor recap (what's already shipped)

- TK Studio v2 live at `https://studio.tktechnology.org` (Render Virginia + Supabase, custom server with `trust proxy`, wildcard subdomain for per-project builders).
- GitHub OAuth login works; a user can create a project, edit in the builder canvas, edits persist across reloads.
- All 17 production env vars in place; PostgREST service-role key bypasses RLS (no grant-SQL workaround needed).
- Old GrapesJS service decommissioned; tk-webstudio Blueprint deleted to prevent accidental service spawning on render.yaml pushes.

---

## Sub-phases

### Phase 4.0 — Investigate Webstudio's template/clone mechanism (1–2 days)

Before building anything, confirm how Webstudio represents "a template" vs "a project" and what flow we hook into. This determines everything that follows.

**Specific questions to answer:**

- Does Webstudio have a built-in template/marketplace concept (look at the `Project` table, `ApprovedMarketplaceProduct`, and the dashboard routes)?
- What does the "clone project" flow do under the hood? Is it `prisma copy` of `Build`/`Instance`/`Style*` rows, or higher-level?
- Where in the dashboard code does `?template={slug}` need to be intercepted (or do we add a new route)?
- Are TK templates best modeled as: (a) a special user's projects that get cloned, (b) entries in a templates table, (c) a separate seed pipeline?
- How does Webstudio's "publish" flow work end-to-end (this is Phase 5 but informs whether templates need a publishable variant now)?

**Deliverable:** a short addendum to this doc — `Phase 4.0 findings` — with the chosen clone mechanism + the route/handler we'll add for `?template={slug}`.

### Phase 4.1 — First template, end to end (3–5 days)

Pick **one** of the 25 templates that is visually representative but not the hardest (recommended: **runway** or **stillwater** — clean structure, well-scoped). Rebuild it as a native Webstudio project, then wire the `?template=runway` deep-link flow to clone it for a new user.

**Steps:**

1. Open the source template at `tk-gallery/templates/runway/` and note its sections + components.
2. In TK Studio, create a project named `template:runway` under the TK system user (or whatever owner pattern Phase 4.0 chose).
3. Rebuild section by section in Webstudio's builder, using only the TK design-system tokens (`design-tools/TK-Technology-Design-System/colors_and_type.css`). Match the original on desktop / tablet / mobile.
4. Mark every `data-brand-*` surface as a meaningfully editable Webstudio Component or Variable so clients can replace text, hero image, accent color without touching layout.
5. Implement the `?template=runway` route: clone the template project to the visiting user, redirect them into the cloned project's builder subdomain.
6. End-to-end test: marketing site → click "Customize in Studio" → land in builder with editable copy. Edit something. Reload. Verify persists.
7. Update `templates.html` if any contract changes are needed (the existing deep-link already targets the right URL shape).

**Exit criterion:** a fresh test client can sign in, click "Customize in Studio" on runway, edit their own copy, and the edit persists. Snapshot the runbook so step 2–4 can be repeated for the remaining 24.

### Phase 4.2 — Production-grade auth for clients (parallel, ~1 week)

Webstudio currently authenticates via GitHub OAuth (configured) and Google OAuth (env vars not set yet). Neither is acceptable for SMB clients long-term. Decide and ship:

- **Option A — Google OAuth.** Cheapest; most clients have a Google account. Add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars; Webstudio's GoogleStrategy already handles it. Callback: `https://studio.tktechnology.org/auth/google/callback`.
- **Option B — Email magic-link.** Most universal; requires adding a Resend/Postmark integration. Webstudio's auth stack is built on `remix-auth`, so adding `remix-auth-email` is feasible. More work than A.
- **Option C — Both.** Recommended end state, but ship Google first.

**Recommendation:** ship **Google** in Phase 4.2 alongside Phase 4.1, defer magic-link to Phase 6 (billing).

### Phase 4.3 — Batch rebuild templates 2–6 (3 weeks)

Once 4.1 proves the rebuild pattern, batch through the next 5 templates: **harbor, maison, silken, dapper, ember**. Same process, captured in the runbook. Per-template review against:

- The original `tk-gallery` rendering (side-by-side screenshots — use `/tmp/shot.mjs` for the source)
- The TK design system kit (`design-tools/TK-Technology-Design-System/`)
- Mobile + tablet
- WCAG AA contrast

**Phase 4 "open for business" milestone:** end of 4.3 with 6 templates live.

### Phase 4.4 — Remaining 19 templates (4–6 weeks)

Continue batching in groups of 4–5. This is also where a less-specialized contributor can take over using the runbook from 4.1.

---

## Marketing-site integration (already in place, mostly)

- `templates.html` deep-links each customizable template card to `https://studio.tktechnology.org/?template={slug}`. **Note:** that change is currently uncommitted in the marketing repo working tree (along with the `customize.html` archival). It needs to be committed as a coherent unit — the `customize.html` → `archive/customize.html` rename, the removal of the "Try With Your Brand" button, and the addition of "Customize in Studio". Don't ship them piecemeal.
- The "Start from Scratch" tile on `templates.html` routes to the template-request modal — preserve that path (it serves clients who don't want any template).

---

## Open decisions / things that need your call

1. **Template owner pattern (Phase 4.0).** Are TK templates projects under a system user (e.g. `tk-system@tktechnology.org`) that get cloned, or do we introduce a `Template` table? Resolved in 4.0.
2. **Client auth (Phase 4.2).** Google OAuth now, magic-link Phase 6 — confirm.
3. **R2 asset storage.** Currently the `S3_ENDPOINT`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` env vars are blank — assets work in-memory only. Phase 4 will need R2 wired up so client uploads persist. Confirm reusing the existing `tk-studio-assets` R2 bucket from the archived GrapesJS work.
4. **Publishing target (peeks into Phase 5).** Webstudio's `PUBLISHER_HOST` defaults to `wstd.work`. We'll want our own (`sites.tktechnology.org`?). Decide before too much template metadata bakes that domain in.
5. **Template selection order.** I recommend starting with `runway` or `stillwater` (representative, clean). Or you pick.

---

## Risks

- **Hand-rebuild fidelity drift.** Templates rebuilt manually will subtly differ from the originals. Mitigation: side-by-side screenshot review built into the runbook, design-system tokens enforced.
- **Auth gate.** Without Google/magic-link, clients can't actually use the product. Don't let 4.2 slip.
- **R2 not wired.** Client uploads will be lost or rejected. Wire R2 before opening to real clients.
- **Render starter plan (~512MB RAM).** With many concurrent builder sessions, may need to bump to Standard ($25/mo). Watch resource usage in 4.1.
- **Upstream Webstudio drift.** Webstudio.is pushes updates; our fork will diverge. Mitigation: the only fork edits are `apps/builder/server.mjs`, the `vercelPreset` gate in `vite.config.ts`, and TK login/branding — keep that surface small.

---

## Tooling reminders

- Build / deploy: push to `main` of `RellG/tk-webstudio` → Render auto-builds (~10 min). Custom server is `apps/builder/server.mjs`; health check is `/robots.txt`.
- Migrations: `pnpm migrations` (Webstudio's custom CLI; NOT plain `prisma migrate`).
- Screenshots for source comparison: `/tmp/shot.mjs` (Playwright-core + bundled chromium, 1200×750).
- Render logs / status: via API (key in CLAUDE.md / server config), or hook up the Render MCP in Claude Code for self-service.
- The TK Studio agent (`tk-studio-webstudio-programmer`) is the intended driver for the actual rebuild work. Sonnet 4.6 is appropriate for the repetitive template-build cycles; Opus for the 4.0 investigation and 4.1 first-template architecture work.

---

## Why a new Claude Code session for Phase 4

This document is the entry point. Start a fresh session, invoke the agent with: _"Read /home/cyphorlogs/tk-webstudio/PHASE_4_PLAN.md and /home/cyphorlogs/TkTechnology/CLAUDE.md, then begin Phase 4.0."_ That gives the agent clean context, current state, and the plan in one prompt — no stale Phase-3-deployment chatter to wade through.

---

_Generated 2026-05-22 — Phase 3 (hosting + DNS cutover) complete; this document gates the start of Phase 4._

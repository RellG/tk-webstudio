# TK templates — converter + provisioner

Pipeline for turning a `tk-gallery` template into a Webstudio project that
backs `studio.tktechnology.org/?template=<slug>`.

```
templates/<slug>.tsx        # hand-port of the source template into ws.element DSL
build.ts                    # renders <slug>.tsx -> out/<slug>.json (WebstudioData)
provision-template.ts       # inserts <slug>.json into Postgres as Project + Build + AuthToken
ensure-tk-system-user.ts    # idempotent: creates tk-system@tktechnology.org if missing
```

## Workflow per template

1. **Author** `templates/<slug>.tsx` mirroring the tk-gallery source. Preserve
   `data-brand-*` / `data-accent-*` attributes — they are the customize-flow
   contract.
2. **Build** the WebstudioData JSON:
   ```
   pnpm tsx scripts/tk-templates/build.ts <slug>
   ```
3. **Register** the slug in `TEMPLATE_REGISTRY` in `build.ts` (one-time per
   template).
4. **Provision** into the database (local dev → staging → prod):
   ```
   DATABASE_URL=... pnpm tsx scripts/tk-templates/provision-template.ts <slug>
   ```
   Emits the resulting `projectId` + `authToken`.
5. **Wire** the entry into `apps/builder/app/tk-templates.ts`:
   ```ts
   <slug>: { projectId: "<from step 4>", authToken: "<from step 4>", title: "<title>" },
   ```
6. **Deploy** (push to `main`, Render auto-deploys).
7. **Verify** `https://studio.tktechnology.org/?template=<slug>` opens the
   clone dialog.

## Idempotency

- `ensure-tk-system-user.ts` is safe to re-run.
- `provision-template.ts` is upsert-keyed on `Project.domain` =
  `tk-template-<slug>` so re-runs replace the project and its Build cleanly.
  Any user clones already minted from a previous version are unaffected
  (they live in their own Project rows).

## Fidelity notes

Hand-ports trade two pieces of the original tk-gallery experience for
durability inside Webstudio's data model:

- **Framer-motion entry animations** are omitted. Rendered surface at rest
  is visually equivalent.
- **Scroll-choreographed sections** (Story Moment, multi-stage
  IntersectionObserver pins) collapse to 1–2 reveal-on-enter beats. Affects
  flagship "designed to inspire" templates only.

Static layout, typography, colors, gradients, spacing, hover transitions,
and the `data-brand-*` contract all carry over 1:1.

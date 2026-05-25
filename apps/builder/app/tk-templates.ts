/**
 * TK Studio template registry.
 *
 * Maps marketing-site template slugs (e.g. `runway`) to the Webstudio project
 * that backs them in production. The dashboard loader at
 * `routes/_ui.dashboard.tsx` reads this map when the URL carries
 * `?template=<slug>` and routes the visitor into the existing clone flow,
 * cloning the template project into a fresh project owned by the visitor.
 *
 * Each entry references a real Webstudio project owned by the
 * `tk-system@tktechnology.org` user, with a `viewers` AuthorizationToken
 * that has `canClone = true`. Provisioning is documented in
 * `scripts/tk-templates/README.md` (see Phase 4.1).
 *
 * Entries are added template-by-template as projects get provisioned in
 * production. An entry whose `projectId` is `"TBD"` is treated as unknown
 * (the loader gracefully no-ops).
 */
export type TKTemplate = {
  projectId: string;
  authToken: string;
  title: string;
};

export const TK_TEMPLATES: Record<string, TKTemplate> = {
  // runway: { projectId: "TBD", authToken: "TBD", title: "Runway" },
};

export const getTKTemplate = (slug: string): TKTemplate | undefined => {
  const entry = TK_TEMPLATES[slug];
  if (entry === undefined || entry.projectId === "TBD") {
    return undefined;
  }
  return entry;
};

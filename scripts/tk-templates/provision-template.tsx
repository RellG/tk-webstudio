/**
 * Provision (or re-provision) a TK template into the Webstudio database.
 *
 *   DATABASE_URL=postgres://... pnpm tsx provision-template.tsx runway
 *
 * Steps:
 *   1. Ensure a `tk-system@tktechnology.org` User row exists.
 *   2. Upsert a Project keyed by `domain = "tk-template-<slug>"` owned by
 *      that user, marketplace status APPROVED, undeleted.
 *   3. Replace the project's Build with one populated from
 *      `out/<slug>.json` (produced by `build.tsx`). JSON columns are
 *      stringified array-of-tuples per Webstudio's schema.
 *   4. Upsert a `viewers` AuthorizationToken with canClone=true.
 *
 * Re-runnable. Existing Project + Build get replaced atomically; any
 * existing user clones from this template are unaffected (they live in
 * separate Project rows that were deep-copied at clone time).
 *
 * Emits the projectId + authToken on stdout so they can be added to
 * `apps/builder/app/tk-templates.ts`.
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const __dirname = dirname(fileURLToPath(import.meta.url));

const TK_SYSTEM_EMAIL =
  process.env.TK_SYSTEM_EMAIL ?? "tk-system@tktechnology.org";
const TK_SYSTEM_USERNAME = process.env.TK_SYSTEM_USERNAME ?? "tk-system";

type Tuple = [string, unknown];
type WebstudioJson = {
  instances: Tuple[];
  props: Tuple[];
  styles: Tuple[];
  styleSources: Tuple[];
  styleSourceSelections: Tuple[];
  dataSources: Tuple[];
  resources: Tuple[];
  breakpoints: Tuple[];
  assets: Tuple[];
  pages: {
    homePageId: string;
    rootFolderId: string;
    pages: Tuple[];
    folders: Tuple[];
  };
};

const ensureSystemUser = async () => {
  const existing = await prisma.user.findUnique({
    where: { email: TK_SYSTEM_EMAIL },
  });
  if (existing !== null) {
    return existing;
  }
  const user = await prisma.user.create({
    data: {
      email: TK_SYSTEM_EMAIL,
      username: TK_SYSTEM_USERNAME,
      provider: "tk-system",
    },
  });
  console.log(`created tk-system user: ${user.id}`);
  return user;
};

const provision = async (slug: string) => {
  const outPath = join(__dirname, "out", `${slug}.json`);
  const json = JSON.parse(await readFile(outPath, "utf8")) as WebstudioJson;

  const user = await ensureSystemUser();
  const domain = `tk-template-${slug}`;

  // Read or create Project. We don't use a real upsert because Webstudio's
  // Project.id is the relation FK for Build/AuthToken, and we want a stable
  // projectId across re-provisions to avoid orphaning entries in
  // TK_TEMPLATES.
  let project = await prisma.project.findFirst({
    where: { domain, isDeleted: false },
  });

  if (project === null) {
    project = await prisma.project.create({
      data: {
        title: titleCase(slug),
        domain,
        userId: user.id,
        marketplaceApprovalStatus: "APPROVED",
      },
    });
    console.log(`created project: ${project.id}`);
  } else {
    console.log(`reusing project: ${project.id}`);
  }

  // Replace Build. Webstudio stores each WebstudioData segment as a
  // JSON-serialized array-of-tuples (the Map's [key, value] entries).
  await prisma.build.deleteMany({ where: { projectId: project.id } });

  const pagesPayload = {
    homePage: pageFromTuple(
      json.pages.pages.find(([id]) => id === json.pages.homePageId)
    ),
    pages: json.pages.pages
      .filter(([id]) => id !== json.pages.homePageId)
      .map(([, page]) => page),
    folders: json.pages.folders.map(([, folder]) => folder),
  };

  await prisma.build.create({
    data: {
      projectId: project.id,
      pages: JSON.stringify(pagesPayload),
      breakpoints: JSON.stringify(json.breakpoints),
      styles: JSON.stringify(json.styles),
      styleSources: JSON.stringify(json.styleSources),
      styleSourceSelections: JSON.stringify(json.styleSourceSelections),
      props: JSON.stringify(json.props),
      dataSources: JSON.stringify(json.dataSources),
      resources: JSON.stringify(json.resources),
      instances: JSON.stringify(json.instances),
    },
  });

  // Ensure a viewers token with canClone=true. We look for one first so
  // existing deep-links keep working across re-provisions.
  let token = await prisma.authorizationToken.findFirst({
    where: {
      projectId: project.id,
      relation: "viewers",
      canClone: true,
    },
  });
  if (token === null) {
    token = await prisma.authorizationToken.create({
      data: {
        projectId: project.id,
        relation: "viewers",
        canClone: true,
        canCopy: true,
        name: "tk-template-clone",
      },
    });
    console.log(`created clone token`);
  } else {
    console.log(`reusing clone token`);
  }

  console.log("");
  console.log("------ register in apps/builder/app/tk-templates.ts ------");
  console.log(
    `  ${slug}: { projectId: "${project.id}", authToken: "${token.token}", title: "${project.title}" },`
  );
};

const pageFromTuple = (entry: Tuple | undefined) => {
  if (entry === undefined) {
    throw new Error("home page tuple missing from json.pages.pages");
  }
  return entry[1];
};

const titleCase = (slug: string) =>
  slug.charAt(0).toUpperCase() + slug.slice(1);

const main = async () => {
  const slug = process.argv[2];
  if (slug === undefined) {
    console.error("Usage: pnpm tsx provision-template.tsx <slug>");
    process.exit(1);
  }
  if (process.env.DATABASE_URL === undefined) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  await provision(slug);
  await prisma.$disconnect();
};

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

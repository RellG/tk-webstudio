/**
 * Build a WebstudioData JSON blob for a TK template.
 *
 *   pnpm tsx scripts/tk-templates/build.ts runway
 *
 * Reads the matching `./templates/{slug}.tsx`, wraps its exported body in a
 * single home page + a default 404, runs `renderData()` from
 * `@webstudio-is/template`, and writes `./out/{slug}.json`.
 *
 * The JSON is the exact shape `provision-template.ts` will insert into the
 * Webstudio `Build` row's JSON columns (instances, props, styles,
 * styleSources, styleSourceSelections, dataSources, resources, breakpoints,
 * assets) plus a `pages` map.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { nanoid } from "nanoid";
import { initialBreakpoints, type Pages } from "@webstudio-is/sdk";
import { renderData, ws } from "@webstudio-is/template";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEMPLATE_REGISTRY = {
  runway: {
    bodyExport: "runwayHero",
    title: "Runway",
    description:
      "Ecom apparel — Spring/Summer drop. Fashion brand template with editorial hero + capsule grid.",
  },
} as const;

type TemplateSlug = keyof typeof TEMPLATE_REGISTRY;

const main = async () => {
  const slug = process.argv[2] as TemplateSlug | undefined;
  if (slug === undefined || TEMPLATE_REGISTRY[slug] === undefined) {
    const known = Object.keys(TEMPLATE_REGISTRY).join(", ");
    console.error(`Usage: pnpm tsx build.ts <slug>\n  known slugs: ${known}`);
    process.exit(1);
  }
  const meta = TEMPLATE_REGISTRY[slug];

  const modulePath = join(__dirname, "templates", `${slug}.tsx`);
  const mod = await import(pathToFileURL(modulePath).href);
  const body = mod[meta.bodyExport];
  if (body === undefined) {
    throw new Error(
      `Template ${slug} did not export ${meta.bodyExport} from ${modulePath}`
    );
  }

  const breakpoints = initialBreakpoints.map((bp) => ({ ...bp, id: nanoid() }));
  const homePageId = nanoid();
  const homeBodyId = nanoid();
  const notFoundPageId = nanoid();
  const notFoundBodyId = nanoid();

  const data = renderData(
    <>
      <ws.element ws:tag="body" ws:id={homeBodyId}>
        {body}
      </ws.element>
      <ws.element ws:tag="body" ws:id={notFoundBodyId}>
        <ws.element ws:tag="div">Not found</ws.element>
      </ws.element>
    </>,
    nanoid,
    breakpoints
  );

  const pages: Pages = {
    homePageId,
    rootFolderId: "root",
    pages: new Map([
      [
        homePageId,
        {
          id: homePageId,
          name: "Home",
          path: "",
          title: `"${meta.title}"`,
          meta: { description: `"${meta.description}"` },
          rootInstanceId: homeBodyId,
        },
      ],
      [
        notFoundPageId,
        {
          id: notFoundPageId,
          name: "404",
          path: "/*",
          title: `"Page not found"`,
          meta: { status: "404", excludePageFromSearch: "false" },
          rootInstanceId: notFoundBodyId,
        },
      ],
    ]),
    folders: new Map([
      [
        "root",
        {
          id: "root",
          name: "Root",
          slug: "",
          children: [homePageId, notFoundPageId],
        },
      ],
    ]),
  };

  // Serialize each column EXACTLY as Webstudio's createBuild does
  // (packages/project-build/src/db/build.ts): every data column is
  // `JSON.stringify(Array.from(map.values()))` — a flat array of objects,
  // NOT [key, value] entry tuples. The builder's parseCompactBuild reads
  // them back with `JSON.parse(col) as Item[]`, so an entry-tuple shape
  // makes the builder crash ("Cannot read properties of undefined").
  const serializeValues = (map: Map<unknown, unknown>) =>
    JSON.stringify(Array.from(map.values()));

  // pages mirrors serializePages() output (homePageId + flat Page[]/Folder[]),
  // which migratePages() recognizes via isSerializedPages().
  const serializedPages = JSON.stringify({
    meta: pages.meta,
    compiler: pages.compiler,
    redirects: pages.redirects,
    homePageId: pages.homePageId,
    rootFolderId: pages.rootFolderId,
    pages: Array.from(pages.pages.values()),
    folders: Array.from(pages.folders.values()),
  });

  const columns = {
    pages: serializedPages,
    breakpoints: serializeValues(data.breakpoints),
    styles: serializeValues(data.styles),
    styleSources: serializeValues(data.styleSources),
    styleSourceSelections: serializeValues(data.styleSourceSelections),
    props: serializeValues(data.props),
    dataSources: serializeValues(data.dataSources),
    resources: serializeValues(data.resources),
    instances: serializeValues(data.instances),
  };

  const outDir = join(__dirname, "out");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${slug}.json`);
  await writeFile(outPath, JSON.stringify(columns, null, 2));

  const counts = {
    instances: data.instances.size,
    props: data.props.size,
    styles: data.styles.size,
    styleSources: data.styleSources.size,
    breakpoints: data.breakpoints.size,
  };
  console.log(`built ${slug} -> ${outPath}`);
  console.log(counts);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

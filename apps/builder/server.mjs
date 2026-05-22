// TK Studio production server.
//
// This is a minimal reimplementation of `remix-serve`'s production path
// (compression + static asset serving + the Remix request handler) with one
// addition: `app.set("trust proxy", true)`.
//
// Render terminates TLS and forwards to the app over plain HTTP (and
// Cloudflare sits in front of the dashboard domain). Stock `remix-serve`
// does not trust the proxy, so Express reports the connection as HTTP and
// `request.url` comes through as `http://...`. Webstudio derives origins
// from `request.url`; with `http://` the project-OAuth `redirect_uri` check
// in `app/routes/oauth.ws.authorize.tsx` rejects every builder subdomain
// ("redirect_uri does not match the registered redirect URIs").
//
// Trusting the proxy makes Express honor `X-Forwarded-Proto`, so `request.url`
// is correctly `https://` and the builder OAuth handshake succeeds.

import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Run from apps/builder so build/* and public/* resolve as remix-serve expects.
process.chdir(path.dirname(fileURLToPath(import.meta.url)));

const build = await import(path.resolve("build/server/index.js"));

installGlobals({ nativeFetch: build.future?.v3_singleFetch ?? false });

const app = express();

// The reason this file exists — see the header comment.
app.set("trust proxy", true);

app.disable("x-powered-by");
app.use(compression());
app.use(
  build.publicPath,
  express.static(build.assetsBuildDirectory, { immutable: true, maxAge: "1y" })
);
app.use(express.static("public", { maxAge: "1h" }));
app.use(morgan("tiny"));
app.all("*", createRequestHandler({ build, mode: process.env.NODE_ENV }));

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, () => {
  console.log(`[tk-studio] listening on http://localhost:${port}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => server.close((err) => err && console.error(err)));
}

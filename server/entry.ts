// В production Railway сам инжектит переменные — не даём локальному .env перебить их.
if (process.env["NODE_ENV"] !== "production") {
  await import("dotenv/config");
}

import { validateServerEnv } from "../src/server/validateEnv.ts";
import { serve } from "@hono/node-server";

validateServerEnv();

const { default: app } = await import("../src/server/index.tsx");

const port = Number(process.env["PORT"] || 4000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`BTT Nexus API listening on http://localhost:${info.port}`);
});

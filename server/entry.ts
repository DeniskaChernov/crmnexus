import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "../src/supabase/functions/server/index.tsx";

const port = Number(process.env["PORT"] || 4000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`BTT Nexus API listening on http://localhost:${info.port}`);
});

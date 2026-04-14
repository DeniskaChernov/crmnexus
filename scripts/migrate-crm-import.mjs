import fs from "node:fs";
import path from "node:path";

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx|ts|js)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const root = process.cwd();
const skip = (f) => {
  const u = f.replace(/\\/g, "/");
  return (
    u.includes("src/server/index") ||
    u.endsWith("serviceDb.ts")
  );
};

let updated = 0;
for (const file of walk(path.join(root, "src"))) {
  if (skip(file)) continue;
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  s = s.replace(
    /import\s*\{\s*supabase\s*\}\s*from\s*['"][^'"]+['"];?\s*\n?/gm,
    'import { crm } from "@/lib/crmClient.ts";\n',
  );
  s = s.replace(/\bsupabase\./g, "crm.");
  s = s.replace(/\bsupabase\b/g, "crm");
  if (s !== orig) {
    fs.writeFileSync(file, s);
    updated++;
    console.log(path.relative(root, file));
  }
}
console.log("Updated", updated, "files");

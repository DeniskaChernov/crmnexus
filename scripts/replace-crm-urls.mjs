import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "src");

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name)) {
      if (p.includes(`${path.sep}lib${path.sep}crmApi.ts`)) continue;
      if (p.includes(`${path.sep}supabase${path.sep}functions${path.sep}server`)) continue;
      out.push(p);
    }
  }
  return out;
}

function relImport(fromFile) {
  const rel = path.relative(path.dirname(fromFile), path.join(root, "lib", "crmApi.ts"));
  const norm = rel.split(path.sep).join("/");
  return norm.startsWith(".") ? norm : `./${norm}`;
}

for (const file of walk(root)) {
  let s = fs.readFileSync(file, "utf8");
  if (!s.includes("projectId") && !s.includes("publicAnonKey")) continue;

  s = s.replace(
    /https:\/\/\$\{projectId\}\.supabase\.co\/functions\/v1\/make-server-f9553289(\/[^"'`\s)]+)/g,
    (_, u) => `crmUrl('${u}')`,
  );

  s = s.replace(/import\s*\{\s*projectId,\s*publicAnonKey\s*\}\s*from\s*['"][^'"]+['"];?\s*\n/g, "");
  s = s.replace(/import\s*\{\s*publicAnonKey,\s*projectId\s*\}\s*from\s*['"][^'"]+['"];?\s*\n/g, "");

  if (!s.includes("crmUrl") || file.endsWith("crmApi.ts")) {
    fs.writeFileSync(file, s);
    continue;
  }

  if (!s.match(/from\s+['"][^'"]*crmApi['"]/)) {
    const imp = `import { crmUrl, authHeaders } from '${relImport(file)}';\n`;
    const first = s.search(/^import\s/m);
    if (first >= 0) {
      const lineEnd = s.indexOf("\n", first);
      s = s.slice(0, lineEnd + 1) + imp + s.slice(lineEnd + 1);
    } else {
      s = imp + s;
    }
  }

  s = s.replace(
    /headers:\s*\{\s*'Authorization':\s*`Bearer \$\{publicAnonKey\}`\s*\}/g,
    "headers: { ...authHeaders(false) }",
  );
  s = s.replace(
    /headers:\s*\{\s*"Authorization":\s*`Bearer \$\{publicAnonKey\}`\s*\}/g,
    "headers: { ...authHeaders(false) }",
  );
  s = s.replace(
    /headers:\s*\{\s*'Authorization':\s*`Bearer \$\{publicAnonKey\}`,\s*'Content-Type':\s*'application\/json'\s*\}/g,
    "headers: { ...authHeaders() }",
  );
  s = s.replace(
    /headers:\s*\{\s*"Authorization":\s*`Bearer \$\{publicAnonKey\}",\s*"Content-Type":\s*"application\/json"\s*\}/g,
    "headers: { ...authHeaders() }",
  );
  s = s.replace(
    /headers:\s*\{\s*'Authorization':\s*`Bearer \$\{publicAnonKey\}`,\s*'Content-Type':\s*'application\/json',\s*\}/g,
    "headers: { ...authHeaders() }",
  );

  s = s.replace(
    /\{\s*'Authorization':\s*`Bearer \$\{publicAnonKey\}`\s*\}/g,
    "{ ...authHeaders(false) }",
  );
  s = s.replace(
    /\{\s*'Authorization':\s*`Bearer \$\{publicAnonKey\}`,\s*'Content-Type':\s*'application\/json'\s*\}/g,
    "{ ...authHeaders() }",
  );

  s = s.replace(
    /const headers = \{\s*'Authorization':\s*`Bearer \$\{publicAnonKey\}`\s*\}/g,
    "const headers = { ...authHeaders(false) }",
  );

  fs.writeFileSync(file, s);
  console.log("patched", path.relative(process.cwd(), file));
}

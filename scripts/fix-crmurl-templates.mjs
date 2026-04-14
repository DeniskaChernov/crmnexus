import fs from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(tsx|ts)$/.test(e.name)) {
      if (p.includes(`${path.sep}src${path.sep}server${path.sep}`)) continue;
      out.push(p);
    }
  }
  return out;
}

for (const file of walk(path.join(process.cwd(), "src"))) {
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  s = s.replace(/`crmUrl\(/g, "`${crmUrl(");
  s = s.replace(/(\$\{crmUrl\([^)]+\))(?=[`,])/g, "$1}");
  s = s.replace(/(\$\{crmUrl\([^)]+\))(?=`)/g, "$1}");
  if (s !== orig) {
    fs.writeFileSync(file, s);
    console.log("fixed", path.relative(process.cwd(), file));
  }
}

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "tailwindcss";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceCssPath = path.join(root, "src/styles/tailwind.source.css");
const outputCssPath = path.join(root, "src/styles/tailwind.generated.css");
const scanRoots = ["index.html", "src", "components"];
const extensions = new Set([".html", ".ts", ".tsx"]);

async function walk(entry) {
  const absolute = path.join(root, entry);
  try {
    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) {
      const children = await fs.readdir(absolute);
      const files = await Promise.all(children.map((child) => walk(path.join(entry, child))));
      return files.flat();
    }
    return extensions.has(path.extname(absolute)) ? [absolute] : [];
  } catch {
    return [];
  }
}

function extractCandidates(content) {
  // Extract all class-like strings cleanly preserving brackets and colons
  const matches = content.match(/[\w\-/:[\]#%.,_]+/g) ?? [];
  return matches
    .map((candidate) => candidate.replace(/^[('"`]+|[)'"`]+$/g, ""))
    .filter((candidate) => {
      if (!candidate || candidate.length < 2) return false;
      if (candidate.startsWith("http://") || candidate.startsWith("https://")) return false;
      return true;
    });
}

async function loadStylesheet(id) {
  let file;

  if (id === "tailwindcss") {
    file = path.join(root, "node_modules/tailwindcss/index.css");
  } else if (id.startsWith("./")) {
    file = path.join(root, "node_modules/tailwindcss", id);
  } else {
    file = path.join(root, "node_modules", id);
  }

  return {
    base: path.dirname(file),
    content: await fs.readFile(file, "utf8"),
  };
}

const files = (await Promise.all(scanRoots.map(walk))).flat();
const candidates = new Set();

for (const file of files) {
  const content = await fs.readFile(file, "utf8");
  for (const candidate of extractCandidates(content)) {
    candidates.add(candidate);
  }
}

const sourceCss = await fs.readFile(sourceCssPath, "utf8");
const compiler = await compile(sourceCss, {
  from: sourceCssPath,
  loadStylesheet,
});

const generated = compiler.build([...candidates]);
await fs.writeFile(outputCssPath, generated);

console.log(`Generated ${path.relative(root, outputCssPath)} with ${candidates.size} candidates.`);

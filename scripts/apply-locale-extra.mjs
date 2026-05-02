/**
 * Merges scripts/data/locale-extra.json into nodalia-i18n.js partial locales (pt/ru/el/zh/ro).
 * Run from repo root: node scripts/apply-locale-extra.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const EXTRA_PATH = path.join(__dirname, "data", "locale-extra.json");
const I18N_PATH = path.join(ROOT, "nodalia-i18n.js");

/** JSON → JS literal lines; top-level keys align at baseSpaces (6 = sibling of navigationMusicAssist). */
function embedBlock(obj, baseSpaces = 6) {
  let j = JSON.stringify(obj, null, 2);
  j = j.replace(/"([a-zA-Z_$][\w$]*)"\s*:/g, "$1:");
  const lines = j.split("\n");
  const innerLines = lines.slice(1, -1);
  return innerLines
    .map((line) => {
      const trimmedLeft = line.replace(/^\s+/, "");
      const jsonIndent = line.length - trimmedLeft.length;
      const target = baseSpaces + jsonIndent - 2;
      return `${" ".repeat(Math.max(0, target))}${trimmedLeft}`;
    })
    .join("\n");
}

const extra = JSON.parse(fs.readFileSync(EXTRA_PATH, "utf8"));

const patches = [
  {
    old: `        browseFallback: "Item",
      },
    },
    ru: {`,
    inject: extra.pt,
  },
  {
    old: `        browseFallback: "Элемент",
      },
    },
    el: {`,
    inject: extra.ru,
  },
  {
    old: `        browseFallback: "Στοιχείο",
      },
    },
    zh: {`,
    inject: extra.el,
  },
  {
    old: `        browseFallback: "项目",
      },
    },
    ro: {`,
    inject: extra.zh,
  },
  {
    old: `        browseFallback: "Element",
      },
    },
  };`,
    inject: extra.ro,
  },
];

let src = fs.readFileSync(I18N_PATH, "utf8");

for (const { old, inject } of patches) {
  if (!src.includes(old)) {
    console.error("Missing anchor in nodalia-i18n.js");
    process.exit(1);
  }
  const lines = old.split("\n");
  const header = lines.slice(0, 2).join("\n");
  const tail = lines.slice(2).join("\n");
  const block = embedBlock(inject);
  const neu = `${header}\n${block}\n${tail}`;
  src = src.replace(old, neu);
}

fs.writeFileSync(I18N_PATH, src);
console.log("Updated nodalia-i18n.js with locale-extra blocks.");

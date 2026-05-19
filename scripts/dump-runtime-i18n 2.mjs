/**
 * Maintenance / recovery: evaluates a **legacy** `nodalia-i18n.js` that still defines
 * `const VACUUM_ERROR_LABELS` next to `PACK`, and writes `i18n/runtime/<lang>.json`.
 * Current trees live in `i18n/runtime/` already; this script is only for re-exporting
 * from an old single-file backup. Run: `node scripts/dump-runtime-i18n.mjs`
 */
import fs from "fs";
import path from "path";
import vm from "node:vm";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const i18nPath = path.join(root, "nodalia-i18n.js");

const src = fs.readFileSync(i18nPath, "utf8");
if (!src.includes("const VACUUM_ERROR_LABELS = {")) {
  console.error(
    "dump-runtime-i18n: nodalia-i18n.js has no VACUUM_ERROR_LABELS block (already migrated). Edit i18n/runtime/*.json instead.",
  );
  process.exit(1);
}

const patched = src.replace(
  "  window.NodaliaI18n = {",
  "  globalThis.__NODALIA_I18N_DUMP__ = { PACK, VACUUM_ERROR_LABELS };\n  window.NodaliaI18n = {",
);

const sandbox = {
  window: { customCards: [] },
  console,
  globalThis: {},
};
sandbox.globalThis = sandbox;

vm.runInNewContext(patched, sandbox, { filename: "nodalia-i18n.js", timeout: 120_000 });

const dump = sandbox.__NODALIA_I18N_DUMP__;
if (!dump?.PACK) {
  console.error("dump-runtime-i18n: could not read PACK from VM context.");
  process.exit(1);
}

const { PACK, VACUUM_ERROR_LABELS } = dump;
const enVacuum = VACUUM_ERROR_LABELS?.en || {};
const outDir = path.join(root, "i18n", "runtime");
fs.mkdirSync(outDir, { recursive: true });

const RUNTIME_LANGS = Object.keys(PACK).sort((a, b) => {
  if (a === "en") {
    return -1;
  }
  if (b === "en") {
    return 1;
  }
  return a.localeCompare(b);
});

for (const lang of RUNTIME_LANGS) {
  const packLang = PACK[lang] && typeof PACK[lang] === "object" ? { ...PACK[lang] } : {};
  const vac = VACUUM_ERROR_LABELS?.[lang] || {};
  packLang.vacuumErrorLabels = { ...enVacuum, ...vac };
  const outPath = path.join(outDir, `${lang}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(packLang, null, 2)}\n`);
  console.log("wrote", path.relative(root, outPath));
}

console.log("dump-runtime-i18n: done.");

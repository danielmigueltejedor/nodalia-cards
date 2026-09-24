/**
 * Nest HTMLElement card/editor classes inside memoized loaders so V8/JSC
 * lazy-compile unused dashboard types, then point each index.ts at
 * NodaliaUtils.defineLazyCustomElement.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const cardsDir = path.join(root, "src", "cards");

function isRegexStart(source, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /[ \t]/.test(source[cursor])) {
    cursor -= 1;
  }
  if (cursor < 0) {
    return true;
  }
  const previous = source[cursor];
  if ("(,[{=:!&|?+;~*%<>^".includes(previous)) {
    return true;
  }
  const word = source.slice(Math.max(0, cursor - 12), cursor + 1).match(/([A-Za-z_]+)$/);
  return Boolean(word && ["return", "typeof", "case", "throw", "in", "of", "new", "void", "delete"].includes(word[1]));
}

function skipQuoted(source, start) {
  const quote = source[start];
  let i = start + 1;
  if (quote === "`") {
    while (i < source.length) {
      if (source[i] === "\\") {
        i += 2;
        continue;
      }
      if (source[i] === "`") {
        return i + 1;
      }
      if (source[i] === "$" && source[i + 1] === "{") {
        i = skipBlock(source, i + 1);
        continue;
      }
      i += 1;
    }
    throw new Error("Unterminated template string");
  }
  while (i < source.length) {
    if (source[i] === "\\") {
      i += 2;
      continue;
    }
    if (source[i] === quote) {
      return i + 1;
    }
    if (quote !== "`" && (source[i] === "\n" || source[i] === "\r")) {
      throw new Error("Unterminated string");
    }
    i += 1;
  }
  throw new Error("Unterminated string");
}

function skipRegex(source, start) {
  let i = start + 1;
  let inClass = false;
  while (i < source.length) {
    const char = source[i];
    if (char === "\\") {
      i += 2;
      continue;
    }
    if (char === "[" ) {
      inClass = true;
    } else if (char === "]" && inClass) {
      inClass = false;
    } else if (char === "/" && !inClass) {
      i += 1;
      while (i < source.length && /[a-z]/i.test(source[i])) {
        i += 1;
      }
      return i;
    }
    if (char === "\n") {
      throw new Error("Unterminated regex");
    }
    i += 1;
  }
  throw new Error("Unterminated regex");
}

function skipBlock(source, braceIndex) {
  if (source[braceIndex] !== "{") {
    throw new Error("skipBlock expects '{'");
  }
  let depth = 0;
  let i = braceIndex;
  while (i < source.length) {
    const char = source[i];
    if (char === "/" && source[i + 1] === "/") {
      const newline = source.indexOf("\n", i);
      i = newline === -1 ? source.length : newline + 1;
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      i = skipQuoted(source, i);
      continue;
    }
    if (char === "/" && isRegexStart(source, i)) {
      i = skipRegex(source, i);
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return i + 1;
      }
    }
    i += 1;
  }
  throw new Error("Unbalanced braces");
}

function transformConstructor(classSource) {
  const match = classSource.match(/\n  constructor\(\) \{/);
  if (!match) {
    throw new Error("HTMLElement class is missing constructor()");
  }
  const headerIndex = classSource.indexOf(match[0]);
  const braceIndex = headerIndex + match[0].lastIndexOf("{");
  const end = skipBlock(classSource, braceIndex);
  const body = classSource.slice(braceIndex + 1, end - 1);
  const superMatch = body.match(/^\s*super\(\);\s*/);
  if (!superMatch) {
    throw new Error("constructor() must start with super();");
  }
  const initBody = body.slice(superMatch[0].length);
  const replacement = `\n  constructor() {
    super();
    this._nodaliaConstruct();
  }

  _nodaliaConstruct() {${initBody}  }`;
  return classSource.slice(0, headerIndex) + replacement + classSource.slice(end);
}

function wrapClass(source, className, start) {
  const braceIndex = source.indexOf("{", start);
  const end = skipBlock(source, braceIndex);
  let classSource = source.slice(start, end);
  if (classSource.includes("_nodaliaConstruct()")) {
    return source;
  }
  classSource = transformConstructor(classSource);
  classSource = classSource.replace(/^export class /, "class ");
  const wrapped = `let _lazy${className};
export function load${className}() {
  if (_lazy${className}) {
    return _lazy${className};
  }
${classSource}
  _lazy${className} = ${className};
  return ${className};
}`;
  return source.slice(0, start) + wrapped + source.slice(end);
}

function wrapFile(filePath) {
  let source = fs.readFileSync(filePath, "utf8");
  const matches = [...source.matchAll(/^export class (\w+) extends HTMLElement \{/gm)];
  if (!matches.length) {
    return false;
  }
  for (const match of [...matches].reverse()) {
    const className = match[1];
    if (source.includes(`export function load${className}(`)) {
      continue;
    }
    source = wrapClass(source, className, match.index);
  }
  fs.writeFileSync(filePath, source);
  return true;
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, acc);
      continue;
    }
    if (!entry.name.endsWith(".ts")) {
      continue;
    }
    if (!/(-card|-editor)\.ts$/.test(entry.name)) {
      continue;
    }
    acc.push(fullPath);
  }
  return acc;
}

const files = walk(cardsDir);
let wrapped = 0;
for (const filePath of files) {
  try {
    if (wrapFile(filePath)) {
      wrapped += 1;
      console.log("wrapped", path.relative(root, filePath));
    }
  } catch (error) {
    throw new Error(`${path.relative(root, filePath)}: ${error.message}`);
  }
}

function patchIndex(filePath) {
  let source;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  if (source.includes("defineLazyCustomElement(CARD_TAG")) {
    return;
  }
  const cardImport = source.match(/import \{ (Nodalia\w+) \} from "(\.\/(?:[\w-]+-card))";/);
  const editorImport = source.match(/import \{ (Nodalia\w+) \} from "(\.\/(?:[\w-]+-editor))";/);
  if (!cardImport || !editorImport) {
    throw new Error(`Could not find card/editor imports in ${path.relative(root, filePath)}`);
  }
  const [, cardClass, cardPath] = cardImport;
  const [, editorClass, editorPath] = editorImport;
  source = source.replace(cardImport[0], `import { load${cardClass} } from "${cardPath}";`);
  source = source.replace(editorImport[0], `import { load${editorClass} } from "${editorPath}";`);
  source = source.replace(
    /if \(!customElements\.get\(CARD_TAG\)\) \{\s*customElements\.define\(CARD_TAG, \w+\);\s*\}\s*if \(!customElements\.get\(EDITOR_TAG\)\) \{\s*customElements\.define\(EDITOR_TAG, \w+\);\s*\}/,
    `window.NodaliaUtils.defineLazyCustomElement(CARD_TAG, load${cardClass}, { editorTag: EDITOR_TAG });
window.NodaliaUtils.defineLazyCustomElement(EDITOR_TAG, load${editorClass});`,
  );
  if (source.includes("customElements.define(CARD_TAG")) {
    throw new Error(`Failed to rewrite defines in ${path.relative(root, filePath)}`);
  }
  fs.writeFileSync(filePath, source);
  console.log("patched index", path.relative(root, filePath));
}

for (const name of fs.readdirSync(cardsDir)) {
  patchIndex(path.join(cardsDir, name, "index.ts"));
}

function patchStandalone(filePath, importName) {
  let source;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
  const loaderName = `load${importName}`;
  const hadDirectImport = source.includes(`import { ${importName} } from`);
  const hadLoaderImport = source.includes(`import { ${loaderName} } from`);

  if (!hadDirectImport && !hadLoaderImport) {
    return;
  }

  if (hadDirectImport) {
    source = source.replace(
      `import { ${importName} } from`,
      `import { ${loaderName} } from`,
    );
  }

  // Rewrite bare class references to loader calls. The lookbehind skips the
  // import binding itself (`loadNodalia…`) so we never emit `loadload…`.
  const next = source.replace(
    new RegExp(`(?<!\\w)(?<!load)${importName}(?!\\w)`, "g"),
    `${loaderName}()`,
  );

  if (next === source && hadLoaderImport) {
    return;
  }

  fs.writeFileSync(filePath, next);
  console.log("patched standalone", path.relative(root, filePath));
}

patchStandalone(path.join(cardsDir, "climate", "standalone.ts"), "NodaliaClimateCardEditorLegacy");
patchStandalone(path.join(cardsDir, "graph", "standalone.ts"), "NodaliaGraphCardEditorLegacy");
patchStandalone(path.join(cardsDir, "power-flow", "standalone.ts"), "NodaliaPowerFlowCardEditor");

console.log(`Wrapped ${wrapped} card/editor files`);

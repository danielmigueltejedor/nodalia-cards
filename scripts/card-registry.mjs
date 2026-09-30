import fs from 'node:fs';

// Build-time data, never imported into the browser's runtime graph.
export const CARD_REGISTRY = Object.freeze(JSON.parse(
  fs.readFileSync(new URL('../src/cards/registry.json', import.meta.url), 'utf8'),
).map(card => Object.freeze(card)));
for (const field of ['id', 'tag', 'editorTag', 'entry', 'standalone', 'artifact']) {
  if (new Set(CARD_REGISTRY.map(card => card[field])).size !== CARD_REGISTRY.length) {
    throw new Error(`Duplicate card registry ${field}`);
  }
}

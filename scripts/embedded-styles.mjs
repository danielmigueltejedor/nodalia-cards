import fs from 'node:fs/promises';
import { transform } from 'esbuild';

/** Embed component CSS without changing declarations, selectors or browser prefixes. */
export function embeddedStylesPlugin() {
  return {
    name: 'embedded-component-styles',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async ({ path }) => {
        const source = await fs.readFile(path, 'utf8');
        const result = await transform(source, {
          loader: 'css', sourcefile: path, minifyWhitespace: true,
          minifySyntax: false, minifyIdentifiers: false,
        });
        return { contents: result.code.trim(), loader: 'text', warnings: result.warnings };
      });
    },
  };
}

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "nodalia-*.js",
      "scripts/**/*.mjs",
      "tests/**/*.mjs",
      "src/cards/climate/climate-card.ts",
      "src/cards/climate/climate-editor.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/ban-ts-comment": ["error", {
        "ts-nocheck": "allow-with-description",
        "minimumDescriptionLength": 10,
      }],
      "no-console": "off",
    },
  },
);

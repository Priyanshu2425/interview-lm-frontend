import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

      /* The folder structure's one enforceable convention: a feature is
         reached through its barrel, never through its internals. Refactoring
         inside a feature then cannot break anything outside it. */
      "no-restricted-imports": ["error", {
        patterns: [
          {
            group: ["@/features/*/*", "../*/components/*", "../*/hooks/*"],
            message: "Import a feature through its index.ts. Its internals are private.",
          },
          {
            group: ["@/ui/*", "!@/ui/styles/*"],
            message: "Import design system primitives from @/ui, not from a primitive's file.",
          },
        ],
      }],
    },
  },
  {
    /* A feature may reach into its own internals, and the routes file composes
       features by name. */
    files: ["src/features/**", "src/routes/**", "src/main.tsx"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    /* Tests reach the unit they test, including a design system internal. */
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}", "src/test/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    /* The router module is a router, not a component module. */
    files: ["src/routes/index.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
);

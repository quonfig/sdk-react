import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Flat config (ESLint 10). Replaces the eslintrc + eslint-config-airbnb setup.
// Bead qfg-ucgz records the full rule-coverage delta from dropping airbnb --
// the short version is that the ~150 rules lost are airbnb style opinions, and
// what replaces them is the mainstream preset stack below.
export default tseslint.config(
  // Formerly .eslintignore territory -- nothing generated should be linted.
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**"],
  },

  // Only TS/TSX is linted; that is what `eslint --ext .ts,.tsx src/` did before.
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      react.configs.flat.recommended,
      reactHooks.configs.flat["recommended-latest"],
      // Must stay last: turns off everything that fights prettier.
      prettier,
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        // Pinned, NOT "detect": eslint-plugin-react's version auto-detection
        // calls the `context.getFilename()` API that ESLint 10 removed, which
        // crashes the run. Pinning also makes the lint deterministic across the
        // CI matrix, which installs both React 18 and 19 -- version-gated rules
        // (react/no-deprecated) now judge against the newest supported React
        // either way, matching what auto-detection resolved to locally before.
        version: "19.0",
      },
    },
    rules: {
      // Incompatible with typescript-eslint's no-unused-vars; the TS-aware one
      // below is the real check.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",

      // React-Compiler-era rules from eslint-plugin-react-hooks v7. The hooks
      // plugin was never wired up before this config, so these fire on
      // longstanding, deliberate provider internals: the module-level Quonfig
      // singleton is mutated in place (clientName/clientVersion, the test
      // provider's get/isEnabled overrides), a ref is read during render to
      // decide whether to mint a nested client, and initialFlags hydration
      // sets state from an effect. Satisfying them means refactoring shipped
      // 1.0.0 provider behavior, which is not a lint migration. Left off
      // deliberately; rules-of-hooks, exhaustive-deps and the rest of the v7
      // set stay on. Tracked in qfg-ucgz.
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },

  {
    files: ["src/__tests__/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      // Carried over from the old eslintrc test override. Not enabled by
      // typescript-eslint's `recommended` in v8 (it moved to `strict`), so this
      // is inert today -- kept so tests stay allowed to assert on
      // definitely-present values if the config ever tightens.
      "@typescript-eslint/no-non-null-assertion": "off",
      // Test components deliberately assign the client / state setter they
      // render with to an outer `let` so the assertions can drive it.
      "react-hooks/globals": "off",
    },
  }
);

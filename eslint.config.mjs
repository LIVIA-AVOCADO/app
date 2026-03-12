import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
    // Generated database types from Supabase CLI:
    "types/database.ts",
    "types/database-old.ts",
    // Large dashboard types file:
    "types/dashboard.ts",
  ]),
  // Custom strict rules for LIVIA MVP
  {
    rules: {
      // Prevent large files (200 lines max - warn to encourage modularization)
      "max-lines": ["warn", { max: 200, skipBlankLines: true, skipComments: true }],

      // TypeScript strict rules
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],

      // Code quality
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",

      // React/Next.js best practices
      "react-hooks/exhaustive-deps": "error",
      "react/jsx-no-useless-fragment": "warn",
    }
  }
]);

export default eslintConfig;

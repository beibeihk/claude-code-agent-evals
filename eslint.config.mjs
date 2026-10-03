import js from "@eslint/js";
import ts from "typescript-eslint";
import globals from "globals";
export default ts.config(
  { ignores: ["bin/**", "node_modules/**", ".tmp/**", "examples/**"] },
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: { "no-empty": ["error", { allowEmptyCatch: true }] },
  },
);

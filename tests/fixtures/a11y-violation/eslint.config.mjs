import jsxA11y from "eslint-plugin-jsx-a11y";

export default [
  {
    files: ["**/*.{tsx,jsx}"],
    plugins: { "jsx-a11y": jsxA11y },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "jsx-a11y/alt-text": "error",
    },
  },
];

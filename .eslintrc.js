module.exports = {
  env: {
    browser: true,
    es2021: true,
    jest: true,
  },
  extends: [
    "plugin:react/recommended",
    "airbnb",
    "plugin:import/typescript",
    "plugin:@typescript-eslint/recommended",
    // Make sure this is always the last configuration in the extends array.
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint"],
  rules: {
    "react/require-default-props": "off", // default props are deprecated and shouldn't be used: https://sophiabits.com/blog/stop-using-defaultprops
    "no-unused-vars": "off", // this rule is incompatible with typescript-eslint's 'no-unused-vars
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "react/jsx-filename-extension": [2, { extensions: [".js", ".jsx", ".ts", ".tsx"] }],
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        ts: "never",
        tsx: "never",
      },
    ],
  },
  overrides: [
    {
      files: ["*.test.ts", "*.test.tsx"],
      rules: {
        "react/jsx-props-no-spreading": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "import/no-extraneous-dependencies": "off",
      },
    },
  ],
};

import { defineConfig } from "tsup";
import { execSync } from "child_process";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  outExtension({ format }) {
    return {
      js: format === "cjs" ? ".cjs" : ".mjs",
    };
  },
  external: ["react", "@reforge-com/javascript"],
  minify: false,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  onSuccess: async () => {
    // Run bundle creation only if not in CI
    if (!process.env.CI) {
      console.log("Creating bundle...");
      execSync("npm run bundle", { stdio: "inherit" });
    } else {
      console.log("Skipping bundle on CI");
    }
  },
});

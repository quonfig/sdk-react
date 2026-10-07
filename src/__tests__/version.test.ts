import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import reactSdkVersion from "../version";

// src/version.ts is the clientVersion stamp the provider reports in telemetry. It is generated from
// package.json by scripts/generate-version.mjs, which `yarn build` runs (Yarn 4 skips `pre*`
// scripts, so a `prebuild` hook never fired and 1.3.0/1.3.1 shipped stamped "1.3.0").
describe("version stamp", () => {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, "../../package.json"), "utf8"));

  it("src/version.ts matches the package.json version", () => {
    expect(reactSdkVersion).toBe(pkg.version);
  });
});

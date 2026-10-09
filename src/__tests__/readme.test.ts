import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// @quonfig/javascript is a peer dependency. npm 7+ installs peers automatically, but Yarn does not,
// so the README's install commands must list it or a Yarn user hits "Unable to resolve module
// @quonfig/javascript" (qfg-goi1.2.24).
describe("README install line", () => {
  const readme = readFileSync(resolve(__dirname, "../../README.md"), "utf8");

  it.each(["npm install", "yarn add"])("`%s` installs the @quonfig/javascript peer", (cmd) => {
    const lines = readme.split("\n").filter((l) => l.includes(`${cmd} @quonfig/react`));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line).toContain("@quonfig/javascript");
    }
  });
});

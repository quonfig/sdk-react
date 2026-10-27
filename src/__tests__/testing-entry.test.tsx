import React from "react";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";

import * as root from "../index";
import * as testing from "../testing";

// 2.0.0 (qfg-qqkf): QuonfigTestProvider lives at @quonfig/react/testing so the
// test double stays out of the production bundle.
describe("@quonfig/react/testing entry", () => {
  const pkgRoot = resolve(__dirname, "../..");
  const pkg = JSON.parse(readFileSync(resolve(pkgRoot, "package.json"), "utf8"));

  it("exports QuonfigTestProvider from the testing entry", () => {
    expect(typeof testing.QuonfigTestProvider).toBe("function");
  });

  it("no longer exports QuonfigTestProvider from the root entry", () => {
    expect(Object.keys(root)).not.toContain("QuonfigTestProvider");
  });

  it("declares a ./testing subpath export whose built files exist", () => {
    const entry = pkg.exports["./testing"];
    expect(entry).toBeDefined();
    for (const field of ["types", "import", "require", "default"]) {
      expect(entry[field]).toBeDefined();
      expect(existsSync(resolve(pkgRoot, entry[field]))).toBe(true);
    }
  });

  it("built testing entry shares the root entry's context (useQuonfig sees the test config)", () => {
    // `yarn test` runs tsup first, so dist/ holds the published build. Without
    // a shared chunk the testing bundle would carry its own React context and
    // useQuonfig from the root entry would never see the test provider.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const builtRoot = require(resolve(pkgRoot, pkg.exports["."].require));
    const builtTesting = require(resolve(pkgRoot, pkg.exports["./testing"].require));
    /* eslint-enable @typescript-eslint/no-require-imports */

    const Greeting = () => {
      const { get } = builtRoot.useQuonfig();
      return <div role="alert">{get("greeting")}</div>;
    };

    render(
      <builtTesting.QuonfigTestProvider config={{ greeting: "hello from testing" }}>
        <Greeting />
      </builtTesting.QuonfigTestProvider>
    );

    expect(screen.getByRole("alert").textContent).toBe("hello from testing");
  });
});

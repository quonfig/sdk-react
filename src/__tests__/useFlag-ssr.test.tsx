/**
 * @jest-environment node
 */

/**
 * qfg-goi1.2.9: useFlag(key) must return the `initialFlags` value in the
 * server render. React reads `getServerSnapshot` there (and again during
 * client hydration), so a snapshot that ignores `initialFlags` renders the
 * default into the HTML and causes exactly the flicker `initialFlags` exists
 * to prevent.
 */

import React from "react";
import { renderToString } from "react-dom/server";
import { QuonfigProvider, useFlag } from "../index";

let warnSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

// One text node, so renderToString does not insert a `<!-- -->` separator.
const BannerFlag = () => <p>{`banner=${String(useFlag("banner"))}`}</p>;

describe("useFlag during server render (qfg-goi1.2.9)", () => {
  it("renders the initialFlags value into the server HTML", () => {
    const html = renderToString(
      <QuonfigProvider
        sdkKey="k"
        contextAttributes={{ user: { key: "alice" } }}
        initialFlags={{ banner: "for-alice" }}
      >
        <BannerFlag />
      </QuonfigProvider>
    );

    expect(html).toContain("banner=for-alice");
  });

  it("returns undefined for a key that is not in initialFlags", () => {
    const html = renderToString(
      <QuonfigProvider
        sdkKey="k"
        contextAttributes={{ user: { key: "bob" } }}
        initialFlags={{ other: 1 }}
      >
        <BannerFlag />
      </QuonfigProvider>
    );

    expect(html).toContain("banner=undefined");
  });

  it("a nested provider without initialFlags does not serve the outer provider's flags", () => {
    const html = renderToString(
      <QuonfigProvider
        sdkKey="k"
        contextAttributes={{ user: { key: "alice" } }}
        initialFlags={{ banner: "outer" }}
      >
        <QuonfigProvider sdkKey="k2" contextAttributes={{ user: { key: "alice" } }}>
          <BannerFlag />
        </QuonfigProvider>
      </QuonfigProvider>
    );

    expect(html).toContain("banner=undefined");
    expect(html).not.toContain("outer");
  });
});

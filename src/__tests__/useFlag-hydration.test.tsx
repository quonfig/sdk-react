/**
 * qfg-goi1.2.9: during client hydration React renders with
 * `getServerSnapshot`, not `getSnapshot`. useFlag must serve the provider's
 * `initialFlags` there, so the hydration pass matches the server HTML and the
 * first paint already shows the real value (no flicker). It must not read
 * the browser singleton there: a singleton that already holds other values
 * would not match what the server rendered.
 */

import React, { act } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { quonfig } from "@quonfig/javascript";
import { QuonfigProvider, useFlag } from "../index";

let warnSpy: ReturnType<typeof jest.spyOn>;
let errorSpy: ReturnType<typeof jest.spyOn>;
let root: Root | undefined;
let container: HTMLDivElement;

beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container.remove();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

const hydrate = (serverHtml: string, element: React.ReactElement) => {
  const rendered: string[] = [];
  const recoverableErrors: unknown[] = [];
  container.innerHTML = serverHtml;
  const Banner = () => {
    const text = `banner=${String(useFlag("banner"))}`;
    rendered.push(text);
    return <p>{text}</p>;
  };
  act(() => {
    root = hydrateRoot(container, React.cloneElement(element, {}, <Banner />), {
      onRecoverableError: (error) => recoverableErrors.push(error),
    });
  });
  return { rendered, recoverableErrors };
};

describe("useFlag during hydration (qfg-goi1.2.9)", () => {
  it("the hydration pass renders the initialFlags value and matches the server HTML", () => {
    const { rendered, recoverableErrors } = hydrate(
      "<p>banner=for-alice</p>",
      <QuonfigProvider
        sdkKey="k"
        contextAttributes={{ user: { key: "alice" } }}
        initialFlags={{ banner: "for-alice" }}
      />
    );

    expect(rendered[0]).toBe("banner=for-alice");
    expect(recoverableErrors).toEqual([]);
    expect(container.innerHTML).toBe("<p>banner=for-alice</p>");
  });

  it("does not read a pre-populated singleton during hydration", () => {
    // The browser singleton already holds `banner` (e.g. from an earlier
    // client-side load), but this page's initialFlags does not. The server
    // rendered the default, so the hydration pass must too.
    quonfig.hydrate({ banner: "stale-from-singleton" });

    const { rendered, recoverableErrors } = hydrate(
      "<p>banner=undefined</p>",
      <QuonfigProvider
        sdkKey="k"
        contextAttributes={{ user: { key: "alice" } }}
        initialFlags={{ other: 1 }}
      />
    );

    expect(rendered[0]).toBe("banner=undefined");
    expect(recoverableErrors).toEqual([]);
  });
});

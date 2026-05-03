/**
 * qfg-lkpm.6: regression coverage for replacing the module-level
 * `globalQuonfigIsTaken` flag with `QuonfigClientContext`. The flag never
 * reset on unmount, so a Provider that mounted, unmounted, and remounted at
 * the top of the tree would receive a fresh `Quonfig()` instance instead of
 * the module singleton — which silently broke `import { quonfig }` consumers
 * across Jest tests in the same file. The context-based approach keys off
 * the React tree, so an unmount cleanly releases the claim.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { quonfig as globalQuonfig, QuonfigProvider, useQuonfig } from "../index";

let warnSpy: ReturnType<typeof jest.spyOn>;
let errorSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => ({ evaluations: {} }),
    })
  ) as jest.Mock;
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

function HashView() {
  const { quonfig: client, loading } = useQuonfig();
  if (loading) return <div data-testid="hash">loading</div>;
  return <div data-testid="hash">{client.instanceHash}</div>;
}

describe("QuonfigClientContext (qfg-lkpm.6) — replaces module-level singleton flag", () => {
  it("a fresh top-level Provider mount uses the module singleton on every mount", async () => {
    const { unmount } = render(
      <QuonfigProvider sdkKey="key" contextAttributes={{ user: { id: "1" } }} onError={() => {}}>
        <HashView />
      </QuonfigProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("hash")).toHaveTextContent(globalQuonfig.instanceHash)
    );
    unmount();

    // Remount as a brand-new tree (no parent provider in the React tree —
    // so the QuonfigClientContext default `null` applies and this Provider
    // claims the singleton again). Under the old `globalQuonfigIsTaken`
    // flag, the second mount would have created a fresh `new Quonfig()`
    // and the assertion below would fail.
    render(
      <QuonfigProvider sdkKey="key" contextAttributes={{ user: { id: "2" } }} onError={() => {}}>
        <HashView />
      </QuonfigProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("hash")).toHaveTextContent(globalQuonfig.instanceHash)
    );
  });
});

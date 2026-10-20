/**
 * qfg-9p4i.5: a failed init must still start polling when pollInterval is set.
 *
 * Before the fix the provider called poll() only inside init().then, so if
 * every delivery leg failed at page load (and no last-known-good copy existed)
 * the tab served defaults for the rest of the session, even after delivery
 * recovered. Repro shape from the 2026-10-16 audit (repro A): 2 fetches at
 * failure, then 0 more over 400ms with a 50ms poll.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { QuonfigProvider, useQuonfig } from "../index";

let warnSpy: ReturnType<typeof jest.spyOn>;
let errorSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    window.localStorage.clear();
  } catch {
    // no storage: nothing to clear
  }
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

function Child() {
  const { get, loading } = useQuonfig();
  if (loading) return <div data-testid="state">loading</div>;
  return <div data-testid="state">{String(get("greeting") ?? "default")}</div>;
}

describe("QuonfigProvider polls after a failed init (qfg-9p4i.5)", () => {
  it("starts polling after init rejects and renders live values once delivery recovers", async () => {
    let failing = true;
    const fetchMock = jest.fn(() => {
      if (failing) return Promise.reject(new Error("network down"));
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => ({ evaluations: { greeting: { value: { type: "string", value: "LIVE" } } } }),
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const onError = jest.fn();

    const { unmount } = render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "poll-after-fail-user" } }}
        pollInterval={50}
        onError={onError}
      >
        <Child />
      </QuonfigProvider>
    );

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(screen.getByTestId("state")).toHaveTextContent("default");
    const callsAtFailure = fetchMock.mock.calls.length;

    // Delivery recovers.
    failing = false;

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("LIVE"), {
      timeout: 1000,
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAtFailure);

    unmount();
    const callsAtUnmount = fetchMock.mock.calls.length;
    await new Promise((r) => setTimeout(r, 200));
    expect(fetchMock.mock.calls.length).toBe(callsAtUnmount);
  });

  it("does not poll after a failed init when pollInterval is unset", async () => {
    const fetchMock = jest.fn(() => Promise.reject(new Error("network down")));
    global.fetch = fetchMock as unknown as typeof fetch;
    const onError = jest.fn();

    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "no-poll-user" } }}
        onError={onError}
      >
        <Child />
      </QuonfigProvider>
    );

    await waitFor(() => expect(onError).toHaveBeenCalled());
    const callsAtFailure = fetchMock.mock.calls.length;
    await new Promise((r) => setTimeout(r, 200));
    expect(fetchMock.mock.calls.length).toBe(callsAtFailure);
  });
});

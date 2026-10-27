/**
 * qfg-9p4i.11 (react part): useQuonfig() exposes isReady, error and source,
 * and QuonfigProvider passes onInitFailure / initTimeout through to
 * @quonfig/javascript's init().
 *
 * Repro shape from the 2026-10-16 audit (dead-client / default-mode): every
 * delivery leg is down at page load and there is no last-known-good copy. The
 * tab serves code defaults, and before this change nothing on useQuonfig()
 * said so: `loading` turned false exactly as on a healthy boot, and the init
 * error only reached onError. Spec: project/plans/2026-10-05-init-failure-design.md
 * (B.1, B.4).
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { QuonfigProvider, quonfig, useQuonfig } from "../index";
import { QuonfigTestProvider } from "../testing";

let warnSpy: ReturnType<typeof jest.spyOn>;
let errorSpy: ReturnType<typeof jest.spyOn>;
let infoSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
  infoSpy.mockRestore();
});

const liveResponse = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({ evaluations: { greeting: { value: { type: "string", value: "LIVE" } } } }),
  });

function Status() {
  const { get, loading, isReady, error, source } = useQuonfig();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="ready">{String(isReady)}</div>
      <div data-testid="error">{error ? error.message : "none"}</div>
      <div data-testid="source">{String(source)}</div>
      <div data-testid="greeting">{String(get("greeting") ?? "default")}</div>
    </div>
  );
}

describe("useQuonfig readiness (qfg-9p4i.11)", () => {
  it("dead-client repro: a failed init reports isReady=false, the error and source=defaults, then heals when delivery recovers", async () => {
    jest.useFakeTimers();
    let failing = true;
    const fetchMock = jest.fn(() =>
      failing ? Promise.reject(new Error("network down")) : liveResponse()
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const onError = jest.fn();

    const { unmount } = render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "readiness-dead-client" } }}
        pollInterval={1000}
        initTimeout={200}
        onError={onError}
      >
        <Status />
      </QuonfigProvider>
    );

    // Before init settles nothing is ready.
    expect(screen.getByTestId("ready")).toHaveTextContent("false");

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });

    expect(onError).toHaveBeenCalled();
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("greeting")).toHaveTextContent("default");
    // The dead-client state is visible to the app, not only to onError.
    expect(screen.getByTestId("ready")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).not.toHaveTextContent("none");
    expect(screen.getByTestId("source")).toHaveTextContent("defaults");

    // Delivery recovers: the client heals and the hook says so.
    failing = false;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(35_000);
    });

    expect(screen.getByTestId("greeting")).toHaveTextContent("LIVE");
    expect(screen.getByTestId("ready")).toHaveTextContent("true");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
    expect(screen.getByTestId("source")).toHaveTextContent("network");

    unmount();
  });

  it("a healthy init reports isReady=true, no error and source=network", async () => {
    global.fetch = jest.fn(liveResponse) as unknown as typeof fetch;

    const { unmount } = render(
      <QuonfigProvider sdkKey="sdk-key" contextAttributes={{ user: { key: "readiness-healthy" } }}>
        <Status />
      </QuonfigProvider>
    );

    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    expect(screen.getByTestId("greeting")).toHaveTextContent("LIVE");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
    expect(screen.getByTestId("source")).toHaveTextContent("network");
    unmount();
  });

  it("a returning visitor served from the last-known-good copy reports source=cache and isReady=false", async () => {
    const context = { user: { key: "readiness-cache" } };
    global.fetch = jest.fn(liveResponse) as unknown as typeof fetch;
    const first = render(
      <QuonfigProvider sdkKey="sdk-key" contextAttributes={context}>
        <Status />
      </QuonfigProvider>
    );
    // Wait for this visit's own fetch (the singleton may still hold an earlier
    // test's values), so it has seeded the last-known-good copy.
    await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
    first.unmount();

    // Next visit: delivery is down, the cached copy counts as config.
    global.fetch = jest.fn(() =>
      Promise.reject(new Error("network down"))
    ) as unknown as typeof fetch;
    const onError = jest.fn();
    const second = render(
      <QuonfigProvider sdkKey="sdk-key" contextAttributes={context} onError={onError}>
        <Status />
      </QuonfigProvider>
    );
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    expect(screen.getByTestId("greeting")).toHaveTextContent("LIVE");
    expect(screen.getByTestId("source")).toHaveTextContent("cache");
    expect(screen.getByTestId("ready")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
    second.unmount();
  });

  it("initialFlags (SSR hydration) counts as ready", () => {
    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "readiness-ssr" } }}
        initialFlags={{ greeting: "SSR" }}
      >
        <Status />
      </QuonfigProvider>
    );
    expect(screen.getByTestId("greeting")).toHaveTextContent("SSR");
    expect(screen.getByTestId("ready")).toHaveTextContent("true");
    expect(screen.getByTestId("source")).toHaveTextContent("network");
  });

  it("QuonfigTestProvider reports ready", () => {
    render(
      <QuonfigTestProvider config={{ greeting: "TEST" }}>
        <Status />
      </QuonfigTestProvider>
    );
    expect(screen.getByTestId("ready")).toHaveTextContent("true");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
    expect(screen.getByTestId("source")).toHaveTextContent("network");
  });
});

describe("onInitFailure / initTimeout pass-through (qfg-9p4i.11)", () => {
  it("passes onInitFailure and initTimeout to the client's init()", async () => {
    global.fetch = jest.fn(liveResponse) as unknown as typeof fetch;
    const initSpy = jest.spyOn(quonfig, "init");

    const { unmount } = render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "pass-through" } }}
        onInitFailure="continue"
        initTimeout={2500}
      >
        <Status />
      </QuonfigProvider>
    );

    await waitFor(() => expect(initSpy).toHaveBeenCalled());
    expect(initSpy.mock.calls[0][0]).toEqual(
      expect.objectContaining({ onInitFailure: "continue", initTimeout: 2500 })
    );
    unmount();
  });

  it("leaves both unset by default so @quonfig/javascript applies its defaults (fail, 5s)", async () => {
    global.fetch = jest.fn(liveResponse) as unknown as typeof fetch;
    const initSpy = jest.spyOn(quonfig, "init");

    const { unmount } = render(
      <QuonfigProvider sdkKey="sdk-key" contextAttributes={{ user: { key: "pass-through-2" } }}>
        <Status />
      </QuonfigProvider>
    );

    await waitFor(() => expect(initSpy).toHaveBeenCalled());
    const options = initSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(options.onInitFailure).toBeUndefined();
    expect(options.initTimeout).toBeUndefined();
    unmount();
  });
});

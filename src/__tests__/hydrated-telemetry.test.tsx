/**
 * qfg-6vno.9: a provider seeded from `initialFlags` (SSR hydration) must still
 * connect in the browser. Before the fix the hydrate path skipped init(), so
 * the client never polled (even with `pollInterval`) and never created its
 * telemetry reporter: every browser evaluation in a Next.js app went
 * unreported, and a flag in live use looked unused.
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { Quonfig } from "@quonfig/javascript";
import { QuonfigProvider, useFlag, useQuonfig } from "../index";

let warnSpy: ReturnType<typeof jest.spyOn>;
let errorSpy: ReturnType<typeof jest.spyOn>;
let fetchMock: jest.Mock;

const deliveryCalls = () =>
  fetchMock.mock.calls.filter(([url]) => !String(url).includes("/api/v1/telemetry"));
const telemetryBodies = () =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).includes("/api/v1/telemetry"))
    .map(([, init]) => String((init as RequestInit | undefined)?.body ?? ""));

beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  fetchMock = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ evaluations: { g: { value: { type: "string", value: "seed" } } } }),
    })
  );
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

function Probe({ capture }: { capture: (q: Quonfig) => void }) {
  const { quonfig, loading } = useQuonfig();
  capture(quonfig as unknown as Quonfig);
  const g = useFlag("g");
  return (
    <div>
      <p data-testid="g">{String(g)}</p>
      <p data-testid="loading">{String(loading)}</p>
    </div>
  );
}

describe("initialFlags hydration connects in the browser (qfg-6vno.9)", () => {
  it("starts polling when pollInterval is set", async () => {
    let client: Quonfig | undefined;
    const { unmount } = render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "hydrated-poll" } }}
        initialFlags={{ g: "seed" }}
        pollInterval={50}
        onError={() => {}}
      >
        <Probe capture={(q) => (client = q)} />
      </QuonfigProvider>
    );

    // The seed paints at once, with no loading state.
    expect(screen.getByTestId("g")).toHaveTextContent("seed");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");

    await waitFor(() => expect(client!.pollStatus.status).toBe("running"));
    await waitFor(() => expect(deliveryCalls().length).toBeGreaterThanOrEqual(2));
    expect(warnSpy).not.toHaveBeenCalledWith(
      "Polling is not supported when hydrating flags via initialFlags"
    );

    await act(async () => {
      unmount();
      await Promise.resolve();
    });
  });

  it("reports hydrated evaluations to telemetry", async () => {
    let client: Quonfig | undefined;
    const { unmount } = render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "hydrated-telemetry" } }}
        initialFlags={{ g: "seed" }}
        onError={() => {}}
      >
        <Probe capture={(q) => (client = q)} />
      </QuonfigProvider>
    );

    expect(screen.getByTestId("g")).toHaveTextContent("seed");
    await waitFor(() => expect(client!.isReady()).toBe(true));

    // close() on unmount drains the reporter: the evaluation of `g` must be
    // in a telemetry POST.
    await act(async () => {
      unmount();
      await new Promise((r) => setTimeout(r, 20));
    });

    // One mount evaluation, counted once: the hydrated read is recorded
    // against the network config for `g` when it lands (qfg-27wr).
    const gCount = telemetryBodies()
      .flatMap((body) => JSON.parse(body).events)
      .flatMap((e: any) => e.summaries.summaries)
      .filter((s: any) => s.key === "g")
      .flatMap((s: any) => s.counters)
      .reduce((n: number, c: any) => n + c.count, 0);
    expect(gCount).toBe(1);
  });

  it("keeps the seed and reaches onError once initTimeout elapses when the init fetch fails", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve({ ok: false, status: 500, headers: new Headers(), json: async () => ({}) })
    );
    const onError = jest.fn();
    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { key: "hydrated-init-500" } }}
        initialFlags={{ g: "seed" }}
        initTimeout={200}
        onError={onError}
      >
        <Probe capture={() => {}} />
      </QuonfigProvider>
    );

    // init() retries until initTimeout (default 5s) before it rejects, so
    // onError comes at the deadline, not on the first failed fetch.
    expect(onError).not.toHaveBeenCalled();
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(String(onError.mock.calls[0][0])).toContain("init FAILED");
    expect(screen.getByTestId("g")).toHaveTextContent("seed");
  });
});

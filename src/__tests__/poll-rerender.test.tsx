/**
 * qfg-daxq: poll updates must re-render Provider subscribers.
 * qfg-2acr: provider unmount must drain telemetry + stop polling/telemetry timers.
 *
 * The original Provider only re-rendered on contextKey/loading/instanceHash/
 * settings changes — poll-driven mutations to the underlying singleton were
 * invisible to React. The fix wires `Quonfig.subscribe()` (added in
 * sdk-javascript@0.0.14) through `useSyncExternalStore` and adds a mount-only
 * cleanup that calls `quonfigClient.close()`.
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { Quonfig } from "@quonfig/javascript";
import { QuonfigProvider, useQuonfig } from "../index";

let warnSpy: ReturnType<typeof jest.spyOn>;
let errorSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
});

const stubFetch = (initial: Record<string, unknown> = {}) => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => ({ evaluations: initial }),
    })
  ) as jest.Mock;
};

function CapturingChild({ capture }: { capture: (q: Quonfig) => void }) {
  const { quonfig, get, loading } = useQuonfig();
  // Capture during render so the test can grab the active client without
  // waiting on an effect tick. quonfig identity is stable across renders.
  capture(quonfig as unknown as Quonfig);

  if (loading) return <div data-testid="state">loading</div>;
  return <div data-testid="state">{String(get("greeting") ?? "default")}</div>;
}

describe("QuonfigProvider re-renders on poll updates (qfg-daxq)", () => {
  it("flips rendered value when underlying client setConfig fires", async () => {
    stubFetch({ greeting: { value: { type: "string", value: "INITIAL" } } });

    let client: Quonfig | undefined;

    render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { email: "test@example.com" } }}
        onError={() => {}}
      >
        <CapturingChild
          capture={(q) => {
            client = q;
          }}
        />
      </QuonfigProvider>
    );

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("INITIAL"));
    expect(client).toBeDefined();

    // Simulate a poll cycle landing a new payload — exactly what poll() does
    // internally after a successful fetch.
    act(() => {
      client!.setConfig({
        evaluations: { greeting: { value: { type: "string", value: "POLLED" } } },
      } as any);
    });

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("POLLED"));

    // And again — confirm we re-render every cycle, not just once.
    act(() => {
      client!.setConfig({
        evaluations: { greeting: { value: { type: "string", value: "POLLED-AGAIN" } } },
      } as any);
    });

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("POLLED-AGAIN"));
  });
});

describe("QuonfigProvider tears down on unmount (qfg-2acr)", () => {
  it("calls quonfigClient.close() and stops polling on unmount", async () => {
    stubFetch();

    const closeSpy = jest.spyOn(Quonfig.prototype, "close");

    let client: Quonfig | undefined;

    const { unmount } = render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { email: "test@example.com" } }}
        onError={() => {}}
      >
        <CapturingChild
          capture={(q) => {
            client = q;
          }}
        />
      </QuonfigProvider>
    );

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("default"));
    expect(client).toBeDefined();

    closeSpy.mockClear();

    await act(async () => {
      unmount();
      // close() is async; let microtasks flush
      await Promise.resolve();
    });

    expect(closeSpy).toHaveBeenCalled();
    expect(client!.pollStatus.status).toBe("stopped");

    closeSpy.mockRestore();
  });
});

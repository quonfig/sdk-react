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
      status: 200,
      headers: new Headers(),
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

describe("QuonfigProvider unmounted during init (qfg-goi1.2.8)", () => {
  it("does not start polling when init resolves after unmount", async () => {
    let releaseFirstFetch!: () => void;
    const firstFetchGate = new Promise<void>((resolve) => {
      releaseFirstFetch = resolve;
    });
    const response = {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => ({ evaluations: {} }),
    };
    let calls = 0;
    global.fetch = jest.fn(() => {
      calls += 1;
      // Hold the init fetch open so the provider unmounts mid-init; any later
      // fetch (a poll) resolves immediately.
      return calls === 1 ? firstFetchGate.then(() => response) : Promise.resolve(response);
    }) as jest.Mock;

    let client: Quonfig | undefined;

    const { unmount } = render(
      <QuonfigProvider
        sdkKey="sdk-key"
        contextAttributes={{ user: { email: "test@example.com" } }}
        pollInterval={20}
        onError={() => {}}
      >
        <CapturingChild
          capture={(q) => {
            client = q;
          }}
        />
      </QuonfigProvider>
    );
    expect(client).toBeDefined();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    await act(async () => {
      releaseFirstFetch();
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const fetchesAfterInit = (global.fetch as jest.Mock).mock.calls.length;

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect({
      pollStatus: client!.pollStatus.status,
      fetchesSinceInit: (global.fetch as jest.Mock).mock.calls.length - fetchesAfterInit,
    }).toEqual({ pollStatus: "stopped", fetchesSinceInit: 0 });
    client!.stopPolling();
  });
});

describe("QuonfigProvider under StrictMode (qfg-goi1.2.8)", () => {
  it("still loads and starts polling after the synthetic unmount/remount", async () => {
    stubFetch({ greeting: { value: { type: "string", value: "STRICT" } } });

    let client: Quonfig | undefined;

    const { unmount } = render(
      <React.StrictMode>
        <QuonfigProvider
          sdkKey="sdk-key"
          contextAttributes={{ user: { email: "test@example.com" } }}
          pollInterval={20}
          onError={() => {}}
        >
          <CapturingChild
            capture={(q) => {
              client = q;
            }}
          />
        </QuonfigProvider>
      </React.StrictMode>
    );

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("STRICT"));
    await waitFor(() => expect(client!.pollStatus.status).toBe("running"));

    await act(async () => {
      unmount();
      await Promise.resolve();
    });
    expect(client!.pollStatus.status).toBe("stopped");
  });
});

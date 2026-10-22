/**
 * qfg-6vno.10: useFlag reads its useSyncExternalStore snapshot with the
 * client's non-recording `peek()` and records one evaluation (one `get()`)
 * per committed value, not one per snapshot read. React calls getSnapshot on
 * every render, on every store notification and twice per render in dev, so
 * reading it with `get()` inflated evaluation summaries and
 * afterEvaluationCallback calls in proportion to config churn.
 */

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import { Quonfig } from "@quonfig/javascript";
import { QuonfigProvider, useFlag, useQuonfig } from "../index";

type Peekable = { peek?: (key: string) => unknown };
const proto = Quonfig.prototype as unknown as Peekable & Record<string, any>;
const nativePeek = proto.peek;

// @quonfig/javascript gains peek() in its next minor. Until the peer floor
// moves, give older installs the same semantics so this test exercises the
// peek path; restore the prototype afterwards.
function ensurePeek() {
  if (typeof nativePeek !== "function") {
    proto.peek = function peek(this: any, key: string) {
      if (!this.loaded) return undefined;
      return this.configs[key]?.value;
    };
  }
}
function restorePeek() {
  if (nativePeek === undefined) delete proto.peek;
  else proto.peek = nativePeek;
}

let warnSpy: ReturnType<typeof jest.spyOn>;
let errorSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
  jest.restoreAllMocks();
  restorePeek();
});

const initialPayload = {
  foo: { value: { type: "string", value: "FOO_INITIAL" } },
  bar: { value: { type: "string", value: "BAR_0" } },
};

const stubFetch = () => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ evaluations: initialPayload }),
    })
  ) as jest.Mock;
};

const flushTimers = () => new Promise((resolve) => setTimeout(resolve, 0));

async function mountFoo() {
  stubFetch();
  const callbackKeys: string[] = [];
  let client: Quonfig | undefined;
  let fooRenders = 0;

  function FooView() {
    const value = useFlag("foo");
    fooRenders += 1;
    return <div data-testid="foo">{String(value)}</div>;
  }
  function ClientCapture() {
    const { quonfig } = useQuonfig();
    client = quonfig as Quonfig;
    return null;
  }

  render(
    <QuonfigProvider
      sdkKey="sdk-key"
      contextAttributes={{ user: { id: "1" } }}
      onError={() => {}}
      afterEvaluationCallback={(key: string) => {
        callbackKeys.push(key);
      }}
    >
      <FooView />
      <ClientCapture />
    </QuonfigProvider>
  );

  await waitFor(() => expect(screen.getByTestId("foo")).toHaveTextContent("FOO_INITIAL"));
  await act(flushTimers);

  return {
    client: () => client!,
    fooCallbacks: () => callbackKeys.filter((k) => k === "foo").length,
    fooRenders: () => fooRenders,
  };
}

describe("useFlag evaluation recording (qfg-6vno.10)", () => {
  it("does not record an evaluation for snapshot reads when the value did not change", async () => {
    ensurePeek();
    const t = await mountFoo();
    const peekSpy = jest.spyOn(t.client() as unknown as Required<Peekable>, "peek");
    const getSpy = jest.spyOn(t.client(), "get");
    const callbacksBefore = t.fooCallbacks();
    const rendersBefore = t.fooRenders();

    // Five installs that leave `foo` unchanged: React re-reads every mounted
    // snapshot on each notification, but nothing new is consumed.
    for (let i = 1; i <= 5; i++) {
      act(() => {
        t.client().setConfig({
          evaluations: {
            ...initialPayload,
            bar: { value: { type: "string", value: `BAR_${i}` } },
          },
        } as any);
      });
    }
    await act(flushTimers);

    expect(peekSpy.mock.calls.some(([k]) => k === "foo")).toBe(true);
    expect(getSpy.mock.calls.filter(([k]) => k === "foo")).toHaveLength(0);
    expect(t.fooCallbacks() - callbacksBefore).toBe(0);
    expect(t.fooRenders()).toBe(rendersBefore);
  });

  it("records exactly one evaluation per committed value change", async () => {
    ensurePeek();
    const t = await mountFoo();
    const getSpy = jest.spyOn(t.client(), "get");
    const callbacksBefore = t.fooCallbacks();

    act(() => {
      t.client().setConfig({
        evaluations: {
          ...initialPayload,
          foo: { value: { type: "string", value: "FOO_UPDATED" } },
        },
      } as any);
    });
    await waitFor(() => expect(screen.getByTestId("foo")).toHaveTextContent("FOO_UPDATED"));
    await act(flushTimers);

    expect(getSpy.mock.calls.filter(([k]) => k === "foo")).toHaveLength(1);
    expect(t.fooCallbacks() - callbacksBefore).toBe(1);
  });

  it("falls back to get() for snapshots on a client without peek()", async () => {
    delete proto.peek;
    const t = await mountFoo();
    const getSpy = jest.spyOn(t.client(), "get");

    act(() => {
      t.client().setConfig({
        evaluations: {
          ...initialPayload,
          foo: { value: { type: "string", value: "FOO_UPDATED" } },
        },
      } as any);
    });
    await waitFor(() => expect(screen.getByTestId("foo")).toHaveTextContent("FOO_UPDATED"));

    // The value still flows; the hook adds no extra get() of its own on top
    // of the snapshot reads, so a legacy client is never double-counted.
    expect(getSpy.mock.calls.some(([k]) => k === "foo")).toBe(true);
  });
});
